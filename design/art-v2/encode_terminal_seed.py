#!/usr/bin/env python3
"""Convert the reviewed terminal seed PNGs into no-image pixel handoff data."""
from __future__ import annotations

import json
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = ROOT / "design" / "art-v2"
ROW_CHARS = ".0123456789ab"
PALETTE = [
    "transparent",
    "#2A1D1A",
    "#4A2B24",
    "#704739",
    "#FFD0B4",
    "#4BA9FF",
    "#153A78",
    "#242634",
    "#F1E8DF",
    "#C52F3C",
    "#141820",
    "#4B2624",
    "#17141B",
]


def read_rgba(path: Path) -> tuple[int, int, list[tuple[int, int, int, int]]]:
    data = path.read_bytes()
    pos = 8
    idat = bytearray()
    width = height = channels = None
    while pos < len(data):
        length = struct.unpack(">I", data[pos : pos + 4])[0]
        kind = data[pos + 4 : pos + 8]
        payload = data[pos + 8 : pos + 8 + length]
        pos += length + 12
        if kind == b"IHDR":
            width, height, depth, color_type, _, _, interlace = struct.unpack(">IIBBBBB", payload)
            if depth != 8 or color_type != 6 or interlace != 0:
                raise ValueError("expected non-interlaced 8-bit RGBA PNG")
            channels = 4
        elif kind == b"IDAT":
            idat.extend(payload)
    if width is None or height is None or channels is None:
        raise ValueError("missing PNG header")
    raw = zlib.decompress(idat)
    stride = width * channels
    previous = [0] * stride
    offset = 0
    pixels: list[tuple[int, int, int, int]] = []
    for _ in range(height):
        filter_type = raw[offset]
        offset += 1
        current = list(raw[offset : offset + stride])
        offset += stride
        for index in range(stride):
            left = current[index - channels] if index >= channels else 0
            up = previous[index]
            up_left = previous[index - channels] if index >= channels else 0
            if filter_type == 1:
                current[index] = (current[index] + left) & 255
            elif filter_type == 2:
                current[index] = (current[index] + up) & 255
            elif filter_type == 3:
                current[index] = (current[index] + ((left + up) // 2)) & 255
            elif filter_type == 4:
                estimate = left + up - up_left
                distances = (abs(estimate - left), abs(estimate - up), abs(estimate - up_left))
                predictor = (left, up, up_left)[distances.index(min(distances))]
                current[index] = (current[index] + predictor) & 255
            elif filter_type != 0:
                raise ValueError(f"unsupported PNG filter {filter_type}")
        for x in range(width):
            base = x * channels
            pixels.append(tuple(current[base : base + 4]))  # type: ignore[arg-type]
        previous = current
    return width, height, pixels


def write_rgba(path: Path, width: int, height: int, pixels: list[tuple[int, int, int, int]]) -> None:
    raw = b"".join(b"\x00" + bytes(sum((list(pixel) for pixel in pixels[y * width : (y + 1) * width]), [])) for y in range(height))
    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)

    def chunk(kind: bytes, payload: bytes) -> bytes:
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)

    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def rgb(hex_color: str) -> tuple[int, int, int]:
    return tuple(int(hex_color[index : index + 2], 16) for index in (1, 3, 5))  # type: ignore[return-value]


PALETTE_RGB = [None if color == "transparent" else rgb(color) for color in PALETTE]


def quantize(width: int, height: int, pixels: list[tuple[int, int, int, int]]) -> list[str]:
    rows: list[str] = []
    for y in range(height):
        chars = []
        for x in range(width):
            r, g, b, alpha = pixels[y * width + x]
            if alpha < 20:
                chars.append(".")
                continue
            distances = [
                sum((channel - target) ** 2 for channel, target in zip((r, g, b), target_rgb))
                for target_rgb in PALETTE_RGB[1:]
                if target_rgb is not None
            ]
            chars.append(ROW_CHARS[1 + distances.index(min(distances))])
        rows.append("".join(chars))
    return rows


def resample_master(path: Path, dimension: int) -> list[tuple[int, int, int, int]]:
    width, height, pixels = read_rgba(path)
    visible = [index for index, pixel in enumerate(pixels) if pixel[3] >= 80]
    left = min(index % width for index in visible)
    right = max(index % width for index in visible) + 1
    top = min(index // width for index in visible)
    bottom = max(index // width for index in visible) + 1
    target_width, target_height = ((20, 23) if dimension == 24 else (14, 15))
    offset_x, offset_y = (dimension - target_width) // 2, 1 if dimension == 24 else 0
    output = [(0, 0, 0, 0)] * (dimension * dimension)
    palette_rgb = [color for color in PALETTE_RGB[1:] if color is not None]
    for y in range(target_height):
        for x in range(target_width):
            x0 = left + int(x * (right - left) / target_width)
            x1 = left + max(x0 + 1, int((x + 1) * (right - left) / target_width))
            y0 = top + int(y * (bottom - top) / target_height)
            y1 = top + max(y0 + 1, int((y + 1) * (bottom - top) / target_height))
            samples = [pixels[sy * width + sx] for sy in range(y0, min(y1, height)) for sx in range(x0, min(x1, width)) if pixels[sy * width + sx][3] >= 80]
            if not samples or len(samples) / max(1, (x1 - x0) * (y1 - y0)) < 0.22:
                continue
            average = tuple(sum(sample[channel] for sample in samples) // len(samples) for channel in range(3))
            nearest = min(palette_rgb, key=lambda target: sum((channel - value) ** 2 for channel, value in zip(average, target)))
            output[(offset_y + y) * dimension + offset_x + x] = (*nearest, 255)
    return output


def encode_existing(path: Path) -> list[str]:
    width, height, pixels = read_rgba(path)
    return quantize(width, height, pixels)


def ascii_preview(rows: list[str]) -> str:
    # Use a high-contrast monochrome view for agents that cannot inspect color.
    dark = set("012679ab")
    return "\n".join("".join("  " if char == "." else "██" if char in dark else "▓▓" for char in row) for row in rows)


def main() -> None:
    # Seed PNGs are generated separately with nearest-neighbour scaling. This
    # encoder only turns them into textual rows; a developer can replace these
    # rows with a hand-cleaned matrix without changing the handoff format.
    regular = encode_existing(HERE / "shigure-v3-terminal-seed-24.png")
    compact = encode_existing(HERE / "shigure-v3-terminal-seed-16.png")
    payload = {
        "source": "shigure-v3-master-crop.png",
        "palette": [{"index": index, "char": ROW_CHARS[index], "color": color} for index, color in enumerate(PALETTE)],
        "sizes": {
            "regular": {"width": 24, "height": 24, "idle_frame": regular},
            "compact": {"width": 16, "height": 16, "idle_frame": compact},
        },
        "states": {
            "idle": "base silhouette; frame 2 changes one eye/bang pixel only",
            "thinking": "move both blue eye clusters one pixel upward and tilt the fringe one pixel",
            "working": "move both forearms inward; keep skirt, socks, boots and hair baseline fixed",
            "waiting": "raise face one pixel and bring hands together below the ribbon",
            "success": "move complete boot/foot groups upward by one logical pixel; no ground line",
            "error": "lower head and shoulders; narrow eyes but retain one blue pixel per eye group",
            "retry": "alternate a one-pixel horizontal lean of the upper body between frames",
        },
    }
    (HERE / "shigure-pixel-data.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# 时雨无图像像素交接数据",
        "",
        "这份文件是给不能查看 PNG 的 Agent 使用的规范。PNG 是视觉母稿；以下行字符串才是可直接实现的像素输入。",
        "",
        "## 调色板与图例",
        "",
        "| 索引 | 字符 | 颜色 | 语义 |",
        "|---:|:---:|:---|:---|",
    ]
    meanings = ["transparent", "hair_shadow", "hair_base", "hair_light", "skin", "eye_blue", "eye_deep", "uniform", "trim_warm_white", "ribbon_red", "sock_black", "boot_red_brown", "outline"]
    for index, color in enumerate(PALETTE):
        lines.append(f"| {index} | `{ROW_CHARS[index]}` | `{color}` | `{meanings[index]}` |")
    lines += ["", "## Regular 24×24 idle seed", "", "```text", *regular, "```", "", "### Regular monochrome silhouette", "", "```text", ascii_preview(regular), "```", "", "## Compact 16×16 idle seed", "", "```text", *compact, "```", "", "### Compact monochrome silhouette", "", "```text", ascii_preview(compact), "```", "", "## 七状态无图动作契约", ""]
    for state, description in payload["states"].items():
        lines.append(f"- `{state}`：{description}。")
    lines += ["", "## 实现边界", "", "- 两档尺寸必须独立修整，不能把 regular 缩放后直接当 compact。", "- 每个状态都继承 idle 的宽发、椭圆脸、双蓝眼、单侧细辫、白侧板、红长领结、裙袜靴分层。", "- 运行期使用编译后的索引矩阵；不在 TUI 内读取 PNG。", "- 若美术 Agent 要调整像素，必须先更新 JSON 和本文件的行字符串，再更新运行时资产。"]
    (HERE / "shigure-pixel-data.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("wrote design/art-v2/shigure-pixel-data.json")
    print("wrote design/art-v2/shigure-pixel-data.md")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Extract clean, reviewable pixel-art masters from the approved concept boards.

This is design tooling only. It never touches src/ or the plugin runtime. The
concept boards place a large 24-ish pixel sprite on a dark grid; the extractor
removes neutral grid/background pixels and keeps colored character pixels plus a
small outline dilation. The result is a visual master for a later deterministic
terminal trace, not a PNG decoder used by the plugin.
"""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "design" / "art-v2"


def read_png(path: Path) -> tuple[int, int, list[tuple[int, int, int]]]:
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
            if depth != 8 or color_type not in (2, 6) or interlace != 0:
                raise ValueError("only non-interlaced 8-bit RGB/RGBA PNGs are supported")
            channels = 3 if color_type == 2 else 4
        elif kind == b"IDAT":
            idat.extend(payload)
    if width is None or height is None or channels is None:
        raise ValueError("missing PNG header")
    raw = zlib.decompress(idat)
    stride = width * channels
    rows: list[list[int]] = []
    previous = [0] * stride
    offset = 0
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
                left_distance = abs(estimate - left)
                up_distance = abs(estimate - up)
                diagonal_distance = abs(estimate - up_left)
                predictor = left if left_distance <= up_distance and left_distance <= diagonal_distance else up if up_distance <= diagonal_distance else up_left
                current[index] = (current[index] + predictor) & 255
            elif filter_type != 0:
                raise ValueError(f"unsupported PNG filter {filter_type}")
        rows.append(current)
        previous = current
    pixels = []
    for row in rows:
        for x in range(width):
            base = x * channels
            pixels.append(tuple(row[base : base + 3]))
    return width, height, pixels


def write_png(path: Path, width: int, height: int, pixels: list[tuple[int, int, int, int]]) -> None:
    raw = b"".join(b"\x00" + bytes(sum((list(pixel) for pixel in pixels[y * width : (y + 1) * width]), [])) for y in range(height))
    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)

    def chunk(kind: bytes, payload: bytes) -> bytes:
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)

    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def extract(source: Path, output: Path) -> None:
    width, height, source_pixels = read_png(source)
    # The lower-left board is an unambiguous front-facing sprite panel in both
    # approved concepts. Coordinates are intentionally kept here, not in app code.
    crop_x, crop_y, crop_w, crop_h = 350, 710, 190, 275
    if crop_x + crop_w > width or crop_y + crop_h > height:
        raise ValueError(f"crop outside {source} ({width}x{height})")
    cropped: list[tuple[int, int, int, int]] = []
    seed: list[bool] = []
    for y in range(crop_y, crop_y + crop_h):
        for x in range(crop_x, crop_x + crop_w):
            r, g, b = source_pixels[y * width + x]
            saturation = max(r, g, b) - min(r, g, b)
            # Neutral charcoal panel and gray grid are rejected. Brown hair,
            # navy cloth, warm skin, red ribbon and blue eyes remain seeds.
            is_subject = saturation >= 7 and max(r, g, b) >= 24
            seed.append(is_subject)
            cropped.append((r, g, b, 0))
    # Restore a narrow dark outline around colored pixels, including black hair
    # contours that are close to the neutral threshold.
    expanded = seed[:]
    for index, present in enumerate(seed):
        if not present:
            continue
        x = index % crop_w
        y = index // crop_w
        for dy in range(-3, 4):
            for dx in range(-3, 4):
                if dx * dx + dy * dy > 10:
                    continue
                nx, ny = x + dx, y + dy
                if 0 <= nx < crop_w and 0 <= ny < crop_h:
                    expanded[ny * crop_w + nx] = True
    keep_mask = []
    for index, pixel in enumerate(cropped):
        r, g, b, _ = pixel
        # Dilation may land on a neutral grid line. Keep only dark neutral
        # outline pixels there; brighter neutral grid strokes stay transparent.
        keep = seed[index] or (expanded[index] and max(r, g, b) < 25)
        keep_mask.append(keep)

    # Remove isolated extraction noise and grid remnants. The character is the
    # component with the largest number of saturated seed pixels; small seeded
    # components close to it (for example the loose braid tip) are retained.
    components: list[list[int]] = []
    visited = [False] * len(keep_mask)
    for start, present in enumerate(keep_mask):
        if not present or visited[start]:
            continue
        stack = [start]
        visited[start] = True
        component: list[int] = []
        while stack:
            index = stack.pop()
            component.append(index)
            x, y = index % crop_w, index // crop_w
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    neighbour = ny * crop_w + nx
                    if 0 <= nx < crop_w and 0 <= ny < crop_h and keep_mask[neighbour] and not visited[neighbour]:
                        visited[neighbour] = True
                        stack.append(neighbour)
        components.append(component)
    main = max(components, key=lambda component: sum(seed[index] for index in component))
    main_xs = [index % crop_w for index in main]
    main_ys = [index // crop_w for index in main]
    main_left, main_right = min(main_xs), max(main_xs)
    main_top, main_bottom = min(main_ys), max(main_ys)
    selected = set(main)
    for component in components:
        if component is main:
            continue
        seeded = [index for index in component if seed[index]]
        if not seeded:
            continue
        xs = [index % crop_w for index in component]
        ys = [index // crop_w for index in component]
        close = max(xs) >= main_left - 18 and min(xs) <= main_right + 18 and max(ys) >= main_top - 18 and min(ys) <= main_bottom + 18
        if close and len(seeded) >= 2:
            selected.update(component)

    result = []
    for index, pixel in enumerate(cropped):
        r, g, b, _ = pixel
        result.append((r, g, b, 255 if index in selected else 0))
    # Trim transparent margins, then add a stable review margin.
    xs = [index % crop_w for index in selected]
    ys = [index // crop_w for index in selected]
    left, right = max(0, min(xs) - 12), min(crop_w, max(xs) + 13)
    top, bottom = max(0, min(ys) - 12), min(crop_h, max(ys) + 13)
    trimmed = []
    for y in range(top, bottom):
        trimmed.extend(result[y * crop_w + left : y * crop_w + right])
    write_png(output, right - left, bottom - top, trimmed)


def main() -> None:
    extract(ROOT / "design/samples/shigure-concept-a-rounded-v3.png", OUT / "shigure-v3-master-crop.png")
    extract(ROOT / "design/samples/shigure-concept-a-uniform-v2.png", OUT / "shigure-v2-uniform-crop.png")
    print("wrote design/art-v2/shigure-v3-master-crop.png")
    print("wrote design/art-v2/shigure-v2-uniform-crop.png")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Render the art-preview-*.txt ANSI truecolor previews to PNG evidence.

Each terminal cell is drawn as a rectangle: for '▀' the top half uses fg and the
bottom half bg; for '▄' the bottom half uses fg; for '█' both halves use fg;
spaces use the terminal background. Half-block semantics match src/renderer.ts
(TOP_GLYPH/BOTTOM_GLYPH). Requires PIL (Pillow); skips a file if PIL is absent.
Usage: python3 art-render-png.py [file.txt ...]
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CELL_W, CELL_H = 14, 28
PANEL_PAD = 10
LABEL_H = 34
COLS = 4

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("PIL not available; skipping PNG render")
    sys.exit(0)

SGR_RE = re.compile(r"\x1b\[([0-9;]*)m")
DARK_BG = (11, 14, 20)      # #0b0e14, xterm dark theme background
LIGHT_BG = (247, 242, 234)  # #F7F2EA, light preview outline == light theme bg

# --- per-cell index text (T1 render-consistency, todo 2) ---------------------
# charset .0123456789ab = palette indices 0..12, mirroring src/assets/final.ts
# ROW_CHARS / decodeRow semantics. Must stay in sync with src/manifest-data.ts
# SHIGURE_PALETTE (index 0 = transparent). Used for mechanical cross-path diff;
# the PNG itself is never decoded (no PNG decoder dependency).
INDEX_CHARS = ".0123456789ab"
PALETTE_HEX = [
    "#2a1d1a",  # 1 hairShadow
    "#4a2b24",  # 2 hairBase
    "#704739",  # 3 hairLight
    "#ffd0b4",  # 4 skin
    "#4ba9ff",  # 5 eyeBlue
    "#153a78",  # 6 eyeDeep
    "#242634",  # 7 uniform
    "#f1e8df",  # 8 trimWarmWhite
    "#c52f3c",  # 9 ribbonRed
    "#141820",  # 10 sockBlack
    "#4b2624",  # 11 bootRedBrown
    "#17141b",  # 12 outline (== preview outline #17141B)
]
MAG = 2  # pixel magnification factor for the index text grid


def color_index(color):
    """SGR rgb tuple -> palette index (0 = transparent when color is None)."""
    if color is None:
        return 0
    return PALETTE_HEX.index("#%02x%02x%02x" % color) + 1


def cell_top_bottom(ch, fg, bg):
    """Half-block cell -> (top, bottom) palette indices (renderFrame semantics).

    ' ' -> transparent/transparent; '▀' -> fg over (bg or transparent);
    '▄' -> transparent over fg; '█' -> fg over fg.
    """
    if ch == " ":
        return 0, 0
    if ch == "\u2580":  # ▀
        return color_index(fg), color_index(bg)
    if ch == "\u2584":  # ▄
        return 0, color_index(fg)
    if ch == "\u2588":  # █
        index = color_index(fg)
        return index, index
    raise ValueError("unexpected glyph %r" % ch)


def write_index_text(frames, path):
    """Emit per-cell palette index text, each logical pixel magnified MAGxMAG."""
    lines = [
        "# render-consistency-png-index: per-cell palette index text derived from art-preview-regular.txt ANSI",
        "# charset: .0123456789ab = palette indices 0..12 (0 = transparent); each logical pixel magnified %dx%d"
        % (MAG, MAG),
    ]
    for state, flabel, rows in frames:
        lines.append("## %s %s (%dx%d logical, %dx%d magnified)" % (state, flabel, len(rows[0]), len(rows), MAG, MAG))
        for row in rows:
            top_indices, bottom_indices = [], []
            for ch, fg, bg in row:
                top, bottom = cell_top_bottom(ch, fg, bg)
                top_indices.append(top)
                bottom_indices.append(bottom)
            for indices in (top_indices, bottom_indices):
                text = "".join(INDEX_CHARS[i] * MAG for i in indices)
                # vertical magnification: each logical pixel row -> MAG text rows
                lines.extend([text] * MAG)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("wrote %s (%d frames)" % (path, len(frames)))


def parse_sgr(params: str):
    fg = bg = None
    parts = params.split(";")
    i = 0
    while i < len(parts):
        if parts[i] == "38" and i + 3 < len(parts) and parts[i + 1] == "2":
            fg = tuple(int(x) for x in parts[i + 2 : i + 5])
            i += 5
        elif parts[i] == "48" and i + 3 < len(parts) and parts[i + 1] == "2":
            bg = tuple(int(x) for x in parts[i + 2 : i + 5])
            i += 5
        else:
            i += 1
    return fg, bg


def parse_cells(line: str):
    """Yield (ch, fg, bg) per terminal cell of one preview row."""
    fg = bg = None
    pos = 0
    for m in SGR_RE.finditer(line):
        if m.start() > pos:
            yield from ((c, fg, bg) for c in line[pos : m.start()])
        params = m.group(1)
        if params == "0":
            fg = bg = None
        else:
            fg, bg = parse_sgr(params)
        pos = m.end()
    if pos < len(line):
        yield from ((c, fg, bg) for c in line[pos:])


def load_font(size: int):
    for path, index in (
        ("/System/Library/Fonts/PingFang.ttc", 0),
        ("/System/Library/Fonts/Helvetica.ttc", 0),
        ("/System/Library/Fonts/Supplemental/Arial.ttf", 0),
    ):
        try:
            return ImageFont.truetype(path, size, index=index)
        except OSError:
            continue
    return ImageFont.load_default()


def frame_to_image(rows, bg):
    cols = max(len(row) for row in rows)
    img = Image.new("RGB", (cols * CELL_W, len(rows) * CELL_H), bg)
    px = img.load()
    for y, row in enumerate(rows):
        for x, (ch, fg, bgc) in enumerate(row):
            top = bottom = bgc if bgc else bg
            if ch == "▀":
                top = fg if fg else bg
            elif ch == "▄":
                bottom = fg if fg else bg
            elif ch == "█":
                top = bottom = fg if fg else bg
            x0, y0 = x * CELL_W, y * CELL_H
            for dy in range(CELL_H):
                color = top if dy < CELL_H // 2 else bottom
                for dx in range(CELL_W):
                    px[x0 + dx, y0 + dy] = color
    return img


def parse_preview(path):
    """Return list of (state, frame_label, rows)."""
    frames = []
    pending = None
    state = None
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.rstrip("\n")
            if line.startswith("## "):
                if pending:
                    frames.append(pending)
                state = line[3:].split(" (")[0]
                pending = None
            elif line.startswith("frame "):
                if pending:
                    frames.append(pending)
                pending = [state, line, []]
            elif pending is not None and line.strip():
                pending[2].append(list(parse_cells(line)))
    if pending:
        frames.append(pending)
    return frames


def parse_preview_raw(path):
    """Like parse_preview but keeps blank (all-space) rows; used only for the
    per-cell index text so the 24x24 grid is not compressed vertically."""
    frames = []
    pending = None
    state = None
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.rstrip("\n")
            if line.startswith("## "):
                if pending:
                    frames.append(pending)
                state = line[3:].split(" (")[0]
                pending = None
            elif line.startswith("frame "):
                if pending:
                    frames.append(pending)
                pending = [state, line, []]
            elif pending is not None and line:
                pending[2].append(list(parse_cells(line)))
    if pending:
        frames.append(pending)
    return frames


def render_contact(frames, bg, font):
    frame_w = max(len(r) for _, _, rows in frames for r in rows) * CELL_W
    frame_h = max(len(rows) for _, _, rows in frames) * CELL_H
    panel_w = frame_w + PANEL_PAD * 2
    panel_h = frame_h + LABEL_H + PANEL_PAD
    ncols = min(COLS, len(frames))
    nrows = (len(frames) + ncols - 1) // ncols
    title = "opco-shigure final art preview"
    title_h = 56
    img = Image.new("RGB", (ncols * panel_w, title_h + nrows * panel_h), bg)
    draw = ImageDraw.Draw(img)
    title_font = load_font(30)
    label_font = load_font(22)
    draw.text((12, 10), title, fill=(220, 225, 232), font=title_font)
    for i, (state, flabel, rows) in enumerate(frames):
        col, row = i % ncols, i // ncols
        x = col * panel_w + PANEL_PAD
        y = title_h + row * panel_h + LABEL_H
        panel = frame_to_image(rows, bg)
        img.paste(panel, (x, y))
        draw.text(
            (x, title_h + row * panel_h + 6),
            "%s %s" % (state, flabel),
            fill=(150, 220, 170) if bg == DARK_BG else (40, 60, 50),
            font=label_font,
        )
    return img


def main():
    files = sys.argv[1:] or [
        "art-preview-regular.txt",
        "art-preview-compact.txt",
        "art-preview-light.txt",
    ]
    for name in files:
        path = os.path.join(HERE, name)
        if not os.path.exists(path):
            print("skip: %s (absent)" % name)
            continue
        bg = LIGHT_BG if "light" in name else DARK_BG
        frames = parse_preview(path)
        out = os.path.join(HERE, os.path.splitext(name)[0] + ".png")
        render_contact(frames, bg, load_font(30)).save(out)
        print("wrote %s (%d frames)" % (out, len(frames)))
        # T1 (todo 2): the regular preview additionally emits the per-cell index
        # text that participates in the three-path mechanical comparison.
        if name == "art-preview-regular.txt":
            write_index_text(parse_preview_raw(path), os.path.join(HERE, "render-consistency-png-index.txt"))


if __name__ == "__main__":
    main()

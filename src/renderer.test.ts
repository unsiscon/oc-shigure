// todo 6 交付物：renderFrame 的 TDD 测试（先行红，后实现转绿）。
// 验收口径见 docs/04 §3.6（半块合并表）与 docs/06 §5（渲染器验收）。

import { describe, expect, it } from "vitest";
import { RenderError, renderFrame, type RenderRow } from "./renderer";
import { SHIGURE_MANIFEST } from "./manifest";
import type { PixelFrame } from "./types";

// ---------------------------------------------------------------------------
// 测试侧独立 oracle：按 docs/04 §3.6 合并表逐格推导（不做 run 合并），
// 用于断言"合并前后逐格展开视觉等价"。
// ---------------------------------------------------------------------------

type Cell = { text: string; fg?: string; bg?: string };

type RenderOpts = { transparentIndex: number; outlineColor: string; backgroundColor: string };

const PALETTE = ["transparent", "#FF0000", "#00FF00"] as const; // 最后一项 = outline token
const PANEL = "#17141B"; // 测试侧 panel 背景 oracle
const BASE_OPTS: RenderOpts = { transparentIndex: 0, outlineColor: "#00FF00", backgroundColor: PANEL }; // outline 与 palette 末项同值 → 轮廓替换为 no-op

function makeFrame(width: number, height: number, pixels: Uint8Array | number[]): PixelFrame {
  const buffer = pixels instanceof Uint8Array ? pixels : Uint8Array.from(pixels);
  return { width, height, pixels: buffer } as unknown as PixelFrame;
}

function cellFor(
  palette: readonly string[],
  opts: RenderOpts,
  top: number,
  bottom: number,
  x: number,
  y: number,
): Cell {
  const outlineIndex = palette.length - 1; // 约定：palette 末项 = outline token
  const color = (index: number): string | undefined => {
    if (index === opts.transparentIndex) return undefined;
    if (index < 0 || index >= palette.length) {
      throw new Error(`oracle: palette index ${index} out of range`);
    }
    return index === outlineIndex ? opts.outlineColor : palette[index];
  };
  const t = color(top);
  const b = color(bottom);
  if (t === undefined && b === undefined) return { text: " ", bg: PANEL };
  if (t !== undefined && b === undefined) return { text: "▀", fg: t, bg: PANEL };
  if (t === undefined && b !== undefined) return { text: "▄", fg: b, bg: PANEL };
  if (t === b) return { text: "█", fg: t };
  return { text: "▀", fg: t, bg: b };
}

function naiveCells(frame: PixelFrame, palette: readonly string[], opts: RenderOpts): Cell[][] {
  const { width, height, pixels } = frame;
  const rows: Cell[][] = [];
  for (let y = 0; y < height; y += 2) {
    const row: Cell[] = [];
    for (let x = 0; x < width; x += 1) {
      const top = pixels[y * width + x];
      const bottom = y + 1 < height ? pixels[(y + 1) * width + x] : opts.transparentIndex;
      row.push(cellFor(palette, opts, top, bottom, x, y));
    }
    rows.push(row);
  }
  return rows;
}

function expandRow(row: RenderRow): Cell[] {
  const cells: Cell[] = [];
  for (const run of row) {
    for (const ch of run.text) cells.push({ text: ch, fg: run.fg, bg: run.bg });
  }
  return cells;
}

// 4 像素高 × 5 宽：输出 2 行 × 5 格，依次覆盖五组合
// （透明/透明、色A/透明、透明/色B、同色A/A、色A/色B）。
const FIVE_COMBOS = makeFrame(
  5,
  4,
  Uint8Array.from([
    /* 输出行 0：像素行 0+1 */
    0, 1, 0, 1, 1,
    0, 0, 2, 1, 2,
    /* 输出行 1：像素行 2+3 */
    0, 1, 0, 1, 1,
    0, 0, 2, 1, 2,
  ]),
);

describe("renderFrame", () => {
  it("five combos: 4x2-style small frame renders 2 output rows with correct half-block glyphs and colors", () => {
    const { rows } = renderFrame(FIVE_COMBOS, PALETTE, BASE_OPTS);
    expect(rows).toHaveLength(2);

    const expected: Cell[] = [
      { text: " ", bg: PANEL },
      { text: "▀", fg: "#FF0000", bg: PANEL },
      { text: "▄", fg: "#00FF00", bg: PANEL },
      { text: "█", fg: "#FF0000" },
      { text: "▀", fg: "#FF0000", bg: "#00FF00" },
    ];
    for (const row of rows) {
      expect(expandRow(row)).toEqual(expected);
      expect(row).toHaveLength(5); // 相邻格互不相同 → 每格一个 run
    }
  });

  it("maps a 24x24 frame to 12 rows x 24 cells and a 16x16 frame to 8 rows x 16 cells", () => {
    const opts: RenderOpts = { transparentIndex: 0, outlineColor: "#FFFFFF", backgroundColor: PANEL };
    const regular = SHIGURE_MANIFEST.sizes.regular.idle.frames[0];
    const compact = SHIGURE_MANIFEST.sizes.compact.idle.frames[0];

    const regularRows = renderFrame(regular, SHIGURE_MANIFEST.palette, opts).rows;
    expect(regularRows).toHaveLength(12);
    for (const row of regularRows) expect(expandRow(row)).toHaveLength(24);

    const compactRows = renderFrame(compact, SHIGURE_MANIFEST.palette, opts).rows;
    expect(compactRows).toHaveLength(8);
    for (const row of compactRows) expect(expandRow(row)).toHaveLength(16);
  });

  it("outputs only space and half-blocks with no ESC bytes, emoji or fullwidth characters", () => {
    const opts: RenderOpts = { transparentIndex: 0, outlineColor: "#FFFFFF", backgroundColor: PANEL };
    for (const size of ["regular", "compact"] as const) {
      const frame = SHIGURE_MANIFEST.sizes[size].idle.frames[0];
      const { rows } = renderFrame(frame, SHIGURE_MANIFEST.palette, opts);
      const allText = rows.flatMap((row) => row.map((run) => run.text)).join("");
      expect(allText.includes("\x1b")).toBe(false);
      const chars = [...allText];
      expect(chars.every((ch) => ch === " " || ch === "▀" || ch === "▄" || ch === "█")).toBe(true);
      // 半块 U+2580/U+2584/U+2588 与空格均 ≤ 0x2588；emoji/全角/组合字符全部更大
      expect(chars.every((ch) => (ch.codePointAt(0) ?? 0) <= 0x2588)).toBe(true);
    }
  });

  it("writes explicit panel background into transparent/transparent cells (blank frame)", () => {
    // docs/11 §9.1：不再依赖 real manifest 的第一输出行（该行现在显式携带 panel bg），
    // 资产 validator 另行验证顶部逻辑行透明。
    const blank = makeFrame(4, 2, new Uint8Array(8));
    const blankRows = renderFrame(blank, PALETTE, BASE_OPTS).rows;
    expect(blankRows).toHaveLength(1);
    expect(expandRow(blankRows[0])).toEqual([
      { text: " ", bg: PANEL },
      { text: " ", bg: PANEL },
      { text: " ", bg: PANEL },
      { text: " ", bg: PANEL },
    ]);
  });

  it("writes explicit panel background for single top-half and single bottom-half frames", () => {
    // 色/透明 → ▀ 带 panel bg；透明/色 → ▄ 带 panel bg（docs/11 §9.1 拆分项）
    const topOnly = makeFrame(2, 2, Uint8Array.from([1, 1, 0, 0]));
    const topRows = renderFrame(topOnly, PALETTE, BASE_OPTS).rows;
    expect(topRows[0]).toEqual([{ text: "▀▀", fg: "#FF0000", bg: PANEL }]);

    const bottomOnly = makeFrame(2, 2, Uint8Array.from([0, 0, 2, 2]));
    const bottomRows = renderFrame(bottomOnly, PALETTE, BASE_OPTS).rows;
    expect(bottomRows[0]).toEqual([{ text: "▄▄", fg: "#00FF00", bg: PANEL }]);
  });

  it("merges adjacent same-style runs into one span without changing cell-by-cell output", () => {
    const frame = makeFrame(
      6,
      4,
      Uint8Array.from([
        /* 输出行 0 */
        1, 1, 1, 0, 0, 1,
        2, 2, 2, 0, 0, 1,
        /* 输出行 1 */
        1, 1, 1, 0, 0, 1,
        2, 2, 2, 0, 0, 1,
      ]),
    );
    const { rows } = renderFrame(frame, PALETTE, BASE_OPTS);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      // 三组同色 run 各合并为一个 span：▀×3、空格×2、█×1
      expect(row).toHaveLength(3);
      expect(row.map((run) => run.text)).toEqual(["▀▀▀", "  ", "█"]);
      expect(row[0]).toEqual({ text: "▀▀▀", fg: "#FF0000", bg: "#00FF00" });
      // 透明/透明合并后的空格 run 显式携带 panel bg
      expect(row[1]).toEqual({ text: "  ", bg: PANEL });
      // 合并前后逐格展开视觉等价
      expect(expandRow(row)).toEqual(naiveCells(frame, PALETTE, BASE_OPTS)[0]);
    }
  });

  it("merged output is cell-by-cell identical to the unmerged merge table on real manifest frames", () => {
    const opts: RenderOpts = { transparentIndex: 0, outlineColor: "#FFFFFF", backgroundColor: PANEL };
    for (const size of ["regular", "compact"] as const) {
      const frame = SHIGURE_MANIFEST.sizes[size].idle.frames[0];
      const expected = naiveCells(frame, SHIGURE_MANIFEST.palette, opts);
      const { rows } = renderFrame(frame, SHIGURE_MANIFEST.palette, opts);
      expect(rows).toHaveLength(expected.length);
      for (let i = 0; i < rows.length; i += 1) {
        expect(expandRow(rows[i])).toEqual(expected[i]);
      }
    }
  });

  it("theme switch changes only outline-token pixels, never body colors", () => {
    // x0 主体/主体，x1 轮廓/轮廓，x2 主体/轮廓，x3 透明/透明
    const frame = makeFrame(
      4,
      4,
      Uint8Array.from([
        1, 2, 1, 0,
        1, 2, 2, 0,
        1, 2, 1, 0,
        1, 2, 2, 0,
      ]),
    );
    const light = renderFrame(frame, PALETTE, { transparentIndex: 0, outlineColor: "#111111", backgroundColor: PANEL });
    const dark = renderFrame(frame, PALETTE, { transparentIndex: 0, outlineColor: "#EEEEEE", backgroundColor: PANEL });
    const lightCells = expandRow(light.rows[0]);
    const darkCells = expandRow(dark.rows[0]);

    // 主体色、字形与透明格完全不变（透明格现在显式携带 panel bg）
    expect(lightCells[0]).toEqual({ text: "█", fg: "#FF0000" });
    expect(lightCells[3]).toEqual({ text: " ", bg: PANEL });
    expect(lightCells[0]).toEqual(darkCells[0]);
    expect(lightCells[3]).toEqual(darkCells[3]);

    // 仅 outline token 像素的 fg（或 bg）随 outlineColor 变化
    expect(lightCells[1]).toEqual({ text: "█", fg: "#111111" });
    expect(darkCells[1]).toEqual({ text: "█", fg: "#EEEEEE" });
    expect(lightCells[2]).toEqual({ text: "▀", fg: "#FF0000", bg: "#111111" });
    expect(darkCells[2]).toEqual({ text: "▀", fg: "#FF0000", bg: "#EEEEEE" });
  });

  it("throws a typed RenderError for out of range palette indices instead of emitting bad characters", () => {
    const frame = makeFrame(2, 2, new Uint8Array([99, 1, 0, 1]));
    expect(() => renderFrame(frame, PALETTE, BASE_OPTS)).toThrow(RenderError);
    try {
      renderFrame(frame, PALETTE, BASE_OPTS);
      throw new Error("expected renderFrame to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(RenderError);
      expect((error as Error).message).toMatch(/99/);
      expect((error as Error).message).toMatch(/out of range/);
    }

    // 像素缓冲长度不匹配也不静默输出坏字符
    const truncated = makeFrame(2, 2, new Uint8Array([0, 1, 0]));
    expect(() => renderFrame(truncated, PALETTE, BASE_OPTS)).toThrow(RenderError);
  });

  it("handles an odd height by pairing the last pixel row with transparent", () => {
    const frame = makeFrame(2, 3, new Uint8Array([1, 1, 0, 0, 2, 2]));
    const { rows } = renderFrame(frame, PALETTE, BASE_OPTS);
    expect(rows).toHaveLength(2);
    expect(expandRow(rows[0])).toEqual([
      { text: "▀", fg: "#FF0000", bg: PANEL },
      { text: "▀", fg: "#FF0000", bg: PANEL },
    ]);
    // 最后一行独立处理：色/透明 → 上半个块 ▀（fg=色，bg=panel）
    expect(expandRow(rows[1])).toEqual([
      { text: "▀", fg: "#00FF00", bg: PANEL },
      { text: "▀", fg: "#00FF00", bg: PANEL },
    ]);
  });

  it("is deterministic: identical input produces identical output", () => {
    const frame = SHIGURE_MANIFEST.sizes.compact.waiting.frames[0];
    const opts: RenderOpts = { transparentIndex: 0, outlineColor: "#FFFFFF", backgroundColor: PANEL };
    expect(renderFrame(frame, SHIGURE_MANIFEST.palette, opts)).toEqual(
      renderFrame(frame, SHIGURE_MANIFEST.palette, opts),
    );
  });
});

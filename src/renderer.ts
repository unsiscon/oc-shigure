// todo 6 交付物：纯函数半块渲染器。
//
// 设计约定（与 SHIGURE_PALETTE / PALETTE_INDEX 对齐，docs/04 §3.6）：
// - palette[transparentIndex]（SHIGURE 中索引 0，值为 "transparent"）为透明标记；
// - palette 的**最后一个条目**是 outline token（SHIGURE 中索引 12），
//   其像素 fg 恒为 opts.outlineColor —— 主题切换只需替换该颜色，
//   主体调色板不随主题变化（docs/01 §5、docs/05 §5）。
//
// 本模块不生成任何 ANSI 转义字符串：颜色由 Run.fg/bg 承载，
// 上层 Solid 组件负责转为 OpenTUI span/主题。输出字符仅为
// 空格、▀（U+2580）、▄（U+2584）、█（U+2588），宽度稳定。

import type { PixelFrame } from "./types";

/** 一个 span：text 为块字符串，fg/bg 为十六进制颜色（可选）。 */
export interface Run {
  text: string;
  fg?: string;
  bg?: string;
}

/** 一行 = 相邻同色 run 合并后的 span 序列；行宽 = 帧逻辑像素宽。 */
export type RenderRow = Run[];

export interface RenderOptions {
  transparentIndex: number;
  /** 主题感知轮廓色：替换 palette 末项（outline token）像素的前景/背景色。 */
  outlineColor: string;
  /** OpenTUI sidebar panel 的实际背景色：显式写入透明组合（docs/11 §5.2），
   *  避免半块字形边缘/行间漏出宿主默认背景。 */
  backgroundColor: string;
}

export interface RenderResult {
  rows: RenderRow[];
}

/** 带类型的渲染错误：由上层降级处理，绝不静默输出坏字符。 */
export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderError";
  }
}

const TOP_GLYPH = "▀"; // 上像素有色 / 上下异色
const BOTTOM_GLYPH = "▄"; // 下像素有色
const FULL_GLYPH = "█"; // 上下同色
const SPACE_GLYPH = " ";

/**
 * 把帧渲染为半块字符行。
 * 垂直相邻两像素合成一个字符格：行数 = ceil(高/2)，行宽 = 帧宽（不缩宽）。
 */
export function renderFrame(frame: PixelFrame, palette: readonly string[], opts: RenderOptions): RenderResult {
  const { width, height, pixels } = frame;
  if (pixels.length !== width * height) {
    throw new RenderError(
      `renderFrame: pixel buffer length ${pixels.length} does not match ${width}x${height} frame`,
    );
  }
  const outlineIndex = palette.length - 1; // 约定：palette 末项 = outline token

  const colorFor = (index: number, x: number, y: number): string | undefined => {
    if (index === opts.transparentIndex) return undefined;
    if (index < 0 || index >= palette.length) {
      throw new RenderError(
        `renderFrame: palette index ${index} out of range [0, ${palette.length}) at (${x}, ${y})`,
      );
    }
    return index === outlineIndex ? opts.outlineColor : palette[index];
  };

  const rows: RenderRow[] = [];
  for (let y = 0; y < height; y += 2) {
    const runs: Run[] = [];
    for (let x = 0; x < width; x += 1) {
      const top = pixels[y * width + x];
      // 奇数高：最后一行与透明配对（由尺寸校验保证，这里兜底）
      const bottom = y + 1 < height ? pixels[(y + 1) * width + x] : opts.transparentIndex;
      const fg = colorFor(top, x, y);
      const bg = colorFor(bottom, x, y + 1);

      let cell: Run;
      if (fg === undefined && bg === undefined) {
        cell = { text: SPACE_GLYPH, bg: opts.backgroundColor }; // 透明/透明 → 空格，显式 panel 背景
      } else if (fg !== undefined && bg === undefined) {
        cell = { text: TOP_GLYPH, fg, bg: opts.backgroundColor }; // 色/透明
      } else if (fg === undefined && bg !== undefined) {
        cell = { text: BOTTOM_GLYPH, fg: bg, bg: opts.backgroundColor }; // 透明/色
      } else if (fg === bg) {
        cell = { text: FULL_GLYPH, fg }; // 同色 → 实心块（探针前不改，docs/11 §17.3）
      } else {
        cell = { text: TOP_GLYPH, fg, bg }; // 异色 → 上色前景、下色背景
      }

      const last = runs[runs.length - 1];
      if (last !== undefined && last.fg === cell.fg && last.bg === cell.bg) {
        last.text += cell.text; // 相邻同色 run 合并，视觉等价
      } else {
        runs.push(cell);
      }
    }
    rows.push(runs);
  }
  return { rows };
}

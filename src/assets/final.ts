// 时雨最终像素资产：行字符串使用 docs/08 §4.2 的 13 色索引图例。
// 本文件由 scripts/build-final-assets.ts 从 design/art-v2/shigure-pixel-data.json 的 v3 母稿种子
// 程序化修正生成（trimEdges / clearTopGap / injectEyes / 状态派生），非手绘；同输入产出同输出。
import { FRAME_DURATIONS, SHIGURE_PALETTE, SIZE_DIMENSIONS } from "../manifest-data";
import type { AnimationSpec, CharacterManifest, PetSize, PetState, PixelFrame } from "../types";

export const ROW_CHARS = ".0123456789ab" as const;

const LOOP_STATES: readonly PetState[] = ["idle", "thinking", "working", "waiting", "retry"];

export function decodeRow(row: string, y: number, width: number, pixels: Uint8Array): void {
  if (row.length !== width) throw new Error(`decodeRow: row ${y} has width ${row.length}, expected ${width}`);
  for (let x = 0; x < width; x += 1) {
    const paletteIndex = ROW_CHARS.indexOf(row[x] as (typeof ROW_CHARS)[number]);
    if (paletteIndex < 0) throw new Error(`decodeRow: invalid character ${JSON.stringify(row[x])} at (${x}, ${y})`);
    pixels[y * width + x] = paletteIndex;
  }
}

function makeFrame(size: PetSize, rows: readonly string[]): PixelFrame {
  const dimension = SIZE_DIMENSIONS[size];
  if (rows.length !== dimension) throw new Error(`makeFrame: row count ${rows.length} != ${dimension}`);
  const pixels = new Uint8Array(dimension * dimension);
  rows.forEach((row, y) => decodeRow(row, y, dimension, pixels));
  return { width: dimension, height: dimension, pixels };
}

function patchRows(rows: readonly string[], patches: readonly [x: number, y: number, value: string][]): string[] {
  const next = rows.map((row) => row.split(""));
  for (const [x, y, value] of patches) {
    if (value.length !== 1 || !ROW_CHARS.includes(value as (typeof ROW_CHARS)[number])) {
      throw new Error(`patchRows: invalid value ${JSON.stringify(value)}`);
    }
    const line = next[y];
    if (!line || x < 0 || x >= line.length) throw new Error(`patchRows: out of bounds (${x}, ${y})`);
    line[x] = value;
  }
  return next.map((line) => line.join(""));
}

function patchFirst(rows: readonly string[], from: string, to: string, occurrence = 0): string[] {
  const next = rows.map((row) => row.split(""));
  let seen = 0;
  for (const line of next) {
    const x = line.indexOf(from);
    if (x >= 0) {
      if (seen === occurrence) {
        line[x] = to;
        return next.map((row) => row.join(""));
      }
      seen += 1;
    }
  }
  throw new Error(`patchFirst: token ${from} occurrence ${occurrence} not found`);
}

// ---------------- regular（24×24） ----------------

/** idle 帧 1：approved-v0（原始 v3 种子）——临时预览态，非交付。 */
const REGULAR_IDLE_ROWS = [
    "........................",
    "........bbbbbbbb........",
    "......ba111111111b......",
    "....b11110a11111111bbb..",
    "....102a101110101220bbb.",
    "...b11112b12212201a1b...",
    "..b188011b111b2111110...",
    "..b0b2b08301b33001100b..",
    "..bb01bbbb11b3bb3010bb..",
    "...b71b75533075601bbb...",
    "...0b1b35533335381b00...",
    "..b1bb0b33333332bb0b1b..",
    "..000b0bb.282.08b0b000..",
    "bb10bbb3b2b8b0b3b00bb10b",
    ".1b0bb33bbb8a67b302b0b1.",
    "b0b0b60b7.08a772a60b0.0.",
    "...b32b6b6b8b966b70b.b..",
    "....0b0a66666b.0ab0b....",
    ".......bbb...bbb........",
    "........0.b.b00b........",
    ".......3..b..b.2........",
    "......b0a0...02ab.......",
    ".......bbb...bbbb.......",
    "........................",
  ] as const;

/** idle 帧 2：临时预览态——approved-v0 无 `4` 蓝眼，暂不眨眼；正式修复见 approved-v1。 */
const REGULAR_IDLE_BLINK_ROWS = REGULAR_IDLE_ROWS;

/** thinking 帧 1：双蓝眼簇上移 1px + 刘海偏移 1px。 */
const REGULAR_THINKING_ROWS = [
    "........................",
    "........................",
    "........111111111.......",
    ".....11110111111111bbb..",
    "....10111011101022.0bbb.",
    "...b11111b122122011b11..",
    "..b111011b111b21111b11..",
    "..b0b1b01101b3300112bb..",
    "..bb01bb4411b34b1012bb..",
    "...b11b15533014601bb1...",
    "...0b1b3..3333.3.1bb1...",
    "....bb773388333.7702bb..",
    "..000b77b.88..0.77b2b0..",
    ".b10bb77b.88.0b.770bb10.",
    ".1b0bb77bb88.6.b77.b0b1.",
    ".0b0b60b..88.....60b0.0.",
    "...b..b6b688b.66b.0b....",
    "....0b0.66666b.0.b0b....",
    "........99...b99........",
    "........99b.b099........",
    "........99b..b99........",
    "......b0aa...0aab.......",
    ".......baa....aab.......",
    "........................",
  ] as const;

/** thinking 帧 2：帧 1 + 眼部内收 1px。 */
const REGULAR_THINKING_ALT_ROWS = [
    "........................",
    "........................",
    "........111111111.......",
    ".....11110111111111bbb..",
    "....10111011101022.0bbb.",
    "...b11111b122122011b11..",
    "..b111011b111b21111b11..",
    "..b0b1b01101b3300112bb..",
    "..bb01bb.441b4.b1012bb..",
    "...b11b1.55304.601bb1...",
    "...0b1b3..3333.3.1bb1...",
    "....bb773388333.7702bb..",
    "..000b77b.88..0.77b2b0..",
    ".b10bb77b.88.0b.770bb10.",
    ".1b0bb77bb88.6.b77.b0b1.",
    ".0b0b60b..88.....60b0.0.",
    "...b..b6b688b.66b.0b....",
    "....0b0.66666b.0.b0b....",
    "........99...b99........",
    "........99b.b099........",
    "........99b..b99........",
    "......b0aa...0aab.......",
    ".......baa....aab.......",
    "........................",
  ] as const;

/** working 帧 1：双手在身体两侧（warm white '7'，2×2px）。 */
const REGULAR_WORKING_ROWS = [
    "........................",
    "........................",
    "........111111111.......",
    ".....11110111111111bbb..",
    "....1011101110101220bbb.",
    "...b11111b122122011b11..",
    "..b111011b111b21111b11..",
    "..b0b1b01101b3300112bb..",
    "..bb01bbbb11b3bb1012bb..",
    "...b11b14433014601bb1...",
    "...0b1b355333343.1bb1...",
    "....bb773388333.7702bb..",
    "..000b77b.88..0.77b2b0..",
    ".b10bb77b.88.0b.770bb10.",
    ".1b0bb77bb88.6.b77.b0b1.",
    ".0b0b677..88....770b0.0.",
    "...b..77b688b.66770b....",
    "....0b0.66666b.0.b0b....",
    "........99...b99........",
    "........99b.b099........",
    "........99b..b99........",
    "......b0aa...0aab.......",
    ".......baa....aab.......",
    "........................",
  ] as const;

/** working 帧 2：双手内收 1px；裙/袜/靴/发基线不动。 */
const REGULAR_WORKING_ALT_ROWS = [
    "........................",
    "........................",
    "........111111111.......",
    ".....11110111111111bbb..",
    "....1011101110101220bbb.",
    "...b11111b122122011b11..",
    "..b111011b111b21111b11..",
    "..b0b1b01101b3300112bb..",
    "..bb01bbbb11b3bb1012bb..",
    "...b11b14433014601bb1...",
    "...0b1b355333343.1bb1...",
    "....bb773388333.7702bb..",
    "..000b77b.88..0.77b2b0..",
    ".b10bb77b.88.0b.770bb10.",
    ".1b0bb77bb88.6.b77.b0b1.",
    ".0b0b6.77.88...77.0b0.0.",
    "...b...77688b.677.0b....",
    "....0b0.66666b.0.b0b....",
    "........99...b99........",
    "........99b.b099........",
    "........99b..b99........",
    "......b0aa...0aab.......",
    ".......baa....aab.......",
    "........................",
  ] as const;

/** waiting 帧 1：眼部上移 1px + 双手在红结下方合拢（中心 2px '7'）。 */
const REGULAR_WAITING_ROWS = [
    "........................",
    "........................",
    "........111111111.......",
    ".....11110111111111bbb..",
    "....1011101110101220bbb.",
    "...b11111b122122011b11..",
    "..b111011b111b21111b11..",
    "..b0b1b01101b3300112bb..",
    "..bb01bb4411b34b1012bb..",
    "...b11b15533014601bb1...",
    "...0b1b3..3333.3.1bb1...",
    "....bb773388333.7702bb..",
    "..000b77b.88..0.77b2b0..",
    ".b10bb77b.88.0b.770bb10.",
    ".1b0bb77bb88.6.b77.b0b1.",
    ".0b0b60b..88.....60b0.0.",
    "...b..b6b688b.66b.0b....",
    "....0b0.66677b.0.b0b....",
    "........99...b99........",
    "........99b.b099........",
    "........99b..b99........",
    "......b0aa...0aab.......",
    ".......baa....aab.......",
    "........................",
  ] as const;

/** waiting 帧 2：眼部回原位 + 双手合拢。 */
const REGULAR_WAITING_ALT_ROWS = [
    "........................",
    "........................",
    "........111111111.......",
    ".....11110111111111bbb..",
    "....1011101110101220bbb.",
    "...b11111b122122011b11..",
    "..b111011b111b21111b11..",
    "..b0b1b01101b3300112bb..",
    "..bb01bbbb11b3bb1012bb..",
    "...b11b14433014601bb1...",
    "...0b1b355333343.1bb1...",
    "....bb773388333.7702bb..",
    "..000b77b.88..0.77b2b0..",
    ".b10bb77b.88.0b.770bb10.",
    ".1b0bb77bb88.6.b77.b0b1.",
    ".0b0b60b..88.....60b0.0.",
    "...b..b6b688b.66b.0b....",
    "....0b0.66677b.0.b0b....",
    "........99...b99........",
    "........99b.b099........",
    "........99b..b99........",
    "......b0aa...0aab.......",
    ".......baa....aab.......",
    "........................",
  ] as const;

/** success：脚/靴整组上移 1px，底行零残留。 */
const REGULAR_SUCCESS_ROWS = [
    "........................",
    "........................",
    "........111111111.......",
    ".....11110111111111bbb..",
    "....1011101110101220bbb.",
    "...b11111b122122011b11..",
    "..b111011b111b21111b11..",
    "..b0b1b01101b3300112bb..",
    "..bb01bbbb11b3bb1012bb..",
    "...b11b14433014601bb1...",
    "...0b1b355333343.1bb1...",
    "....bb773388333.7702bb..",
    "..000b77b.88..0.77b2b0..",
    ".b10bb77b.88.0b.770bb10.",
    ".1b0bb77bb88.6.b77.b0b1.",
    ".0b0b60b..88.....60b0.0.",
    "...b..b6b688b.66b.0b....",
    "....0b0.66666b.0.b0b....",
    "........99...b99........",
    "........99b.b099........",
    "........99b..b99........",
    "......bbaa...0aab.......",
    "........................",
    "........................",
  ] as const;

/** error：眼部变窄，每侧保留 ≥1px 蓝眼。 */
const REGULAR_ERROR_ROWS = [
    "........................",
    "........................",
    "........111111111.......",
    ".....11110111111111bbb..",
    "....1011101110101220bbb.",
    "...b11111b122122011b11..",
    "..b111011b111b21111b11..",
    "..b0b1b01101b3300112bb..",
    "..bb01bbbb11b3bb1012bb..",
    "...b11b14433014601bb1...",
    "...0b1b3..3333.3.1bb1...",
    "....bb773388333.7702bb..",
    "..000b77b.88..0.77b2b0..",
    ".b10bb77b.88.0b.770bb10.",
    ".1b0bb77bb88.6.b77.b0b1.",
    ".0b0b60b..88.....60b0.0.",
    "...b..b6b688b.66b.0b....",
    "....0b0.66666b.0.b0b....",
    "........99...b99........",
    "........99b.b099........",
    "........99b..b99........",
    "......b0aa...0aab.......",
    ".......baa....aab.......",
    "........................",
  ] as const;

/** retry 帧 1：与 idle 帧 1 相同。 */
const REGULAR_RETRY_ROWS = [
    "........................",
    "........................",
    "........111111111.......",
    ".....11110111111111bbb..",
    "....1011101110101220bbb.",
    "...b11111b122122011b11..",
    "..b111011b111b21111b11..",
    "..b0b1b01101b3300112bb..",
    "..bb01bbbb11b3bb1012bb..",
    "...b11b14433014601bb1...",
    "...0b1b355333343.1bb1...",
    "....bb773388333.7702bb..",
    "..000b77b.88..0.77b2b0..",
    ".b10bb77b.88.0b.770bb10.",
    ".1b0bb77bb88.6.b77.b0b1.",
    ".0b0b60b..88.....60b0.0.",
    "...b..b6b688b.66b.0b....",
    "....0b0.66666b.0.b0b....",
    "........99...b99........",
    "........99b.b099........",
    "........99b..b99........",
    "......b0aa...0aab.......",
    ".......baa....aab.......",
    "........................",
  ] as const;

/** retry 帧 2：上半身（行 2-12）水平右移 1px，边缘裁剪。 */
const REGULAR_RETRY_ALT_ROWS = [
    "........................",
    "........................",
    ".........111111111......",
    "......11110111111111bbb.",
    ".....1011101110101220bb.",
    "....b11111b122122011b11.",
    "...b111011b111b21111b11.",
    "...b0b1b01101b3300112bb.",
    "...bb01bbbb11b3bb1012bb.",
    "....b11b14433014601bb1..",
    "....0b1b355333343.1bb1..",
    ".....bb773388333.7702bb.",
    "...000b77b.88..0.77b2b0.",
    ".b10bb77b.88.0b.770bb10.",
    ".1b0bb77bb88.6.b77.b0b1.",
    ".0b0b60b..88.....60b0.0.",
    "...b..b6b688b.66b.0b....",
    "....0b0.66666b.0.b0b....",
    "........99...b99........",
    "........99b.b099........",
    "........99b..b99........",
    "......b0aa...0aab.......",
    ".......baa....aab.......",
    "........................",
  ] as const;

// ---------------- compact（16×16） ----------------

/** idle 帧 1：JSON v3 种子 + 修边 + 顶隙 + 蓝眼注入。 */
const COMPACT_IDLE_ROWS = [
    "................",
    "................",
    "...0011101101bb.",
    "...0221110220b..",
    "...21b111300b1..",
    "..11bb113bbbbb1.",
    "..00146334302b1.",
    "..1bb3333330b2b.",
    ".0bbb378171bb2b.",
    ".b0b1b781710bb1.",
    ".b0.b.78.7b63b1.",
    "..b..6.6666b32b.",
    ".....99.b99..2b.",
    ".....99.b99.....",
    ".....aa..aa.....",
    ".....aa..aa.....",
  ] as const;

/** idle 帧 2：第一枚蓝眼像素变深瞳（1px 眨眼）。 */
const COMPACT_IDLE_BLINK_ROWS = patchFirst(COMPACT_IDLE_ROWS, "4", "5");

/** thinking 帧 1：双蓝眼簇上移 1px + 刘海偏移 1px。 */
const COMPACT_THINKING_ROWS = [
    "................",
    "................",
    "...0011101101bb.",
    "...2.211102.2b..",
    "...21b111300b1..",
    "..11b41134bbbb1.",
    "..001.633.302b1.",
    "..1bb3333330b2b.",
    ".0bbb378171bb2b.",
    ".b0b1b781710bb1.",
    ".b0.b.78.7b63b1.",
    "..b..6.6666b32b.",
    ".....99.b99..2b.",
    ".....99.b99.....",
    ".....aa..aa.....",
    ".....aa..aa.....",
  ] as const;

/** thinking 帧 2：帧 1 + 眼部内收 1px。 */
const COMPACT_THINKING_ALT_ROWS = [
    "................",
    "................",
    "...0011101101bb.",
    "...2.211102.2b..",
    "...21b111300b1..",
    "..11b.414.bbbb1.",
    "..001.633.302b1.",
    "..1bb3333330b2b.",
    ".0bbb378171bb2b.",
    ".b0b1b781710bb1.",
    ".b0.b.78.7b63b1.",
    "..b..6.6666b32b.",
    ".....99.b99..2b.",
    ".....99.b99.....",
    ".....aa..aa.....",
    ".....aa..aa.....",
  ] as const;

/** working 帧 1：双手在身体两侧（warm white '7'，2×2px）。 */
const COMPACT_WORKING_ROWS = [
    "................",
    "................",
    "...0011101101bb.",
    "...0221110220b..",
    "...21b111300b1..",
    "..11bb113bbbbb1.",
    "..00146334302b1.",
    "..1bb3333330b2b.",
    ".077b378171b77b.",
    ".b771b781710771.",
    ".b0.b.78.7b63b1.",
    "..b..6.6666b32b.",
    ".....99.b99..2b.",
    ".....99.b99.....",
    ".....aa..aa.....",
    ".....aa..aa.....",
  ] as const;

/** working 帧 2：双手内收 1px；裙/袜/靴/发基线不动。 */
const COMPACT_WORKING_ALT_ROWS = [
    "................",
    "................",
    "...0011101101bb.",
    "...0221110220b..",
    "...21b111300b1..",
    "..11bb113bbbbb1.",
    "..00146334302b1.",
    "..1bb3333330b2b.",
    ".0.7737817177.b.",
    ".b.77b7817177.1.",
    ".b0.b.78.7b63b1.",
    "..b..6.6666b32b.",
    ".....99.b99..2b.",
    ".....99.b99.....",
    ".....aa..aa.....",
    ".....aa..aa.....",
  ] as const;

/** waiting 帧 1：眼部上移 1px + 双手在红结下方合拢（中心 2px '7'）。 */
const COMPACT_WAITING_ROWS = [
    "................",
    "................",
    "...0011101101bb.",
    "...0221110220b..",
    "...21b111300b1..",
    "..11b41134bbbb1.",
    "..001.633.302b1.",
    "..1bb3333330b2b.",
    ".0bbb378171bb2b.",
    ".b0b1b781710bb1.",
    ".b0.b.78.7b63b1.",
    "..b..6.6666b32b.",
    ".....99.b99..2b.",
    ".....997799.....",
    ".....aa..aa.....",
    ".....aa..aa.....",
  ] as const;

/** waiting 帧 2：眼部回原位 + 双手合拢。 */
const COMPACT_WAITING_ALT_ROWS = [
    "................",
    "................",
    "...0011101101bb.",
    "...0221110220b..",
    "...21b111300b1..",
    "..11bb113bbbbb1.",
    "..00146334302b1.",
    "..1bb3333330b2b.",
    ".0bbb378171bb2b.",
    ".b0b1b781710bb1.",
    ".b0.b.78.7b63b1.",
    "..b..6.6666b32b.",
    ".....99.b99..2b.",
    ".....997799.....",
    ".....aa..aa.....",
    ".....aa..aa.....",
  ] as const;

/** success：脚/靴整组上移 1px，底行零残留。 */
const COMPACT_SUCCESS_ROWS = [
    "................",
    "................",
    "...0011101101bb.",
    "...0221110220b..",
    "...21b111300b1..",
    "..11bb113bbbbb1.",
    "..00146334302b1.",
    "..1bb3333330b2b.",
    ".0bbb378171bb2b.",
    ".b0b1b781710bb1.",
    ".b0.b.78.7b63b1.",
    "..b..6.6666b32b.",
    ".....99.b99..2b.",
    ".....99.b99.....",
    ".....aa..aa.....",
    "................",
  ] as const;

/** error：眼部变窄，每侧保留 ≥1px 蓝眼。 */
const COMPACT_ERROR_ROWS = [
    "................",
    "................",
    "...0011101101bb.",
    "...0221110220b..",
    "...21b111300b1..",
    "..11bb113bbbbb1.",
    "..001.434.302b1.",
    "..1bb3333330b2b.",
    ".0bbb378171bb2b.",
    ".b0b1b781710bb1.",
    ".b0.b.78.7b63b1.",
    "..b..6.6666b32b.",
    ".....99.b99..2b.",
    ".....99.b99.....",
    ".....aa..aa.....",
    ".....aa..aa.....",
  ] as const;

/** retry 帧 1：与 idle 帧 1 相同。 */
const COMPACT_RETRY_ROWS = [
    "................",
    "................",
    "...0011101101bb.",
    "...0221110220b..",
    "...21b111300b1..",
    "..11bb113bbbbb1.",
    "..00146334302b1.",
    "..1bb3333330b2b.",
    ".0bbb378171bb2b.",
    ".b0b1b781710bb1.",
    ".b0.b.78.7b63b1.",
    "..b..6.6666b32b.",
    ".....99.b99..2b.",
    ".....99.b99.....",
    ".....aa..aa.....",
    ".....aa..aa.....",
  ] as const;

/** retry 帧 2：上半身（行 2-12）水平右移 1px，边缘裁剪。 */
const COMPACT_RETRY_ALT_ROWS = [
    "................",
    "................",
    "....0011101101b.",
    "....0221110220b.",
    "....21b111300b1.",
    "...11bb113bbbbb.",
    "...00146334302b.",
    "...1bb3333330b2.",
    "..0bbb378171bb2.",
    "..b0b1b781710bb.",
    "..b0.b.78.7b63b.",
    "...b..6.6666b32.",
    "......99.b99..2.",
    ".....99.b99.....",
    ".....aa..aa.....",
    ".....aa..aa.....",
  ] as const;

export const REGULAR_IDLE_FRAMES = [makeFrame("regular", REGULAR_IDLE_ROWS), makeFrame("regular", REGULAR_IDLE_BLINK_ROWS)];
export const REGULAR_THINKING_FRAMES = [makeFrame("regular", REGULAR_THINKING_ROWS), makeFrame("regular", REGULAR_THINKING_ALT_ROWS)];
export const REGULAR_WORKING_FRAMES = [makeFrame("regular", REGULAR_WORKING_ROWS), makeFrame("regular", REGULAR_WORKING_ALT_ROWS)];
export const REGULAR_WAITING_FRAMES = [makeFrame("regular", REGULAR_WAITING_ROWS), makeFrame("regular", REGULAR_WAITING_ALT_ROWS)];
export const REGULAR_SUCCESS_FRAMES = [makeFrame("regular", REGULAR_SUCCESS_ROWS)];
export const REGULAR_ERROR_FRAMES = [makeFrame("regular", REGULAR_ERROR_ROWS)];
export const REGULAR_RETRY_FRAMES = [makeFrame("regular", REGULAR_RETRY_ROWS), makeFrame("regular", REGULAR_RETRY_ALT_ROWS)];

export const COMPACT_IDLE_FRAMES = [makeFrame("compact", COMPACT_IDLE_ROWS), makeFrame("compact", COMPACT_IDLE_BLINK_ROWS)];
export const COMPACT_THINKING_FRAMES = [makeFrame("compact", COMPACT_THINKING_ROWS), makeFrame("compact", COMPACT_THINKING_ALT_ROWS)];
export const COMPACT_WORKING_FRAMES = [makeFrame("compact", COMPACT_WORKING_ROWS), makeFrame("compact", COMPACT_WORKING_ALT_ROWS)];
export const COMPACT_WAITING_FRAMES = [makeFrame("compact", COMPACT_WAITING_ROWS), makeFrame("compact", COMPACT_WAITING_ALT_ROWS)];
export const COMPACT_SUCCESS_FRAMES = [makeFrame("compact", COMPACT_SUCCESS_ROWS)];
export const COMPACT_ERROR_FRAMES = [makeFrame("compact", COMPACT_ERROR_ROWS)];
export const COMPACT_RETRY_FRAMES = [makeFrame("compact", COMPACT_RETRY_ROWS), makeFrame("compact", COMPACT_RETRY_ALT_ROWS)];

const FRAME_TABLE: Record<PetSize, Record<PetState, readonly PixelFrame[]>> = {
  regular: {
    idle: REGULAR_IDLE_FRAMES,
    thinking: REGULAR_THINKING_FRAMES,
    working: REGULAR_WORKING_FRAMES,
    waiting: REGULAR_WAITING_FRAMES,
    success: REGULAR_SUCCESS_FRAMES,
    error: REGULAR_ERROR_FRAMES,
    retry: REGULAR_RETRY_FRAMES,
  },
  compact: {
    idle: COMPACT_IDLE_FRAMES,
    thinking: COMPACT_THINKING_FRAMES,
    working: COMPACT_WORKING_FRAMES,
    waiting: COMPACT_WAITING_FRAMES,
    success: COMPACT_SUCCESS_FRAMES,
    error: COMPACT_ERROR_FRAMES,
    retry: COMPACT_RETRY_FRAMES,
  },
};

export function buildFinalSpec(size: PetSize, state: PetState): AnimationSpec {
  return {
    frames: FRAME_TABLE[size][state],
    frameDurationMs: FRAME_DURATIONS[state],
    loop: LOOP_STATES.includes(state),
  };
}

export const FINAL_MANIFEST: CharacterManifest = {
  id: "shigure",
  displayName: "时雨",
  palette: SHIGURE_PALETTE,
  sizes: {
    regular: {
      idle: buildFinalSpec("regular", "idle"),
      thinking: buildFinalSpec("regular", "thinking"),
      working: buildFinalSpec("regular", "working"),
      waiting: buildFinalSpec("regular", "waiting"),
      success: buildFinalSpec("regular", "success"),
      error: buildFinalSpec("regular", "error"),
      retry: buildFinalSpec("regular", "retry"),
    },
    compact: {
      idle: buildFinalSpec("compact", "idle"),
      thinking: buildFinalSpec("compact", "thinking"),
      working: buildFinalSpec("compact", "working"),
      waiting: buildFinalSpec("compact", "waiting"),
      success: buildFinalSpec("compact", "success"),
      error: buildFinalSpec("compact", "error"),
      retry: buildFinalSpec("compact", "retry"),
    },
  },
};

export const FINAL_ASSETS_READY = true as const;

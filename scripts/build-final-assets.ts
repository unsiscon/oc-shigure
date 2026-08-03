#!/usr/bin/env tsx
/**
 * build-final-assets.ts —— 确定性帧生成器（art-v3 交付）。
 *
 * 输入：design/art-v2/shigure-pixel-data.json（美术 agent 从 v3 母稿提取的
 *       regular/compact idle_frame 最近邻追踪种子，字符图例 .0123456789ab ↔ 调色板 0-12）。
 * 输出：src/assets/final.ts（七状态最终帧；全部导出符号与模块结构保持不变）。
 *
 * 修正管线（全部程序化，无手绘）：
 *   1. trimEdges  —— 清 x0 与 x(W-1) 两列（修复技术侦察发现的左右边缘违规）。
 *   2. clearTopGap —— 清逻辑第 1 行（v3 种子把头部冠顶放在 y=1；renderer 契约要求
 *                    输出行 0 即逻辑行 0-1 全透明，validator 只保证 y=0）。
 *   3. injectEyes —— 在种子 '5'(eye_deep) 所在眼部行注入 '4'(eye_blue) 蓝眼簇，
 *                    每侧 regular 2px / compact 1px，簇内保留深瞳 '5'。
 *   3. 派生七状态（shiftRows / setPixels / clearPixels / patchFirst 等小助手）。
 *   4. token 检查 —— 每 (size,state) 断言 eye_blue/ribbon_red/trim_warm_white/sock_black ≥1，
 *                    缺则就近注入 1px（本批次所有状态均天然满足，仅为安全网）。
 *   5. validateManifest 断言零违规后才写出 final.ts。
 *
 * 确定性：同输入 → 同输出（无随机、无时间依赖）。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateManifest } from "../src/manifest";
import { FRAME_DURATIONS, SHIGURE_PALETTE, SIZE_DIMENSIONS } from "../src/manifest-data";
import type { CharacterManifest, PetSize, PetState } from "../src/types";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SEED_PATH = join(ROOT, "design", "art-v2", "shigure-pixel-data.json");
const OUT_PATH = join(ROOT, "src", "assets", "final.ts");

type Grid = string[];

interface Edit {
  x: number;
  y: number;
  from: string;
  to: string;
  note: string;
}

/** 全局修改日志：全部 trim/inject/派生编辑，用于坐标清单汇报。 */
const log: Edit[] = [];

function withLog(note: string, result: { rows: Grid; edits: Edit[] }): Grid {
  for (const e of result.edits) log.push({ ...e, note });
  return result.rows;
}

// ---------------------------------------------------------------- 基础修正

function trimEdges(g: Grid): { rows: Grid; edits: Edit[] } {
  const w = g[0].length;
  const edits: Edit[] = [];
  const rows = g.map((r) => r.split(""));
  for (let y = 0; y < rows.length; y += 1) {
    if (rows[y][0] !== ".") {
      edits.push({ x: 0, y, from: rows[y][0], to: ".", note: "" });
      rows[y][0] = ".";
    }
    if (rows[y][w - 1] !== ".") {
      edits.push({ x: w - 1, y, from: rows[y][w - 1], to: ".", note: "" });
      rows[y][w - 1] = ".";
    }
  }
  return { rows: rows.map((r) => r.join("")), edits };
}

/** 顶隙：清逻辑第 1 行（输出行 0 = 逻辑行 0+1 须全透明，renderer 契约）。 */
function clearTopGap(g: Grid): { rows: Grid; edits: Edit[] } {
  const edits: Edit[] = [];
  const row = g[1];
  if (row === undefined) return { rows: g, edits };
  const chars = row.split("");
  for (let x = 0; x < chars.length; x += 1) {
    if (chars[x] !== ".") {
      edits.push({ x, y: 1, from: chars[x], to: ".", note: "" });
      chars[x] = ".";
    }
  }
  return { rows: [g[0], chars.join(""), ...g.slice(2)], edits };
}

function injectEyes(g: Grid, perSide: number): { rows: Grid; edits: Edit[] } {
  const w = g[0].length;
  const mid = w / 2;
  const eyePixels: [number, number][] = [];
  g.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) if (row[x] === "5") eyePixels.push([x, y]);
  });
  if (eyePixels.length === 0) return { rows: g, edits: [] };
  const bySide = (s: "L" | "R") =>
    eyePixels
      .filter(([x]) => (s === "L" ? x < mid : x >= mid))
      .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const targets = [...bySide("L").slice(0, perSide), ...bySide("R").slice(0, perSide)];
  const rows = g.map((r) => r.split(""));
  const edits: Edit[] = [];
  for (const [x, y] of targets) {
    edits.push({ x, y, from: "5", to: "4", note: "" });
    rows[y][x] = "4";
  }
  return { rows: rows.map((r) => r.join("")), edits };
}

// ---------------------------------------------------------------- 终端尺度清理（art-v4：去白点）

/** 阶段1：清除所有散落的亮色簇色（'7' 暖白 / '8' 红 / '9' 袜黑 / 'a' 靴棕）——它们将被结构蒙版重绘。 */
function clearScatter(g: Grid): { rows: Grid; edits: Edit[] } {
  const rows = g.map((r) => r.split(""));
  const edits: Edit[] = [];
  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y].length; x += 1) {
      const c = rows[y][x];
      if (c === "7" || c === "8" || c === "9" || c === "a") {
        edits.push({ x, y, from: c, to: ".", note: "" });
        rows[y][x] = ".";
      }
    }
  }
  return { rows: rows.map((r) => r.join("")), edits };
}

/** 阶段2：按语义蒙版重绘结构簇（连续块，杜绝孤立点）。 */
function writeMasks(g: Grid): { rows: Grid; edits: Edit[] } {
  const size = g[0].length === 24 ? "regular" : "compact";
  const cells: [number, number][] = [];
  const chars: string[] = [];
  const add = (xs: number[], ys: number[], c: string) => {
    for (const x of xs) for (const y of ys) {
      cells.push([x, y]);
      chars.push(c);
    }
  };
  if (size === "regular") {
    add([6, 7, 16, 17], [11, 12, 13, 14], "7");
    add([10, 11], [11, 12, 13, 14, 15, 16], "8");
    add([8, 9, 14, 15], [18, 19, 20], "9");
    add([8, 9, 14, 15], [21, 22], "a");
    for (let y = 5; y <= 12; y += 1) {
      const p = (y - 5) % 4;
      cells.push([19, y], [20, y]);
      chars.push(p < 2 ? "b" : "2", p < 2 ? "1" : "b");
    }
  } else {
    add([6, 9], [8, 9, 10], "7");
    add([7], [8, 9, 10], "8");
    add([5, 6, 9, 10], [12, 13], "9");
    add([5, 6, 9, 10], [14, 15], "a");
    for (let y = 5; y <= 12; y += 1) {
      const p = (y - 5) % 4;
      cells.push([13, y], [14, y]);
      chars.push(p < 2 ? "b" : "2", p < 2 ? "1" : "b");
    }
  }
  const rows = g.map((r) => r.split(""));
  const edits: Edit[] = [];
  cells.forEach(([x, y], i) => {
    const from = rows[y][x];
    if (from === chars[i]) return;
    edits.push({ x, y, from, to: chars[i], note: "" });
    rows[y][x] = chars[i];
  });
  return { rows: rows.map((r) => r.join("")), edits };
}

/** 阶段3：迭代去噪——删除"8 邻域内无同色邻居"的像素（色限 7/8/a/9/3/1/2；'4' 眼睛永远保留）。 */
function denoiseIterative(g: Grid): { rows: Grid; edits: Edit[] } {
  const DENOISE = new Set(["7", "8", "a", "9", "3", "1", "2", "b"]);
  const w = g[0].length;
  const h = g.length;
  let grid = g.map((r) => r.split(""));
  const edits: Edit[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const c = grid[y][x];
        if (!DENOISE.has(c)) continue;
        let same = false;
        for (let dy = -1; dy <= 1 && !same; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            if (grid[ny][nx] === c) {
              same = true;
              break;
            }
          }
        }
        if (!same) {
          edits.push({ x, y, from: c, to: ".", note: "" });
          grid[y][x] = ".";
          changed = true;
        }
      }
    }
  }
  return { rows: grid.map((r) => r.join("")), edits };
}

/** 阶段4：发区补洞——hair 区（行 2-9）内 ≥3 个不透明 8 邻域的 '.' 补为发色 '1'（修复清散点造成的发际缺口）。 */
function hairMend(g: Grid): { rows: Grid; edits: Edit[] } {
  const w = g[0].length;
  const grid = g.map((r) => r.split(""));
  const edits: Edit[] = [];
  for (let y = 2; y <= 9; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      if (grid[y][x] !== ".") continue;
      let opaque = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= g.length) continue;
          if (grid[ny][nx] !== ".") opaque += 1;
        }
      }
      if (opaque >= 5) {
        edits.push({ x, y, from: ".", to: "1", note: "" });
        grid[y][x] = "1";
      }
    }
  }
  return { rows: grid.map((r) => r.join("")), edits };
}

function cleanupTerminal(g: Grid): { rows: Grid; edits: Edit[] } {
  let rows = g;
  let edits: Edit[] = [];
  const s1 = clearScatter(rows);
  rows = s1.rows;
  edits = edits.concat(s1.edits);
  const s2 = writeMasks(rows);
  rows = s2.rows;
  edits = edits.concat(s2.edits);
  const s3 = denoiseIterative(rows);
  rows = s3.rows;
  edits = edits.concat(s3.edits);
  const s4 = hairMend(rows);
  rows = s4.rows;
  edits = edits.concat(s4.edits);
  return { rows, edits };
}

// ---------------------------------------------------------------- 眼部小助手

function eyeBand(g: Grid): number[] {
  const ys: number[] = [];
  g.forEach((row, y) => {
    if (row.includes("4") || row.includes("5")) ys.push(y);
  });
  return ys;
}

function eyePixels(g: Grid, band: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const y of band) {
    for (let x = 0; x < g[y].length; x += 1) {
      const c = g[y][x];
      if (c === "4" || c === "5") out.push([x, y]);
    }
  }
  return out;
}

/** 眼部带整体平移 dy 行（先清旧位、再写新位，避免同帧互相覆盖）。 */
function moveEyeBand(g: Grid, dy: number): { rows: Grid; edits: Edit[] } {
  const band = eyeBand(g);
  if (band.length === 0) return { rows: g, edits: [] };
  const pixels = eyePixels(g, band);
  const rows = g.map((r) => r.split(""));
  const edits: Edit[] = [];
  for (const [x, y] of pixels) {
    edits.push({ x, y, from: g[y][x], to: ".", note: "" });
    rows[y][x] = ".";
  }
  for (const [x, y] of pixels) {
    const ny = y + dy;
    if (ny < 0 || ny >= g.length) continue;
    const from = g[ny][x];
    rows[ny][x] = g[y][x];
    edits.push({ x, y: ny, from, to: g[y][x], note: "" });
  }
  return { rows: rows.map((r) => r.join("")), edits };
}

/** 眼部内收 1px：左眼右移、右眼左移（x<mid 的像素 +1，其余 -1）。 */
function moveEyesInward(g: Grid): { rows: Grid; edits: Edit[] } {
  const band = eyeBand(g);
  if (band.length === 0) return { rows: g, edits: [] };
  const w = g[0].length;
  const pixels = eyePixels(g, band);
  const rows = g.map((r) => r.split(""));
  const edits: Edit[] = [];
  for (const [x, y] of pixels) {
    edits.push({ x, y, from: g[y][x], to: ".", note: "" });
    rows[y][x] = ".";
  }
  for (const [x, y] of pixels) {
    const nx = x + (x < w / 2 ? 1 : -1);
    if (nx < 0 || nx >= w) continue;
    const from = g[y][nx];
    rows[y][nx] = g[y][x];
    edits.push({ x: nx, y, from, to: g[y][x], note: "" });
  }
  return { rows: rows.map((r) => r.join("")), edits };
}

// ---------------------------------------------------------------- 发型 / 手 / 脚

/** 刘海偏移 1px：取最顶含 '2' 行的左右端 '2'，各向外侧挪 1px；目标已含 '2' 则反向（保证可见 1px 变化）。 */
function fringeOffset(g: Grid): { rows: Grid; edits: Edit[] } {
  const y0 = g.findIndex((row) => row.includes("2"));
  if (y0 < 0) return { rows: g, edits: [] };
  const xs: number[] = [];
  for (let x = 0; x < g[y0].length; x += 1) if (g[y0][x] === "2") xs.push(x);
  const rows = g.map((r) => r.split(""));
  const edits: Edit[] = [];
  const move = (fromX: number, dir: 1 | -1) => {
    let toX = fromX + dir;
    if (toX < 0 || toX >= g[y0].length) return;
    if (rows[y0][toX] === "2") {
      const alt = fromX - dir;
      if (alt < 0 || alt >= g[y0].length || rows[y0][alt] === "2") return;
      toX = alt;
    }
    edits.push({ x: toX, y: y0, from: rows[y0][toX], to: "2", note: "" });
    edits.push({ x: fromX, y: y0, from: "2", to: ".", note: "" });
    rows[y0][toX] = "2";
    rows[y0][fromX] = ".";
  };
  move(xs[0], 1);
  move(xs[xs.length - 1], -1);
  return { rows: rows.map((r) => r.join("")), edits };
}

function setPixels(g: Grid, cells: readonly [number, number][], value: string): { rows: Grid; edits: Edit[] } {
  const rows = g.map((r) => r.split(""));
  const edits: Edit[] = [];
  for (const [x, y] of cells) {
    const from = rows[y][x];
    if (from === value) continue;
    edits.push({ x, y, from, to: value, note: "" });
    rows[y][x] = value;
  }
  return { rows: rows.map((r) => r.join("")), edits };
}

/** success：脚/靴整组上移 1px —— 清最底行非透明像素、并入上一行，底行零残留。 */
function liftFeet(g: Grid): { rows: Grid; edits: Edit[] } {
  const rows = g.map((r) => r.split(""));
  let last = -1;
  for (let y = g.length - 1; y >= 0; y -= 1) {
    if (/[^.]/.test(g[y])) {
      last = y;
      break;
    }
  }
  if (last < 1) return { rows: g, edits: [] };
  const edits: Edit[] = [];
  for (let x = 0; x < g[0].length; x += 1) {
    const c = g[last][x];
    if (c === ".") continue;
    const from = rows[last - 1][x];
    rows[last - 1][x] = c;
    rows[last][x] = ".";
    edits.push({ x, y: last, from: c, to: ".", note: "" });
    edits.push({ x, y: last - 1, from, to: c, note: "" });
  }
  return { rows: rows.map((r) => r.join("")), edits };
}

/** error：眼部变窄。眼部带 ≥2 行（regular）→ 清最底一行眼像素；单行（compact）→ 眼部内收 1px。 */
function narrowEyes(g: Grid): { rows: Grid; edits: Edit[] } {
  const band = eyeBand(g);
  if (band.length >= 2) {
    const yClear = band[band.length - 1];
    const rows = g.map((r) => r.split(""));
    const edits: Edit[] = [];
    for (let x = 0; x < g[yClear].length; x += 1) {
      const c = g[yClear][x];
      if (c === "4" || c === "5") {
        edits.push({ x, y: yClear, from: c, to: ".", note: "" });
        rows[yClear][x] = ".";
      }
    }
    return { rows: rows.map((r) => r.join("")), edits };
  }
  return moveEyesInward(g);
}

/** retry 帧2：上半身（yFrom..yTo 行）水平右移 1px，边缘裁剪（x0 与 x(W-1) 恒透明）。 */
function shiftRowsRight(g: Grid, yFrom: number, yTo: number): { rows: Grid; edits: Edit[] } {
  const w = g[0].length;
  const rows: Grid = [];
  const edits: Edit[] = [];
  for (let y = 0; y < g.length; y += 1) {
    if (y < yFrom || y > yTo) {
      rows.push(g[y]);
      continue;
    }
    const next = new Array<string>(w).fill(".");
    for (let x = 1; x <= w - 2; x += 1) next[x] = g[y][x - 1];
    for (let x = 1; x <= w - 2; x += 1) {
      if (g[y][x] !== next[x]) edits.push({ x, y, from: g[y][x], to: next[x], note: "" });
    }
    rows.push(next.join(""));
  }
  return { rows, edits };
}

/** 眨眼：把第一枚 '4'(eye_blue) 变 '5'(eye_deep)，仅 1 像素。 */
function blinkFirst(rows: Grid): Grid {
  for (let y = 0; y < rows.length; y += 1) {
    const x = rows[y].indexOf("4");
    if (x >= 0) {
      log.push({ x, y, from: "4", to: "5", note: "idle 帧2 眨眼 1px" });
      const grid = rows.map((r) => r.split(""));
      grid[y][x] = "5";
      return grid.map((r) => r.join(""));
    }
  }
  throw new Error("blinkFirst: no '4' found in idle frame");
}

// ---------------------------------------------------------------- token 安全网

function injectTokenNearOpaque(rows: Grid, token: string, note: string): Grid {
  const w = rows[0].length;
  const h = rows.length;
  const opaque = (x: number, y: number) =>
    y >= 0 && y < h && x >= 0 && x < w && rows[y][x] !== ".";
  for (let y = 2; y < h - 2; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      if (rows[y][x] !== ".") continue;
      if (opaque(x - 1, y) || opaque(x + 1, y) || opaque(x, y - 1) || opaque(x, y + 1)) {
        const grid = rows.map((r) => r.split(""));
        grid[y][x] = token;
        log.push({ x, y, from: ".", to: token, note });
        return grid.map((r) => r.join(""));
      }
    }
  }
  throw new Error(`injectTokenNearOpaque: no candidate for token ${token} (${note})`);
}

function ensureTokens(frames: Grid[], label: string): Grid[] {
  const required: [string, string][] = [
    ["4", "eye_blue"],
    ["8", "ribbon_red"],
    ["7", "trim_warm_white"],
    ["9", "sock_black"],
  ];
  const out = frames.map((f) => [...f]);
  for (const [token, name] of required) {
    const present = out.some((frame) => frame.some((row) => row.includes(token)));
    if (!present) {
      console.log(`  [token] ${label}: 缺 ${name}，就近注入 1px`);
      out[0] = injectTokenNearOpaque(out[0], token, `${label}: 注入缺失 ${name}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------- 主构建

const RAW = JSON.parse(readFileSync(SEED_PATH, "utf8")) as {
  sizes: Record<"regular" | "compact", { width: number; height: number; idle_frame: string[] }>;
};

const ALL_STATES = ["idle", "thinking", "working", "waiting", "success", "error", "retry"] as const;

interface SizeArt {
  size: PetSize;
  frames: Record<PetState, Grid[]>;
}

function build(size: "regular" | "compact"): SizeArt {
  const rawFrame = RAW.sizes[size].idle_frame;
  const perSide = size === "regular" ? 2 : 1;

  let seed = withLog(`${size} seed: trimEdges`, trimEdges(rawFrame));
  seed = withLog(`${size} seed: clearTopGap`, clearTopGap(seed));
  seed = withLog(`${size} seed: injectEyes`, injectEyes(seed, perSide));
  seed = withLog(`${size} seed: cleanupTerminal（去白点/结构簇重绘/去噪/补洞）`, cleanupTerminal(seed));

  const WORK_F1: [number, number][] =
    size === "regular"
      ? [[6, 15], [7, 15], [6, 16], [7, 16], [16, 15], [17, 15], [16, 16], [17, 16]]
      : [[2, 8], [3, 8], [2, 9], [3, 9], [12, 8], [13, 8], [12, 9], [13, 9]];
  const WORK_F2: [number, number][] =
    size === "regular"
      ? [[7, 15], [8, 15], [7, 16], [8, 16], [15, 15], [16, 15], [15, 16], [16, 16]]
      : [[3, 8], [4, 8], [3, 9], [4, 9], [11, 8], [12, 8], [11, 9], [12, 9]];
  const WAIT_HANDS: [number, number][] = size === "regular" ? [[11, 17], [12, 17]] : [[7, 13], [8, 13]];

  const idle1 = seed;
  const idle2 = blinkFirst(seed);

  const eyesUp = withLog(`${size} thinking/waiting 帧1: 眼部上移 1px`, moveEyeBand(seed, -1));
  const think1 = withLog(`${size} thinking 帧1: 刘海偏移 1px`, fringeOffset(eyesUp));
  const think2 = withLog(`${size} thinking 帧2: 眼部内收 1px`, moveEyesInward(think1));

  const work1 = withLog(`${size} working 帧1: 双手置于体侧 2x2`, setPixels(seed, WORK_F1, "7"));
  const work2 = withLog(
    `${size} working 帧2: 双手内收 1px`,
    setPixels(withLog(`${size} working 帧2: 清旧手位`, setPixels(work1, WORK_F1, ".")), WORK_F2, "7"),
  );

  const wait1 = withLog(`${size} waiting 帧1: 双手红结下合拢`, setPixels(eyesUp, WAIT_HANDS, "7"));
  const wait2 = withLog(`${size} waiting 帧2: 眼部回原位 + 双手合拢`, setPixels(seed, WAIT_HANDS, "7"));

  const succ = withLog(`${size} success: 脚/靴整组上移 1px`, liftFeet(seed));
  const err = withLog(`${size} error: 眼部变窄`, narrowEyes(seed));

  const retry1 = seed;
  const retry2 = withLog(`${size} retry 帧2: 上半身(行2-12)右移 1px`, shiftRowsRight(seed, 2, 12));

  const frames: Record<PetState, Grid[]> = {
    idle: [idle1, idle2],
    thinking: [think1, think2],
    working: [work1, work2],
    waiting: [wait1, wait2],
    success: [succ],
    error: [err],
    retry: [retry1, retry2],
  };
  for (const state of ALL_STATES) {
    frames[state] = ensureTokens(frames[state], `${size}/${state}`);
  }
  return { size, frames };
}

const art: Record<PetSize, SizeArt> = { regular: build("regular"), compact: build("compact") };

// ---------------------------------------------------------------- 验证（validateManifest 断言零违规）

function makeFrame(size: PetSize, rows: Grid) {
  const dimension = SIZE_DIMENSIONS[size];
  if (rows.length !== dimension) throw new Error(`makeFrame: row count ${rows.length} != ${dimension}`);
  const pixels = new Uint8Array(dimension * dimension);
  rows.forEach((row, y) => {
    if (row.length !== dimension) throw new Error(`decodeRow: row ${y} has width ${row.length}, expected ${dimension}`);
    for (let x = 0; x < dimension; x += 1) {
      const idx = ".0123456789ab".indexOf(row[x]);
      if (idx < 0) throw new Error(`invalid char ${JSON.stringify(row[x])} at (${x}, ${y})`);
      pixels[y * dimension + x] = idx;
    }
  });
  return { width: dimension, height: dimension, pixels };
}

const LOOP_STATES: readonly PetState[] = ["idle", "thinking", "working", "waiting", "retry"];

function specFor(size: PetSize, state: PetState, frames: Grid[]) {
  return {
    frames: frames.map((f) => makeFrame(size, f)),
    frameDurationMs: FRAME_DURATIONS[state],
    loop: LOOP_STATES.includes(state),
  };
}

const manifest: CharacterManifest = {
  id: "shigure",
  displayName: "时雨",
  palette: SHIGURE_PALETTE,
  sizes: {
    regular: {
      idle: specFor("regular", "idle", art.regular.frames.idle),
      thinking: specFor("regular", "thinking", art.regular.frames.thinking),
      working: specFor("regular", "working", art.regular.frames.working),
      waiting: specFor("regular", "waiting", art.regular.frames.waiting),
      success: specFor("regular", "success", art.regular.frames.success),
      error: specFor("regular", "error", art.regular.frames.error),
      retry: specFor("regular", "retry", art.regular.frames.retry),
    },
    compact: {
      idle: specFor("compact", "idle", art.compact.frames.idle),
      thinking: specFor("compact", "thinking", art.compact.frames.thinking),
      working: specFor("compact", "working", art.compact.frames.working),
      waiting: specFor("compact", "waiting", art.compact.frames.waiting),
      success: specFor("compact", "success", art.compact.frames.success),
      error: specFor("compact", "error", art.compact.frames.error),
      retry: specFor("compact", "retry", art.compact.frames.retry),
    },
  },
};

const violations = validateManifest(manifest);
if (violations.length > 0) {
  console.error("FAIL: 生成器产物未通过 validateManifest：");
  for (const v of violations) console.error(`- ${v}`);
  process.exit(1);
}
console.log("PASS: 生成器产物 validateManifest 零违规");

// ---------------------------------------------------------------- 写出 final.ts

const HELPERS = `export function decodeRow(row: string, y: number, width: number, pixels: Uint8Array): void {
  if (row.length !== width) throw new Error(\`decodeRow: row \${y} has width \${row.length}, expected \${width}\`);
  for (let x = 0; x < width; x += 1) {
    const paletteIndex = ROW_CHARS.indexOf(row[x] as (typeof ROW_CHARS)[number]);
    if (paletteIndex < 0) throw new Error(\`decodeRow: invalid character \${JSON.stringify(row[x])} at (\${x}, \${y})\`);
    pixels[y * width + x] = paletteIndex;
  }
}

function makeFrame(size: PetSize, rows: readonly string[]): PixelFrame {
  const dimension = SIZE_DIMENSIONS[size];
  if (rows.length !== dimension) throw new Error(\`makeFrame: row count \${rows.length} != \${dimension}\`);
  const pixels = new Uint8Array(dimension * dimension);
  rows.forEach((row, y) => decodeRow(row, y, dimension, pixels));
  return { width: dimension, height: dimension, pixels };
}

function patchRows(rows: readonly string[], patches: readonly [x: number, y: number, value: string][]): string[] {
  const next = rows.map((row) => row.split(""));
  for (const [x, y, value] of patches) {
    if (value.length !== 1 || !ROW_CHARS.includes(value as (typeof ROW_CHARS)[number])) {
      throw new Error(\`patchRows: invalid value \${JSON.stringify(value)}\`);
    }
    const line = next[y];
    if (!line || x < 0 || x >= line.length) throw new Error(\`patchRows: out of bounds (\${x}, \${y})\`);
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
  throw new Error(\`patchFirst: token \${from} occurrence \${occurrence} not found\`);
}`;

const ROW_COMMENTS: Record<PetState, [string, string]> = {
  idle: ["REGULAR_IDLE_ROWS", "idle 帧 1：JSON v3 种子 + 修边 + 顶隙 + 蓝眼注入。"],
  thinking: ["REGULAR_THINKING_ROWS", "thinking 帧 1：双蓝眼簇上移 1px + 刘海偏移 1px。"],
  working: ["REGULAR_WORKING_ROWS", "working 帧 1：双手在身体两侧（warm white '7'，2×2px）。"],
  waiting: ["REGULAR_WAITING_ROWS", "waiting 帧 1：眼部上移 1px + 双手在红结下方合拢（中心 2px '7'）。"],
  success: ["REGULAR_SUCCESS_ROWS", "success：脚/靴整组上移 1px，底行零残留。"],
  error: ["REGULAR_ERROR_ROWS", "error：眼部变窄，每侧保留 ≥1px 蓝眼。"],
  retry: ["REGULAR_RETRY_ROWS", "retry 帧 1：与 idle 帧 1 相同。"],
};

function emitRows(name: string, comment: string, rows: Grid): string[] {
  return [
    `/** ${comment} */`,
    `const ${name} = [`,
    ...rows.map((r) => `    ${JSON.stringify(r)},`),
    `  ] as const;`,
    ``,
  ];
}

function emitModule(): string {
  const P: string[] = [];
  P.push(`// 时雨最终像素资产：行字符串使用 docs/08 §4.2 的 13 色索引图例。`);
  P.push(`// 本文件由 scripts/build-final-assets.ts 从 design/art-v2/shigure-pixel-data.json 的 v3 母稿种子`);
  P.push(`// 程序化修正生成（trimEdges / clearTopGap / injectEyes / 状态派生），非手绘；同输入产出同输出。`);
  P.push(`import { FRAME_DURATIONS, SHIGURE_PALETTE, SIZE_DIMENSIONS } from "../manifest-data";`);
  P.push(`import type { AnimationSpec, CharacterManifest, PetSize, PetState, PixelFrame } from "../types";`);
  P.push(``);
  P.push(`export const ROW_CHARS = ".0123456789ab" as const;`);
  P.push(``);
  P.push(`const LOOP_STATES: readonly PetState[] = ["idle", "thinking", "working", "waiting", "retry"];`);
  P.push(``);
  P.push(HELPERS);
  P.push(``);
  for (const size of ["regular", "compact"] as const) {
    const a = art[size];
    const upper = size === "regular" ? "REGULAR" : "COMPACT";
    const f = a.frames;
    P.push(`// ---------------- ${size}（${SIZE_DIMENSIONS[size]}×${SIZE_DIMENSIONS[size]}） ----------------`);
    P.push(``);
    P.push(...emitRows(`${upper}_IDLE_ROWS`, ROW_COMMENTS.idle[1], f.idle[0]));
    P.push(`/** idle 帧 2：第一枚蓝眼像素变深瞳（1px 眨眼）。 */`);
    P.push(`const ${upper}_IDLE_BLINK_ROWS = patchFirst(${upper}_IDLE_ROWS, "4", "5");`);
    P.push(``);
    P.push(...emitRows(`${upper}_THINKING_ROWS`, ROW_COMMENTS.thinking[1], f.thinking[0]));
    P.push(...emitRows(`${upper}_THINKING_ALT_ROWS`, "thinking 帧 2：帧 1 + 眼部内收 1px。", f.thinking[1]));
    P.push(...emitRows(`${upper}_WORKING_ROWS`, ROW_COMMENTS.working[1], f.working[0]));
    P.push(...emitRows(`${upper}_WORKING_ALT_ROWS`, "working 帧 2：双手内收 1px；裙/袜/靴/发基线不动。", f.working[1]));
    P.push(...emitRows(`${upper}_WAITING_ROWS`, ROW_COMMENTS.waiting[1], f.waiting[0]));
    P.push(...emitRows(`${upper}_WAITING_ALT_ROWS`, "waiting 帧 2：眼部回原位 + 双手合拢。", f.waiting[1]));
    P.push(...emitRows(`${upper}_SUCCESS_ROWS`, ROW_COMMENTS.success[1], f.success[0]));
    P.push(...emitRows(`${upper}_ERROR_ROWS`, ROW_COMMENTS.error[1], f.error[0]));
    P.push(...emitRows(`${upper}_RETRY_ROWS`, ROW_COMMENTS.retry[1], f.retry[0]));
    P.push(...emitRows(`${upper}_RETRY_ALT_ROWS`, "retry 帧 2：上半身（行 2-12）水平右移 1px，边缘裁剪。", f.retry[1]));
  }
  const frameExports = (upper: string): string[] => [
    `export const ${upper}_IDLE_FRAMES = [makeFrame("${upper === "REGULAR" ? "regular" : "compact"}", ${upper}_IDLE_ROWS), makeFrame("${upper === "REGULAR" ? "regular" : "compact"}", ${upper}_IDLE_BLINK_ROWS)];`,
    `export const ${upper}_THINKING_FRAMES = [makeFrame("${upper === "REGULAR" ? "regular" : "compact"}", ${upper}_THINKING_ROWS), makeFrame("${upper === "REGULAR" ? "regular" : "compact"}", ${upper}_THINKING_ALT_ROWS)];`,
    `export const ${upper}_WORKING_FRAMES = [makeFrame("${upper === "REGULAR" ? "regular" : "compact"}", ${upper}_WORKING_ROWS), makeFrame("${upper === "REGULAR" ? "regular" : "compact"}", ${upper}_WORKING_ALT_ROWS)];`,
    `export const ${upper}_WAITING_FRAMES = [makeFrame("${upper === "REGULAR" ? "regular" : "compact"}", ${upper}_WAITING_ROWS), makeFrame("${upper === "REGULAR" ? "regular" : "compact"}", ${upper}_WAITING_ALT_ROWS)];`,
    `export const ${upper}_SUCCESS_FRAMES = [makeFrame("${upper === "REGULAR" ? "regular" : "compact"}", ${upper}_SUCCESS_ROWS)];`,
    `export const ${upper}_ERROR_FRAMES = [makeFrame("${upper === "REGULAR" ? "regular" : "compact"}", ${upper}_ERROR_ROWS)];`,
    `export const ${upper}_RETRY_FRAMES = [makeFrame("${upper === "REGULAR" ? "regular" : "compact"}", ${upper}_RETRY_ROWS), makeFrame("${upper === "REGULAR" ? "regular" : "compact"}", ${upper}_RETRY_ALT_ROWS)];`,
    ``,
  ];
  P.push(...frameExports("REGULAR"));
  P.push(...frameExports("COMPACT"));
  P.push(`const FRAME_TABLE: Record<PetSize, Record<PetState, readonly PixelFrame[]>> = {`);
  P.push(`  regular: {`);
  for (const s of ALL_STATES) P.push(`    ${s}: REGULAR_${s.toUpperCase()}_FRAMES,`);
  P.push(`  },`);
  P.push(`  compact: {`);
  for (const s of ALL_STATES) P.push(`    ${s}: COMPACT_${s.toUpperCase()}_FRAMES,`);
  P.push(`  },`);
  P.push(`};`);
  P.push(``);
  P.push(`export function buildFinalSpec(size: PetSize, state: PetState): AnimationSpec {`);
  P.push(`  return {`);
  P.push(`    frames: FRAME_TABLE[size][state],`);
  P.push(`    frameDurationMs: FRAME_DURATIONS[state],`);
  P.push(`    loop: LOOP_STATES.includes(state),`);
  P.push(`  };`);
  P.push(`}`);
  P.push(``);
  P.push(`export const FINAL_MANIFEST: CharacterManifest = {`);
  P.push(`  id: "shigure",`);
  P.push(`  displayName: "时雨",`);
  P.push(`  palette: SHIGURE_PALETTE,`);
  P.push(`  sizes: {`);
  for (const size of ["regular", "compact"] as const) {
    P.push(`    ${size}: {`);
    for (const s of ALL_STATES) P.push(`      ${s}: buildFinalSpec("${size}", "${s}"),`);
    P.push(`    },`);
  }
  P.push(`  },`);
  P.push(`};`);
  P.push(``);
  P.push(`export const FINAL_ASSETS_READY = true as const;`);
  P.push(``);
  return P.join("\n");
}

writeFileSync(OUT_PATH, emitModule(), "utf8");
console.log(`wrote ${OUT_PATH}`);

// ---------------------------------------------------------------- 汇报摘要

const byNote = new Map<string, Edit[]>();
for (const e of log) {
  if (!byNote.has(e.note)) byNote.set(e.note, []);
  byNote.get(e.note)!.push(e);
}
console.log(`\n== 生成器注入/修剪坐标清单（${log.length} 处编辑） ==`);
for (const [note, edits] of byNote) {
  console.log(`- ${note}（${edits.length} 处）`);
  for (const e of edits) console.log(`    (${e.x},${e.y}) ${JSON.stringify(e.from)} -> ${JSON.stringify(e.to)}`);
}

console.log(`\n== regular idle 帧1（图例 .0123456789ab） ==`);
for (const row of art.regular.frames.idle[0]) console.log(row);
console.log(`\n== compact idle 帧1 ==`);
for (const row of art.compact.frames.idle[0]) console.log(row);

console.log(`\n== token 覆盖（每 (size,state) 帧集合内计数） ==`);
for (const size of ["regular", "compact"] as const) {
  for (const state of ALL_STATES) {
    const joined = art[size].frames[state].join("\n");
    const count = (c: string) => joined.split("").filter((ch) => ch === c).length;
    console.log(
      `${size}/${state}: eye_blue=4:${count("4")} ribbon_red=8:${count("8")} warm_white=7:${count("7")} sock_black=9:${count("9")}`,
    );
  }
}

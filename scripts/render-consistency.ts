// T1 防回归门（todo 2）：机械证明三条渲染路径对 src/assets/final.ts regular idle 帧 1
// 输出结构同构（颜色归一化逐格 diff，脚本断言，非人工目测）。
//
// 三路径：
//   (a) 半块文本路径：scripts/preview-assets.ts（复用 renderFrame）→ .omo/evidence/art-preview-regular.txt
//   (b) 像素放大路径：.omo/evidence/art-render-png.py → .omo/evidence/render-consistency-png-index.txt
//       （TS 无 PNG 解码器且禁新依赖，PNG 路径以其逐格索引文本参与比对）
//   (c) 索引矩阵路径：本脚本直接消费 final.ts 的 PixelFrame（makeFrame/decodeRow 语义）
//
// 本脚本 read-only：不修改任何 src/ 文件，不引入新依赖。
// 用法：npx tsx scripts/render-consistency.ts
// 前置：(a)(b) 两路径的输出文件已存在（先跑 preview-assets.ts 与 art-render-png.py）。
// 退出码：0 = 三路径同构（diff 文件仅注释行）；1 = 存在差异或输入缺失/解析失败。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { FINAL_MANIFEST, ROW_CHARS } from "../src/assets/final";
import { SHIGURE_PALETTE } from "../src/manifest-data";

const OUT_DIR = ".omo/evidence";
const INDEX_PATH = join(OUT_DIR, "render-consistency-index.txt");
const PNG_INDEX_PATH = join(OUT_DIR, "render-consistency-png-index.txt");
const PREVIEW_PATH = join(OUT_DIR, "art-preview-regular.txt");
const DIFF_PATH = join(OUT_DIR, "render-consistency-diff.txt");

const DIM = 24; // regular 尺寸
const OUTLINE = "#17141B";

// palette 色 → 索引查找（0 = transparent 不参与；#17141B 即 palette 末项 outline token）。
const COLOR_TO_INDEX = new Map<string, number>();
for (let i = 0; i < SHIGURE_PALETTE.length; i += 1) {
  const color = SHIGURE_PALETTE[i];
  if (color !== "transparent") COLOR_TO_INDEX.set(color.toLowerCase(), i);
}

function writeFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

/** (c) 路径：final.ts regular idle 帧 1 的逐格索引矩阵。 */
function makeIndexMatrix(): string[] {
  const frame = FINAL_MANIFEST.sizes.regular.idle.frames[0];
  const matrix: string[] = [];
  for (let y = 0; y < DIM; y += 1) {
    let row = "";
    for (let x = 0; x < DIM; x += 1) {
      row += ROW_CHARS[frame.pixels[y * DIM + x]]!;
    }
    matrix.push(row);
  }
  return matrix;
}

interface Cell {
  ch: string;
  fg?: string;
  bg?: string;
}

/** 解析 SGR 参数串，返回 (fg, bg) 十六进制色。 */
function parseSgr(params: string): { fg?: string; bg?: string } {
  const parts = params.split(";");
  let fg: string | undefined;
  let bg: string | undefined;
  for (let i = 0; i < parts.length; i += 1) {
    if (parts[i] === "38" && parts[i + 1] === "2" && i + 4 < parts.length) {
      const hex = [parts[i + 2], parts[i + 3], parts[i + 4]]
        .map((n) => Number(n).toString(16).padStart(2, "0"))
        .join("");
      fg = `#${hex}`;
      i += 4;
    } else if (parts[i] === "48" && parts[i + 1] === "2" && i + 4 < parts.length) {
      const hex = [parts[i + 2], parts[i + 3], parts[i + 4]]
        .map((n) => Number(n).toString(16).padStart(2, "0"))
        .join("");
      bg = `#${hex}`;
      i += 4;
    }
  }
  return { fg, bg };
}

/** 解析一行 ANSI 半块文本为逐格 (ch, fg, bg) 序列。 */
function parseAnsiRow(line: string): Cell[] {
  const cells: Cell[] = [];
  let fg: string | undefined;
  let bg: string | undefined;
  const sgr = /\u001b\[([0-9;]*)m/g;
  let pos = 0;
  for (let m = sgr.exec(line); m !== null; m = sgr.exec(line)) {
    if (m.index > pos) {
      for (const ch of line.slice(pos, m.index)) cells.push({ ch, fg, bg });
    }
    const params = m[1]!;
    if (params === "0") {
      fg = undefined;
      bg = undefined;
    } else {
      const next = parseSgr(params);
      fg = next.fg ?? fg;
      bg = next.bg ?? bg;
    }
    pos = sgr.lastIndex;
  }
  if (pos < line.length) {
    for (const ch of line.slice(pos)) cells.push({ ch, fg, bg });
  }
  return cells;
}

/** 字符格 → 上下两个逻辑像素的 palette 索引（renderFrame 半块语义）。 */
function cellTopBottom(cell: Cell): [number, number] {
  const indexOf = (color?: string): number => {
    if (color === undefined) return 0; // 无前景/背景色 = 透明
    const index = COLOR_TO_INDEX.get(color.toLowerCase());
    if (index === undefined) throw new Error(`render-consistency: unknown color ${color}`);
    return index;
  };
  if (cell.ch === " ") return [0, 0];
  if (cell.ch === "▀") return [indexOf(cell.fg), cell.bg === undefined ? 0 : indexOf(cell.bg)];
  if (cell.ch === "▄") return [0, indexOf(cell.fg)];
  if (cell.ch === "█") {
    const index = indexOf(cell.fg);
    return [index, index];
  }
  throw new Error(`render-consistency: unexpected glyph ${JSON.stringify(cell.ch)}`);
}

/** (a) 路径：art-preview-regular.txt 中 idle 帧 1 展开为 24×24 索引矩阵。 */
function parsePreviewMatrix(): string[] {
  if (!existsSync(PREVIEW_PATH)) {
    throw new Error(`${PREVIEW_PATH} 缺失：先运行 npx tsx scripts/preview-assets.ts`);
  }
  const lines = readFileSync(PREVIEW_PATH, "utf8").split("\n");
  let inIdle = false;
  let collecting = false;
  const terminalRows: Cell[][] = [];
  for (const line of lines) {
    if (line.startsWith("## ")) {
      inIdle = line.slice(3).startsWith("idle");
      collecting = false;
      continue;
    }
    if (inIdle && line.startsWith("frame ")) {
      collecting = line.startsWith("frame 1/2");
      if (collecting) terminalRows.length = 0;
      continue;
    }
    if (inIdle && collecting && line.length > 0) {
      const cells = parseAnsiRow(line);
      if (cells.length !== DIM) {
        throw new Error(`preview idle 帧 1 第 ${terminalRows.length} 行有 ${cells.length} 格，期望 ${DIM}`);
      }
      terminalRows.push(cells);
      if (terminalRows.length === DIM / 2) break;
    }
  }
  if (terminalRows.length !== DIM / 2) {
    throw new Error(`preview idle 帧 1：期望 ${DIM / 2} 行终端字符行，实际 ${terminalRows.length}`);
  }
  const matrix: string[] = [];
  for (const row of terminalRows) {
    for (const half of [0, 1] as const) {
      let text = "";
      for (const cell of row) {
        const [top, bottom] = cellTopBottom(cell);
        text += ROW_CHARS[half === 0 ? top : bottom]!;
      }
      matrix.push(text);
    }
  }
  return matrix;
}

/** (b) 路径：render-consistency-png-index.txt 的 idle 帧 1 放大网格降采样为 24×24 索引矩阵。 */
function parsePngIndexMatrix(): string[] {
  if (!existsSync(PNG_INDEX_PATH)) {
    throw new Error(`${PNG_INDEX_PATH} 缺失：先运行 /usr/bin/python3 .omo/evidence/art-render-png.py`);
  }
  const lines = readFileSync(PNG_INDEX_PATH, "utf8").split("\n");
  let inTarget = false;
  let raw: string[] = [];
  for (const line of lines) {
    if (line.startsWith("## ")) {
      inTarget = line.slice(3).startsWith("idle frame 1/2");
      if (inTarget) raw = [];
      continue;
    }
    if (inTarget && line.length > 0 && !line.startsWith("#")) raw.push(line);
  }
  if (raw.length === 0) throw new Error(`png index：未找到 idle frame 1/2 小节`);
  const factor = raw[0]!.length / DIM;
  if (!Number.isInteger(factor) || factor < 1) {
    throw new Error(`png index：无法确定放大倍数（行宽 ${raw[0]!.length}）`);
  }
  if (raw.length !== DIM * factor) {
    throw new Error(`png index：期望 ${DIM * factor} 行，实际 ${raw.length}`);
  }
  const matrix: string[] = [];
  for (let y = 0; y < DIM; y += 1) {
    const lineTop = raw[y * factor]!;
    const lineBottom = raw[y * factor + 1]!;
    if (lineTop !== lineBottom) {
      throw new Error(`png index：逻辑行 ${y} 垂直放大不一致`);
    }
    let row = "";
    for (let x = 0; x < DIM; x += 1) {
      const block = lineTop.slice(x * factor, (x + 1) * factor);
      const ch = block[0]!;
      if (![...block].every((c) => c === ch)) {
        throw new Error(`png index：逻辑像素 (x=${x}, y=${y}) 水平放大不一致`);
      }
      row += ch;
    }
    matrix.push(row);
  }
  return matrix;
}

/** 三矩阵逐格结构 diff；返回差异行（空 = 同构）。 */
function compare(matrixC: string[], matrixA: string[], matrixB: string[]): string[] {
  const diffs: string[] = [];
  for (let y = 0; y < DIM; y += 1) {
    for (let x = 0; x < DIM; x += 1) {
      const c = matrixC[y]![x]!;
      const a = matrixA[y]![x]!;
      const b = matrixB[y]![x]!;
      if (c !== a || c !== b) {
        diffs.push(`DIFF (x=${x}, y=${y}): index-final=${c} index-halfblock=${a} index-png=${b}`);
      }
    }
  }
  return diffs;
}

/** b（outline，索引 12）像素内外分布：外边界 = x/y 为 0 或 23。 */
function countB(matrix: string[]): { total: number; internal: number; external: number } {
  let total = 0;
  let internal = 0;
  let external = 0;
  for (let y = 0; y < DIM; y += 1) {
    for (let x = 0; x < DIM; x += 1) {
      if (matrix[y]![x] !== "b") continue;
      total += 1;
      if (x === 0 || y === 0 || x === DIM - 1 || y === DIM - 1) external += 1;
      else internal += 1;
    }
  }
  return { total, internal, external };
}

function main(): void {
  const matrixC = makeIndexMatrix();
  writeFile(
    INDEX_PATH,
    `# render-consistency-index: src/assets/final.ts regular idle 帧 1（24×24 逻辑像素，outline ${OUTLINE}）\n` +
      `# charset: .0123456789ab = palette 索引 0..12（final.ts ROW_CHARS / decodeRow 语义）\n` +
      `${matrixC.join("\n")}\n`,
  );

  const matrixA = parsePreviewMatrix();
  const matrixB = parsePngIndexMatrix();
  const diffs = compare(matrixC, matrixA, matrixB);
  const b = countB(matrixC);

  if (diffs.length === 0) {
    writeFile(DIFF_PATH, "# consistent: 三路径同构（c == 半块 == PNG 放大索引），0 差异\n");
  } else {
    writeFile(DIFF_PATH, `# differences: ${diffs.length} 个差异坐标（颜色归一化后）\n${diffs.join("\n")}\n`);
  }

  console.log(`render-consistency: frame=regular idle 1 outline=${OUTLINE}`);
  console.log(`(c) index matrix -> ${INDEX_PATH} (24x24)`);
  console.log(`(a) half-block path: parsed 12 terminal rows -> 24x24 index matrix`);
  console.log(`(b) png-magnified path: parsed ${DIM * 2} magnified rows -> 24x24 index matrix`);
  console.log(`comparison: ${diffs.length} diff cell(s)`);
  console.log(`b-pixel counts (regular idle frame 1): total=${b.total} internal=${b.internal} external=${b.external}`);
  console.log(diffs.length === 0 ? "verdict: CONSISTENT (三路径同构)" : `verdict: DIFFERENCES (see ${DIFF_PATH})`);

  if (diffs.length > 0) process.exitCode = 1;
}

try {
  main();
} catch (err) {
  console.error(`render-consistency FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
}

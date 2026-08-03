import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { ROW_CHARS, decodeRow } from "../src/assets/final";
import { SHIGURE_MANIFEST } from "../src/manifest";
import { PALETTE_INDEX, SIZE_DIMENSIONS } from "../src/manifest-data";
import type { CharacterManifest, PetSize, PetState, PixelFrame } from "../src/types";

const SIZES = ["regular", "compact"] as const satisfies readonly PetSize[];
const STATES = ["idle", "thinking", "working", "waiting", "success", "error", "retry"] as const satisfies readonly PetState[];
const OUTLINE_INDEX = PALETTE_INDEX.outline;
const TOKEN_EXEMPT_INDICES = new Set<number>([
  PALETTE_INDEX.eyeBlue,
  PALETTE_INDEX.ribbonRed,
  PALETTE_INDEX.trimWarmWhite,
  PALETTE_INDEX.sockBlack,
  OUTLINE_INDEX,
]);
const NEIGHBOR_OFFSETS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;
const BASELINE_PATH = ".omo/evidence/art-loop/outline-baseline.txt";

export type AuditContext = {
  readonly size?: PetSize;
  readonly state?: PetState;
  readonly frameIndex?: number;
};

export type AuditEntry = {
  readonly size: PetSize;
  readonly state: PetState;
  readonly frameIndex: number;
  readonly violations: readonly string[];
  readonly boundaryOutlineCellCount: number;
};

export type AuditReport = {
  readonly entries: readonly AuditEntry[];
  readonly violations: readonly string[];
};

type Point = { readonly x: number; readonly y: number };

export class GridFormatError extends Error {
  readonly name = "GridFormatError";

  constructor(message: string) {
    super(message);
  }
}

function isInBounds(frame: PixelFrame, point: Point): boolean {
  return point.x >= 0 && point.x < frame.width && point.y >= 0 && point.y < frame.height;
}

function pixelAt(frame: PixelFrame, point: Point): number {
  if (!isInBounds(frame, point)) return PALETTE_INDEX.transparent;
  return frame.pixels[point.y * frame.width + point.x] ?? PALETTE_INDEX.transparent;
}

function neighbors(frame: PixelFrame, point: Point): readonly Point[] {
  return NEIGHBOR_OFFSETS.map(([dx, dy]) => ({ x: point.x + dx, y: point.y + dy }));
}

function outsideTransparentPixels(frame: PixelFrame): Uint8Array {
  const outside = new Uint8Array(frame.width * frame.height);
  const queue: number[] = [];
  const enqueue = (x: number, y: number): void => {
    const index = y * frame.width + x;
    if (pixelAt(frame, { x, y }) === PALETTE_INDEX.transparent && outside[index] === 0) {
      outside[index] = 1;
      queue.push(index);
    }
  };

  for (let x = 0; x < frame.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, frame.height - 1);
  }
  for (let y = 1; y < frame.height - 1; y += 1) {
    enqueue(0, y);
    enqueue(frame.width - 1, y);
  }

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    if (index === undefined) continue;
    const point = { x: index % frame.width, y: Math.floor(index / frame.width) };
    for (const neighbor of neighbors(frame, point)) {
      if (isInBounds(frame, neighbor)) enqueue(neighbor.x, neighbor.y);
    }
  }
  return outside;
}

function frameScope(context: AuditContext): string {
  const size = context.size ?? "grid";
  const state = context.state ?? "frame";
  const frameIndex = context.frameIndex ?? 0;
  return `${size}/${state}/frame ${frameIndex}`;
}

function isOutsideTransparent(frame: PixelFrame, outside: Uint8Array, point: Point): boolean {
  return !isInBounds(frame, point) || outside[point.y * frame.width + point.x] === 1;
}

export function auditFrame(frame: PixelFrame, context: AuditContext = {}): {
  readonly violations: readonly string[];
  readonly boundaryOutlineCellCount: number;
} {
  const violations: string[] = [];
  const scope = frameScope(context);
  const outside = outsideTransparentPixels(frame);
  const boundaryOutlineCells = new Set<number>();

  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const point = { x, y };
      if (pixelAt(frame, point) !== OUTLINE_INDEX) continue;

      const adjacentTransparent = neighbors(frame, point).some((neighbor) => pixelAt(frame, neighbor) === PALETTE_INDEX.transparent);
      const adjacentOutsideTransparent = neighbors(frame, point).some((neighbor) => isOutsideTransparent(frame, outside, neighbor));
      const adjacentOpaque = neighbors(frame, point).some((neighbor) => {
        const neighborIndex = pixelAt(frame, neighbor);
        return neighborIndex !== PALETTE_INDEX.transparent && neighborIndex !== OUTLINE_INDEX;
      });
      if (adjacentTransparent && adjacentOutsideTransparent && adjacentOpaque) {
        boundaryOutlineCells.add(Math.floor(y / 2) * frame.width + x);
      } else {
        const kind = adjacentOpaque ? "internal-b" : "floating-b";
        violations.push(`${scope}: rule 1 ${kind} at (${x},${y})`);
      }
    }
  }

  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const point = { x, y };
      const paletteIndex = pixelAt(frame, point);
      if (paletteIndex === PALETTE_INDEX.transparent || TOKEN_EXEMPT_INDICES.has(paletteIndex)) continue;
      const hasSameColorNeighbor = neighbors(frame, point).some(
        (neighbor) => isInBounds(frame, neighbor) && pixelAt(frame, neighbor) === paletteIndex,
      );
      if (!hasSameColorNeighbor) {
        violations.push(`${scope}: rule 2 isolated palette index ${paletteIndex} at (${x},${y})`);
      }
    }
  }

  return { violations, boundaryOutlineCellCount: boundaryOutlineCells.size };
}

export function parseGrid(content: string, expectedSize?: PetSize): PixelFrame {
  const normalized = content.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const withoutFinalTerminator = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
  const rows = withoutFinalTerminator.split("\n");
  const dimension = rows.length === 24 ? 24 : rows.length === 16 ? 16 : undefined;
  if (dimension === undefined) {
    throw new GridFormatError(`format error: expected exactly 16 or 24 rows, got ${rows.length}`);
  }
  if (expectedSize !== undefined && SIZE_DIMENSIONS[expectedSize] !== dimension) {
    throw new GridFormatError(`format error: ${expectedSize} grids must be ${SIZE_DIMENSIONS[expectedSize]}x${SIZE_DIMENSIONS[expectedSize]}`);
  }
  for (const [rowIndex, row] of rows.entries()) {
    if (row.length !== dimension) {
      throw new GridFormatError(`format error: row ${rowIndex} has width ${row.length}, expected ${dimension}`);
    }
    for (const character of row) {
      if (!ROW_CHARS.includes(character)) {
        throw new GridFormatError(`format error: invalid legend character ${JSON.stringify(character)} in row ${rowIndex}`);
      }
    }
  }

  const pixels = new Uint8Array(dimension * dimension);
  rows.forEach((row, y) => decodeRow(row, y, dimension, pixels));
  return { width: dimension, height: dimension, pixels };
}

export function auditRows(rows: readonly string[], context: AuditContext = {}): ReturnType<typeof auditFrame> {
  return auditFrame(parseGrid(rows.join("\n"), context.size), context);
}

export function auditManifest(manifest: CharacterManifest, filters: AuditContext = {}): AuditReport {
  const entries: AuditEntry[] = [];
  for (const size of SIZES) {
    if (filters.size !== undefined && filters.size !== size) continue;
    for (const state of STATES) {
      if (filters.state !== undefined && filters.state !== state) continue;
      const frames = manifest.sizes[size][state].frames;
      for (const [frameIndex, frame] of frames.entries()) {
        const result = auditFrame(frame, { size, state, frameIndex });
        entries.push({ size, state, frameIndex, ...result });
      }
    }
  }
  return { entries, violations: entries.flatMap((entry) => entry.violations) };
}

function baselineText(entries: readonly AuditEntry[]): string {
  return entries.map((entry) => `${entry.size}/${entry.state}/frame ${entry.frameIndex}: ${entry.boundaryOutlineCellCount}`).join("\n");
}

function writeBaseline(entries: readonly AuditEntry[]): void {
  mkdirSync(dirname(BASELINE_PATH), { recursive: true });
  writeFileSync(BASELINE_PATH, `${baselineText(entries)}\n`);
}

function isPetSize(value: string): value is PetSize {
  return SIZES.some((candidate) => candidate === value);
}

function isPetState(value: string): value is PetState {
  return STATES.some((candidate) => candidate === value);
}

function parseArgs(argv: readonly string[]): { readonly grid?: string; readonly size?: PetSize; readonly state?: PetState } {
  let grid: string | undefined;
  let size: PetSize | undefined;
  let state: PetState | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--grid" || argument === "--size" || argument === "--frame") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) throw new GridFormatError(`format error: ${argument} requires a value`);
      index += 1;
      if (argument === "--grid") grid = value;
      else if (argument === "--size") {
        if (!isPetSize(value)) throw new GridFormatError(`format error: invalid size ${value}`);
        size = value;
      } else {
        if (!isPetState(value)) throw new GridFormatError(`format error: invalid frame ${value}`);
        state = value;
      }
    } else {
      throw new GridFormatError(`format error: unknown argument ${argument}`);
    }
  }
  return { grid, size, state };
}

function runAudit(argv: readonly string[]): AuditReport {
  const options = parseArgs(argv);
  if (options.grid !== undefined) {
    const frame = parseGrid(readFileSync(options.grid, "utf8"), options.size);
    const size = options.size ?? (frame.width === SIZE_DIMENSIONS.regular ? "regular" : "compact");
    const state = options.state ?? "idle";
    const result = auditFrame(frame, { size, state, frameIndex: 0 });
    const entry = { size, state, frameIndex: 0, ...result } satisfies AuditEntry;
    return { entries: [entry], violations: entry.violations };
  }
  return auditManifest(SHIGURE_MANIFEST, options);
}

function main(): void {
  mkdirSync(dirname(BASELINE_PATH), { recursive: true });
  writeFileSync(BASELINE_PATH, "");
  try {
    const report = runAudit(process.argv.slice(2));
    writeBaseline(report.entries);
    for (const violation of report.violations) console.log(`- ${violation}`);
    console.log(`AUDIT: ${report.entries.length} frame(s), ${report.violations.length} violation(s)`);
    process.exitCode = report.violations.length === 0 ? 0 : 1;
  } catch (error) {
    if (error instanceof GridFormatError) {
      console.error(error.message);
    } else if (error instanceof Error) {
      console.error(`audit error: ${error.message}`);
    } else {
      console.error("audit error: unknown failure");
    }
    process.exitCode = 1;
  }
}

const invokedScript = process.argv[1];
if (invokedScript !== undefined && fileURLToPath(import.meta.url) === resolve(invokedScript)) main();

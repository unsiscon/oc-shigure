import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  auditManifest,
  auditRows,
  parseGrid,
  type AuditContext,
} from "../scripts/audit-art-noise";
import { SHIGURE_MANIFEST } from "./manifest";

const SIZE = 16;
const SCRIPT = join(process.cwd(), "scripts/audit-art-noise.ts");
const EVIDENCE = join(process.cwd(), ".omo/evidence/art-loop/outline-baseline.txt");

function rowsWithPixels(pixels: readonly [x: number, y: number, value: string][]): string[] {
  const rows = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => "."));
  for (const [x, y, value] of pixels) {
    const row = rows[y];
    if (!row) throw new Error(`test pixel y=${y} is out of bounds`);
    row[x] = value;
  }
  return rows.map((row) => row.join(""));
}

function auditTestRows(rows: readonly string[], context: AuditContext = {}) {
  return auditRows(rows, { size: "compact", state: "idle", frameIndex: 0, ...context });
}

describe("audit-art-noise", () => {
  it("internal-b FAIL (Rule 1)", () => {
    const rows = rowsWithPixels([
      [6, 6, "1"],
      [7, 6, "1"],
      [8, 6, "1"],
      [6, 7, "1"],
      [7, 7, "b"],
      [8, 7, "1"],
      [6, 8, "1"],
      [7, 8, "1"],
      [8, 8, "1"],
    ]);

    expect(auditTestRows(rows).violations.some((violation) => violation.includes("rule 1"))).toBe(true);
  });

  it("outer-b PASS", () => {
    const rows = rowsWithPixels([
      [7, 7, "1"],
      [8, 7, "1"],
      [7, 6, "b"],
    ]);

    expect(auditTestRows(rows).violations).toEqual([]);
  });

  it("floating-b FAIL (Rule 1)", () => {
    const rows = rowsWithPixels([
      [2, 2, "1"],
      [3, 2, "1"],
      [10, 10, "b"],
    ]);

    expect(auditTestRows(rows).violations.some((violation) => violation.includes("rule 1"))).toBe(true);
  });

  it("isolated 3(skin) / a(boot)→FAILs (Rule 2)", () => {
    const rows = rowsWithPixels([
      [5, 5, "3"],
      [10, 10, "a"],
    ]);

    expect(auditTestRows(rows).violations.filter((violation) => violation.includes("rule 2"))).toHaveLength(2);
  });

  it("token-exemption PASS for single-pixel 4(eye) and 7/8/9 clusters", () => {
    const rows = rowsWithPixels([
      [4, 4, "4"],
      [6, 6, "7"],
      [8, 8, "8"],
      [10, 10, "9"],
    ]);

    expect(auditTestRows(rows).violations).toEqual([]);
  });

  it("--grid PASS parses a checkpoint, lists violations, and writes outline-baseline.txt", () => {
    const directory = mkdtempSync(join(tmpdir(), "audit-art-noise-"));
    const checkpoint = join(directory, "candidate.md");
    writeFileSync(
      checkpoint,
      rowsWithPixels([
        [2, 2, "1"],
        [3, 2, "1"],
        [10, 10, "b"],
      ]).join("\n"),
    );

    try {
      const output = spawnSync("npx", ["tsx", SCRIPT, "--grid", checkpoint, "--size", "compact", "--frame", "idle"], {
        cwd: process.cwd(),
        encoding: "utf8",
      });
      expect(output.status).not.toBe(0);
      expect(`${output.stdout}${output.stderr}`).toContain("rule 1");
      expect(readFileSync(EVIDENCE, "utf8")).toContain("compact/idle/frame 0:");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("manifest mode --size regular --frame idle filters only regular idle frames", () => {
    const report = auditManifest(SHIGURE_MANIFEST, { size: "regular", state: "idle" });

    expect(report.entries.length).toBe(2);
    expect(report.entries.every((entry) => entry.size === "regular" && entry.state === "idle")).toBe(true);
    expect(report.entries.some((entry) => entry.size === "compact")).toBe(false);
    expect(report.entries.some((entry) => entry.state !== "idle")).toBe(false);
  });

  it("format-error PASS rejects wrong-length lines and non-legend characters", () => {
    const directory = mkdtempSync(join(tmpdir(), "audit-art-noise-format-"));
    const wrongLength = join(directory, "wrong-length.md");
    const invalidCharacter = join(directory, "invalid-character.md");
    writeFileSync(wrongLength, `${".".repeat(SIZE)}\n${".".repeat(SIZE - 1)}`);
    writeFileSync(invalidCharacter, rowsWithPixels([]).map((row, index) => (index === 0 ? `${row.slice(0, -1)}X` : row)).join("\n"));

    try {
      for (const checkpoint of [wrongLength, invalidCharacter]) {
        const output = spawnSync("npx", ["tsx", SCRIPT, "--grid", checkpoint, "--size", "compact"], {
          cwd: process.cwd(),
          encoding: "utf8",
        });
        expect(output.status).not.toBe(0);
        expect(`${output.stdout}${output.stderr}`).toContain("format error");
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("parseGrid delegates row decoding to the final-art legend contract", () => {
    const rows = rowsWithPixels([[1, 1, "b"]]);
    const frame = parseGrid(rows.join("\n"), "compact");

    expect(frame.width).toBe(16);
    expect(frame.pixels[17]).toBe(12);
    expect(() => parseGrid(`${rows.join("\n")}\n`, "compact")).not.toThrow();
  });

  it("CLI invocation is executable through npx tsx", () => {
    const output = spawnSync("npx", ["tsx", SCRIPT, "--size", "regular", "--frame", "idle"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(output.status).not.toBe(0);
    expect(`${output.stdout}${output.stderr}`).toContain("regular/idle/frame 0");
  });
});

// 生成 docs/08 §8.2 要求的实际终端尺寸预览。
// 预览只消费现有 renderFrame，不引入图片解码或其他运行时依赖。
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { SHIGURE_MANIFEST } from "../src/manifest";
import { renderFrame, type Run } from "../src/renderer";
import type { PetSize, PetState } from "../src/types";

const STATES: readonly PetState[] = ["idle", "thinking", "working", "waiting", "success", "error", "retry"];
const SIZES: readonly PetSize[] = ["regular", "compact"];
const OUTPUT_DIR = ".omo/evidence";

function rgb(hex: string): [number, number, number] | undefined {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
  return [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)];
}

function ansiRun(run: Run): string {
  const fg = run.fg ? rgb(run.fg) : undefined;
  const bg = run.bg ? rgb(run.bg) : undefined;
  if (!fg && !bg) return run.text;
  const codes: string[] = [];
  if (fg) codes.push(`38;2;${fg[0]};${fg[1]};${fg[2]}`);
  if (bg) codes.push(`48;2;${bg[0]};${bg[1]};${bg[2]}`);
  return `\u001b[${codes.join(";")}m${run.text}\u001b[0m`;
}

function render(size: PetSize, outlineColor: string): string {
  const lines: string[] = [];
  const manifest = SHIGURE_MANIFEST.sizes[size];
  const dimension = size === "regular" ? 24 : 16;
  lines.push(`# ${size} ${dimension}x${dimension} logical -> ${dimension}x${dimension / 2} terminal cells`);
  for (const state of STATES) {
    const spec = manifest[state];
    lines.push(`\n## ${state} (${spec.frames.length} frame${spec.frames.length === 1 ? "" : "s"})`);
    for (const [index, frame] of spec.frames.entries()) {
      lines.push(`frame ${index + 1}/${spec.frames.length}`);
      const result = renderFrame(frame, SHIGURE_MANIFEST.palette, {
        transparentIndex: 0,
        outlineColor,
        // 透明组合现在显式携带 bg；预览沿用本模式的主题基调（深/浅各一），
        // 保持"透明 = 面板底色"的预览语义。
        backgroundColor: outlineColor,
      });
      lines.push(...result.rows.map((row) => row.map(ansiRun).join("")));
    }
  }
  return `${lines.join("\n")}\n`;
}

function writePreview(filename: string, content: string): void {
  const path = `${OUTPUT_DIR}/${filename}`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
  console.log(`wrote ${path}`);
}

writePreview("art-preview-regular.txt", render("regular", "#17141B"));
writePreview("art-preview-compact.txt", render("compact", "#17141B"));
writePreview(
  "art-preview-light.txt",
  `${render("regular", "#F7F2EA")}\n${render("compact", "#F7F2EA")}`,
);

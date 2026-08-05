import { defineConfig } from "tsup";

export default defineConfig({
  // 临时探针入口（docs/11 §17.2）：构建出独立 dist/fill-probe.js，
  // 截图期间临时替换 tui.json 中的 dist/tui.js；截图后随探针提交移除。
  entry: { tui: "src/tui.ts", "fill-probe": "scripts/fill-probe-standalone.ts" },
  format: ["esm"],
  dts: true,
  outDir: "dist",
  external: [
    "@opencode-ai/plugin",
    "@opentui/core",
    "@opentui/keymap",
    "@opentui/solid",
    "solid-js",
  ],
});

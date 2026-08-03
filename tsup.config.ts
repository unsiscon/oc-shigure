import { defineConfig } from "tsup";

export default defineConfig({
  entry: { tui: "src/tui.ts" },
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

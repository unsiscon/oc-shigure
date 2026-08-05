// 临时探针 helper（docs/11 §17.2 四模式单元格填充探针）。
// 截图完成后随探针提交整体删除；仅被 scripts/fill-probe-standalone.ts 引用，
// 不进入 dist/tui.js。四模式语义与 6×4 最小样本、左右各 2 个显式 panel 单元
// 均按已审核的第 17.2 节实现。

import type { RenderRow, Run } from "../src/renderer";

type FillProbeMode = "fg-full" | "fg-bg-full" | "fg-bg-half" | "bg-space";

function fillProbeRun(mode: FillProbeMode, color: string): Run {
  switch (mode) {
    case "fg-full":
      return { text: "██████", fg: color };
    case "fg-bg-full":
      return { text: "██████", fg: color, bg: color };
    case "fg-bg-half":
      return { text: "▀▀▀▀▀▀", fg: color, bg: color };
    case "bg-space":
      return { text: "      ", bg: color };
  }
}

function panelRun(backgroundColor: string): Run {
  return { text: "  ", bg: backgroundColor };
}

export function fillProbeRuns(backgroundColor: string, color: string): RenderRow[] {
  const modes: readonly FillProbeMode[] = ["fg-full", "fg-bg-full", "fg-bg-half", "bg-space"];
  const rows: RenderRow[] = modes.map((mode) => [
    panelRun(backgroundColor),
    fillProbeRun(mode, color),
    panelRun(backgroundColor),
  ]);

  const diagonalSamples: readonly Run[] = [
    { text: "▀▄▀▄▀▄", fg: color },
    { text: "▄▀▄▀▄▀", fg: color },
    { text: "▀▀▀▄▄▄", fg: color },
    { text: "█ █ █", fg: color, bg: backgroundColor },
  ];
  rows.push([panelRun(backgroundColor), { text: "          ", bg: backgroundColor }, panelRun(backgroundColor)]);
  for (const sample of diagonalSamples) {
    rows.push([panelRun(backgroundColor), sample, panelRun(backgroundColor)]);
  }
  return rows;
}

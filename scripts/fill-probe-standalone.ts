// 临时探针插件入口（docs/11 §17.2/§17.6）：独立构建为 dist/fill-probe.js，
// 截图期间临时替换 tui.json 中的 dist/tui.js；截图完成后随探针提交整体删除。
// dist/tui.js 不引用本文件，探针不进入正式 bundle。

import { createElement, insert, setProp } from "@opentui/solid";
import { rgbToHex, type BaseRenderable } from "@opentui/core";
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui";
import type { JSX } from "@opentui/solid/jsx-runtime";
import type { RenderRow } from "../src/renderer";
import { fillProbeRuns } from "./fill-probe";

const PROBE_COLOR = "#4A2B24"; // 当前头发中间色（docs/11 §17.2 建议固定主体色）

function probeRowNode(row: RenderRow): BaseRenderable {
  const node = createElement("text");
  for (const run of row) {
    const span = createElement("span");
    setProp(span, "style", { fg: run.fg, bg: run.bg });
    insert(span, run.text);
    insert(node, span);
  }
  return node;
}

function ProbeSidebar(props: { api: TuiPluginApi }): JSX.Element {
  const panelBackground = (): string => rgbToHex(props.api.theme.current.backgroundPanel);

  const petContent = createElement("box");
  setProp(petContent, "flexDirection", "column");
  setProp(petContent, "alignItems", "center");
  insert(petContent, () => {
    const nodes: BaseRenderable[] = [];
    for (const row of fillProbeRuns(panelBackground(), PROBE_COLOR)) {
      nodes.push(probeRowNode(row));
    }
    return nodes;
  });

  const root = createElement("box");
  setProp(root, "flexDirection", "column");
  setProp(root, "alignItems", "center");
  insert(root, petContent);
  return root as unknown as JSX.Element;
}

export const tui: TuiPlugin = async (api: TuiPluginApi): Promise<void> => {
  // no-excuse-ok: catch — 插件边界绝不向宿主抛错。
  try {
    if (api.lifecycle.signal.aborted) return;
    api.slots.register({
      order: 600,
      slots: {
        sidebar_content: () => ProbeSidebar({ api }),
      },
    });
  } catch {
    console.debug("[opco-shigure-probe] slot registration failed");
  }
};

const plugin: TuiPluginModule = { id: "opco-shigure-probe", tui };

export default plugin;

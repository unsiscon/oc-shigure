/** @opentui/solid 命令式树 API（不用 JSX——esbuild 不跑 babel-plugin-solid，
 *  JSX 表达式只会求值一次，反应式失效；本模块用 reconciler 的
 *  insert(parent, accessor) 保持信号驱动渲染，参考 oh-my-openagent 同款模式）。
 *  todo 7：Solid 侧栏组件（由 todo 8 真实 TUI 冒烟验证，不写单测）。
 *
 *  SidebarPet 职责：
 *  - createEffect on props.session_id：切换控制器（旧 dispose，新 getOrCreate + hydrate，docs/03 §7）；
 *  - 渲染 `<box flexDirection="column">`：宠物行（renderFrame rows → fg/bg span，水平居中）
 *    与标签行（PET_STATE_LABELS[state]，waiting/error/retry 用主题色，docs/03 §10）；
 *  - 响应 cfg()（反应式读取器）：enabled=false → 空内容（docs/03 §11）；size/animations
 *    变化经控制器 applyConfig 生效（FR-3 即时生效）；
 *  - 轮廓色：dark 主题将 outline token 融入实际侧栏背景，light 用 palette 末项；
 *  - 帧来源：controller onFrame → Solid signal；无帧 → 当前状态首帧（docs/03 §11）；
 *  - visible 标志：onMount 置 true、onCleanup 置 false（!visible 时控制器 pause）；
 *  - 渲染异常 → 仅标签（docs/04 §5）。
 *  组件不订阅全局事件（事件只经 registry 分发）；不显示工具名/文件名/错误摘要/倒计时。
 */
import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { rgbToHex, type BaseRenderable, type RGBA } from "@opentui/core";
import { createElement, insert, setProp } from "@opentui/solid";
import type { JSX } from "@opentui/solid/jsx-runtime";
import type { TuiPluginApi } from "@opencode-ai/plugin/tui";
import { SHIGURE_MANIFEST, SHIGURE_PALETTE } from "./manifest";
import { renderFrame, type RenderRow } from "./renderer";
import type { ControllerRegistry, PetController } from "./registry";
import { PET_STATE_LABELS, type PetConfig, type PetState, type PixelFrame } from "./types";

export type SidebarPetProps = {
  api: TuiPluginApi;
  session_id: string;
  controllers: ControllerRegistry;
  /** 反应式配置读取器（todo 8 由 createSignal 注入）：组件据此响应 enabled/size/animations。 */
  cfg: () => PetConfig;
};

function textNode(text: string, fg?: string | RGBA, bg?: string | RGBA): BaseRenderable {
  const node = createElement("text");
  if (fg === undefined && bg === undefined) {
    insert(node, text);
    return node;
  }
  const span = createElement("span");
  setProp(span, "style", { fg, bg });
  insert(span, text);
  insert(node, span);
  return node;
}

function petRowNode(row: RenderRow): BaseRenderable {
  const node = createElement("text");
  for (const run of row) {
    const span = createElement("span");
    setProp(span, "style", { fg: run.fg, bg: run.bg });
    insert(span, run.text);
    insert(node, span);
  }
  return node;
}

export function SidebarPet(props: SidebarPetProps): JSX.Element {
  const [frameSignal, setFrame] = createSignal<PixelFrame | null>(null);
  const [stateSignal, setState] = createSignal<PetState>("idle");

  let current: PetController | null = null;

  // 会话切换：旧控制器 dispose，新 getOrCreate + hydrate（docs/03 §7/§8）
  createEffect(() => {
    const sessionID = props.session_id;
    const prev = current;
    if (prev && prev.sessionID !== sessionID) {
      prev.setVisible(false);
      prev.dispose();
      current = null;
    }
    if (!current) {
      const ctrl = props.controllers.getOrCreate(sessionID);
      current = ctrl;
      const unsubFrame = ctrl.onFrame((frame) => setFrame(frame));
      const unsubState = ctrl.onState((state) => setState(state));
      onCleanup(() => {
        unsubFrame();
        unsubState();
        // 注意：不在此 dispose 控制器——宿主会因侧栏布局变化重新挂载本组件
        // （真实冒烟观察到任务结束后 200ms 内重挂载），dispose 会连同 success/error
        // 瞬态一起丢失并重建控制器；控制器生命周期由 registry（会话切换/插件卸载）管理。
        if (current === ctrl) {
          current = null;
        }
      });
      setFrame(ctrl.currentFrame);
      setState(ctrl.currentState ?? "idle");
      ctrl.hydrate(props.api);
    }
  });

  // 配置即时生效：enabled/size/animations 经控制器 setState/pause（FR-3，docs/03 §11）
  createEffect(() => {
    props.session_id;
    current?.applyConfig(props.cfg());
  });

  // 可见性：onMount 置 true、onCleanup 置 false；!visible 时控制器 pause
  onMount(() => {
    current?.setVisible(true);
  });
  onCleanup(() => {
    current?.setVisible(false);
  });

  const cfg = (): PetConfig => props.cfg();

  const panelBackground = (): string => rgbToHex(props.api.theme.current.backgroundPanel);

  // 深色主题中把 outline token 融入侧栏面板背景。
  // v2 的 b 像素经过半块字符后会形成连续的深色横带；固定 #17141B
  // 在 OpenCode 的深灰蓝 panel 上对比过强。使用实际 panel 色后，外轮廓
  // 仍由发色/制服色块保留，但不会把角色切割成一层层黑线。
  // 浅色主题继续使用 palette 的 outline token，保留原有浅色预览的边界感。
  const outlineColor = (): string =>
    props.api.theme.mode() === "dark"
      ? panelBackground()
      : SHIGURE_PALETTE[SHIGURE_PALETTE.length - 1];

  // 帧来源：controller onFrame → signal；无帧（未开始/动画关闭）→ 当前状态首帧
  const frame = (): PixelFrame => {
    const currentFrame = frameSignal();
    if (currentFrame) return currentFrame;
    const state = stateSignal();
    return SHIGURE_MANIFEST.sizes[cfg().size][state].frames[0];
  };

  // 渲染异常 → 仅标签（docs/04 §5），绝不向宿主抛错
  const rows = (): RenderRow[] | null => {
    try {
      return renderFrame(frame(), SHIGURE_PALETTE, {
        transparentIndex: 0,
        outlineColor: outlineColor(),
        backgroundColor: panelBackground(),
      }).rows;
    } catch (err) {
      console.debug("[opco-shigure] render error, label only", err);
      return null;
    }
  };

  // 标签颜色：默认 textMuted；waiting→warning、error→error、retry→accent（docs/03 §10）
  const labelColor = (): string | RGBA => {
    const theme = props.api.theme.current;
    switch (stateSignal()) {
      case "waiting":
        return theme.warning;
      case "error":
        return theme.error;
      case "retry":
        return theme.accent;
      default:
        return theme.textMuted;
    }
  };

  const petContent = createElement("box");
  setProp(petContent, "flexDirection", "column");
  setProp(petContent, "alignItems", "center");
  // enabled=false → 空内容（slot 空，docs/03 §11）；命令仍可重新启用。
  // 单一数组插槽整体重建 [rows…, label]：多个独立 accessor 插槽会互相打架
  // （单节点 replace 定位到兄弟行、旧标签残留；真实冒烟观察到标签不更新）。
  insert(petContent, () => {
    if (!cfg().enabled) return null;
    const nodes: BaseRenderable[] = [];
    const rendered = rows();
    if (rendered) {
      for (const row of rendered) nodes.push(petRowNode(row));
    }
    nodes.push(textNode(PET_STATE_LABELS[stateSignal()], labelColor()));
    return nodes;
  });

  const root = createElement("box");
  setProp(root, "flexDirection", "column");
  setProp(root, "alignItems", "center");
  insert(root, petContent);

  // 宿主 slot 注册类型要求 Solid JSX.Element；运行时经 reconciler 直接挂载
  // BaseRenderable 树（oh-my-openagent 同款模式），故此处单点收窄类型。
  return root as unknown as JSX.Element;
}

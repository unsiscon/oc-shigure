# opco-shigure

> 一个原生嵌入 OpenCode TUI 侧栏、使用 ANSI 半块高密度像素呈现时雨，并安静反馈当前 Agent 状态的陪伴插件。

`opco-shigure` 目前处于**可运行骨架阶段**。TUI 入口、侧栏占位帧、七状态事件管线、配置命令与生命周期已可运行；七状态最终动画资产仍未交付。概念 PNG 仅用于视觉方向选择，不是运行时终端资源。

当前视觉基准已选择 **A 圆润体型 v3**：保留圆润陪伴感，同时采用参考图的柔和小脸、深巧克力棕长发、单侧细辫、简洁深色水手服、红色长领结、黑色过膝袜和深红棕短靴。

主样本是 [A 圆润体型 v3](design/samples/shigure-concept-a-rounded-v3.png)；[A 制服 v2](design/samples/shigure-concept-a-uniform-v2.png) 作为次选参考，主要用于回退制服与外貌结构。

## 预期体验

```text
┌──────────────────────────┬──────────────────────┐
│                          │ Session title        │
│                          │                      │
│      OpenCode 对话       │      ▄████▄          │
│                          │     █  ▀▀  █         │
│                          │      ▀████▀          │
│                          │                      │
│                          │       工作           │
│                          │                      │
│                          │ Context / LSP / ...  │
└──────────────────────────┴──────────────────────┘
```

宠物只反映当前会话的七类状态：

- 待机 `idle`
- 思考 `thinking`
- 工作 `working`
- 等待 `waiting`
- 完成 `success`
- 出错 `error`
- 重试 `retry`

默认使用 24×24 逻辑像素，通过 `▀`、`▄`、`█` 压缩为 24×12 个终端字符格；紧凑模式使用 16×16 逻辑像素和 16×8 字符格。渲染不依赖 Kitty、Sixel、iTerm 图片协议、emoji 方块或外部窗口。

## 已确定边界

- OpenCode 1.18+，仅面向原生 TUI 插件接口。
- 使用 `sidebar_content`，侧栏不可见时不占用主界面。
- 默认内置一个时雨角色，V1 不开放第三方角色导入。
- 完全本地运行：无网络、无遥测、无 AI 对话、无会话正文解析、无外部进程。
- 不做养成、等级、成就、统计、社交、提醒、小游戏或多 Agent 仪表盘。
- 正式目标平台为现代 macOS、Linux 与 Windows 终端；tmux/SSH 为尽力兼容。

## 文档导航

- [调研与定位](docs/01-research-and-positioning.md)
- [产品需求](docs/02-product-requirements.md)
- [体验与状态模型](docs/03-experience-and-state-model.md)
- [顶层架构](docs/04-top-level-architecture.md)
- [视觉资产规范](docs/05-visual-asset-spec.md)
- [质量与 Agent 交接](docs/06-quality-and-agent-handoff.md)
- [无多模态视觉交接合同](docs/07-visual-handoff-without-multimodal.md)
- [视觉概念生成记录](design/samples/README.md)

## 当前交付状态

- [x] 可行性与竞品调研
- [x] 产品范围与状态语义
- [x] 顶层架构与内部契约
- [x] 美术制作规范
- [x] 测试矩阵与交接规则
- [x] A/B 概念生成提示与检查标准
- [x] A/B 概念 PNG
- [x] 方向 A 圆润体型 v3 经项目负责人选定
- [x] 制服 v2 作为次选参考记录
- [x] TUI 骨架实现（占位帧、事件、配置命令、打包入口）
- [ ] 七状态最终动画资产

## 安装与验证

当前包以 TUI 子路径导出，要求 OpenCode 1.18+：

```bash
npm install opco-shigure
# 在 ~/.config/opencode/tui.json 的 plugin 数组加入："opco-shigure"
```

本地开发验证：

```bash
npm run build
npm run validate-assets
npm run typecheck
npm test
npm pack
```

`npm run build` 生成 `dist/tui.js` 与 `dist/tui.d.ts`；`npm pack` 后应确认压缩包包含 `dist/tui.js`，且 `exports["./tui"].import` 指向该文件。运行时只使用原生 `sidebar_content` slot、ANSI 真彩与半块字符，不使用网络、遥测、外部进程或图片协议。

本地安装：正式发布前（npm 名称尚未占用、包尚未发布），`tui.json` 的 `plugin` 数组请使用 `dist/tui.js` 的绝对路径条目（如 `"/Users/<you>/opcopet/dist/tui.js"`）——实测该形式可直接加载；裸包名条目（`"opco-shigure"`）会触发 npm registry 解析，在包未发布时会阻塞插件加载，需等发布后方可生效。

## 骨架状态与已知限制

- 当前渲染的是可运行的静态/占位帧，用于验证布局、状态标签、配置即时生效与事件路由；不能视为最终美术。
- `sidebar_content` 按 order 600 注册，预期堆叠在内置 context、MCP、LSP、todo、files 之后；窄终端可能隐藏侧栏。
- tmux 与 SSH 走标准 ANSI 路径并尽力兼容；终端宽度、主题和字体差异需按 [质量与 Agent 交接](docs/06-quality-and-agent-handoff.md) 记录，不能用图片协议规避错行。

## 美术交接

最终帧、调色板、尺寸与七状态资产必须遵循[视觉资产规范](docs/05-visual-asset-spec.md)和[无多模态视觉交接合同](docs/07-visual-handoff-without-multimodal.md)。提交前使用 `npm run validate-assets` 及其中的 validator 管线检查尺寸、帧、调色板和状态覆盖；占位帧不会替代最终资产验收。

## 许可边界与发布前检查

- 代码按 MIT 边界发布；角色名称、设计稿、概念 PNG、最终角色帧及相关素材必须分别确认其许可，不因代码许可自动获得再分发权。
- 正式发布前重新查询 npm 名称 `opco-shigure` 的可用性与归属，并附 OpenCode 最低版本、终端矩阵、已知限制、代码许可和角色素材许可说明。

## English summary

`opco-shigure` is a runnable-skeleton OpenCode 1.18+ TUI companion plugin. It renders a placeholder Shigure-inspired pixel character in the native sidebar using ANSI true color and Unicode half-blocks, reacting to seven local session states without networking, telemetry, gamification, or an external window. Final animation art is still pending.

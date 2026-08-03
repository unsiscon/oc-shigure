---
slug: opco-shigure-tui-skeleton
status: drafting
intent: clear
review_required: false
pending-action: write .omo/plans/opco-shigure-tui-skeleton.md
approach: 在仓库根新建 opco-shigure npm 包（TS+tsup+vitest，TDD），实现 TUI 入口/sidebar_content、三项命令+KV、SDK 事件适配器、状态归约器、每会话动画控制器、CharacterManifest+占位帧+构建期校验、半块渲染器；测试先行按 docs/06 S01-S15；最后真实 OpenCode TUI 冒烟并保留启用
---

# Draft: opco-shigure-tui-skeleton

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->

- c1 package-scaffold | npm 包 `opco-shigure` 可构建出 ESM `dist/tui.js`，`exports["./tui"]` 默认导出模块，在 OpenCode 1.18+ 加载 | active | docs/04 §6; docs/01 §2.1; librarian spec (tui-plugins.md)
- c2 config-kv-commands | 三项命令即时生效并持久化到 KV，非法值单字段回退默认 | active | docs/02 FR-3; docs/03 §11; docs/06 §4
- c3 event-adapter | SDK 事件 → PetEvent，按 sessionID 过滤，未知事件忽略 | active | docs/04 §3.2; docs/03 §4,§7; sdk types.gen.d.ts:583-1260
- c4 state-reducer | 会话事实 + 优先级归约 + success/error 瞬态 + 幂等 + generation token | active | docs/03 §2,§3,§5; docs/06 §3 (S01-S15)
- c5 manifest-animation | CharacterManifest + 两尺寸七状态占位帧 + ≤6FPS 动画时钟 + 构建期校验 | active | docs/04 §3.4,§3.5,§4; docs/05 §4-§7; docs/07 §5-§7
- c6 renderer-sidebar | 半块渲染器（▀▄█+真彩） + Solid sidebar_content 组件（主题感知） | active | docs/04 §3.6; docs/03 §10; @opentui/core Plugin type
- c7 tests | reducer S 矩阵、渲染器确定性、fake-clock 动画、配置回退 | active | docs/06 §3,§5,§7
- c8 real-smoke | 真实 OpenCode TUI 冒烟 + npm pack 安装验证 | active | docs/06 §2,§6,§12

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->

- a1 仓库布局 | 插件直接建在仓库根（package.json + src/），docs/ design/ 原样保留 | 本仓库即 opco-shigure 项目仓库 | 是
- a2 工具链 | npm + TypeScript + tsup(ESM) + vitest | 参考插件 context-progress 同款；docs/06 §9 授权自主决定 | 是
- a3 占位资产 | 按 docs/07 语义 token（H/F/E/W/R/K/B）手写 2 尺寸×7 状态占位帧，明确标记 PLACEHOLDER，经构建期校验器验证 | 最终七状态资产尚未交付（README 待办），骨架需可渲染像素 | 是
- a4 retry 检测 | `session.status`（status.type==="retry"）与 `session.next.retried`（**均含 sessionID**，types.gen.d.ts:916）→ retry-started；任何 status type 为 idle/busy → retry-ended | sdk types.gen.d.ts:913-919, 1218-1222；docs/03 §4:72 | 是
- a5 slot order | sidebar_content 用 order 600（内置 context 100/MCP 200/LSP 300/todo 400/files 500 之后） | librarian spec | 是
- a6 命令 API | `api.keymap.registerLayer` + palette namespace；若 1.18.5 类型不符则回退 legacy `api.command.register` | @opentui/keymap keymap.d.ts:32; plugin tui.ts | 是
- a7 KV 键 | `opco-shigure.enabled` / `opco-shigure.size` / `opco-shigure.animations`，KV 不自动命名空间 | librarian spec | 是
- a8 瞬态时长 | success 2500ms / error 4000ms，monotonic + generation token，新活动立即打断 | docs/03 §5 | 是
- a9 动画时钟 | Solid signal + setInterval + `api.renderer.requestRender()`，上限 6FPS；disabled/animations=false/slot 卸载时停表 | docs/04 §3.4; docs/02 NFR; example plugins | 是

## Findings (cited - path:lines)

- 产品范围与边界：docs/02 §6 FR-1..FR-5、§7 NFR、§9 明确排除（无网络/遥测/多角色/养成/desktop-web）
- 状态模型：docs/03 §2 SessionPetFacts、§3 优先级（error>waiting>retry>working>thinking>success>idle）、§4 事件映射、§5 瞬态时序、§6 并发工具、§7 会话边界、§8 启动重水合
- 架构：docs/04 §3 各组件职责、§4 美术构建流（build-time validator 不可省略检查）、§5 生命周期与错误隔离、§6 包边界、§7 可观测性、§8 未来扩展约束
- 质量合同：docs/06 §2 DoD、§3 状态验收矩阵 S01-S15、§4 配置验收、§5 渲染器验收、§7 性能、§8 隐私
- 视觉合同：docs/05 §4 两档尺寸、§5 调色板、§6 七状态动作、§7 动画原则、§8 禁止效果；docs/07 §5 语义调色板 token、§6 语义像素分层示例、§7 状态帧描述
- SDK 事件（本机 1.18.5，第一手）：types.gen.d.ts:583-1260 事件联合。关键：`session.next.step.started`（含 sessionID/assistantMessageID）、`step.ended`、`step.failed`（含 error）、`session.next.shell.started/ended`（callID）、`session.next.reasoning.started/ended`、`session.next.text.started/ended`、`session.next.tool.input.started/ended/called/success/failed`（callID）、`session.next.retried`（**含 sessionID**，types.gen.d.ts:916）、`permission.asked`（id）/`permission.replied`（requestID）/`permission.v2.asked`（id）/`permission.v2.replied`（requestID）、`question(.v2).asked/replied/rejected`、`session.status`（含 SessionStatus 对象）、`session.idle`、`session.error`（sessionID 可选，error 联合）、`session.next.prompted`
- SessionStatus（types.gen.d.ts:504-521）：`{type:"idle"} | {type:"retry",attempt,message,next} | {type:"busy"}`
- 用户中断（types.gen.d.ts:172-177）：MessageAbortedError = { name: "MessageAbortedError", data }；`session.error` 的 error 联合含它
- TUI 插件 API（v1.18.10 tui.ts，第一手抓取）：`TuiPluginModule = { id?, tui: TuiPlugin; server?: never }`；`TuiPlugin = (api, options, meta) => Promise<void>`；`api.slots.register(plugin)`；`api.event.on(type, handler): () => void`；`api.state.session.status/permission/question(sessionID)`；`api.kv.get/set`；`api.theme.current/mode()`；`api.keymap`（TuiKeymap）；`api.lifecycle.signal/onDispose`；`api.renderer.requestRender()`；`sidebar_content: { session_id: string }`；`TuiSlotContext = { theme }`
- slot 注册形状（@opentui/core/plugins/types.d.ts:22-30）：`Plugin = { id, order?, setup?, dispose?, slots: { [K]: (ctx, props) => node } }`；`SlotMode = "append"|"replace"|"single_winner"`
- keymap（@opentui/keymap/src/keymap.d.ts:32）：`registerLayer(layer): () => void`；Command 形状含 name/title/category/namespace/desc/run（librarian spec）
- 打包惯例（@oh-my-sidebar/opencode-context-progress package.json）：type=module、`exports["./tui"]`、tsup 构建、vitest 测试、peer deps @opencode-ai/plugin + @opentui/core + @opentui/solid + solid-js
- 本机事实：@opencode-ai/plugin 1.18.5 已装（exports "." 与 "./tui"）；@opencode-ai/sdk 1.18.5 已装；OpenCode 1.18.10（docs/01 §7）
- 安装方式：tui.json `"plugin": ["opco-shigure"]` 或相对路径/绝对路径/`[spec, options]` 条目；npm 包按 `exports["./tui"]` 解析，需默认导出模块（librarian spec，dev 分支）

## Decisions (with rationale)

- d1 骨架范围：实现 docs/04 全部七模块 + 占位资产 + 构建期校验器 + 全套测试 + 真实冒烟；不做最终七状态美术（未交付）与 npm 发布
- d2 包形态：根导出即 TUI 模块（默认导出 `{ id: "opco-shigure", tui }`），`exports["./tui"]` 指向 dist/tui.js；peer deps 对齐 1.18.x；engines opencode ^1.18.0
- d3 模块组织：src/tui.ts（入口）＋ src/adapter.ts（事件适配）＋ src/reducer.ts（纯归约）＋ src/animation.ts（时钟）＋ src/manifest.ts（角色注册表＋占位帧）＋ src/renderer.ts（半块）＋ src/sidebar.tsx（Solid 组件）＋ src/config.ts（KV 合同）＋ scripts/validate-assets.ts
- d4 每会话控制器：plugin 级 Map<sessionID, Controller>；sidebar_content 组件按 props.session_id 取用/创建，onCleanup 时销毁（计时器/瞬态一并清理），满足 S12/S15
- d5 事件映射到 PetEvent（docs/04 §3.2 形状）：cycle-started←step.started(+prompted 仅打断瞬态)；reasoning/text/tool/shell start/end；permission/question open/close（asked 用 id、replied 用 requestID，v1/v2 归一）；retry←session.status type==="retry" **与 session.next.retried（含 sessionID）**；**tool-ended.failed→短暂可打断 error（docs/03:80），完整 4s 留给 session.error/step.failed**；cycle-failed←session.error（非 MessageAbortedError）或 step.failed；MessageAbortedError→直接回 idle 不触发成功/失败；**delta 事件一律忽略（allowlist）**；**cycleActive/retryActive 复位点显式定义（Metis F5/F6）**
- d6 success/error 判定：仅当同会话本周期 cycleActive 为真且随后回到 idle 才 success；error 4s / success 2.5s，generation token 防旧回调覆盖，新活动事件立即打断
- d7 渲染：行宽=逻辑像素宽；透明像素不写背景色；同色 run 合并；主题切换只换轮廓色（outline token），主体 palette 不变
- d8 错误隔离：适配错误→忽略+debug 日志；动画异常→当前状态首帧；资源异常→内置静态 idle 占位；渲染异常→仅标签；绝不向宿主事件路径抛错（docs/04 §5 错误策略表）
- d9 测试：reducer 以 docs/06 S01-S15 行为矩阵为准（适配器喂入 SDk 形状事件）；renderer 五组合+尺寸+透明+run 合并确定性测试；动画 fake-clock ≤6FPS 且禁用时零更新；配置非法值回退测试
- d10 冒烟位置（用户已答 Q1）：在真实 ~/.config/opencode/tui.json 加入插件条目，真实 TUI 冒烟后**保留启用**
- d11 测试策略（用户已答 Q2）：**TDD 测试先行**——reducer/renderer/animation/config 先写失败测试再实现

## Scope IN

- npm 包骨架（package.json/tsconfig/tsup/vitest），默认导出 TUI 模块，`exports["./tui"]`
- 三项命令（Show/Hide、Regular/Compact、Enable/Disable Animations）+ KV 持久化 + 非法值回退
- 事件适配器、状态归约器（含瞬态与幂等）、每会话动画控制器、CharacterManifest + 两尺寸七状态占位帧 + 构建期校验器
- 半块渲染器 + Solid sidebar_content 组件（中文标签、主题感知、≤6FPS）
- reducer S 矩阵测试、渲染器确定性测试、fake-clock 动画测试、配置回退测试
- 真实 OpenCode TUI 冒烟 + npm pack 本地安装验证

## Scope OUT (Must NOT have)

- 最终七状态美术资产（README 待办，另行美术任务）——占位帧仅为可运行证明
- npm 发布（docs/06 §12 发布门槛要求发布前重新查询名称；本骨架不发布）
- server 插件、MCP、网络/遥测/外部进程、会话正文解析、桌面/Web 渲染器
- 多角色注册表、第三方角色导入、养成/成就/统计/提醒/小游戏
- OpenCode <1.18 兼容层、emoji 方块、图片协议（Kitty/Sixel/iTerm）
- 修改 opencode.json、新增配置字段、KV 暴露 manifest 内部结构

## Open questions

- Q1（冒烟安装位置）：已答复 → 真实配置安装并保留启用（d10）
- Q2（测试策略）：已答复 → TDD 测试先行（d11）
- 无剩余开放问题

## Approval gate
status: approved - plan written at .omo/plans/opco-shigure-tui-skeleton.md (Metis 31 findings folded in; TL;DR filled; structural self-check passed)

## High-accuracy review (dual review)
phase: review_complete - APPROVED
review_required: true
plan_path: .omo/plans/opco-shigure-tui-skeleton.md
plan_sha256: 7f1d64faabf8c647f9943646fe906c22df14cad1540f00f03d7ee4b16200adf9
review_round_id: rr-20260802-005 (final, approved)
round_status: approved
pending-action: none - plan ready for execution

## Round 5 receipts (rr-20260802-005) — FINAL
- momus: **VERDICT APPROVE** — session ses_03cc16722ffeliqIp7ucB6apee / launch launch-momus-005。四项 round-4 修复核实；引用文档与类型相符；任务具备可执行 QA/证据/依赖
- independent: **VERDICT APPROVE** — session ses_03cc154dbffdu3pSQZ0Il0MXS2 / launch launch-oracle-005。四项 round-4 修复核实；全对抗探针通过；附非阻塞建议（见下）
- 两路对同一文件（SHA 7f1d64fa…，54197B/356 行）无条件批准。按契约，批准后计划文件不再改动
- **非阻塞建议（Oracle 附带，记录供执行者参考，不改计划）**：①t8 步骤 4 mock 安装若 opencode npm-spec 解析需联网或 scratch node_modules 缺依赖闭包，步骤会失败——计划已有文档化回退路径（绝对路径条目验证 + .omo/evidence 记录），按现状执行即可；②若干行号/措辞微调不构成问题
- 高精度双评审完成：4 轮修复（共 33 项评审发现全部折入）+ 双 APPROVE

review:
  momus:
    status: approved
    workspace_root: /Users/unsis/code/opcode/opcopet
    runtime_home: null
    target: .omo/plans/opco-shigure-tui-skeleton.md
    round_id: rr-20260802-005
    launch_id: launch-momus-005
    session: ses_03cc16722ffeliqIp7ucB6apee
    result: APPROVE
  independent:
    status: approved
    workspace_root: /Users/unsis/code/opcode/opcopet
    runtime_home: null
    target: .omo/plans/opco-shigure-tui-skeleton.md
    round_id: rr-20260802-005
    launch_id: launch-oracle-005
    session: ses_03cc154dbffdu3pSQZ0Il0MXS2
    result: APPROVE
approach: 在仓库根新建 opco-shigure npm 包（TypeScript + tsup + vitest，TDD 测试先行），实现：TUI 默认导出模块 + sidebar_content 注册（order 600）、三项命令 + KV 持久化、SDK 事件适配器（按已核实的 1.18.5 事件名）、状态归约器（S01-S15 语义 + 瞬态 + 幂等）、每会话动画控制器（≤6FPS）、CharacterManifest + 两尺寸×七状态占位帧 + 构建期校验器、半块渲染器 + Solid 侧栏组件（主题感知）；最后真实 OpenCode TUI 冒烟（真实配置安装并保留）。
next action after approval: 生成 .omo/plans/opco-shigure-tui-skeleton.md，运行 Metis 差距分析，追加 todo 批次，最后填 TL;DR。
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->

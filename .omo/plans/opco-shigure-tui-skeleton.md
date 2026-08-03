# opco-shigure-tui-skeleton - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** 一个可运行的 OpenCode 插件 `opco-shigure`：OpenCode 右侧栏会出现一只带中文状态标签（待机/思考/工作/等待/完成/出错/重试）的像素宠物，真实反映当前会话在做什么；可用命令面板三项开关随时隐藏、切换大小、开关动画。本次用的是占位画风（能看出头发/脸/领结的位置，也会真的动），正式"长相"留待后续美术补充。

**Why this approach:** 设计文档已把状态语义、优先级、验收矩阵（15 条状态序列测试）、渲染规则全部锁死，所以采用"测试先行 + 模块化管线"：占位帧证明整条渲染/动画管线真实可跑，正式美术将来只替换数据、不改代码。

**What it will NOT do:** 不做最终美术资产（本次为占位帧）；不发布到 npm；零网络请求、零遥测、不读对话内容；不做多角色、养成、提醒、桌面端；不改动您除 tui.json 以外的任何配置。

**Effort:** Medium
**Risk:** Medium - OpenCode TUI 插件接口仍在快速演进，真实 TUI 冒烟是唯一硬验证
**Decisions to sanity-check:**
- 冒烟验证会直接写入您的真实 `~/.config/opencode/tui.json` 并**保留启用**（您已确认）
- 占位帧是程序生成的"语义色板小人"，明确标记 PLACEHOLDER，不是最终时雨
- 仓库不初始化 git、不产生提交（当前非 git 仓库，您未要求）
- 命令面板优先用新版 keymap 接口，旧接口仅作回退
- 动画上限 6FPS、成功 2.5 秒/出错 4 秒、可被新任务随时打断

Your next move: 批准后以 `$start-work opco-shigure-tui-skeleton` 执行；或先运行一次高精度评审。完整执行细节见下文。

---

> TL;DR (machine): Medium effort / Medium risk (TUI API evolution) — 8-todo runnable opco-shigure TUI plugin skeleton (entry+commands+KV, SDK event adapter, reducer with S01-S15 tests, per-session animation controller, placeholder manifest+validator, half-block renderer, Solid sidebar, real-TUI smoke kept enabled), TDD, no final art / no npm publish / no git.

## Scope
### Must have

- 在仓库根新建 `opco-shigure` npm 包：TypeScript + tsup(ESM) + vitest，默认导出 TUI 模块，`exports["./tui"]` → `dist/tui.js`。
- `sidebar_content` 注册（order 600）渲染：居中像素宠物（半块字符）+ 七种中文状态标签，主题感知。
- 三项命令面板动作（Show/Hide、Regular/Compact、Enable/Disable Animations）即时生效并持久化到 KV（`opco-shigure.enabled/size/animations`），非法值单字段回退默认。
- SDK 事件适配器 → PetEvent（按已核实的 1.18.5 事件名/负载映射）。
- 纯函数状态归约器：会话事实 + 优先级归约 + success(2.5s)/error(4s) 瞬态 + generation token + 幂等。
- 每会话动画控制器：≤6FPS、禁用/关闭/卸载时停表、状态/尺寸切换回首帧。
- CharacterManifest + 两尺寸×七状态**占位帧**（docs/07 语义 token 确定性生成，标记 PLACEHOLDER）+ 构建期校验器（尺寸/状态齐全/索引合法/透明一致/边界不裁切/帧率上限）。
- 半块渲染器：▀▄█ + 真彩前景/背景，行宽=逻辑像素宽，透明继承面板背景，同色 run 合并，主题切换只换轮廓色。
- 测试：reducer S01-S15 行为矩阵、适配器映射、渲染器确定性、fake-clock 动画、配置回退（TDD 测试先行）。
- 真实 OpenCode TUI 冒烟：`~/.config/opencode/tui.json` 绝对路径条目加载并**保留启用**；`npm pack` 本地 tarball 模拟安装验证。
- README 更新骨架状态、安装验证步骤、已知限制与美术交接说明。

### Must NOT have (guardrails, anti-slop, scope boundaries)

- **不做最终七状态美术资产**（README 待办；占位帧仅为可运行证明，正式美术由后续美术 Agent 按 docs/05/07 合同另行交付，只替换 manifest 数据，代码不改）。
- **不发布 npm**（docs/06 §12 门槛：发布前重查名称占用 + 终端兼容矩阵 + 许可说明；本骨架只做本地 pack 验证）。
- 不做 server 插件 / MCP / 模型可调用工具 / 修改 system prompt / 影响权限结果。
- 零网络请求、零遥测、零外部进程、不解析会话正文/工具输出/文件内容、不写日志文件。
- 不做多角色注册表、第三方角色导入、养成/等级/成就/投喂/点击反应/小游戏/提醒/声音。
- 不做 OpenCode Desktop / Web / 独立窗口 / 多 Agent 仪表盘。
- 不做 OpenCode <1.18 兼容分支；不用 Kitty/Sixel/iTerm 图片协议、不用 emoji 方块。
- 不修改 `opencode.json`、不新增 KV 字段、不对外暴露 manifest 内部格式。
- 不初始化 git、不产生提交（仓库当前非 git，用户未要求版本控制）。

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: **TDD 测试先行**（用户已确认）+ vitest；核心模块先写失败测试再实现。
- Evidence: `.omo/evidence/task-N-happy.txt` / `task-N-failure.txt`（统一命名，含冒烟产物 task-8-smoke.typescript / task-8-fallback.txt / task-8-terminal.txt）；本计划无 ulw-loop，统一用 `.omo/evidence/`
- 验收命令全绿 = `npm run typecheck` + `npm test`（vitest）+ `npm run validate-assets` + `npm run build`。
- 真实 TUI 冒烟证据：PTY 捕获（`script -q`）或终端截图，保存于 `.omo/evidence/`。

## Execution strategy
### Parallel execution waves

- **Wave 1（领域层）**: todo 1（包骨架+类型+配置）、todo 2（事件适配器）、todo 3（状态归约器）、todo 4（动画控制器）——t2/t3/t4 依赖 t1，相互并行。
- **Wave 2（资产+渲染+UI）**: todo 5（manifest+占位帧+校验器，与 Wave 1 并行）、todo 6（渲染器，依赖 t5）、todo 7（registry+侧栏组件，依赖 t3/t4/t6）。
- **Wave 3（集成收尾）**: todo 8（TUI 入口+命令+生命周期+构建/打包/真实冒烟+README）。
- **Final verification wave**: F1-F4 并行，全部 APPROVE 才宣布完成。

### Dependency matrix

| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 包骨架+类型+配置 | — | 2,3,4,5,6,7,8 | — |
| 2 事件适配器 | 1 | 8 | 3,4,5 |
| 3 状态归约器 | 1 | 7,8 | 2,4,5 |
| 4 动画控制器 | 1 | 7,8 | 2,3,5 |
| 5 manifest+占位帧+校验器 | 1 | 6,8 | 2,3,4 |
| 6 半块渲染器 | 5 | 7,8 | — |
| 7 registry+侧栏组件 | 3,4,5,6 | 8 | — |
| 8 TUI 入口+命令+集成冒烟 | 2,3,4,5,6,7 | — | — |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [x] 1. 包骨架 + 领域类型 + 配置层（TDD）
  What to do / Must NOT do:
  在仓库根创建 npm 包 `opco-shigure`：`package.json`（name=opco-shigure, version=0.1.0, private=true, type=module, exports: { "./tui": { "import": "./dist/tui.js", "types": "./dist/tui.d.ts" } }, files=["dist"], engines.opencode="^1.18.0", scripts: build="tsup", typecheck="tsc --noEmit", test="vitest run", validate-assets="tsx scripts/validate-assets.ts", peerDependencies: @opencode-ai/plugin ^1.18.0, @opentui/core ^0.4.5, @opentui/keymap ^0.4.5, @opentui/solid ^0.4.5, solid-js ^1.9.12；devDependencies: typescript, tsup, vitest, tsx, @types/node + 上述 peer 包。不设 `"main"`/`"."` 导出（TUI 加载只认 `./tui`）。`tsconfig.json`（strict, target ES2022, module ESNext, moduleResolution bundler, **jsx="automatic" + jsxImportSource="@opentui/solid"**（esbuild 必须转译 JSX——`preserve` 会把原始 JSX 留在 dist/tui.js 导致加载失败；sidebar.tsx 内 pragma 注释保留作双保险）, noEmit, include src+scripts）。`tsup.config.ts`（entry `{tui: "src/tui.ts"}`，format esm，dts true，external = peerDependencies 名单 + solid-js）。`vitest.config.ts`（node 环境，include `src/**/*.test.ts`）。`.gitignore`（node_modules/dist）。
  `src/types.ts`：`PetSize="regular"|"compact"`；`PetState="idle"|"thinking"|"working"|"waiting"|"success"|"error"|"retry"`；`PET_STATE_LABELS: Record<PetState,string>` = {idle:"待机",thinking:"思考",working:"工作",waiting:"等待",success:"完成",error:"出错",retry:"重试"}；`PetConfig={enabled:boolean; size:PetSize; animations:boolean}`；`PixelFrame={width:24|16; height:24|16; pixels:Uint8Array}`（行优先，索引指向 palette，0=透明）；`AnimationSpec={frames: readonly PixelFrame[]; frameDurationMs: number; loop: boolean}`；`CharacterManifest={id:"shigure"; displayName:"时雨"; palette: readonly string[]; sizes: Record<PetSize, Record<PetState, AnimationSpec>>}`；`PetEvent` 联合（本计划授权 docs/04 §3.2 微调）：
  `{type:"cycle-started"} | {type:"busy-started"} | {type:"reasoning-started"|"reasoning-ended"} | {type:"text-started"|"text-ended"} | {type:"tool-started"|"tool-ended"; callID: string; failed?: boolean} | {type:"permission-opened"|"permission-closed"; requestID: string} | {type:"question-opened"|"question-closed"; requestID: string} | {type:"retry-started"} | {type:"session-idle"} | {type:"cycle-failed"} | {type:"cycle-aborted"}`（**无 retry-ended**：SDK 与 docs/03 §4 均无 retry-end 事件来源，retryActive 仅由 session.status idle/busy 与 cycle-failed/aborted 复位，避免死分支）。
  `src/config.ts`：`DEFAULT_CONFIG={enabled:true,size:"regular",animations:true}`；`loadConfig(kv): PetConfig`（读 `opco-shigure.enabled` / `opco-shigure.size` / `opco-shigure.animations`，非法/缺省值**单字段**回退默认，不清空其他有效偏好）；`saveConfig(kv, cfg)`。配置层不依赖 TUI API 具体实现，以 `{get(key,fallback):unknown; set(key,value):void}` 最小接口注入（便于测试）。
  Must NOT：不建 server 入口；不写 `opencode.json`；不引入任何运行时依赖（除 peer）；不新增超出三项的配置字段。
  Parallelization: Wave 1 | Blocked by: — | Blocks: 2,3,4,5,6,7,8
  References (executor has NO interview context - be exhaustive):
  - docs/02-product-requirements.md:74-91（配置合同 FR-3）、docs/03-experience-and-state-model.md:191-197（设置行为）、docs/04-top-level-architecture.md:139-149（配置持久化：KV 命名空间、未知值回退、不暴露 manifest）
  - 参考插件打包惯例：/Users/unsis/.config/opencode/node_modules/@oh-my-sidebar/opencode-context-progress 不存在；npm 上 `@oh-my-sidebar/opencode-context-progress` package.json（type=module、exports["./tui"]、tsup、vitest、peer deps 含 solid-js）
  - 本机 API 版本事实：/Users/unsis/.config/opencode/node_modules/@opencode-ai/plugin/package.json（1.18.5，exports "." 与 "./tui"，peer @opentui/* >=0.4.5）
  - 本机参考类型：/Users/unsis/.config/opencode/node_modules/@opencode-ai/plugin/dist/tui.d.ts（TuiKV/TuiTheme/TuiPlugin 等）、/Users/unsis/.cache/opencode/packages/oh-my-openagent@latest/node_modules/@opentui/core/plugins/types.d.ts:21-30（Plugin 形状）
  Acceptance criteria (agent-executable):
  - `npm run typecheck` 退出码 0
  - `npx vitest run src/config.test.ts` 全绿
  - `npm pack --dry-run` 输出包含 dist/ 与 package.json，且不含 node_modules
  QA scenarios (name the exact tool + invocation): happy + failure, Evidence .omo/evidence/task-1-*.txt
  - happy: `npx vitest run src/config.test.ts -t "defaults" --reporter=verbose > .omo/evidence/task-1-happy.txt 2>&1`；断言退出码 0 且输出含 "defaults" 用例（空 KV → 默认三项；set 后回读一致）
  - failure: `npx vitest run src/config.test.ts -t "illegal" --reporter=verbose > .omo/evidence/task-1-failure.txt 2>&1`；断言退出码 0（enabled:"垃圾"/size:"huge"/animations:null → 各字段单字段回退默认、其他有效字段保留）
  Commit: N/A（仓库非 git，见 Commit strategy）

- [x] 2. SDK 事件适配器（TDD）
  What to do / Must NOT do:
  实现 `src/adapter.ts`：`mapEvent(event: Event): PetEvent | null`，把 @opencode-ai/sdk v2 Event 联合映射为 PetEvent；`filterForSession(sessionID)` 返回包装器丢弃 sessionID 不匹配的事件。映射表（事件名/负载均核自本机 SDK 类型）：
  - `session.next.step.started` → cycle-started
  - `session.next.prompted`、`session.next.prompt.admitted` → cycle-started（新用户任务，用于打断 success/error 瞬态）
  - `session.next.reasoning.started` / `.ended` → reasoning-started / reasoning-ended
  - `session.next.text.started` / `.ended` → text-started / text-ended
  - `session.next.tool.input.started`、`session.next.tool.called`、`session.next.shell.started` → tool-started（callID）
  - `session.next.tool.success`、`session.next.shell.ended` → tool-ended（callID）
  - `session.next.tool.failed` → tool-ended（callID, failed:true）
  - `session.next.tool.input.ended` → 忽略（输入流结束 ≠ 执行结束，docs/03 §4 移除节点不含它）
  - `permission.asked`（id）、`permission.v2.asked`（id）→ permission-opened（requestID=id）；`permission.replied`、`permission.v2.replied`（requestID）→ permission-closed（requestID）
  - `question.asked`、`question.v2.asked`（id）→ question-opened（requestID=id）；`question.replied`、`question.rejected`、`question.v2.replied`、`question.v2.rejected`（requestID）→ question-closed
  - `session.status`：status.type==="retry" → retry-started；==="busy" → busy-started；==="idle" → session-idle
  - `session.next.retried`（**含 sessionID**，types.gen.d.ts:916）→ retry-started（docs/03 §4:72 要求 `session.status: retry` 与 `session.next.retried` 同为 retry 源；按 sessionID 过滤后分发）
  - `session.idle` → session-idle
  - `session.next.step.failed`、`session.error`（`error?.name !== "MessageAbortedError"`）→ cycle-failed
  - `session.error` 且 `error?.name === "MessageAbortedError"` → cycle-aborted（用户中断，不 success 不 error）
  - `session.error` 的 sessionID 与 error 字段均**可选**（types.gen.d.ts:991-995）→ 判定一律用 `error?.name` 可选链守卫，error 缺失按 cycle-failed 处理；无 sessionID 时路由到 registry.lastActiveSessionID 对应控制器，无则忽略；绝不抛错；**显式测试：session.error 无 error 且无 sessionID → 不抛错、按归属规则处理**
  - **明确 allowlist**：只映射上述 started/ended/called/success/failed/shell.started/ended 事件；`session.next.text.delta`、`reasoning.delta`、`tool.input.delta`、`tool.progress`、`message.part.*` 一律返回 null（S06 依赖：delta 不得冲掉 retry，docs/06:36）
  - 其余事件类型 → null（忽略，不改变可信状态）
  Must NOT：不解析事件正文/delta 文本内容；不匹配错误文本字符串；不访问 session message/tool input/output；**debug 日志仅事件类型+sessionID，绝不记录 shell.ended.output / tool input / delta 文本**（docs/04 §7:220）。
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 8 | Can parallelize with: 3,4,5
  References:
  - 事件名/负载：/Users/unsis/.config/opencode/node_modules/@opencode-ai/sdk/dist/v2/gen/types.gen.d.ts:583-1260（session.next.* / permission(.v2).* / question(.v2).* / session.status / session.idle / session.error / retried）；172-177（MessageAbortedError = {name:"MessageAbortedError"}）；504-521（SessionStatus = {type:"idle"}|{type:"retry",...}|{type:"busy"}）
  - 事件→事实映射语义：docs/03-experience-and-state-model.md:57-92；工具失败可恢复：:78-80；用户中断：:82-91
  - PetEvent 边界（可微调声明）：docs/04-top-level-architecture.md:45-61
  - TuiEventBus：/Users/unsis/.config/opencode/node_modules/@opencode-ai/plugin/dist/tui.d.ts（`event.on<Type>(type, handler): () => void`）
  Acceptance criteria (agent-executable):
  - `npx vitest run src/adapter.test.ts` 全绿；`npm run typecheck` 退出码 0
  - 断言：每个映射表条目一条用例；未知事件返回 null；v1/v2 permission/question 的 id/requestID 归一正确；MessageAbortedError → cycle-aborted；**retried → retry-started（含 sessionID，返回非 null）并按 sessionID 正确过滤分发**（与映射表一致）
  QA scenarios: happy + failure, Evidence .omo/evidence/task-2-*.txt
  - happy: `npx vitest run src/adapter.test.ts --reporter=verbose > .omo/evidence/task-2-happy.txt 2>&1`；断言退出码 0 且输出包含全部映射表用例名（含 retried→retry-started、v1/v2 归一、MessageAbortedError→cycle-aborted）
  - failure: `npx vitest run src/adapter.test.ts -t "missing sessionID" --reporter=verbose > .omo/evidence/task-2-failure.txt 2>&1`；断言退出码 0 且输出含该用例（缺 sessionID 事件与未声明类型不抛错、返回 null）
  Commit: N/A

- [x] 3. 状态归约器（TDD，docs/06 S01-S15）
  What to do / Must NOT do:
  实现 `src/reducer.ts`（纯函数，无计时器、无 UI）：
  - `initialFacts(sessionID)` → `SessionPetFacts`（docs/03 §2 形状：cycleActive、reasoningActive、textActive、activeToolCallIDs:Set、pendingPermissionIDs:Set、pendingQuestionIDs:Set、retryActive、lastTerminalOutcome?）
  - `reduceFacts(facts, event): Facts'`（不可变更新）：cycle-started → cycleActive=true（并清 lastTerminalOutcome）；busy-started → cycleActive=true、retryActive=false；retry-started → retryActive=true、cycleActive=true；reasoning/text start/end 设置对应布尔；tool-started → add callID；tool-ended → remove callID（幂等，重复移除无操作）；permission/question open → add requestID；close → remove（幂等）；**session-idle → 先按归约前 cycleActive 判定 success（见 reduceStep），随后 cycleActive=false、清空活动集合、retryActive=false、lastTerminalOutcome="success"**；cycle-failed → 清空全部活动事实、retryActive=false、cycleActive=false、**lastTerminalOutcome="error"**；cycle-aborted → 同上且不触发 success/error、**lastTerminalOutcome="aborted"**（lastTerminalOutcome 的写入点仅此三处，供重水合与调试，不作为成功判定依据）
  - **cycleActive 复位点（显式）**：cycle-started/busy-started 置 true；cycle-aborted、cycle-failed、已触发 success 的 session-idle 置 false —— 否则幽灵 idle 会重复触发 success（破坏 S01/S11）
  - **retryActive 复位（显式）**：任何 session.status 且 type 为 idle/busy（→busy-started/session-idle）都清除 retryActive；测试断言永久 retry 无法锁死状态（docs/03:72,111）
  - **新 prompt 不打断 retry**：prompted/prompt.admitted（→cycle-started）只打断 success/error 瞬态，**不清除 retryActive**（docs/03 "retry 持续到对应事实消失"；新用户任务仅打断结果动画）；测试断言：retry 期间收到新 prompt → 仍显示 retry 直到 status busy/idle（防与 S06 冲突）
  - `reduceState(facts): PetState`：优先级 error>waiting>retry>working>thinking>idle（docs/03 §3）：pendingPermissionIDs∪pendingQuestionIDs 非空 → waiting；retryActive → retry；activeToolCallIDs 非空 → working；reasoningActive||textActive||cycleActive → thinking；否则 idle
  - 瞬态调度纯函数 `reduceStep(facts, event, now)` → `{facts, visible: PetState, transient?: {kind:"success"|"error"; until: number; generation: number}}`：**成功判定——session-idle 且归约前 facts.cycleActive 为真 → transient success（until=now+2500）；不要求 step.ended 前置**（docs/03:76 "session.idle / status idle 若周期正常活跃过则触发 success"）；cycle-failed → transient error（until=now+4000，完整 4s 错误）；**tool-ended.failed → transient error（until=now+4000，docs/03:80 工具失败=短暂可打断错误；S08 要求 error→thinking）**；任何"活动开始"事件（cycle-started/busy-started/reasoning-started/text-started/tool-started/permission-opened/question-opened/retry-started）→ generation++ 并清除当前瞬态；瞬态过期（now>=until 且 generation 未变）→ 重新归约事实得出 visible，不无条件写 idle
  - generation token：每次创建/清除瞬态递增 generation，过期回调用 generation 校验，防旧回调覆盖新状态（docs/03 §5）
  - **单调时钟**：`now` 由调用方注入，**生产环境必须用单调时钟（performance.now()/process.hrtime），禁止 Date.now()**（docs/03:112 要求 success/error 计时以 monotonic time 为依据；测试用 fake clock 注入）
  Must NOT：reducer 内不启动计时器、不读真实时钟（`now` 由调用方注入）；不解析事件正文。
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 7,8 | Can parallelize with: 2,4,5
  References:
  - 事实模型：docs/03-experience-and-state-model.md:9-27；优先级：:29-57；瞬态时序：:93-113（2500/4000、打断、monotonic、generation token、过期重归约）；并发工具：:115-126（幂等、清空集合防幽灵 callID）；会话边界/重水合不恢复瞬态：:128-137；hydration 顺序：:138-148
  - 验收矩阵（逐条转成测试）：docs/06-quality-and-agent-handoff.md:27-42（S01-S15 输入序列/预期可见序列/关键断言）
  - PetEvent 形状：.omo/drafts/opco-shigure-tui-skeleton.md 或 src/types.ts（todo 1 产出）
  Acceptance criteria (agent-executable):
  - `npx vitest run src/reducer.test.ts` 全绿：S01-S15 全部实现为事件序列测试（S12 用两个独立实例验证隔离；S13 由 todo 7 hydration 集成测试覆盖，本 todo 至少覆盖瞬态不继承）
  - 断言：并发工具 S07；重复 tool-end/reply 幂等 S14；S11 旧瞬态不覆盖新状态（generation）
  QA scenarios: happy + failure, Evidence .omo/evidence/task-3-*.txt
  - happy: `npx vitest run src/reducer.test.ts -t "S02" --reporter=verbose > .omo/evidence/task-3-happy.txt 2>&1`；断言退出码 0 且输出含 S02 用例（thinking→working→thinking→success→idle，fake clock 推进 2500ms）
  - failure: `npx vitest run src/reducer.test.ts -t "S14" --reporter=verbose > .omo/evidence/task-3-failure.txt 2>&1 && npx vitest run src/reducer.test.ts -t "S10" --reporter=verbose >> .omo/evidence/task-3-failure.txt 2>&1`；断言退出码 0 且输出含 S14 与 S10 用例（S14 幂等不崩溃、S10 用户中断回 idle 无 success/error）
  Commit: N/A

- [x] 4. 动画控制器（TDD，fake clock）
  What to do / Must NOT do:
  实现 `src/animation.ts`：`AnimationController(manifest, opts)`，opts 注入 `now()`、`schedule(cb, ms)`、`cancel(id)`（测试用 fake clock）与 `fpsCap=6`。
  - `setState(state, size)`：取 manifest.sizes[size][state]，重置到首帧；切换状态/尺寸时回到首帧（docs/03 §11 尺寸切换重置）；**animations 重新启用时同样重置当前状态首帧，不追赶禁用期间经过的帧**（docs/03:194-196）
  - 帧推进：按 frameDurationMs 步进；**全局上限 ≤6FPS**（两帧渲染间隔 ≥ 1000/fpsCap，取 max(frameDurationMs, 167)）
  - `start()/pause()/dispose()`：disabled / animations=false / visible=false 时 pause 且不推进帧；dispose 取消全部调度（幂等）；只维护**单一定时器**，不累积
  - **每控制器统一计时器登记**：动画时钟与瞬态（success/error 期限）共用一个 `Map<timerKind, handle>`；回调内校验 generation token；dispose/onCleanup 取消全部（docs/04 §5:177-185、docs/03:113）
  - 一次性状态（success/error，loop=false）：播放一遍后停在该状态末帧（瞬态结束后由上层把状态切回归约结果）
  - 暴露 `onFrame(frame: PixelFrame)` 订阅；不直接调用 UI
  Must NOT：不用真实 setInterval（全部经注入的 schedule）；不在动画控制器里做状态归约。
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 7,8 | Can parallelize with: 2,3,5
  References:
  - 动画职责：docs/04-top-level-architecture.md:73-83（≤6FPS、尺寸独立资源、瞬态期限、停止条件）；docs/02-product-requirements.md:108-113（性能 NFR：≤6FPS、idle 更低、隐藏/禁用/关闭停表）
  - 帧率节奏建议：docs/03-experience-and-state-model.md:150-162（idle 2-4FPS、active 4-6FPS、success/error 一次性短循环、retry 3-5FPS）
  - 设置行为：docs/03-experience-and-state-model.md:191-197（animations=false 取消计时器显示首帧；重新启用从首帧开始不追赶）
  - AnimationSpec：docs/04-top-level-architecture.md:93-111
  Acceptance criteria (agent-executable):
  - `npx vitest run src/animation.test.ts` 全绿；`npm run typecheck` 退出码 0
  - fake clock 断言：帧间隔 ≥167ms；pause 后 10 个 tick 无帧回调；dispose 后无回调；状态切换回首帧；任意时长运行后调度计数不增长（单定时器）
  QA scenarios: happy + failure, Evidence .omo/evidence/task-4-*.txt
  - happy: `npx vitest run src/animation.test.ts -t "idle loop" --reporter=verbose > .omo/evidence/task-4-happy.txt 2>&1`；断言退出码 0 且输出含 idle 两帧按 400ms 交替用例（fake clock 快进）
  - failure: `npx vitest run src/animation.test.ts -t "long retry" --reporter=verbose > .omo/evidence/task-4-failure.txt 2>&1`；断言退出码 0（长 retry 虚拟 10 分钟定时器恒为 1；dispose 两次幂等）
  Commit: N/A

- [x] 5. CharacterManifest + 占位帧 + 构建期校验器（TDD）
  What to do / Must NOT do:
  实现 `src/manifest.ts`：
  - `SHIGURE_PALETTE`：docs/07 §5 的 **12 个颜色 token（十六进制）**（hair_shadow #2A1D1A, hair_base #4A2B24, hair_light #704739, skin #FFD0B4, eye_blue #4BA9FF, eye_deep #153A78, uniform #242634, trim_warm_white #F1E8DF, ribbon_red #C52F3C, sock_black #141820, boot_red_brown #4B2624, outline #17141B）**+ transparent 索引 0**（palette[0] 占位，token 从 1 开始编号，docs/07 §5 共 13 行含 transparent）
  - `generatePlaceholderFrames(size, state): PixelFrame[]`：**确定性**程序生成占位帧（明确 `PLACEHOLDER`）：用 token 画圆润小人剪影——宽发轮廓、小椭圆脸、蓝眼像素簇、深色水手服、暖白侧板、红领结、深色裙/袜/靴分层（几何遵循 docs/07 §6 语义分层）；每状态几何变化遵循 docs/07 §7 无图描述（thinking 眼上移/头微侧、waiting 头抬起、error 头低肩沉、success 脚底上移 ≤1px、working 微前倾、retry 轻微左右摆、**idle 第 2 帧仅眨眼/刘海/发尾或辫子 1px 变化，身体与脚底基线不动**——docs/05 §7:130-139 无基线跳动、docs/05:81 基线稳定、docs/07 §7 idle 只改 1px）；循环状态（idle/thinking/working/waiting/retry）2 帧，一次性（success/error）1 帧；帧尺寸精确 24×24 / 16×16；**角色不接触画布边缘：上/左/右至少 1 列/行透明，底部允许 0px**（docs/07 §3:58 compact 底部安全边距 0-1px；保持"无意外裁切"意图，success 跳起除外）；不使用半透明、不出现文字/符号/道具
  - 帧时长：idle 400ms；thinking/working/retry 200ms；**waiting 300ms（docs/03:157 建议 waiting 2–4 FPS）**；success/error 300ms；loop：success/error=false，其余 true
  - 导出 `SHIGURE_MANIFEST: CharacterManifest`（结构按 docs/04 §3.5：id/displayName/palette/sizes）
  - `scripts/validate-assets.ts`：加载 SHIGURE_MANIFEST，执行 docs/04 §4 不可省略检查——两尺寸×七状态齐全、逻辑尺寸精确（24×24/16×16）、palette 索引合法、透明索引一致、每状态 ≥1 非透明像素、**上/左/右透明 + 底部 ≥0px（不裁切；与 docs/07 §3 compact 底部 0px 允许一致）**、frameDurationMs ∈ [167,600]（**下限 167ms=1000/6，与 ≤6FPS 自洽**）、有效 FPS ≤6；**另加占位帧 token 存在性检查：两尺寸均含 eye_blue / ribbon_red / trim_warm_white / sock_black 至少各 1 像素（docs/07 §9:175-186 无图验收，为美术交接兜底）**；失败打印明细并以非零退出
  - `manifest.test.ts`：validator 对损坏 manifest 拒绝（缺状态/错尺寸/非法索引/全透明）；占位生成确定性（同输入同输出）
  Must NOT：不解码任何 PNG（运行时与构建期都不引入图片解码）；不加入 docs/07 §8 禁止效果（漂浮符号/阴影/场景/文字）；占位帧不冒充最终资产（manifest 导出同时导出 `ASSETS_ARE_PLACEHOLDER: true` 常量）。
  Parallelization: Wave 2（可与 Wave 1 并行） | Blocked by: 1 | Blocks: 6,8 | Can parallelize with: 2,3,4
  References:
  - manifest 合同（不可改约束）：docs/04-top-level-architecture.md:85-116（两尺寸独立资源、七状态齐全、索引调色板、帧时长与循环语义）；构建流与必查项：:151-174
  - 调色板 token：docs/07-visual-handoff-without-multimodal.md:74-91；语义像素分层示例：:93-122；状态帧无图描述：:141-153
  - 两档尺寸规则：docs/05-visual-asset-spec.md:72-97（独立重绘、基线稳定、不触边、无半透明）；动画原则：:130-139（首尾连续、无基线跳动、idle 必须可见微变化）
  - 禁止效果：docs/05-visual-asset-spec.md:140-150
  Acceptance criteria (agent-executable):
  - `npm run validate-assets` 退出码 0；`npx vitest run src/manifest.test.ts` 全绿；`npm run typecheck` 退出码 0
  - 断言：两尺寸×七状态帧全部存在；24×24 帧像素数组长度 576、16×16 长度 256；每个非透明像素索引 < palette.length
  QA scenarios: happy + failure, Evidence .omo/evidence/task-5-*.txt
  - happy: `npx tsx scripts/validate-assets.ts > .omo/evidence/task-5-happy.txt 2>&1; echo "exit=$?" >> .omo/evidence/task-5-happy.txt`；断言 exit=0 且输出含 PASS
  - failure: 临时把 manifest 的一状态帧改为缺状态/非法索引/全透明（改后运行 `npx tsx scripts/validate-assets.ts > .omo/evidence/task-5-failure.txt 2>&1; echo "exit=$?" >> .omo/evidence/task-5-failure.txt`；断言 exit≠0 且输出报出具体违规项）→ **随后恢复 manifest 并重跑 happy 命令确认恢复**
  Commit: N/A

- [x] 6. 半块渲染器（TDD）
  What to do / Must NOT do:
  实现 `src/renderer.ts`：`renderFrame(frame, palette, opts: {transparentIndex: number; outlineColor: string}) → {rows: RenderRow[]}`，`RenderRow = Run[]`，`Run = {text: string; fg?: string; bg?: string}`（颜色为十六进制字符串，由 Solid 组件转主题/ANSI）。
  - 上下像素合并表（docs/04 §3.6）：透明/透明→空格（无 fg/bg）；色A/透明→"▀" fg=A；透明/色B→"▄" fg=B；同色A/A→"█" fg=A；色A/色B→"▀" fg=A bg=B
  - **垂直配对只减半高度：行宽 = 逻辑像素宽（24px→24 格、16px→16 格），行数 = 高/2（docs/04:135、docs/06:63-64）——禁止把宽度也减半**
  - 行宽严格 = 帧宽；24×24 → 12 行×24 格；16×16 → 8 行×16 格
  - 透明像素不写 bg（继承 sidebar panel 背景）
  - palette 中等于 outline token 的像素 → fg=outlineColor（主题切换时只换轮廓色，docs/04 §3.6 + docs/05 §5）
  - 相邻同色 run 合并为一个 span（合并前后视觉等价）
  - 只输出 `▀▄█` 与空格、十六进制色值（Run 结构 {text, fg?, bg?}，由 Solid 组件渲染为 OpenTUI `<text>`/span）；**禁止** emoji/全角空格/组合字符/任何 ANSI 转义字符串注入文本（docs/04:133）
  - 测试补充：输出不含 ESC 字节（\x1b）与 emoji/全角字符；**主题切换测试**——浅/深 theme 下仅 outline token 色变化、主体色不变（docs/06:70-75）
  Must NOT：不生成 ANSI 转义串塞普通文本（颜色用 span 结构承载）；不做任何缩放/抗锯齿。
  Parallelization: Wave 2 | Blocked by: 5 | Blocks: 7,8 | Can parallelize with: —
  References:
  - 半块映射与要求：docs/04-top-level-architecture.md:117-137；docs/05-visual-asset-spec.md:83-84（半块承载两像素）
  - 渲染器验收：docs/06-quality-and-agent-handoff.md:59-76（五组合/尺寸/无 emoji/透明不写背景色/run 合并不改变输出）
  - 主题感知：docs/01-research-and-positioning.md:111-112（轮廓色切换，主体色不变）
  Acceptance criteria (agent-executable):
  - `npx vitest run src/renderer.test.ts` 全绿；`npm run typecheck` 退出码 0
  - 断言：五组合输出正确；24×24 → 12 行×24 格；16×16 → 8 行×16 格；输出字符集合 ⊆ {▀,▄,█,空格}；透明行无 bg；合并前后逐格展开视觉等价
  QA scenarios: happy + failure, Evidence .omo/evidence/task-6-*.txt
  - happy: `npx vitest run src/renderer.test.ts -t "five combos" --reporter=verbose > .omo/evidence/task-6-happy.txt 2>&1`；断言退出码 0 且输出含五组合与 4×2 帧用例（2 行输出）
  - failure: `npx vitest run src/renderer.test.ts -t "out of range" --reporter=verbose > .omo/evidence/task-6-failure.txt 2>&1`；断言退出码 0（越界索引帧抛带类型错误，不静默输出坏字符）
  Commit: N/A

- [x] 7. 会话控制器注册表 + Solid 侧栏组件（TDD registry，组件由 todo 8 冒烟验证）
  What to do / Must NOT do:
  实现 `src/registry.ts`：`ControllerRegistry`（plugin 级单例）
  - `getOrCreate(sessionID)`：创建 `PetController`（组合：adapter 过滤 + reducer + AnimationController + hydration）；`get(sessionID)`；`dispose(sessionID)`（取消动画计时器与瞬态计时器，幂等）；`disposeAll()`
  - `PetController.handle(event)`：sessionID 过滤（不匹配忽略，docs/03 §7）；reducer 步进（注入 now）；动画控制器 setState；**异常按 docs/04 §5 分层降级**——事件适配错误→忽略该事件+console.debug；状态归约异常→重水合当前会话（重新 hydrate）；动画异常→当前状态首帧；资源/帧缺失异常→**内置静态 idle 占位**（manifest.regular.idle 首帧，编译期常量，FR-5:101-102）；渲染异常→仅标签。**绝不向宿主抛错**
  - **静态 idle 占位**：`SHIGURE_MANIFEST.sizes.regular.idle.frames[0]` 作为所有资源异常的回退帧（生成器保证始终存在）；渲染层对该帧的解析失败 → 空 slot
  - `PetController.hydrate(api)`：docs/03 §8 顺序——读 `api.state.session.permission(sessionID)`/`question(sessionID)` 非空 → waiting；否则 `api.state.session.status(sessionID)`：retry→retry、busy→thinking、idle/**undefined**→idle（tui.d.ts:307 返回 SessionStatus|undefined）；**不恢复 success/error 瞬态，只恢复 idle/thinking/retry/waiting**（docs/03 §7:136）；`api.kv.ready`/`api.state.ready` 为 false 或读取失败 → 静态 idle，不轮询重试（docs/03:148）
  - `visible` 标志：组件 onMount 置 true、onCleanup 置 false；`animations=false`/`disabled`/`!visible` 时 pause
  - **`lastActiveSessionID` 追踪**：registry 记录最近一次成功分发事件的 sessionID；供无 sessionID 的 `session.error` 归属（t8 分发器使用）
  - 测试补充（docs/06 §7:96-97、§4:56、FR-5:103）：10,000 个无关/他会话事件不改状态；重复 mount/dispose 监听器数量不增长；长 retry/waiting 计时器不累积；热重载偏好保留、无重复注册；**双重 dispose 幂等**；**dispose 后动画与瞬态计时器全部取消**（fake clock 断言）
  实现 `src/sidebar.tsx`（`/** @jsxImportSource @opentui/solid */`）：`SidebarPet(props: {api: TuiPluginApi; session_id: string; controllers: ControllerRegistry; cfg: () => PetConfig})`（**cfg 为反应式读取器**，由 tui.ts 的 createSignal 注入——组件据此响应 enabled/size/animations 变化，FR-3 即时生效）
  - createEffect on props.session_id：切换控制器（旧控制器 dispose，新 getOrCreate + hydrate）
  - 渲染：`<box flexDirection="column">` 内宠物行（每行一个 `<text>`，水平居中——用 box alignItems/justifyContent 或每行补空格居中，行宽=逻辑像素宽）+ 标签行 `<text>`（`PET_STATE_LABELS[state]`；颜色：默认 textMuted；waiting→theme.warning、error→theme.error、retry→theme.accent，docs/03 §10；不能只靠颜色——标签文字恒显示）；**响应 cfg()**：enabled=false → 返回 null（slot 空内容，docs/03 §11）；size/animations 变化 → 通过控制器 setState/pause 生效（t8 命令写入信号）
  - 轮廓色：`ctx.theme.mode()==="dark" ? 浅轮廓 : outline token`（docs/07 §5 轮廓切换）
  - 帧来源：controller 订阅 onFrame → Solid signal；无帧（动画关闭）→ 当前状态首帧
  Must NOT：组件内不订阅全局事件（事件只经 registry 分发）；不显示工具名/文件名/错误摘要/倒计时（docs/03 §10:188）；不添加文字气泡/漂浮 UI。
  Parallelization: Wave 2 | Blocked by: 3,4,5,6 | Blocks: 8 | Can parallelize with: —
  References:
  - 会话边界/重水合：docs/03-experience-and-state-model.md:128-148；布局：:165-190；设置行为：:191-197
  - slot 组件形状（ctx/props）：/Users/unsis/.config/opencode/node_modules/@opencode-ai/plugin/dist/tui.d.ts（TuiSlotPlugin/TuiSlotContext/TuiHostSlotMap["sidebar_content"]={session_id}）；@opentui/core Plugin：/Users/unsis/.cache/opencode/packages/oh-my-openagent@latest/node_modules/@opentui/core/plugins/types.d.ts:21-30
  - 主题字段：同上 dist/tui.d.ts 的 TuiThemeCurrent（text/textMuted/warning/error/accent/backgroundPanel）
  - 错误策略：docs/04-top-level-architecture.md:175-198
  Acceptance criteria (agent-executable):
  - `npx vitest run src/registry.test.ts` 全绿（registry 生命周期：create/get 同实例、dispose 取消计时器、disposeAll、handle 过滤异会话事件）；`npm run typecheck` 退出码 0
  - 组件本身无单测（渲染由 todo 8 真实 TUI 冒烟验证）；若 tsx 类型检查发现组件错误则必须修复
  QA scenarios: happy + failure, Evidence .omo/evidence/task-7-*.txt
  - happy: `npx vitest run src/registry.test.ts --reporter=verbose > .omo/evidence/task-7-happy.txt 2>&1`；断言退出码 0 且输出含 S12 隔离用例名（两会话独立实例、事件互不串扰）
  - failure: `npx vitest run src/registry.test.ts -t "hydrate failure" --reporter=verbose > .omo/evidence/task-7-failure.txt 2>&1`；断言退出码 0（测试通过即证明 hydrate 抛错落到静态 idle 且不抛向调用方）
  Commit: N/A

- [x] 8. TUI 入口 + 命令 + 生命周期 + 构建/打包/真实冒烟 + README
  What to do / Must NOT do:
  实现 `src/tui.ts`：
  - **`export default { id: "opco-shigure", tui }` 且同时具名导出 `tui`**（官方 tui-plugins.md spec：加载器**只读默认导出对象**、具名导出被忽略——默认导出是权威形态；具名导出保留仅作无害兼容；`id` 必须放默认导出上——file 插件要求非空 id；冒烟确认默认导出加载，见下）
  - `tui(api, options, meta)` 顶层 try/catch + `api.lifecycle.signal.aborted` 早退（docs/04 §5）
  - **配置反应式通道（FR-3 即时生效）**：在 `tui.ts` 用 Solid `createSignal<PetConfig>`（初始 loadConfig）持有配置；slot 渲染传入 `cfg: () => PetConfig` 给 SidebarPet；三项命令的 run() 通过 setter 更新信号 + `saveConfig` —— 保证 Hide/Show/Compact/Animations 在运行会话中立即生效（不依赖重载）
  - slot：`api.slots.register({ order: 600, slots: { sidebar_content: (ctx, props) => <SidebarPet api={api} session_id={props.session_id} controllers={registry} cfg={cfgSignal[0]} /> } })`（order 600 排在内置 context 100/MCP 200/LSP 300/todo 400/files 500 之后；**注册的 slot plugin 不带 id**——TuiSlotPlugin 禁止 id，id 只留在模块导出上，tui.d.ts:398-400；若冒烟发现 600 位置错误 → 回退默认 order 并记录）
  - 事件：对 todo 2 映射表列出的每个 SDK 事件类型 `api.event.on(type, handler)`（handler：try/catch → console.debug；按 event.sessionID 分发到 registry 对应控制器；**session.error 无 sessionID → 分发到 registry.lastActiveSessionID 对应控制器，无则忽略，绝不抛错**）
  - 命令（标题按 docs/02 FR-3）：`api.keymap.registerLayer({ mode: "base", commands: [ {name:"opco-shigure.toggle", title:"Shigure: Show/Hide Pet", category:"Shigure", namespace:"palette", desc:"显示或隐藏时雨宠物", run(){setCfg(c => ({...c, enabled: !c.enabled})); saveConfig; registry 全量生效}}, {name:"opco-shigure.size", title:"Shigure: Use Regular/Compact Size", ...run(){setCfg(c => ({...c, size: c.size==="regular"?"compact":"regular"})); saveConfig; 各控制器动画重置首帧}}, {name:"opco-shigure.animations", title:"Shigure: Enable/Disable Animations", ...run(){setCfg(c => ({...c, animations: !c.animations})); saveConfig; **registry 对所有控制器 pause/resume + 重置当前状态首帧（FR-3 即时生效，docs/02:90）**}}], bindings: [] })`；**Command 形状以已装 @opentui/keymap 的 `Command` 类型为准做编译期类型断言**（勿凭 spec 猜测字段）；若 `registerLayer` 不可用 → 回退 legacy `api.command?.register`（**api.command 为可选且已废弃，必须 `?.` 守卫**，tui.d.ts:468）
  - 生命周期：`api.lifecycle.onDispose(() => registry.disposeAll())`；**`api.slots.register` 返回 slot-id 字符串而非 disposer**（tui.d.ts:401-405）——slot 清理依赖宿主自动执行并在冒烟验证，勿寻找不存在的 slot disposer；`api.event.on` 的 unsubscribe 与 `keymap.registerLayer` 的 disposer **按 spec 由宿主自动清理**——显式登记到 lifecycle 仅作幂等双保险（**确保这些 disposer 幂等，避免宿主与自身双重清理**）；类型引用（keymap.d.ts:32 / plugins/types.d.ts:21-30）来自本机 @opentui 0.2.16 缓存，**实现时以运行时实际安装的 ≥0.4.5 类型复核**（编译期 Command 类型断言兜底）
  - 只允许 console.debug 结构化日志（加载/卸载/能力缺失/降级原因/开发模式状态转换），**只记录事件类型与 sessionID，绝不记录会话正文/工具输出/文件内容/delta 文本**（docs/04 §7）
  - 构建脚本链：`npm run build`（tsup）+ `npm run validate-assets`；`npm run typecheck`；`npm test`
  - 打包验证：`npm pack` → tarball 含 dist/tui.js + package.json（exports["./tui"] 指向正确）；解包检查
  - **真实冒烟（用户已确认 d10：真实配置安装并保留）**——**冒烟顺序先验证"加载与布局"再验证"行为"**（Metis F32）：
    1. 备份 `~/.config/opencode/tui.json` → `.omo/evidence/tui.json.backup`
    2. 在该文件 `plugin` 数组追加绝对路径条目 `"/Users/unsis/code/opcode/opcopet/dist/tui.js"`（保留启用；验证 OpenCode 接受绝对路径条目）
    3. **PTY 捕获 + 输入驱动（单一一致栈，二选一）**：**(a) python pty 脚本**——spawn `opencode` + 注入输入 + 实时捕获输出，输出落盘 `.omo/evidence/task-8-smoke.typescript`；或 **(b) 全部用 tmux**——新 pane 启动 opencode，`send-keys` 注入输入，`capture-pane -S -200` 输出落盘。**禁止 script 捕获 + tmux 注入混用**。**spawn/建 pane 前先设窗口尺寸**（python: TIOCSWINSZ 200×50；tmux: `resize-window -x 200 -y 50`）——**必须保证侧栏可见**（FR-1：终端过窄侧栏隐藏，宠物渲染证据无法出现）。**每个冒烟步骤设 30s 超时，超时即记录并判该步失败**。插件 debug 日志定向：启动命令加 `2>&1` 使 stderr 进捕获，或记录 opencode 日志文件路径并 grep "opco-shigure loaded"。断言顺序：先断言加载成功——**以捕获中宠物区块（占位帧字符行）实际渲染为权威加载证据**（`api.plugins.list()` active 若不可观测则降级为渲染证据）→ 打开会话 → 断言 sidebar 宠物区块渲染且堆叠在内置 context/MCP/LSP/todo/files 之后（order 600 生效；位置不符 → 回退默认 order 并记录）→ 标签"待机" → **真实任务（写 `.omo/evidence/hello.txt`）**：**若环境无可用 provider/网络（此时连授权等待也无法触发）→ 回退方案：仅验证加载+渲染+待机标签+三项命令生效（命令不依赖 provider），状态序列与 waiting 语义由 S01-S15 单测覆盖，限制记录到 .omo/evidence/task-8-fallback.txt**；有 provider 则观察 思考/工作/完成 → 触发一次等待（如需要授权的命令）→ "等待" → 命令面板执行三项命令：Hide（slot 空）→ Show（恢复）→ Compact（16×8 格）→ Regular（恢复）→ Animations off（静止首帧）→ on（恢复动画，且从首帧开始）→ 清理：删除 `.omo/evidence/hello.txt`（如已创建）
    4. npm pack 模拟安装：scratch 目录 `node_modules/opco-shigure` 放入解包 tarball + scratch XDG_CONFIG_HOME 配置 `tui.json` 写 `"plugin":["opco-shigure"]`，启动 opencode → 插件加载成功（端到端验证 `exports["./tui"]` 解析路径）；若该解析需联网 registry 而环境不允许 → 记录为已知限制并回退绝对路径条目验证（在 .omo/evidence 记录）
    5. 隐私检查：对 dist/ 与依赖做静态 grep——无 `fetch(`/`WebSocket`/`child_process`/`exec(`/`spawn(`（docs/06 §8）
    6. **终端矩阵冒烟（docs/06 §6:77-89 骨架子集）**：在当前主终端（本机 macOS 终端/iTerm2/Ghostty 之一）记录 opencode 版本/终端/字体/主题/COLORTERM，验证真彩+块字符+窗口 resize+主题切换，写入 .omo/evidence/task-8-terminal.txt；tmux/SSH 差异记入已知限制，不启用任何图片协议
    7. 冒烟后 tui.json 条目**保留**（用户已确认）
  - README.md 更新：骨架状态（可运行、占位帧）、安装与验证步骤、已知限制（tmux/SSH 尽力兼容、占位帧非最终美术）、美术交接说明（docs/05/07 合同 + validator 管线）、**许可边界（代码 MIT + 角色素材许可需单独说明，docs/06 §12:166-177）与发布前重查 npm 名称提示**
  Must NOT：不发布 npm；不改 `opencode.json`；不新增 KV 字段；不初始化 git；不把最终美术资产纳入本 todo。
  Parallelization: Wave 3 | Blocked by: 2,3,4,5,6,7 | Blocks: —
  References:
  - 入口职责：docs/04-top-level-architecture.md:29-38；包边界：:199-209；生命周期：:175-198；可观测性：:211-219
  - 命令合同：docs/02-product-requirements.md:84-91；设置即时生效：docs/03-experience-and-state-model.md:191-197
  - 插件模块形状：/Users/unsis/.config/opencode/node_modules/@opencode-ai/plugin/dist/tui.d.ts（TuiPluginModule/TuiPlugin/TuiSlotPlugin/TuiKV/TuiEventBus/TuiLifecycle）；keymap registerLayer：/Users/unsis/.cache/opencode/packages/oh-my-openagent@latest/node_modules/@opentui/keymap/src/keymap.d.ts:32
  - 安装解析：tui.json `plugin` 数组接受 npm spec / 相对 / 绝对路径 / `[spec, options]`（librarian 调研：github.com/anomalyco/opencode/blob/dev/packages/opencode/specs/tui-plugins.md）；npm 包按 `exports["./tui"]` 解析、默认导出模块
  - 冒烟矩阵：docs/06-quality-and-agent-handoff.md:76-89（正式终端 ≥1 主路径）；DoD：:9-25；发布门槛（本次不发布，仅对齐）：:166-177
  - 参考实现：github.com/edso404/oh-my-sidebar/blob/main/packages/context-progress/src/index.tsx（slot 注册 + 事件订阅 + kv）
  Acceptance criteria (agent-executable):
  - `npm run build`、`npm run typecheck`、`npm test`、`npm run validate-assets` 全部退出码 0
  - `npm pack` 成功且 tarball 内 dist/tui.js 存在、package.json 的 exports["./tui"].import 指向 dist/tui.js
  - 真实 TUI 冒烟证据落盘（.omo/evidence/task-8-smoke.typescript 或截图），断言：**宠物区块+标签实际渲染**（权威加载证据）、插件加载日志、**有 provider 时**至少一次真实任务触发 思考/工作/完成 + 一次 等待（无 provider 时回退证据 .omo/evidence/task-8-fallback.txt 记录限制）、三项命令生效
  - `~/.config/opencode/tui.json` 含 `opco-shigure` 条目且**保留**；`.omo/evidence/tui.json.backup` 存在
  - 隐私 grep 零命中；README 更新完成
  QA scenarios: happy + failure, Evidence .omo/evidence/task-8-*.txt
  - happy: 完整冒烟流程通过（见上，含 provider 分支或回退分支）；pack 模拟安装加载成功（输出写入 .omo/evidence/task-8-happy.txt）
  - failure（可复现步骤）：`mv dist dist.bak` → 按步骤 3 启动 TUI → 断言 opencode TUI 不崩溃、插件降级日志有记录、无宠物区块但会话正常 → 记录到 .omo/evidence/task-8-failure.txt；`mv dist.bak dist` 恢复后重跑步骤 3 确认恢复正常
  Commit: N/A

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.

- [x] F1. Plan compliance audit
  What: 对照本计划逐 todo 核验：全部 8 个 todo 的 Acceptance 均达成、证据文件存在（.omo/evidence/task-*.txt 与冒烟产物）、无遗漏 todo。
  How (agent-executable): 逐条运行验收命令复核：`npm run typecheck`、`npm test`、`npm run validate-assets`、`npm run build`、`npm pack --dry-run` 全绿；检查 .omo/evidence/ 下 8 组 task-* 证据 + task-8 冒烟产物齐全且非空。
  Happy (PASS): 上述命令全绿且证据文件齐全 → PASS；输出清单到 .omo/evidence/f1-audit.txt。
  Failure (FAIL): 任一命令非零退出或任一证据缺失 → FAIL 并列出缺失项到 .omo/evidence/f1-audit.txt（修复后重跑本项）。
- [x] F2. Code quality review
  What: 独立代码审查（可派 oracle）：reducer 纯函数与 generation token 正确性、动画控制器单定时器与 ≤6FPS、渲染器五组合与 run 合并、错误隔离（无异常抛入宿主路径）、隐私（无网络/外部进程/正文解析）、无 AI slop（死代码/重复实现/过度工程）。
  How (agent-executable): 审查 src/ 全部文件 + `grep -rn "fetch(\|WebSocket\|child_process\|exec(\|spawn(" dist/` 复验零命中。
  Happy (PASS): 审查无 high 级问题且隐私 grep 零命中 → PASS；清单到 .omo/evidence/f2-review.txt。
  Failure (FAIL): 任一 high 级问题或 grep 命中 → FAIL，附问题清单到 .omo/evidence/f2-review.txt（修复后重跑本项）。
- [x] F3. Real manual QA
  What: **独立于实现者**启动真实 OpenCode TUI：在仓库内新开会话 → 宠物与七种标签渲染正确；跑真实任务观察状态序列（无 provider 时按 t8 回退方案）；权限等待 → 等待；三项命令各自生效；切换会话（若可行）无串扰；卸载/重载插件无残留计时器（调试日志验证）。
  How (agent-executable): 复制 t8 冒烟步骤（含 PTY 驱动/超时/回退）重跑一遍并保存独立证据到 .omo/evidence/f3-smoke.typescript + .omo/evidence/f3-notes.txt；断言结果与 t8 一致。
  Happy (PASS): 加载+渲染+待机标签通过，命令三项生效，状态证据与 t8 一致 → PASS。
  Failure (FAIL): 加载失败/渲染缺失/命令无效 → FAIL，记录到 .omo/evidence/f3-notes.txt（修复后重跑本项）。
- [x] F4. Scope fidelity
  What: 对照本计划 Must NOT have 逐项核验：无 server 入口、bundle 无 fetch/WebSocket/child_process、无 emoji/图片协议路径、无养成/多角色/统计代码、无 <1.18 兼容分支、KV 仅三项键、无 git 初始化、无 npm 发布动作、无最终美术资产混入。
  How (agent-executable): 代码引用点 grep（**只匹配禁用模块/API，不匹配普通 import**）：`grep -rnE "(from ['\"](?:node:)?(?:http|https|child_process|net|ws)\b|fetch\(|WebSocket|child_process|spawn\(|exec\(|sixel|kitty|\.png)" src/ dist/ --include="*.ts" --include="*.tsx" --include="*.js"`（"server" 关键字不参与 grep——注释会出现误报；server 入口检查改为核对 package.json 无 `exports["./server"]`）+ 文件清单核对 + KV 键清单核对（仅 opco-shigure.enabled/size/animations）。
  Happy (PASS): 逐项零违规 → PASS；清单到 .omo/evidence/f4-scope.txt。
  Failure (FAIL): 任一 Must NOT 违规 → FAIL，列违规项到 .omo/evidence/f4-scope.txt（修复后重跑本项）。

## Commit strategy

- 仓库**当前不是 git 仓库**，且用户未要求版本控制：本计划**不初始化 git、不产生任何提交**（所有 todo 的 Commit 行为 N/A）。
- 若执行过程中用户决定初始化 git：每个 todo 完成后按 `type(scope): summary` 规范提交一次（feat/scaffold、feat(adapter)、feat(reducer)、feat(animation)、feat(manifest)、feat(renderer)、feat(sidebar)、feat(entry)、docs(readme)），但该决定需用户明示，不默认执行。

## Success criteria

- `opco-shigure` 包可在真实 OpenCode 1.18+ TUI 从 `tui.json` 绝对路径条目加载，**条目保留启用**。
- `sidebar_content` 正常显示宠物区块，不替换/不占用 session title 与 footer。
- 两档尺寸 × 七状态占位帧全部有效（`npm run validate-assets` 通过），构建期校验器对损坏资产拒绝。
- 宠物启用且侧栏可见时，七种中文标签始终显示；动画关闭时标签仍显示（FR-4）。
- reducer 测试覆盖 docs/06 S01-S15 行为矩阵并全绿（并发/幂等/跨会话隔离/瞬态时序）。
- success ≈2.5s / error ≈4s，可被新任务打断（fake-clock 断言）；动画关闭时无活动帧计时器。
- 渲染器确定性测试全绿：五组合、24×12 / 16×8 行宽、透明继承背景、同色 run 合并不改视觉。
- 异常路径不抛入 OpenCode 宿主（适配/归约/渲染/资源异常全部隔离，冒烟验证 TUI 不崩溃）。
- 构建产物零网络请求、零遥测、零外部进程、零会话正文解析（隐私 grep 通过）。
- README 反映骨架状态：可运行、占位帧、安装验证步骤、已知限制与美术交接说明。

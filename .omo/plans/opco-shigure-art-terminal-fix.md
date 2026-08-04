# opco-shigure-art-terminal-fix - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** 侧栏时雨宠物的两件套修复——①终端里不再有点状白点/灰点（换回暖白轮廓后依然干净，有机器门禁+真实终端捕获双重验证）；②美术重新按你给的 art-v2 参考图低分辨率重画（宽发、椭圆脸、蓝眼、单侧细辫、白侧板、红领结、裙袜靴分层，最终长相由你逐项终审）。

**Why this approach:** 你实测确认灰点根源在"美术轮廓像素过密散落+渲染器统一映射浅色"，所以本轮重点是把美术重新画干净（A 方案）而不是改渲染器；同时把"终端干净"下沉成一条确定性机器审计门，防止以后改图再带回噪点。

**What it will NOT do:** 不改你终端里宠物的位置/大小（你留到下一轮的想法）；不做任何生图——本地 looker 模型只负责"看图+输出文本网格"，PNG 全由脚本渲染；不接入图片协议；不改渲染器逻辑；不发布 npm；不重写 git 历史（rebase -i/force push）。

**Effort:** Medium
**Risk:** Medium - 美术最终长相依赖 looker 文本网格的还原度（未经验证），用"单帧探针+3 轮升级规则+你终审"兜底；looker 本地模型可能断连，有"探针+重试+通知你+断点续跑"预案
**Decisions to sanity-check:**
- 换回浅轮廓用 #F7F2EA（与现有预览一致，而非 docs/09 提到的旧 #E8E4DF），避免两处颜色不一致
- 只重画两尺寸 idle 母版，其余 6 个状态按种子微动差派生重建，但每个派生状态都要过状态可读性终审
- 生成器退役并加"运行即抛错"硬守卫，防止误跑覆盖手绘资产
- 连续 3 轮美术未过你的终审 → 三选一升级（你来改像素 / 换模型或人工 / 接受现状）由你拍板

Your next move: 批准后以 `$start-work opco-shigure-art-terminal-fix` 执行；或先运行一次高精度评审。完整执行细节见下文。

---

> TL;DR (machine): Medium effort / Medium risk (looker 文本网格还原度未验证 + 本地模型断连) — 9-todo: git 初始化+基线提交+远端推送（baseline-v4d 回滚安全网）→ T1 渲染一致性复验+前检（复用 /tmp/cap2.py+shigure2.ansi）→ 审计门（b 仅外轮廓含悬浮 b 三条件/无孤立非 token 亮色，测试固定 src/）→ 单帧探针 → 24 idle 母版重设计 → 16 idle+七状态派生（§9.3 可读性终审）→ sidebar 轮廓恢复+生成器退役 → 真实终端捕获（SGR 解析+单一阈值：边界 b×1.2 且 <314，孤立=0）→ 全门禁+预览+docs 附录；A-only、B 不默认做；d11 靠拢 art-v2 参考图硬约束；用户 gate 协议（d15）+ d9 升级兜底；每 todo 提交+push，main 直推。

## Scope
### Must have

- **todo 1：git 初始化 + 基线提交（用户 2026-08-04 新增范围变更，执行前第一步）**——`git init -b main` → 补 `.gitignore`（`*.tgz`）→ 基线提交 `chore: baseline v4d pre-art-fix` + `git tag baseline-v4d` → `git remote add origin git@github.com:unsiscon/oc-shigure.git` → `git push -u origin main`；**每 todo 完成提交一次（type(scope) 命名）+ 每 todo 后 push（异地备份）**；回滚安全网 = baseline-v4d tag + 每 todo 提交点；main 直推（solo 无 PR 流程）。
- 两尺寸 idle 母版低分辨率重设计 + 其余状态按种子微动差契约派生重建（**全部 2×7 帧重新写入 src/assets/final.ts；派生状态必须通过 §9.3 状态可读性终审**，Metis F4），通过 validateManifest + 新审计门。
- multimodal-looker 视觉闭环（先看 v3 母稿 → 文本输出调色板索引行字符串 → 预览对照粗检 → 迭代；最终用户终审；d11 硬约束：靠拢 design/art-v2 参考图）。
- 单帧能力探针（todo 4，先 24×24 idle 帧验证方向性再全量）。
- scripts/audit-art-noise.ts 新增（b 仅最外层轮廓含悬浮 b 三条件、无孤立非 token 亮色；token 覆盖不重复检查——由 validateManifest gate 11 兜底；Metis F1/F16 + Oracle F6/F7）。
- scripts/build-final-assets.ts 退役（scripts/legacy/ + 硬守卫，Metis F6）。
- sidebar.tsx LIGHT_OUTLINE 恢复 #F7F2EA + 删除 v4d 临时注释（Metis F2/F17）。
- 重建仓库内真实终端捕获工具与证据（.omo/evidence/capture/，python pty）。
- 全套门禁（typecheck / test / validate-assets / build / **audit-art-noise**，Metis F9）+ 预览 PNG（深/浅轮廓）+ docs/09 附录更新。

### Must NOT have (guardrails, anti-slop, scope boundaries)

- 不改 manifest-data.ts（palette/帧数/时长是合同）；不动 runtime 模块（adapter/reducer/animation/registry/tui/config/types/manifest.ts/manifest.test.ts/validate-assets.ts，Metis F8 枚举）；renderer.ts 默认零改动（仅当 t8 捕获或 t2 复验出现与用户观察矛盾的渲染差异时才评估 B，且需定义触发阈值）。
- 不改 package.json（若生成器退役需移除引用则按 Metis F8 最小处理并记录）。
- 不新增调色板颜色、不新增状态/尺寸/帧数/时长。
- 不用 v1-v4 程序化/文字契约路线再试；不做高精 PNG 机械降采样。
- 不引入 PNG 解码运行时依赖、图片协议、emoji 方块、新构建依赖。
- 不发布 npm、不改 opencode.json/tui.json 条目；**不 push 其他远端、不 git 历史重写（rebase -i/force push）、不删除 baseline-v4d tag**（git 流程见 todo 1 / Commit strategy）。
- 不做 docs/05 §8 禁止效果（漂浮符号/阴影/场景/道具）。
- 不负责 OpenCode 1.18.10 session.next.* 事件不可观测的运行时限制（docs/09:106）。
- 本轮不做（用户延期至下一轮）：①pet 终端位置调整；②大小微调；③接入 ANSI 更精细显示（Sixel/Kitty 图片协议）。

## Verification strategy
> 机器可验证项全部 agent 执行（命令 + 断言 + 证据）；三个用户 gate（todo 4/5/6/8）按 d15 用户 gate 协议执行（Momus M1 折入：不称"零人工干预"，明示人工 gate 协议）。
- Test decision: TDD 仅用于审计门脚本（todo 3，**测试文件固定放 src/audit-art-noise.test.ts——vitest.config.ts include 仅 src/**/*.test.ts，放 scripts/ 会被 npm test 静默跳过**，Oracle F5）；美术重绘按"looker 产出 → 门禁 → 用户终审"迭代闭环；门禁全绿 + 用户终审 PASS 为 DoD。
- Evidence: `.omo/evidence/task-<N>-*.txt`（**`<N>` = todo 编号 0-8，`*.txt` 为允许的 glob 通配符记法——happy/failure 各一份，如 task-4-happy.txt / task-4-failure.txt；注意 todo 1 产出 task-0-*.txt、todo 9 产出 task-8-*.txt，编号 = todo 编号 - 1**；本计划无 ulw-loop，统一用 .omo/evidence/）；美术迭代检查点 .omo/evidence/art-loop/；终端捕获 .omo/evidence/capture/。
- 验收命令全绿 = `npm run typecheck` + `npm test`（vitest，**全绿；当前 135，新增审计门测试后可增**，Metis F9）+ `npm run validate-assets` + `npm run build` + `npx tsx scripts/audit-art-noise.ts`（零违规，Metis F9 接入）。
- **用户 gate 协议（d15，Momus M1 / Oracle F9）**：三个用户 gate——todo 4 方向性、todo 5/6 终审、todo 8 重启复验——统一执行：①worker 在 verdict 文件（probe-1-verdict.md / idle-regular-verdict.md / states-verdict.md / capture/user-confirm.txt）写 `status: awaiting-user` + 检查清单；②一句话通知用户（查什么/看哪里/结果写哪）；③等待并报告等待状态（不烧 token、不静默空转）；④**超 1 个自然日无响应 → 再通知一次并暂停，恢复时从检查点续跑**（Oracle F9）；⑤用户写入逐项结果（PASS/拒绝+理由）→ worker 从检查点继续。
- 捕获计数规则（todo 8 硬指标）由 todo 8 定义完整算法（ANSI SGR 解析 / 轮廓单元格定义 / 孤立规则 / 区域范围），`capture.py` 无人工判断即可出 PASS/FAIL（Momus M3 / Oracle F2/F3）。

## Execution strategy
### Parallel execution waves

- **Wave 0（git 前置）**: todo 1（git 初始化 + 基线提交 + 远端推送——执行前第一步，破坏性操作的安全网）。
- **Wave 1（根因复验 + 审计门先行）**: todo 2（T1 渲染一致性复验 + 环境前检，用户已实测灰点消失，本轮文档化复验防回归）、todo 3（审计门脚本，TDD）——t2 与 t3 可并行。
- **Wave 2（美术重绘，串行）**: todo 4（单帧能力探针）→ todo 5（24×24 idle 母版重设计）→ todo 6（16×16 idle 母版独立重设计 + 七状态派生）。
- **Wave 3（工具与恢复）**: todo 7（sidebar.tsx 轮廓恢复 + preview 色值统一 + 生成器退役）。
- **Wave 4（真实终端验证）**: todo 8（重建终端捕获 + 硬指标）。
- **Wave 5（收尾）**: todo 9（全门禁 + 预览证据 + docs/09 附录）。
- **Final verification wave**: F1-F4 并行，全部 APPROVE 才宣布完成。

### Dependency matrix

| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 git 初始化 + 基线提交 | — | 2-9 | — |
| 2 T1 渲染一致性复验+前检 | 1 | 4 | 3 |
| 3 审计门 audit-art-noise（TDD） | 1 | 5,6,9 | 2 |
| 4 单帧能力探针（24×24 idle） | 2,3 | 5 | — |
| 5 24×24 idle 母版重设计 | 3,4 | 6,7,9 | — |
| 6 16×16 idle 重设计 + 七状态派生 | 5 | 7,8,9 | — |
| 7 sidebar 轮廓恢复 + 生成器退役 | 6 | 8,9 | — |
| 8 真实终端捕获 + 硬指标 | 7 | 9 | — |
| 9 全门禁 + 预览证据 + docs 附录 | 6,7,8 | — | — |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [x] 1. git 初始化 + 基线提交 + 远端推送（用户 2026-08-04 新增，执行前第一步）
  What to do / Must NOT do:
  1) **前置确认**：本地当前非 git 仓库（实测 `git rev-parse` fatal）、远端 `git@github.com:unsiscon/oc-shigure.git` 可达且为空（实测 `git ls-remote` exit 0 无 refs）、git 身份已配置（unsis/unsiscon@gmail.com）、`.gitignore` 已有 node_modules/+dist/。
  2) **初始化**：`git init -b main`；把 `.gitignore` 追加 `*.tgz`（opco-shigure-0.1.0.tgz 构建产物不入库）。
  3) **基线提交 + tag**：`git add -A && git commit -m "chore: baseline v4d pre-art-fix"` → `git tag baseline-v4d`。
  4) **远端连接**：`git remote add origin git@github.com:unsiscon/oc-shigure.git` → `git push -u origin main`（空远端零冲突）。
  5) **验证**：`git status` clean、`git log --oneline` 含基线提交、`git tag` 含 baseline-v4d、`git ls-remote origin` 非空。
  Must NOT：不 push 到其他远端；不重写历史（rebase -i/force push）；不把 .omo/evidence 排除在基线外（证据应入库，F1-F4 依赖）；不忽略 dist/（.gitignore 已有）。
  Parallelization: Wave 0（前置） | Blocked by: — | Blocks: 2-9 | Can parallelize with: —
  References (executor has NO interview context - be exhaustive):
  - 环境事实（实测）：`git rev-parse --is-inside-work-tree` fatal（非仓库）；`git ls-remote git@github.com:unsiscon/oc-shigure.git` exit 0 无 refs（远端可达为空）；`git config user.name=unsis / user.email=unsiscon@gmail.com`（身份已配置）；`.gitignore` 现有 node_modules/+dist/
  - 用户要求：2026-08-04 会话——"我这个项目是不是还没有 git 仓库？万一改坏了就完蛋了……我已经在远端建了仓库 git@github.com:unsiscon/oc-shigure.git"
  - 回滚价值：todo 5/6 覆盖 final.ts、todo 7 移动生成器——baseline-v4d tag 是破坏性操作前的可回退基线
  Acceptance criteria (agent-executable):
  - `git rev-parse --is-inside-work-tree` 输出 true；`git log --oneline` 首行 = "chore: baseline v4d pre-art-fix"；`git tag` 含 baseline-v4d；`git ls-remote origin` 非空（main 已推送）
  - `.gitignore` 含 `*.tgz`
  QA scenarios (name the exact tool + invocation): happy + failure, Evidence .omo/evidence/task-0-*.txt
  - happy: `git status --porcelain > .omo/evidence/task-0-happy.txt 2>&1; echo "status exit=$?" >> .omo/evidence/task-0-happy.txt`（断言 "status exit=0" 且无输出行=clean）→ `git log --oneline -1 >> .omo/evidence/task-0-happy.txt`（断言首行含 baseline）
  - failure: `git push -u origin main > .omo/evidence/task-0-failure.txt 2>&1; echo "push exit=$?" >> .omo/evidence/task-0-failure.txt`（断言 "push exit=0"；若 SSH 认证失败→记录网络/密钥问题，修复后重跑；若远端非空冲突→`git pull --rebase origin main` 后重推）
  Commit: `git add -A && git commit -m "chore: baseline v4d pre-art-fix" && git push -u origin main`

- [x] 2. T1 渲染一致性复验 + 环境前检（防回归门）
  What to do / Must NOT do:
  1) **环境前检（Metis F11 + Oracle F1 修正）**：确认 `~/.omo/omo.jsonc` 含 `multimodal-looker` 配置且非 disabled（qwen-vl-local/qwen2.5vl:7b）；确认 `~/.config/opencode/tui.json` plugin 数组含 `/Users/unsis/code/opcode/opcopet/dist/tui.js` 绝对路径条目；确认 `design/art-v2/shigure-v3-master-crop.png`、`shigure-v2-uniform-crop.png`、`shigure-pixel-data.json` 存在（Metis F7：以 art-v2 crop 为权威，samples 路径仅记录差异，不切换基准）；**检查 `/tmp/cap2.py` 与 `/tmp/shigure2.ansi`——实测存在（Oracle F1）：cap2.py 是原始 ANSI 抓取器（非计数器）、shigure2.ansi 是 314 基线原始捕获；若存在则复制到 `.omo/evidence/capture/` 备用（供 todo 8 反向推导计数口径）；若已被系统清理则记录缺失并降级（todo 8 按自身规范重抓）**。任一项不符 → 记录到 `.omo/evidence/task-1-happy.txt` 并继续（不阻塞，注明降级）。
  2) **三机器路径一致性对照（Metis F3 顺序修正 + Oracle F4/B）**：取当前 `src/assets/final.ts` regular idle 帧 1，同一轮廓色 #17141B，跑 (a) `npx tsx scripts/preview-assets.ts` 半块文本路径（preview-assets.ts:38 复用 renderFrame）；(b) `/usr/bin/python3 .omo/evidence/art-render-png.py` 像素放大路径——**扩展 art-render-png.py 额外输出逐格索引文本 `.omo/evidence/render-consistency-png-index.txt`（Oracle B：TS 无 PNG 解码器且禁新依赖，PNG 路径以"像素放大后逐格索引文本"形式参与机械比对，而非直接解码 PNG）**；(c) **新建 `scripts/render-consistency.ts`**（read-only，`npx tsx scripts/render-consistency.ts` 调用，输出 `.omo/evidence/render-consistency-index.txt`——逐格输出 final.ts regular idle 帧 1 的索引矩阵）。**三路输出机械逐格比对**：render-consistency.ts 对 (c) 索引矩阵 vs (a) 半块文本路径的展开像素格 vs (b) 像素放大索引文本做颜色归一化后的逐格结构 diff（脚本断言，非人工目测），一致 → 结论"三路径同构"，不一致 → 记录差异坐标到 `.omo/evidence/render-consistency-diff.txt`。
  3) **记录用户已完成的真实 TUI 重启观察**（灰点消失）作为第四路径证据；真实终端捕获工具重建延后到 todo 8。
  4) **b 像素内外分布计数**：统计 final.ts 当前 regular idle 帧 1 的 b 像素总数、内部 b 数（非外边界）、外部 b 数，写入 task-1 证据，作为"审计门阈值"基线。
  5) 产出 `.omo/evidence/task-1-*.txt`（happy/failure）与 `.omo/evidence/render-consistency-*.txt`。
  Must NOT：不改任何 src/ 文件；不修 renderer.ts；不重建终端捕获工具（todo 8 做）；不把"三路径一致"当成"根因已证"之外的新结论；**不因 /tmp/cap2.py 存在与否改变 todo 8 的仓库内重建计划**（/tmp 易失，仓库内重建为保证可复现）。
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 4 | Can parallelize with: 3
  References (executor has NO interview context - be exhaustive):
  - 复验依据：docs/OpenCode_Pet_时雨终端效果_图片分析交接文档.md §9.1（四路径验收点）、§10 建议清单第 1 条（先确认 Renderer 白点根因再重画——Oracle D：§10 是平铺编号清单非 10.x 子节，以下同）；docs/09-art-terminal-fix-handoff.md:29-33（证据与 314 计数）、:73（重启生效）
  - 共用 renderFrame 事实：scripts/preview-assets.ts:38 与 src/sidebar.tsx:134 均调用 src/renderer.ts 的 renderFrame
  - 环境事实：docs/09:74（multimodal-looker 用户已启用）；~/.omo/omo.jsonc:12-14（qwen-vl-local/qwen2.5vl:7b）
  - 种子/参考：design/art-v2/shigure-pixel-data.json:74-98（regular idle 种子，仅读作对照）
  Acceptance criteria (agent-executable):
  - 三机器路径输出存在且非空：`.omo/evidence/render-consistency-index.txt`、preview-assets 输出、art-render-png.py 输出 PNG；三路径结构对照结论写入 task-1-happy.txt
  - 环境前检结论（4 项）逐项 PASS/降级记录；b 像素内外计数写入证据
  - `npx tsx scripts/preview-assets.ts` 退出码 0
  QA scenarios (name the exact tool + invocation): happy + failure, Evidence .omo/evidence/task-1-*.txt
  - happy: 三路径一致 + 前检 4 项 PASS → `npx tsx scripts/render-consistency.ts > .omo/evidence/render-consistency.log 2>&1; echo "rc exit=$?" >> .omo/evidence/render-consistency.log`（断言 "rc exit=0" 且 render-consistency-diff.txt 为空/无差异行）→ `printf "HAPPY: three-path consistent\n" > .omo/evidence/task-1-happy.txt`；断言 task-1-happy.txt 非空
  - failure: 三路径结构不一致（diff.txt 非空）或前检缺失 → `npx tsx scripts/render-consistency.ts > .omo/evidence/render-consistency.log 2>&1; echo "rc exit=$?" >> .omo/evidence/render-consistency.log`（断言 "rc exit"≠0 或 diff.txt 有差异行）→ `cp .omo/evidence/render-consistency-diff.txt .omo/evidence/task-1-failure.txt 2>/dev/null; printf "FAIL: see diff\n" >> .omo/evidence/task-1-failure.txt`；断言 task-1-failure.txt 非空，注明是否触发 B 评估（Metis F5：B 触发阈值=同帧在 TUI 与 preview 渲染不同构且非轮廓色差异所致）
  Commit: `git add scripts/ .omo/evidence/ && git commit -m "feat(scripts): T1 render-consistency + 环境前检" && git push origin main`

- [x] 3. 确定性审计门 scripts/audit-art-noise.ts（TDD，Metis F1/F16 + Oracle F5/F6/F7 精确化规则）
  What to do / Must NOT do:
  新建 `scripts/audit-art-noise.ts`（脚本本体）+ **`src/audit-art-noise.test.ts`（测试文件——vitest.config.ts include 仅 `src/**/*.test.ts`，放 scripts/ 会被 `npm test` 静默跳过，Oracle F5；删除原计划的条件性豁免）**。**CLI 输入契约（Oracle A/C：候选帧审计 + 基线输出统一入口）**：脚本默认读 `SHIGURE_MANIFEST`；**支持过滤参数（Oracle P1 round5：`--size`/`--frame` 在 manifest 模式同样生效，不限于 `--grid`）** `npx tsx scripts/audit-art-noise.ts [--grid <checkpoint-file>] [--size <regular|compact>] [--frame <idle|thinking|...>]`——**`--size`/`--frame` 未指定 = 全量审计；指定任一 = 仅审计匹配的 (size,frame) 子集**（供 todo 4 对"已提交的 regular idle"做 scoped 审计）；`--grid` 时从检查点 .md 网格解析单帧并审计（供 todo 4/5 对候选帧先审计再提交）；**检查点 .md 格式契约（Oracle N1，与 todo 4/5/6 的 writer 一致）**：`.omo/evidence/art-loop/probe-1.md` 与 `idle-*-vN.md` **仅含恰好 N 行、每行恰好 N 个图例字符（`.0123456789ab`），无标题/图例/代码围栏/其他内容**——任何非 N 长度行或非图例字符 → 视为格式错误并报错退出（不得静默跳过行）；`--grid` 解析用 final.ts makeFrame/decodeRow 语义（src/assets/final.ts:11-26）；**无论何种输入，都输出 `.omo/evidence/art-loop/outline-baseline.txt`**——定义为**"该 (size,state) 帧的字符格中，含 ≥1 个边界 b 像素的字符格数（上/下半任一半皆计）"**（Oracle N2：基线按"含 b 的字符格"计，与捕获侧 fg/bg 双色规则对齐，单位可比），供 todo 7 作阈值基线。逐 (size,state,frame) 检查并输出违规清单，退出码 0=零违规。**两条规则（Metis F1/F16 + Oracle F6/F7 精确化）**：
  1) **b(outline) 仅最外层轮廓**：b 像素必须同时满足 (a) 8 邻域含透明 且 (b) 位于非透明区域外边界（从外部透明像素经 8 邻域可达）且 **(c) 8 邻域含 ≥1 个不透明像素（Oracle F6：b 必须贴靠不透明区边界，而非悬浮在透明空间——杜绝腿隙/发隙间孤立 b 像素漏过导致换浅轮廓后白点复现）**；**越界按透明处理**；**字符↔调色板索引映射（Oracle E）**：审计在 SHIGURE_MANIFEST 的调色板索引空间运行，行字符→索引按 docs/08 §4.2 图例（docs/08:85-98）：`0`=1 hairShadow、`1`=2 hairBase、`2`=3 hairLight、`3`=4 skin、`4`=5 eyeBlue、`5`=6 eyeDeep、`6`=7 uniform、`7`=8 trimWarmWhite、`8`=9 ribbonRed、`9`=10 sockBlack、`a`=11 bootRedBrown、`b`=12 outline——规则中的字符写法一律映射为索引后判断；
  2) **无孤立亮色像素**：对非 token 索引（hairShadow 1/hairBase 2/hairLight 3/skin 4/uniform 7/eyeDeep 6/bootRedBrown 11 等）检查 8 邻域无同色 → 孤立即违规；**豁免 4 个强制 token 索引（eyeBlue 5/ribbonRed 9/trimWarmWhite 8/sockBlack 10）及其语义簇**（compact 单像素蓝眼合法，docs/08 §8.5:235"每侧 ≥1px 蓝眼簇"）；
  3) **token 覆盖不重复检查（Oracle F7：删除每帧级 token 门）**：validateManifest（src/manifest.ts:107-109）已按 (size,state) **帧集合**粒度检查 token；**审计门不再做每帧级 token 检查**——每帧级会与 docs/08 帧集合粒度冲突且会误拒合法眨眼帧（idle 帧 2 只改 1px 眨眼，可能把蓝眼变深瞳致该帧 0 个 `4`，docs/08:194/235）。token 存在性完全交给 validateManifest gate 11 兜底。
  测试用例（TDD）：构造含内部 b 的帧→FAIL；构造外轮廓 b→PASS；**构造悬浮在透明区的孤立 b（腿隙/发隙）→FAIL（Oracle F6 条件 c）**；构造孤立 3(skin)/a(boot)→FAIL；构造单像素 4(eye)→PASS（豁免）；构造 7/8/9 单像素簇→PASS（豁免）；**`--grid` 参数解析检查点 .md 网格并输出违规 + outline-baseline.txt（Oracle A/C）**；**manifest 模式 `--size regular --frame idle` 过滤：仅审计 regular idle 两帧，其他 (size,state) 不计入（Oracle P1 round5）**。另加 `npx vitest run src/manifest.test.ts` 断言不破坏现有 validateManifest（Metis F8：不改 src/manifest.ts / src/manifest.test.ts）。
  Must NOT：不改 `src/manifest.ts`（validateManifest 契约零改动，Metis F5）；不改 `scripts/validate-assets.ts`；不改 manifest-data.ts；不新增 package.json script（审计门用 `npx tsx scripts/audit-art-noise.ts` 直调，Metis F9 措辞："当前 135 测试可增"）；**测试文件不得放 scripts/（F5）**。
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 5,6,9 | Can parallelize with: 2
  References (executor has NO interview context - be exhaustive):
  - 门禁基线：docs/08-art-asset-handoff.md §6（validateManifest 11 条，含 token 存在性 gate 11 为帧集合粒度）；src/manifest.ts:42-113
  - 终端硬指标（审计门的资产级代理）：docs/09:88-91（除暖白 #F1E8DF 外无亮色散点、轮廓单元格数大幅下降）
  - 豁免依据：docs/08 §8.5:235（compact 蓝眼 ≥1px 合法）；docs/07 §9（token 识别锚点）；docs/08:194（idle 帧 2 仅 1px 眨眼）
  - 悬浮 b 反例（F6）：design/art-v2/shigure-pixel-data.json:93-95、src/assets/final.ts:79-80（腿隙/发隙间孤立 b）
  - 字符↔索引映射：docs/08 §4.2 图例（docs/08:85-98）；manifest-data.ts:19-33（PALETTE_INDEX）
  - vitest include 事实：vitest.config.ts:6（仅 src/**/*.test.ts，F5）
  Acceptance criteria (agent-executable):
  - `npx vitest run src/audit-art-noise.test.ts` 全绿（含内部 b FAIL、外轮廓 b PASS、**悬浮 b FAIL**、孤立色 FAIL、token 豁免 PASS、**--grid 解析+基线输出 PASS**、**manifest 模式 --size/--frame 过滤 PASS** 用例）
  - `npx tsx scripts/audit-art-noise.ts` 退出码 0（对**当前 v4d 资产**预期 FAIL——内部 b/悬浮 b 仍存在；本 todo 验收只要求"测试全绿 + 脚本可运行并正确报出当前违规清单 + 产出 outline-baseline.txt"）
  - `npx tsx scripts/audit-art-noise.ts --grid .omo/evidence/art-loop/probe-1.md --size regular --frame idle` 能解析候选网格并输出违规 + outline-baseline.txt（供 todo 5/6 先审计再提交）
  - `npx tsx scripts/audit-art-noise.ts --size regular --frame idle` 仅审计 regular idle 子集（manifest 模式 scoped 过滤，供 todo 5 提交后 scoped 验证——Oracle P1 round5）
  - `npx vitest run src/manifest.test.ts` 仍绿（validateManifest 契约未动）
  QA scenarios (name the exact tool + invocation): happy + failure, Evidence .omo/evidence/task-2-*.txt
  - happy: `npx vitest run src/audit-art-noise.test.ts --reporter=verbose > .omo/evidence/task-2-happy.txt 2>&1`；断言退出码 0 且含"内部 b→FAIL、外轮廓 b→PASS、悬浮 b→FAIL、token 豁免→PASS、--grid→PASS"用例名
  - failure: `npx tsx scripts/audit-art-noise.ts > .omo/evidence/task-2-failure.txt 2>&1; echo "exit=$?" >> .omo/evidence/task-2-failure.txt`；断言当前资产报出内部 b/悬浮 b 违规清单（证明脚本能检出问题），exit 非 0 属预期
  Commit: `git add scripts/ src/audit-art-noise.test.ts .omo/evidence/ && git commit -m "feat(scripts): audit-art-noise 审计门 (TDD)" && git push origin main`

- [x] 4. 单帧能力探针（24×24 idle 第 1 帧，d10 硬检查点）
  What to do / Must NOT do:
  1) **looker 健康探针（d13①）**：调用 multimodal-looker 让其一句话描述 `design/art-v2/shigure-v3-master-crop.png`，确认本地模型可响应；失败重试 3 次 × 30s，仍失败 → `BLOCKED: looker 本地模型不可用` 写入执行日志并**通知用户**（唤醒/检查网络后继续），不烧 token（d13③）。
  2) **looker 产出探针网格**：让 looker 参照 v3 母稿输出 24×24 idle 第 1 帧的调色板索引行字符串（24 行，每行 24 字符，图例 `.0123456789ab`，docs/08 §4.2）；**先落盘检查点 `.omo/evidence/art-loop/probe-1.md`（d13④ 断点续跑，Oracle N1 格式契约：仅含恰好 24 行、每行恰好 24 个图例字符，无标题/图例/代码围栏/其他内容）**，不直接写 final.ts。
  3) **worker 机械校验（Oracle F：格式重试设上限）**：用 final.ts 的 makeFrame/decodeRow 语义（或临时脚本）解析检查点网格 → 尺寸 24×24、像素长度 576、索引合法、上/左/右边缘透明、token 覆盖（eye/ribbon/trim/sock 各 ≥1）——不通过则退回 looker 重产出（不手工改）；**格式校验失败重试上限 3 次，仍失败 → 判定 looker 无法产出合格网格，触发 d9 升级**（Oracle F：防"模型产不出 576 字符网格"时无限循环）。
  4) **渲染预览 + 方向性检查（d10）**：用临时渲染脚本（或扩展 art-render-png.py）从 probe-1.md 检查点渲染探针帧 PNG（#17141B 深轮廓）——**`npx tsx scripts/preview-assets.ts` 只渲染 final.ts 现有帧，无法渲染未提交的检查点网格，故必须用检查点渲染脚本**（Oracle A/N1 一致性）；**交给用户对照 v3 母稿判断方向性**（剪影/头身比/识别特征是否上道，不要求细节完美）。
  5) 用户方向性判定记录到 `.omo/evidence/art-loop/probe-1-verdict.md`；**方向性不可接受 → 立即触发 d9 升级（三选一：用户像素级修正/换模型或人工美术/接受当前稿），不烧满 3 轮全量迭代**；可接受 → 进入 todo 5。
  Must NOT：不让 worker 凭 docs/07 文字自行画图（docs/08 §8.5 强制"先看再画"）；不直接写 final.ts（检查点先行）；不修改 manifest-data.ts；looker 输出不做单像素裁决（新文档 §10 建议清单第 3 条）。
  Parallelization: Wave 2 | Blocked by: 2,3 | Blocks: 5 | Can parallelize with: —
  References (executor has NO interview context - be exhaustive):
  - 探针依据：docs/OpenCode_Pet_时雨终端效果_图片分析交接文档.md §10 建议清单第 2 条（先固定一个 24×24 idle 帧验证）、第 3 条（本地 Qwen 只做粗检）
  - 视觉真源：design/art-v2/shigure-v3-master-crop.png（主基准，**docs/09:80 与草稿 d14 Metis F7 决定的覆盖基准——docs/07 §1 原文列出的是 design/samples/shigure-concept-a-rounded-v3.png，art-v2 crop 是本计划明确记录的 override（Oracle F8），二者关系在 todo 2 前检中核实；d11 硬约束：尽量靠拢参考图**）
  - 图例/校验：docs/08 §4.2（图例 .0123456789ab↔13 色）、§6（机器门禁）
  - 断连预案：d13（健康探针/有界重试/BLOCKED/断点续跑）
  Acceptance criteria (agent-executable):
  - `.omo/evidence/art-loop/probe-1.md` 存在且可被 makeFrame 语义解析（24×24、576 像素、索引合法）
  - 探针帧通过结构校验（边缘透明、token 覆盖）；预览 PNG 生成
  - 用户方向性判定记录在 probe-1-verdict.md（接受/拒绝 + 理由）；拒绝时升级路径已记录
  QA scenarios (name the exact tool + invocation): happy + failure, Evidence .omo/evidence/art-loop/
  - happy: `npx tsx scripts/audit-art-noise.ts --grid .omo/evidence/art-loop/probe-1.md --size regular --frame idle > .omo/evidence/task-3-happy.txt 2>&1; echo "exit=$?" >> .omo/evidence/task-3-happy.txt`（断言退出码 0 = 探针网格零违规）；方向性接受 → probe-1-verdict.md 记录 PASS，进入 todo 5
  - failure: 方向性拒绝或 looker 断连 → `printf "REJECTED: <reason 值规则：用户在方向性检查中给出的拒绝理由原文，如 silhouette-off|proportion-wrong|detail-lost|other-text>\n" >> .omo/evidence/art-loop/probe-1-verdict.md && cp .omo/evidence/art-loop/probe-1-verdict.md .omo/evidence/task-3-failure.txt`（断言 task-3-failure.txt 含 "REJECTED"）或 BLOCKED 日志（`printf "BLOCKED: looker 本地模型不可用\n" > .omo/evidence/task-3-failure.txt`）；断连恢复后从 probe-1.md 检查点续跑（d13④）；格式校验连续 3 次失败 → `printf "D9-UPGRADE: 3x format-fail\n" >> .omo/evidence/task-3-failure.txt`（断言 task-3-failure.txt 含 "D9-UPGRADE"）
  Commit: `git add .omo/evidence/art-loop/ && git commit -m "chore(art): 单帧能力探针检查点" && git push origin main`

- [~] 5. 24×24 idle 母版重设计定稿（looker 迭代 + 审计门 + 用户终审）
  What to do / Must NOT do:
  1) 在探针通过基础上，让 looker 参照 v3 母稿 + v2 制服迭代产出 24×24 idle 两帧（帧 2 仅眨眼/刘海 1px 微动，docs/05 §6 + docs/07 §7 idle 契约），每版**先落盘 `.omo/evidence/art-loop/idle-regular-vN.md` 检查点（d13④）**。
  2) **确定性校验（Oracle A：先审计再提交）**：每版候选帧先用 `npx tsx scripts/audit-art-noise.ts --grid .omo/evidence/art-loop/idle-regular-vN.md --size regular --frame idle`（todo 3 产出的 CLI 接口；`vN` = 该版迭代号，首个为 `idle-regular-v1.md`，每版递增）审计，再 makeFrame 结构校验 + validateManifest——机器门不过即退回 looker 重产出（不手工改，Metis F13：审计门=确定性噪点门）；**最终 idle 帧提交后重跑 `npx tsx scripts/audit-art-noise.ts --size regular --frame idle` 并确认 outline-baseline.txt 已产出（todo 8 阈值基线的生产者，Oracle C；scoped 到 regular idle——Oracle P1 round5）**。
  3) **looker 粗检**：渲染预览 PNG 后让 looker 对照 v3 母稿粗检（有无白点/结构哪里不对），只作建议性反馈（Metis F13 证据层级：looker=建议，用户=终审）。
  4) **用户终审（d15 用户 gate 协议，Momus M1：阻塞语义明确）**：用户对照 v3 母稿逐项 PASS（剪影、头身比 2.2-2.4、宽发、椭圆脸、双蓝眼、单侧细辫、白侧板、红长领结、袜靴分层、圆润低重心 + **d11：与参考图接近度为首要判据**）；按 d15：verdict 文件写 `status: awaiting-user` + 检查清单 → 一句话通知 → 等待报告 → 超 1 日再通知并暂停 → 用户写逐项结果 → 从检查点续跑。
  5) **连续 3 轮未过终审 → d9 升级**（三选一由用户拍板）；通过后该帧写入 `src/assets/final.ts`（仅替换 regular idle 相关行，保持导出符号/结构不变，Metis F17 精神）。
  Must NOT：不让 worker 手工改像素（所有修改经 looker 重产出或用户像素级修正）；不整文件重写 final.ts（只改 idle 行，保留 decodeRow/makeFrame/patchRows/patchFirst/*_FRAMES/buildFinalSpec/FINAL_MANIFEST/FINAL_ASSETS_READY 导出，docs/08 §4.1）；不改 manifest-data.ts。
  Parallelization: Wave 2 | Blocked by: 3,4 | Blocks: 6,7,9 | Can parallelize with: —
  References (executor has NO interview context - be exhaustive):
  - 视觉验收：docs/09:90（美术硬指标逐项清单）、docs/07 §3 比例表:44-58、docs/08 §8.5（多模态视觉闭环）、新文档 §9.2（美术结构验收重点）、**d11（靠拢 art-v2 参考图硬约束）**
  - 终端干净目标：docs/09:23-33（根因链）、:88-89（硬指标：除暖白外无亮色散点）
  - final.ts 结构契约：docs/08 §4.1（导出符号勿自造）、§4.2（图例）
  Acceptance criteria (agent-executable):
  - `src/assets/final.ts` regular idle 两帧更新后：`npx tsx scripts/audit-art-noise.ts --size regular --frame idle` 对 **regular idle 子集**零违规（内部 b=0、孤立非 token 色=0——Oracle P1 round5：scoped 到本 todo 实际提交的帧，不对未提交的 compact/其他状态做全量断言，全量零违规由 t6/t9 门禁把关）
  - `npm run validate-assets` 退出码 0；`npm test` 全绿（135+可增）
  - 用户终审记录（.omo/evidence/art-loop/idle-regular-verdict.md）逐项 PASS + 接近度结论
  QA scenarios (name the exact tool + invocation): happy + failure, Evidence .omo/evidence/task-4-*.txt
  - happy: 终审 PASS + 审计门零违规 → `npx tsx scripts/audit-art-noise.ts --size regular --frame idle > .omo/evidence/task-4-happy.txt 2>&1; echo "audit exit=$?" >> .omo/evidence/task-4-happy.txt`（断言 "audit exit=0"）+ `npm run validate-assets >> .omo/evidence/task-4-happy.txt 2>&1; echo "validate exit=$?" >> .omo/evidence/task-4-happy.txt`（断言 "validate exit=0"）
  - failure: 3 轮未过终审 → `printf "D9-UPGRADE: user-pixel-fix|model-swap|accept-current\n" >> .omo/evidence/art-loop/idle-regular-verdict.md && printf "d9 upgrade recorded\n" > .omo/evidence/task-4-failure.txt`（断言 task-4-failure.txt 存在且含 "d9 upgrade recorded"；三选一选项见 d9：①用户像素级修正 ②换更强视觉模型/人工美术 ③接受当前稿）；审计门违规 → `npx tsx scripts/audit-art-noise.ts --grid .omo/evidence/art-loop/idle-regular-v3.md --size regular --frame idle > .omo/evidence/task-4-failure.txt 2>&1; echo "exit=$?" >> .omo/evidence/task-4-failure.txt`（断言 exit≠0 且违规清单列出），退回 looker 重产出（检查点续跑）
  Commit: `git add src/assets/final.ts .omo/evidence/ && git commit -m "feat(art): 24×24 idle 母版重设计" && git push origin main`

- [~] 6. 16×16 idle 独立重设计 + 七状态派生重建（全部 2×7 帧）
  What to do / Must NOT do:
  1) **16×16 idle 母版独立重设计**（独立重绘禁止缩放，docs/08 §2 + 新文档 §10 建议清单第 5 条）：同 todo 5 流程（检查点 idle-compact-vN.md → **`npx tsx scripts/audit-art-noise.ts --grid .omo/evidence/art-loop/idle-compact-vN.md --size compact --frame idle` 先审计再提交**（vN 迭代号同 t5 规则）→ looker 粗检 → 用户终审），16×16 至少看得到蓝眼/白边/红色块/深棕发/两只深色脚块（docs/07 §9 + docs/08 §8.5:235）。
  2) **七状态派生/微调重建（Metis F4）**：以两尺寸 idle 母版为基准，按种子 states 契约（design/art-v2/shigure-pixel-data.json:124-132）+ docs/07 §7 微动差派生：thinking（眼上移+刘海）、working（双手内收）、waiting（眼上移+手合拢）、success（脚上移 ≤1px）、error（眼窄，保留 ≥1px 蓝眼）、retry（上半身平移）；**每个派生状态渲染预览后由 looker 粗检 + 用户终审对照 §9.3 状态可读性清单**（idle 两帧呼吸/眨眼可见、thinking 与 idle 差异足够、working/waiting 可区分、success 像跳跃、error 低落、retry 左右倾斜——新文档 §9.3，Metis F4）；**用户终审按 d15 用户 gate 协议**（states-verdict.md 写 awaiting-user + 清单 → 通知 → 等待 → 超 1 日暂停 → 用户逐项结果 → 断点续跑）。
  3) 全部 2×7 帧写回 `src/assets/final.ts`（保持导出符号结构，只替换各 *_ROWS 数据）。
  Must NOT：不从 24×24 缩放得到 16×16（docs/08 §2 独立重绘）；不改 manifest-data.ts（帧数/时长/loop 锁死）；不新增状态/尺寸；派生状态不做成"仅 1px 变一下交差"——必须通过 §9.3 可读性终审。
  Parallelization: Wave 2 | Blocked by: 5 | Blocks: 7,8,9 | Can parallelize with: —
  References (executor has NO interview context - be exhaustive):
  - 状态动作契约：docs/07 §7:141-153、docs/05 §6、seed json:124-132
  - 状态可读性：新文档 §5.3（各状态当前问题）、§9.3（状态验收重点）
  - 尺寸规则：docs/08 §2（16×16 独立重绘）、docs/07 §3:44-58（比例表）
  Acceptance criteria (agent-executable):
  - `npx tsx scripts/audit-art-noise.ts` 对两尺寸全部 2×7 帧零违规；`npm run validate-assets` 退出码 0；`npm test` 全绿
  - 用户终审记录（.omo/evidence/art-loop/states-verdict.md）覆盖 §9.3 状态可读性逐项 + idle 母版接近度
  QA scenarios (name the exact tool + invocation): happy + failure, Evidence .omo/evidence/task-5-*.txt
  - happy: 终审 PASS + 全门禁绿 → `npm run validate-assets > .omo/evidence/task-5-happy.txt 2>&1; echo "validate exit=$?" >> .omo/evidence/task-5-happy.txt`（断言 "validate exit=0"）然后 `npm test >> .omo/evidence/task-5-happy.txt 2>&1; echo "test exit=$?" >> .omo/evidence/task-5-happy.txt`（断言 "test exit=0"）然后 `npx tsx scripts/audit-art-noise.ts >> .omo/evidence/task-5-happy.txt 2>&1; echo "audit exit=$?" >> .omo/evidence/task-5-happy.txt`（断言 "audit exit=0" = 全部 2×7 帧零违规——Oracle O2 round5 补 audit）
  - failure: 任一状态可读性被否 → `printf "REJECTED-STATE: thinking|working|waiting|success|error|retry\n" >> .omo/evidence/art-loop/states-verdict.md && cp .omo/evidence/art-loop/states-verdict.md .omo/evidence/task-5-failure.txt`（断言 task-5-failure.txt 含 "REJECTED-STATE" 与被否状态名）；审计门违规 → `npx tsx scripts/audit-art-noise.ts > .omo/evidence/task-5-failure.txt 2>&1; echo "audit exit=$?" >> .omo/evidence/task-5-failure.txt`（断言 "audit exit"≠0 且违规清单列出），退回 looker 重产出该状态（检查点续跑）
  Commit: `git add src/assets/final.ts .omo/evidence/ && git commit -m "feat(art): 16×16 idle + 七状态派生" && git push origin main`

- [~] 7. sidebar.tsx 轮廓恢复 + preview 色值统一 + 生成器退役（Metis F2/F6/F17）
  What to do / Must NOT do:
  1) **sidebar.tsx（Metis F17 最小改动）**：把 `LIGHT_OUTLINE` 从临时 `#17141B` 改为 **`#F7F2EA`**（与 preview-assets.ts:56 浅色预览值统一，Metis F2），删除临时缓解注释块（sidebar.tsx:28-32，引用 docs/09 §4 的说明）；**不动 outlineColor() 结构**（sidebar.tsx:119-121 已是 dark→浅轮廓、light→palette 末项的正确结构）。
  2) **preview-assets.ts 确认**：浅色版已用 #F7F2EA（preview-assets.ts:56），无需改；深色版 #17141B 对应 light 主题（palette 末项）语义正确，保留。
  3) **生成器退役（Metis F6 硬守卫）**：把 `scripts/build-final-assets.ts` 移到 `scripts/legacy/`，头注释标注"已退役，勿运行"；**在脚本顶部加硬守卫——检测到运行即抛错退出（除非显式传 `--force`）**，防止未来误跑覆盖手绘 final.ts（build-final-assets.ts:32 OUT_PATH=src/assets/final.ts）；检查 package.json 是否引用该脚本（Metis F8），如有则同步移除引用。
  4) 重建 `npm run build`（tsup）→ `dist/tui.js` 含新 LIGHT_OUTLINE；记录 `~/.config/opencode/tui.json` 指向 dist（无需改条目，重启生效 docs/09:73）。
  Must NOT：不改 manifest-data.ts；不改 renderer.ts（B 不做，Metis F5）；不新增配置项；不在 package.json 加新 script（审计门直调）；不动 docs/05 §8 边界。
  Parallelization: Wave 3 | Blocked by: 6 | Blocks: 8,9 | Can parallelize with: —
  References (executor has NO interview context - be exhaustive):
  - 当前状态：src/sidebar.tsx:28-33（LIGHT_OUTLINE=#17141B 临时注释）、:119-121（outlineColor 结构）
  - 恢复依据：docs/09:86(D)（A 落地后换回主题感知轮廓+删临时注释）、docs/04 §3.6（主题切换只换轮廓色）、docs/05 §5
  - 色值统一：scripts/preview-assets.ts:52-56（深 #17141B / 浅 #F7F2EA）；Metis F2/F15
  - 生成器：scripts/build-final-assets.ts:32（OUT_PATH）、:1-21（确定性说明）；docs/09:80（生成器可弃用或仅作参考）
  Acceptance criteria (agent-executable):
  - `npm run build` 退出码 0；`grep -n "LIGHT_OUTLINE" dist/tui.js` 含 #F7F2EA 且不含临时注释
  - `npx tsx scripts/legacy/build-final-assets.ts` 无 `--force` 时退出码非 0 且输出退役提示（硬守卫生效）
  - `npm test` / `npm run typecheck` 全绿（sidebar 无单测，由 t7 冒烟验证）
  QA scenarios (name the exact tool + invocation): happy + failure, Evidence .omo/evidence/task-6-*.txt
  - happy: `npm run build > .omo/evidence/task-6-happy.txt 2>&1; echo "build exit=$?" >> .omo/evidence/task-6-happy.txt`（断言 "build exit=0"）；`grep -c "F7F2EA" dist/tui.js`（断言输出 ≥1）
  - failure: `md5 -q src/assets/final.ts > .omo/evidence/task-6-before.md5`（若 `md5` 不存在则用 `md5sum`；本机 darwin 已验证 /sbin/md5 可用——Oracle O1 round5）；`npx tsx scripts/legacy/build-final-assets.ts > .omo/evidence/task-6-failure.txt 2>&1; echo "legacy exit=$?" >> .omo/evidence/task-6-failure.txt`（断言 "legacy exit"≠0 且输出含退役提示）；`md5 -q src/assets/final.ts > .omo/evidence/task-6-after.md5`；`cmp -s .omo/evidence/task-6-before.md5 .omo/evidence/task-6-after.md5`（断言退出码 0 = final.ts 未被覆盖）
  Commit: `git add scripts/ src/sidebar.tsx .gitignore .omo/evidence/ && git commit -m "fix(sidebar): 轮廓恢复 #F7F2EA + 生成器退役" && git push origin main`（`git add scripts/` 同时登记 scripts/build-final-assets.ts 的删除，防 `git status` 残留 dirty——Oracle round8 FIND-6）

- [~] 8. 重建真实终端捕获工具 + 硬指标验证（docs/09:89 硬指标，Momus M3 + Oracle F1/F2/F3）
  What to do / Must NOT do:
  1) 新建 `.omo/evidence/capture/capture.py`（python pty，基于 .omo/evidence/task-8-smoke.py:383-444 模式裁剪）：spawn opencode（200×50 pty，docs/09:30），`hi\r` 开会话后等待，抓取侧栏区域 ANSI 流。**复用 `/tmp/cap2.py` 与 `/tmp/shigure2.ansi`（Oracle F1：实测存在；cap2.py 为原始抓取器、shigure2.ansi 为 314 基线原始捕获）——复制入 `.omo/evidence/capture/` 并以其反向推导 docs/09:32 计数的口径**；仓库内重建 capture.py 为保证可复现（/tmp 易失）。
  2) **完整计数算法（Oracle F2 规范 + N2 单位对齐，task-8-smoke.py 的 Screen 类丢弃全部颜色/SGR——task-8-smoke.py:248 `pass # m/h/l/q/etc: ignored`，须新写 ANSI 解析）**：
     (a) **SGR 解析**：逐字符解析 `\x1b[38;2;R;G;Bm`（fg）与 `\x1b[48;2;R;G;Bm`（bg），为每个字符格构建 fg/bg 网格（含 ESC 状态机，兼容 run 合并与 reset）；
     (b) **轮廓单元格定义（Oracle N2：与审计门基线同单位）**：单元格 **fg 或 bg 任一精确等于 `#F7F2EA`** 记为轮廓单元格（renderer 把半块下像素放 bg——renderer.ts:78-79——故 fg-only 规则会漏计下半轮廓像素，必须 fg∪bg 双色）；**暖白面板 #F1E8DF 作为 bg 时不计入轮廓（面板底色），仅当该单元格 fg 或 bg 为 #F7F2EA 才计**；
     (c) **区域范围**：仅统计侧栏宠物区（SIDEBAR_MIN_COL=140 起，task-8-smoke.py:20）且剔除标签行（待机/思考等中文标签）；**帧范围=捕获窗口内全部 idle 帧（含帧 1 与帧 2），排除其他状态帧**（捕获期间若状态标签变化为思考/工作等，该时段帧不计入，仅累计标签为"待机"的帧）；
     (d) **孤立判定**：某轮廓单元格在其字符格 8 邻域内无其他轮廓单元格（fg∪bg=#F7F2EA）→ 记为孤立亮色散点（违规）；
     (e) **累计语义（Oracle N3：union 而非 sum）**：捕获窗口内所有计入帧的轮廓单元格做**去重合并（union of distinct char cells）**——同一字符格在多个帧出现只计一次；捕获时长固定 **30s**（docs/09:30 同款，约 75 个 idle 帧）；
     (f) **metric ③"内部 b 像素=0"从捕获侧移除**——内部 b 是资产帧空间概念，ANSI 流无法直接测量（Oracle F2），由审计门（todo 3 规则 1）在资产侧强制执行，捕获侧只做 (a)-(e)。
  3) **硬指标断言（Oracle F3 单一阈值 + N2/N3 单位对齐，删"实测上限"措辞）**：①孤立亮色散点计数 = 0（(d) 定义）；②**轮廓单元格数（union，见 (e)）≤ 审计门在最终 idle 帧上输出的 outline-baseline.txt（"含 ≥1 边界 b 像素的字符格数"）× 1.2**（执行期实测派生，非预设数；审计门输出该基线到 `.omo/evidence/art-loop/outline-baseline.txt`，单位与捕获侧同为"字符格"——Oracle N2），且 **< 314（docs/09:33 灰轮廓基线，作 sanity）**；③暖白面板 #F1E8DF bg 单元格单独计数记录（不作断言）。
  4) 真实 TUI 证据落盘 `.omo/evidence/capture/shigure-capture.typescript`（原始 ANSI 流）+ 计数汇总 `.omo/evidence/capture/counts.txt`（含：轮廓单元格数、实测基线×1.2 阈值、sanity 314、孤立散点数、暖白面板数、PASS/FAIL 结论——**全部由脚本机械判定，无人工判断**，Momus M3）。
  5) **用户重启复验（d15 用户 gate 协议，最后一步）**：提示用户重启 opencode 观察侧栏（docs/09:73），确认深色主题下无灰点/白点、轮廓为暖白 #F7F2EA 且干净；用户确认记录到 `.omo/evidence/capture/user-confirm.txt`。
  Must NOT：不改 sidebar.tsx（本 todo 只验证）；不改 tui.json；不引入图片协议/截图依赖（纯 ANSI 流解析）；不伪造捕获（真实 spawn opencode）；**不手工"数"轮廓单元格**（必须脚本机械计数）；不把 /tmp/cap2.py 的存在当作计数口径本身（它只是抓取器）。
  Parallelization: Wave 4 | Blocked by: 7 | Blocks: 9 | Can parallelize with: —
  References (executor has NO interview context - be exhaustive):
  - 捕获基线：docs/09:29-33（/tmp/shigure2.ansi 200×50、关键计数 314 灰轮廓）、:89（硬指标：除暖白面板外无亮色散点、轮廓单元格大幅下降）
  - pty 基座：.omo/evidence/task-8-smoke.py:383-444（spawn opencode + ANSI 重建 + snapshot）、:248（Screen 丢弃颜色——须新写解析）、:20（SIDEBAR_MIN_COL=140）
  - 复用源：/tmp/cap2.py、/tmp/shigure2.ansi（Oracle F1 实测存在；docs/09:30-31）
  - 环境：~/.config/opencode/tui.json（绝对路径条目已就位）；docs/09:73（重启生效）
  Acceptance criteria (agent-executable):
  - `.omo/evidence/capture/counts.txt` 存在且由脚本机械产出：轮廓单元格数 ≤ 实测基线×1.2 且 <314、孤立亮色散点=0、暖白面板单独列出、PASS/FAIL 结论
  - 用户确认记录 `.omo/evidence/capture/user-confirm.txt`（无灰点/白点，轮廓干净，d15 协议）
  QA scenarios (name the exact tool + invocation): happy + failure, Evidence .omo/evidence/capture/
  - happy: `/usr/bin/python3 .omo/evidence/capture/capture.py > .omo/evidence/capture/capture-run.log 2>&1; echo "capture exit=$?" >> .omo/evidence/capture/capture-run.log`（断言 "capture exit=0"）；`grep -E "PASS|FAIL" .omo/evidence/capture/counts.txt`（断言含 PASS 且无 FAIL）
  - failure: 轮廓单元格超基线×1.2 或 ≥314，或孤立散点>0 → `grep -E "FAIL" .omo/evidence/capture/counts.txt > .omo/evidence/task-7-failure.txt; echo "FAIL captured" >> .omo/evidence/task-7-failure.txt`（断言 task-7-failure.txt 非空），回溯：审计门违规→回 todo 5/6（`npx tsx scripts/audit-art-noise.ts` 复核违规）；渲染层异常→记录并评估 B（Metis F5）
  Commit: `git add .omo/evidence/capture/ && git commit -m "test(capture): 真实终端捕获 + 硬指标" && git push origin main`

- [~] 9. 全门禁 + 预览证据 + docs/09 附录更新（收尾）
  What to do / Must NOT do:
  1) **全量门禁**：`npm run typecheck`、`npm test`（vitest，全绿；135+可增，Metis F9 措辞）、`npm run validate-assets`、`npm run build`、`npx tsx scripts/audit-art-noise.ts`（零违规）——逐条退出码 0 记录到 `.omo/evidence/task-8-happy.txt`。
  2) **预览证据重生成**：`npx tsx scripts/preview-assets.ts`（深 #17141B + 浅 #F7F2EA）+ `/usr/bin/python3 .omo/evidence/art-render-png.py`，覆盖 .omo/evidence/art-preview-*.{png,txt}（Metis F15：随 #F7F2EA 重生成）；预览与真实终端结构一致（Metis F2）。
  3) **docs/09 增补"已解决"状态附录**：在 docs/09-art-terminal-fix-handoff.md 末尾追加状态节——记录：v4d→A 落地、轮廓恢复 #F7F2EA、审计门规则、捕获计数、用户终审结论；**标注 d11 硬约束（美术靠拢 art-v2 参考图）已落实**。
  4) 更新 README 中"七状态最终动画资产"待办状态（如适用，仅事实性更新）。
  Must NOT：不改 manifest-data.ts；不改 renderer.ts；不发布 npm；不 push 其他远端、不 git 历史重写（rebase -i/force push）、不删除 baseline-v4d tag；不把未过终审的美术写进交付。
  Parallelization: Wave 5 | Blocked by: 6,7,8 | Blocks: — | Can parallelize with: —
  References (executor has NO interview context - be exhaustive):
  - 门禁清单：docs/09:72（验证命令）、docs/08 §9（验证工作流 5 步）、package.json scripts
  - 预览：docs/08 §8.2（三份预览文件）、scripts/preview-assets.ts:52-56
  - docs/09 现状：docs/09-art-terminal-fix-handoff.md（全文，末尾追加）
  Acceptance criteria (agent-executable):
  - 五道门禁（typecheck/test/validate-assets/build/audit）全部退出码 0，证据 task-8-happy.txt 逐条列出
  - .omo/evidence/art-preview-regular/compact/light 全部重生成且非空
  - docs/09 附录存在且含：A 落地状态、#F7F2EA 轮廓、审计门规则（b 三条件/无孤立非 token 亮色）、捕获计数（SGR 解析 + 单一阈值：边界 b×1.2 且 <314、孤立=0）、用户终审结论
  QA scenarios (name the exact tool + invocation): happy + failure, Evidence .omo/evidence/task-8-*.txt
  - happy: 依次 `npm run typecheck > .omo/evidence/task-8-happy.txt 2>&1; echo "typecheck exit=$?" >> .omo/evidence/task-8-happy.txt`、`npm test >> .omo/evidence/task-8-happy.txt 2>&1; echo "test exit=$?" >> .omo/evidence/task-8-happy.txt`、`npm run validate-assets >> .omo/evidence/task-8-happy.txt 2>&1; echo "validate exit=$?" >> .omo/evidence/task-8-happy.txt`、`npm run build >> .omo/evidence/task-8-happy.txt 2>&1; echo "build exit=$?" >> .omo/evidence/task-8-happy.txt`、`npx tsx scripts/audit-art-noise.ts >> .omo/evidence/task-8-happy.txt 2>&1; echo "audit exit=$?" >> .omo/evidence/task-8-happy.txt`——断言 5 个 "exit=0" 全部出现
  - failure: 逐条定位失败命令 → 重跑失败项并记录：如 `npm run typecheck > .omo/evidence/task-8-failure.txt 2>&1; echo "typecheck exit=$?" >> .omo/evidence/task-8-failure.txt`（或对应失败命令 test/validate-assets/build/audit，逐一重跑、将 exit≠0 的命令输出 + exit 记录到 task-8-failure.txt）——断言 task-8-failure.txt 含至少一个 "exit=" 行且对应 exit≠0（修复后重跑 happy 全链确认 5 个 exit=0）
  Commit: `git add docs/ README.md .omo/evidence/ && git commit -m "docs(09): 门禁 + 预览 + docs 附录" && git push origin main`

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete. （Momus M2：F1-F4 每项给出工具/步骤/证据/通过标准，非仅名称。）
> **References/Commit 适用范围（Momus-2 round 3）**：本波次为验证任务（非实现任务），模板的 "每个 todo 需 References + Acceptance + QA + Commit" 要求**仅适用于实现 todo 1-9**；F1-F4 为只读验证，无 Commit 行，其"验证依据"即下方各 F 项的 How（指向本计划对应 todo 编号），不另设 References 字段。

- [~] F1. Plan compliance audit
  What: 对照本计划逐 todo 核验：全部 9 个 todo 的 Acceptance 均达成、证据文件存在且非空、无遗漏 todo、依赖矩阵已执行。
  How (agent-executable): 逐条重跑验收命令：`npm run typecheck`、`npm test`、`npm run validate-assets`、`npm run build`、`npx tsx scripts/audit-art-noise.ts` 全绿；核对 .omo/evidence/task-0..8 证据 + art-loop/ 检查点 + capture/counts.txt 齐全非空。
  Happy (PASS): 命令全绿且证据齐全 → PASS，清单写入 .omo/evidence/f1-audit.txt。
  Failure (FAIL): 任一命令非零或任一证据缺失 → FAIL，列缺失项到 f1-audit.txt（修复后重跑本项）。
- [~] F2. Code quality review
  What: 独立代码审查（可派 oracle）：audit-art-noise.ts 规则实现正确性（b 三条件/孤立判定/token 豁免）、render-consistency.ts 逐格 diff、capture.py SGR 解析状态机、sidebar.tsx 最小改动（只改 LIGHT_OUTLINE 值与注释）、无 AI slop（死代码/重复/过度工程）、隐私零网络/外部进程。
  How (agent-executable): 审查 scripts/ + src/ 改动文件 + `grep -rn "fetch(\|WebSocket\|child_process\|exec(\|spawn(" dist/` 复验零命中。
  Happy (PASS): 无 high 级问题 + 隐私 grep 零命中 → PASS，清单到 .omo/evidence/f2-review.txt。
  Failure (FAIL): 任一 high 级问题或 grep 命中 → FAIL，附清单到 f2-review.txt（修复后重跑）。
- [~] F3. Real manual QA
  What: 独立于实现者重跑真实终端验证：复制 todo 8 capture.py 流程重跑一遍，断言 counts.txt 结论一致（轮廓≤基线×1.2 且<314、孤立=0）；用户重启复验记录在 user-confirm.txt 有效。
  How (agent-executable): `/usr/bin/python3 .omo/evidence/capture/capture.py` 重跑 + 比对两次 counts.txt；用户终审 verdict 文件（probe-1-verdict/idle-regular-verdict/states-verdict）均为 PASS 且含逐项记录。
  Happy (PASS): 两次捕获结论一致 + 用户终审全 PASS → PASS，记录到 .omo/evidence/f3-notes.txt。
  Failure (FAIL): 不一致或任一 verdict 非 PASS → FAIL，记录到 f3-notes.txt（修复后重跑）。
- [~] F4. Scope fidelity
  What: 对照 Must NOT have 逐项核验：manifest-data.ts 未改、runtime 模块未动、renderer.ts 零改动（无 B）、无新增调色板/状态/尺寸、无 PNG 解码/图片协议/emoji、无 v1-v4 路线残留、package.json 无新增 script（audit 直调）、未发布 npm、**git 已按 todo 1 初始化且 main 已推送、无历史重写（rebase -i/force push）、baseline-v4d tag 未删除（git 流程合规，Oracle round9 FIND-8）**、无位置/大小/ANSI 精细显示改动。
  How (agent-executable): 文件改动清单核对（git 无则用时间戳 + grep）+ `grep -rnE "(sixel|kitty|\.png|fetch\(|WebSocket|child_process)" src/ dist/ --include="*.ts" --include="*.tsx" --include="*.js"` 零命中（注释允许但须人工确认）+ manifest-data.ts md5 前后比对 + package.json diff 核对。
  Happy (PASS): 逐项零违规 → PASS，清单到 .omo/evidence/f4-scope.txt。
  Failure (FAIL): 任一 Must NOT 违规 → FAIL，列违规项到 f4-scope.txt（修复后重跑）。

## Commit strategy

- **todo 1 建立 git 仓库**：`git init -b main` + 基线提交 + baseline-v4d tag + `git push -u origin main`（详见 todo 1；用户 2026-08-04 新增，远端 git@github.com:unsiscon/oc-shigure.git 已建且为空）。
- **每个 todo 完成后提交一次**（`git add <改动文件>` + `git commit -m "<type>(<scope>): <summary>"`），命名规范：todo 2 `feat(scripts)`、todo 3 `feat(scripts)`、todo 4 `chore(art)`、todo 5 `feat(art)`、todo 6 `feat(art)`、todo 7 `fix(sidebar)`、todo 8 `test(capture)`、todo 9 `docs(09)`。
- **每 todo 提交后 push**（`git push origin main`，异地备份——用户核心诉求"改坏可回滚"）。
- **回滚安全网**：baseline-v4d tag = 破坏性操作前基线；任一 todo 改坏 → `git checkout baseline-v4d -- <文件>` 恢复单文件，或 `git revert <commit>` 撤销整提交（不重写历史）。
- **main 直推**（solo 项目，无 PR 流程）；禁止 rebase -i/force push/删除 baseline-v4d tag。

## Success criteria

- 灰点/白点在真实终端消失（v4d 深轮廓已实现；A 落地换回 #F7F2EA 暖白轮廓后仍无散点），终端捕获证据（Oracle F2/F3 完整算法）显示：**轮廓单元格数 ≤ 审计门实测边界 b 字符格数 ×1.2 且 <314 基线**（执行期实测派生，单一阈值），**孤立亮色散点 = 0**，暖白面板 #F1E8DF 单独计数。
- 美术质量由用户对照 design/art-v2 参考图终审 PASS（d11 硬约束：与参考图接近度为首要判据）：剪影、头身比 2.2-2.4、宽发、椭圆脸、双蓝眼、单侧细辫、白侧板、红长领结、袜靴分层、圆润低重心逐项合格；**七状态按新文档 §9.3 状态可读性逐项 PASS**（idle 呼吸/眨眼可见、thinking 与 idle 差异足够、working/waiting 可区分、success 像跳跃、error 低落、retry 左右倾斜）。
- 五道门禁全绿：typecheck / npm test（当前 135 可增）/ validate-assets / build / audit-art-noise（零违规）；预览 PNG（深 #17141B + 浅 #F7F2EA）与真实终端结构一致。
- 审计门对最终资产零违规：内部 b 像素 = 0、b 仅最外层轮廓、无孤立非 token 亮色像素。
- 生成器退役（scripts/legacy/ + 硬守卫）、sidebar.tsx LIGHT_OUTLINE=#F7F2EA 且临时注释删除、主题感知轮廓恢复。
- 证据齐全：.omo/evidence/task-0..8、art-loop/、capture/、art-preview-* 重生成；docs/09 附录记录 A 落地状态与用户终审结论。

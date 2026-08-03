---
slug: opco-shigure-art-terminal-fix
status: approved (round 12 re-review complete - dual APPROVE)
intent: clear
review_required: true
pending-action: none - plan approved with git flow folded in; ready for $start-work opco-shigure-art-terminal-fix
approach: 分两段：T1 先做渲染一致性验证门（同一 idle 帧在索引预览/放大像素/半块渲染/真实 TUI 四路径、同一轮廓色对照，复核 docs/09 的"白点=浅色 b 轮廓像素"结论并计数 b 像素内外分布；若证实纯美术根因→走 A；若发现独立渲染缺陷→按需补 B/渲染修复）；随后以 A 为主路径——multimodal-looker（粗粒度视觉检查，非单像素裁决）参照 v3 母稿 + 新文档 §9 验收重点做两尺寸独立低分辨率重设计，产出干净调色板索引帧写入 src/assets/final.ts（外轮廓 1px、内部零散点清零、忠实 v3 识别特征）；新增确定性"终端噪点审计"机器门；恢复 sidebar.tsx 主题感知轮廓并移除 v4d 临时深色轮廓；重建仓库内真实终端捕获工具验证硬指标（除暖白面板外无亮色散点、轮廓单元格数大幅下降对照 314 基线）；全套门禁全绿 + 你终审美术；git 流程（todo 1：init+基线+远端 push，每 todo 提交，d17）
---

# Draft: opco-shigure-art-terminal-fix

## Components (topology ledger)
<!-- Lock the SHAPE before depth. One row per top-level component that can succeed or fail independently. -->
<!-- id | outcome (one line) | status: active|deferred | evidence path -->

- c1 render-consistency-gate | 同一 idle 帧、同一轮廓色，在 preview-assets 渲染 / art-render-png.py 像素放大 / 半块文本**三机器路径**对照 + **记录用户已完成的真实 TUI 重启观察**（灰点消失）；真实终端捕获（第四路径）延后到 t7 重建工具后执行（Metis F3 顺序修正）；计数 b 像素内外分布 | active | 新文档 §6/§8/§9.1/§10; docs/09 §2; Metis F3
- c2 art-rework | 两尺寸 idle 母版**低分辨率重设计**（外轮廓 1px、内部零散点清零、忠实 v3 识别特征）+ 其余状态按种子微动差契约派生重建（**派生状态同样必须过 §9.3 状态可读性终审清单**，Metis F4）——全部 2×7 帧重新写入 final.ts，validateManifest 零违规 | active | docs/09 §5A; docs/08 §4/§7/§12; 新文档 §9.2/§9.3; Metis F4
- c3 visual-loop | multimodal-looker 先看 v3 母稿再产出行字符串（文本输出）；渲染 PNG 后 looker 做粗粒度自检（有无白点/哪里不一致），逐项 PASS 后交用户终审 | active | docs/08 §8.5; docs/09:90; 新文档 §10.3; 用户已答 Q2
- c4 asset-audit | 新增确定性审计脚本 scripts/audit-art-noise.ts：①**b(outline) 仅允许出现在最外层轮廓**——b 像素必须同时满足 (a) 8 邻域含透明 且 (b) 处于非透明区域的外边界（从外部透明像素经 8 邻域可达）且 (c) **8 邻域含 ≥1 个不透明像素**（贴靠不透明区边界而非悬浮在透明区，杜绝腿隙/发隙孤立 b，Oracle F6），越界按透明处理；②无孤立亮色像素——按色检查 8 邻域无同色，**豁免 4 个强制 token（eye_blue 4/ribbon_red 8/trim_warm_white 7/sock_black 9）及其语义簇**（compact 单像素蓝眼合法，Metis F1）；③**token 覆盖不重复检查**——删除每帧级 token 门（Oracle F7：与 docs/08 frame-set 粒度冲突且会误拒眨眼帧），token 存在性由 validateManifest gate 11 兜底（src/manifest.ts:107-109） | docs/09:89; docs/08 §6; Metis F1/F16; Oracle F6/F7 | active
- c5 outline-restore | sidebar.tsx 恢复主题感知轮廓（dark→浅轮廓、light→palette 末项），删除 v4d 临时注释 | active | docs/09:86(D); docs/04 §3.6; docs/05 §5
- c6 capture-tooling | 重建真实终端捕获（.omo/evidence/capture/，python pty 基于 task-8-smoke.py 模式），输出轮廓单元格计数对照 314 基线 | active | docs/09:29-33,89; .omo/evidence/task-8-smoke.py
- c7 gates-green | validate-assets / npm test(135) / typecheck / build 全绿；预览 PNG（深+浅轮廓）与真实终端一致 | active | docs/09:91

## Open assumptions (announced defaults)
<!-- Record any default you adopt instead of asking, so the user can veto it at the gate. -->
<!-- assumption | adopted default | rationale | reversible? -->

- a1 美术机制 | multimodal-looker（已启用 ~/.omo/omo.jsonc:12-14，qwen-vl-local/qwen2.5vl:7b，**Image-Text-to-Text 视觉语言模型，非原生生图模型**）只读：机制全程**不依赖、不调用任何原生 PNG/像素图生成**——模型只做两件事：①图像理解（读 v3 母稿 PNG、读渲染后的预览 PNG 做粗检）；②输出文本结构化数据（调色板索引行字符串）。PNG 仅在输入（母稿）与验收（预览）两处出现，均由脚本渲染（art-render-png.py / preview-assets.ts），与模型无关。looker 定位为**粗粒度检查**（有无白点/结构是否对），**不做单像素裁决**（新文档 §10.3），最终长相由用户终审 | docs/08 §8.5; 新文档 §10.3; 用户已答 Q2; 用户确认 Qwen2.5-VL 非生图模型（机制无需生图） | 是
- a2 美术任务定位 | 低分辨率**重新设计**（重分配像素预算、保留时雨识别特征），**不是**从高精参考图机械降采样/过度压缩 | 新文档 §6.3/§8.2/§10.4; docs/08 §8.5 | 是
- a3 状态派生 | 只重绘 idle 母版（两尺寸各 1 帧），其余状态按 docs/07 §7 与种子 states 契约的微动差派生/微调（眼上移/手内收/脚上移/眼窄/上半身平移），不整 24 帧全重绘 | docs/07:141-153; seed json:124-132 | 是
- a4 生成器处置 | scripts/build-final-assets.ts 保留源码但"退役"：重命名至 scripts/legacy/ + 头注释 + **硬守卫（legacy 副本运行即抛错或需 --force，防未来误跑覆盖 final.ts——Metis F6）**；package.json 若引用该脚本则同步处理（Metis F8） | 防 clobber；docs/09:80 "生成器可弃用或仅作参考"；Metis F6/F8 | 是
- a5 审计门位置 | 新增独立脚本 scripts/audit-art-noise.ts（不改 src/manifest.ts 的 validateManifest 契约），把"终端干净"变成资产级确定性检查 | 终端捕获易受环境抖动；runtime 契约零改动 | 是
- a6 恢复后的浅轮廓色值 | dark 主题轮廓恢复为 **#F7F2EA**（与 preview-assets.ts:56 现有浅色预览值统一，A 落地后 b 像素只剩外边界稀疏一圈，浅色不会再现白点；避免 #E8E4DF 与预览 #F7F2EA 两值不一致导致"预览与真实终端一致"验收不可判——Metis F2） | docs/09:12,86; preview-assets.ts:56; Metis 差距分析 F2 | 是
- a7 终端捕获落盘 | 重建脚本与产物放 .omo/evidence/capture/；**/tmp/cap2.py 与 /tmp/shigure2.ansi 实测存在（Oracle F1 复验；docs/09:30-31 记录可复用）**——cap2.py 是原始 ANSI 抓取器（非计数器）、shigure2.ansi 是 314 基线原始捕获，复制到仓库内复用并反向推导计数口径；仓库内重建保证可复现（/tmp 易被系统清理） | docs/09:30-31; Oracle F1 | 是
- a8 B 方案的触发条件 | 渲染层边界感知轮廓（B）**默认不做**：用户已实测复验（重启后灰点消失）→ 纯美术/资产根因成立，renderer.ts 零改动；仅当执行期 T1 复验出现矛盾结果时才重新评估 | 用户复验通过 v4d 结论；新文档 §10.1 顺序要求已由用户复验满足；B 在 A 落地后视觉无增量 | 是
- a9 looker 本地模型可用性 | qwen-vl-local/qwen2.5vl:7b 是用户本机部署模型，局域网波动/电脑休眠会导致不可调用 → 采用"健康探针 + 有界重试 + BLOCKED 通知 + 断点续跑"预案（d13），绝不静默降级 | 用户提出；本地部署现实风险 | 是

## Findings (cited - path:lines)

- **用户重启复验通过（2026-08-03 会话）**：用户重启 opencode 后灰点消失，docs/09 的 v4d 结论成立——灰点根因确认为"浅色 outline 像素渲染"（纯美术/资产根因），渲染链无独立缺陷；**T1 收敛为 A-only，B 不需要**（B 仅作执行期防回归的评估项，默认不做）
- 用户明确延期到下一轮的未来设想（本轮 Scope OUT）：①pet 在终端中的位置调整（新布局/新 KV 配置键，触碰 docs/02 配置合同）；②大小微调（24×24/16×16 是 docs/08 §2 + validateManifest 硬校验合同尺寸，改需独立决策）；③接入 ANSI 更精细显示（Sixel/Kitty 图片协议等，docs/05 §8.1/README 已明确禁止，属架构级变更）
- 双问题定义：docs/09-art-terminal-fix-handoff.md:11-13（终端点状噪点 + 美术质量回退，必须一起解决）；根因链 :23-33（种子噪声 + renderer 把全部 b 像素统一映射 outlineColor + 主题色 + 预览隐藏）；:33（灰轮廓时 314 单元格）；:44（A 是共同出口，不是可选项）
- 已尝试方案勿重复：docs/09:48-58（v1 文字手绘被拒 / v2 清理重绘被拒 / v3 种子忠实但噪声 / v4a-d 程序化清理 + 深轮廓临时缓解；v4d 当前状态：LIGHT_OUTLINE=#17141B）
- 代码事实：docs/09:64-74 表；src/renderer.ts:52-69（outlineIndex=palette.length-1，所有 b 像素 fg=outlineColor，无边界感知）；src/sidebar.tsx:29-33（LIGHT_OUTLINE=#17141B 临时）与 :119-121；src/assets/final.ts:59-85（regular idle v4d 态，'b' 散落在发/脸/身体内部）、:373-390（compact）、:666（FINAL_ASSETS_READY=true）
- 预览与真实 TUI **共用同一 renderFrame**：scripts/preview-assets.ts:38 与 src/sidebar.tsx:134 均调用 src/renderer.ts 的 renderFrame；当前预览 PNG 用深色 #17141B（preview-assets.ts:52-53）→ 新文档"预览无噪点 vs TUI 有噪点"的对照混入了轮廓色变量，两文档根因结论收敛
- 新文档（docs/OpenCode_Pet_时雨终端效果_图片分析交接文档.md）：§6.1（两独立问题叠加：渲染不一致 + Sprite 未成熟）；§8.1-8.3（可直接确认/较强推断/无法确定清单——灰白块确切产生代码未知）；§9.1（渲染一致性验收：同一 idle 帧四路径对照）；§9.2（美术结构验收重点：头发向下流动而非横向膨胀、脸部完整、双蓝眼分离、白区像衣领袖子而非白柱、红色适量、上身-裙-腿连续、单侧发束/细辫明显、可辨识为时雨）；§10（建议顺序：先确认 Renderer 白点根因→固定一个 24×24 idle 帧验证→16×16 独立设计不缩放）；§10.3（本地 Qwen2.5-VL Q4 只做粗粒度检查）
- 生成器管线：scripts/build-final-assets.ts:234-250（cleanupTerminal）、:485-539（build 主流程）、:1-21（确定性）
- 种子数据：design/art-v2/shigure-pixel-data.json:74-98（regular idle）、:104-121（compact idle）、:124-132（七状态微动差契约）
- 交付合同：docs/08-art-asset-handoff.md §4.2（图例）、§6（validateManifest 11 条门禁含 token 存在性）、§8.5（多模态交付强制"先看再画"+视觉闭环）、§12（DoD）
- 视觉契约：docs/07-visual-handoff-without-multimodal.md:9（v3>v2>照片优先级）、:44-58（比例表：头身比 2.2-2.4、宽发、单侧细辫）、:124-137（regular 区域图）、:175-186（§9 文字验收清单）
- 视觉证据管线：.omo/evidence/art-render-png.py 存在可用（PIL 在 /usr/bin/python3，art-visual/PLAN-A-FALLBACK.txt:23-32 实证）；preview-assets.ts:52-56（深 #17141B + 浅 #F7F2EA）
- 真实终端捕获基座：.omo/evidence/task-8-smoke.py（748 行 python pty 完整驱动，可复用/裁剪，但 Screen 类**丢弃全部颜色/SGR 信息**——task-8-smoke.py:248 `pass # m/h/l/q/etc: ignored`，其 block_count 只数 ▄▀█ 字符不算颜色，捕获计数需新写 ANSI SGR 解析）；**/tmp/cap2.py 与 /tmp/shigure2.ansi 实测存在（Oracle F1 复验；docs/09:30-31 记录"新会话可复用"）**——cap2.py 是原始 ANSI 抓取器（非计数器，888B）、shigure2.ansi 是 314 基线原始捕获（132KB）；**314/50/19/72/234 计数的口径在仓库中无任何可复现计算**（docs/09:32 只留数字）
- 环境事实：~/.config/opencode/tui.json plugin 含绝对路径 /Users/unsis/code/opcode/opcopet/dist/tui.js（改 sidebar/renderer 后需重启 opencode 生效，docs/09:73）；~/.omo/omo.jsonc:12-14 multimodal-looker 已启用
- 测试现状：src/manifest.test.ts:20-21 已断言 FINAL_ASSETS_READY=true、ASSETS_ARE_PLACEHOLDER=false

## Decisions (with rationale)

- d1 主路径 = 方案 A（多模态低分辨率重设计）：docs/09:44/80 + 新文档 §6.3/§10.4 收敛——A 是唯一同时解决"终端干净"与"美术忠实 v3"的路径，且美术任务按新文档定位为"重设计"而非"降采样"
- d2 先门后画：T1 渲染一致性验证门（新文档 §10.1）优先于重绘；**用户已实测复验（重启后灰点消失）→ T1 收敛为 A-only**：T1 保留为执行期文档化复验（同一 idle 帧四路径对照，防环境回归），不再作为未决分支
- d3 B 不做（用户复验后）：T1 已证实纯美术/资产根因，渲染链无独立缺陷 → renderer.ts 保持零改动；仅当执行期 T1 复验出现与用户复验矛盾的意外结果时才重新评估 B（记录于执行笔记，不默认触发）
- d4 美术产出机制（a1）：looker 文本输出行字符串 → worker 机械写入 final.ts；禁止 worker 凭 docs/07 文字自行猜图（docs/08 §8.5 强制）
- d5 状态派生复用种子契约微动差（a3），控制工作量并保证 docs/05 §6 状态区分度
- d6 生成器退役（a4）；新增确定性审计门（a5）；sidebar.tsx 恢复主题感知轮廓并删临时注释（a6）
- d7 重建仓库内真实终端捕获（a7）：**复用 /tmp/cap2.py（复制入仓）+ /tmp/shigure2.ansi（314 基线，反向推导计数口径）**，按 Oracle F2 规范新写 ANSI SGR 解析与计数规则，对照 docs/09:89 硬指标
- d8 执行边界：只允许改 src/assets/final.ts、src/sidebar.tsx、scripts/（preview/audit/legacy/consistency）、.omo/evidence/、docs/09 附录状态；T1 结论触发 B 时追加 renderer.ts + 其测试；不改 manifest-data.ts（palette/帧数/时长是合同）；不改 runtime 其他模块；不发布 npm、不初始化 git
- d15 用户 gate 协议（Momus M1 / Oracle F9 折入）：三个用户 gate（todo 3 方向性 / todo 4-5 终审 / todo 7 重启复验）统一协议——①worker 在 verdict 文件写 `status: awaiting-user` + 检查清单；②一句话通知用户（查什么/看哪里/结果写哪）；③等待并报告状态（不烧 token）；④**超 1 个自然日无响应 → 再通知一次并暂停，恢复从检查点续跑**；⑤用户写逐项结果 → worker 从检查点继续。Verification strategy 中删除"Zero human intervention"绝对表述（改为"机器可验证项 agent 执行 + 用户 gate 按协议"）
- d9 looker 美术升级规则（防无限空转）：looker 产出行→预览→你对照 v3 检查为一个迭代；**连续 3 轮迭代未能通过你的终审时，停止自动迭代并向你呈报升级选项**：①你在文本行上做像素级修正（你来画）；②换更强视觉模型/人工美术；③接受当前稿（记录为已知限制）。升级选择由你拍板后继续执行对应分支
- d10 单帧能力探针（先探针后全量）：T2 第一步**只产出 idle 母版第 1 帧（24×24）**，渲染预览后你对照 v3 判断"方向性"（剪影/头身比/识别特征是否上道，不要求细节完美）；**方向性不可接受 → 立即触发 d9 升级，不烧满 3 轮全量迭代**；方向性可接受才继续 16×16 idle 母版与七状态派生（新文档 §10.2 "先固定一个 24×24 idle 帧验证"落成硬检查点）
- d11 **美术靠拢 art-v2 参考图 = 最高验收标准（用户最后强调，硬约束）**：所有美术产出以 design/art-v2 参考图为唯一视觉基准，优先级 v3 母稿（shigure-v3-master-crop.png）> v2 制服（shigure-v2-uniform-crop.png）> 参考照片（docs/07 §1）；looker 提示词必须包含"对照参考图逐项"，终审清单必须以"与参考图的接近度"为首要判据；任何机器门禁通过但偏离参考图的美术一律不算合格
- d12 批准记录：用户 2026-08-03 明确批准（"其他没啥了"），批准范围=仅生成计划文件；用户重启复验灰点消失（v4d 结论成立，A-only）；三项未来设想（位置调整/大小微调/ANSI 精细显示）记入 Scope OUT 留待下一轮
- d13 looker 断连预案（a9，用户提出）：①**健康探针**——每轮调用 looker 前先发最小视觉请求（让 looker 一句话描述 v3 母稿）确认可响应；②**有界重试**——失败自动重试 3 次 × 30s 退避（约 2 分钟），不打扰用户；③**BLOCKED 通知**——重试仍失败则停止美术循环，执行日志写 `BLOCKED: looker 本地模型不可用` 并明确通知用户（唤醒电脑/检查网络后继续），不烧 token、不假产出；④**断点续跑**——looker 每版网格先落盘 `.omo/evidence/art-loop/` 检查点（probe-1.md / idle-regular-v2.md 等），通过方向性检查/终审后才写 final.ts，模型恢复后从最后检查点继续、已过帧不重做；⑤**looker 依赖映射（Metis F18）**：t1 复验/t2 审计门/t6 轮廓恢复/t7 终端捕获/t8 门禁 = 不依赖 looker；t3 探针/t4 24 母版/t5 16 母版+状态派生 = 依赖 looker（t3 起先健康探针）；断连期间不并行复杂化主流程
- d14 Metis 差距分析台账（2026-08-03，18 项发现全部折入）：F1 审计门规则精确化（内部 b=0、豁免 4 强制 token）→ 折入 t2；F2 浅轮廓色值统一 #F7F2EA → 折入 a6/t6；F3 T1 四路径顺序 → T1 改为"3 机器路径 + 记录用户重启观察"，真实终端捕获延后到 t7；F4 Scope 与 a3 矛盾 → 明确"idle 母版重设计 + 七状态派生重建，派生状态也必须过 §9.3 状态可读性终审清单"；F5 d2/d3 过度断言 → T1 保持真实门禁并定义 B 触发阈值；F6 生成器退役加硬守卫（legacy 副本运行即抛错或需 --force）；F7 参考文件路径预检（art-v2 crop vs samples 是否存在、以 art-v2 为准）；F8 执行边界枚举 manifest.ts/test.ts/validate-assets.ts/package.json；F9 审计门接入验收命令（npx tsx scripts/audit-art-noise.ts）+ 测试数措辞"当前 135 可增"；F10 硬指标定义数值阈值（轮廓单元格 ≤100 或 ≤32% 对照 314）+ 计数规则 + pty 200×50；F11 未验证假设折入 t1 前检（looker 配置/tui.json/参考图存在性）；F12 用户终审阻塞语义（等待+断点续跑+明确报告等待状态）；F13 证据层级（审计门=确定性噪点门，looker=建议性粗检，用户终审=最终权威）；F14 d1 引用改为 §6.3/§10.2 并记录 §10.4 替代顺序被否决的理由；F15 预览证据随 #F7F2EA 重生成；F16 审计 token 覆盖改为"仅当与 validateManifest 粒度不同时保留"；F17 sidebar 只改 LIGHT_OUTLINE 值与注释、不动 outlineColor() 结构
- d17 **git 流程（用户 2026-08-04 新增范围变更，替换 d8 中"不初始化 git"）**：本地无 git 仓库（已实测 `git rev-parse` fatal）、远端 `git@github.com:unsiscon/oc-shigure.git` 可达且为空（`git ls-remote` exit 0 无 refs）、git 身份已配置（unsis/unsiscon@gmail.com）、`.gitignore` 已有 node_modules/+dist/ 需补 `*.tgz`。新增 **todo 0（执行前第一步）**：`git init -b main` → 补 `.gitignore`（`*.tgz`）→ 基线提交 `chore: baseline v4d pre-art-fix` + `git tag baseline-v4d` → `git remote add origin git@github.com:unsiscon/oc-shigure.git` → `git push -u origin main`。**提交策略**：每 todo 完成提交一次（type(scope) 命名），每 todo 后 push（异地备份）；回滚安全网 = baseline-v4d tag + 每 todo 提交点（改坏 → `git checkout baseline-v4d -- <文件>` 或 revert）；**main 直推**（solo 项目无 PR 流程）；禁止 git 历史重写（rebase -i/force push）。所有 todo 的 `Commit: N/A` 改为实际提交命令。**Momus M1**（零人工表述与用户 gate 矛盾、QA 不可执行）→ d15 用户 gate 协议 + Verification strategy 改述；**Momus M2**（F1-F4 终验无定义）→ 计划 F1-F4 补工具/步骤/证据/通过标准；**Momus M3 + Oracle F2**（捕获计数规则未定义、task-8-smoke.py 丢弃颜色）→ t7 补 ANSI SGR 解析/轮廓单元格定义（fg=#F7F2EA 精确匹配，面板=bg #F1E8DF）/孤立邻接规则/区域范围/移除捕获侧"内部 b"（由审计门资产侧兜底）；**Oracle F1**（/tmp/cap2.py + shigure2.ansi 实测存在，原"丢失"前提错误）→ a7/d7 改为复用 + 反向推导计数口径；**Oracle F3**（≤100 误标"实测上限"、OR 语义可逃逸）→ 单一阈值 = 审计门实测边界 b 计数 ×1.2，且 <314 sanity，删"实测上限"措辞；**Oracle F4**（临时索引脚本无路径）→ 命名 scripts/render-consistency.ts + 机械逐格比对；**Oracle F5**（vitest include 只覆盖 src/，scripts/ 测试被 npm test 静默跳过）→ t2 测试文件固定放 src/audit-art-noise.test.ts；**Oracle F6**（审计规则 1 漏过悬浮 b）→ 加条件 (c) 8 邻域含 ≥1 不透明像素，越界按透明；**Oracle F7**（每帧 token 门与 docs/08 粒度冲突、误拒眨眼帧）→ 删每帧 token 门，validateManifest gate 11 兜底；**Oracle F8**（误引 docs/07 §1）→ 改引 docs/09:80 + 记录 override 关系；**Oracle F9**（用户等待无界）→ d15 步骤④ 1 自然日再通知+暂停

## Scope IN

- T1 渲染一致性验证门（四路径对照 + b 像素内外计数 + 根因归属结论 + B 触发判断）
- 两尺寸×七状态干净帧重绘（final.ts，低分辨率重设计），通过 validateManifest + 新审计门
- multimodal-looker 视觉闭环（先看 v3 → 产出行 → 预览对照粗检 → 迭代；最终用户终审）
- scripts/audit-art-noise.ts 新增 + scripts/build-final-assets.ts 退役改名 + T1 一致性脚本
- sidebar.tsx 主题感知轮廓恢复 + 临时注释删除
- 重建真实终端捕获工具与证据（.omo/evidence/capture/）
- 全套门禁与预览证据重新生成；docs/09 增补"已解决"状态附录

## Scope OUT (Must NOT have)

- 不改 manifest-data.ts / 不动 runtime 模块（adapter/reducer/animation/registry/tui/config/types）；renderer.ts 仅在 T1 证实独立渲染缺陷时按 d3 追加改动
- 不新增调色板颜色、不新增状态/尺寸/帧数/时长（docs/08 §2 合同锁死）
- 不用 v1-v4 程序化/文字契约路线再试（已 4 次被拒）；不做高精 PNG 机械降采样（新文档 §6.2/§10.4）
- 不引入 PNG 解码运行时依赖、图片协议、emoji 方块、新构建依赖
- 不发布 npm、不改 opencode.json/tui.json 条目（绝对路径条目已就位，只重启生效）；**不 push 其他远端、不 git 历史重写（rebase -i/force push）、不删除 baseline-v4d tag（git 流程见 d17）**
- 不做 docs/05 §8 禁止效果（漂浮符号/阴影/场景/道具）
- 不负责 OpenCode 1.18.10 session.next.* 事件不可观测的运行时限制（docs/09:106）
- **用户明确延期到下一轮的三项未来设想（本轮不做，仅记录）**：①pet 终端位置调整（新布局/新 KV 配置键）；②大小微调（尺寸档位或改 manifest 合同）；③接入 ANSI 更精细显示（Sixel/Kitty 图片协议，项目边界已禁止）

## Open questions

- Q1（方向）：用户答"偏 A，读新文档后综合考虑" → 已综合：A 为主路径 + T1 先验证根因 + B 按需触发（d1-d3）；不再追问
- Q2（美术验收 gate）：用户答"looker 逐项 PASS + 你终审" → 已折入 a1/d4；不再追问
- 无剩余开放问题

## High-accuracy review (dual review)
phase: review_complete - APPROVED (git flow scope change folded in)
review_required: true
plan_path: .omo/plans/opco-shigure-art-terminal-fix.md
plan_sha256: 038f224e08b39cb88e6415b8f6388101f55ed3692e02f9df6ba64a42bc97e609
review_round_id: rr-20260804-012 (final, approved)
round_status: approved
pending-action: none - plan ready for execution via $start-work opco-shigure-art-terminal-fix
review:
  momus:
    status: approved
    workspace_root: /Users/unsis/code/opcode/opcopet
    runtime_home: null
    target: .omo/plans/opco-shigure-art-terminal-fix.md
    round_id: rr-20260804-012
    plan_sha256: 038f224e08b39cb88e6415b8f6388101f55ed3692e02f9df6ba64a42bc97e609
    launch_id: launch-momus-012
    session: ses_037435d09ffdeHdAgbWAW3Qkte
    result: APPROVE
  independent:
    status: approved
    workspace_root: /Users/unsis/code/opcode/opcopet
    runtime_home: null
    target: .omo/plans/opco-shigure-art-terminal-fix.md
    round_id: rr-20260804-012
    plan_sha256: 038f224e08b39cb88e6415b8f6388101f55ed3692e02f9df6ba64a42bc97e609
    launch_id: launch-oracle-012
    session: ses_037434a17ffdfWjtbQeFR0Ohx7
    result: APPROVE
## Round 7 receipts (rr-20260804-007) — FINAL
- momus: **VERDICT APPROVE** — session ses_03763d537ffeStEpTEordcaJHs / launch launch-momus-007。round 6 两项（glob 记法/reason 值规则）核实关闭；全计划无剩余阻塞项；引用/QA/scope 与既往 F1-F9 等项目一致。
- independent: **VERDICT APPROVE** — session ses_03763beaeffeeV7Xdj5WcYejAS / launch launch-oracle-007。round 6 两项关闭；P1 端到端无回归（scoped 审计时序可满足）；4 项对抗探针全过（无占位符/无新依赖/ledger 诚实）；2 条非阻塞观察（t7 证据不对称、docs 引用 ±1 行）。
- 双路对同一文件（SHA 4e986d04…f7a1，53213B）无条件批准。按契约，批准后计划文件不再改动。
- **非阻塞观察（Oracle 附带，记录供执行者参考，不改计划）**：①t7 仅产出 task-7-failure.txt，happy 证据在 capture/（F1 的"task-1..8 证据"按 t7 自身验收理解）；②"idle 帧 2 仅 1px 眨眼"实际在 docs/08:193（计划引 :194）、美术清单在 docs/09:89（计划引 :90）——内容准确，行号 ±1。
- 高精度双审完成：7 轮（含 round 2 momus TLS 死亡后重发），累计折入 40+ 项评审发现，最终双路 APPROVE。

## Round history (rr-20260804-001 → 012, 如实记录)
- rr-20260804-001（round 1）：momus CHANGES_REQUESTED（M1-M3）+ oracle CHANGES_REQUESTED（F1-F9）→ 全部折入修复
- rr-20260804-002（round 2）：oracle CHANGES_REQUESTED（F1-F9 确认 CLOSED，新发现 A-F）；**momus 子代理因 TLS "unknown certificate verification error" 于 2026-08-03T16:26:20.396Z 失败（0 输出、未触发 fallback），外部检测确证僵尸 running 后取消 bg_f63ac6cc** → A-F 折入
- rr-20260804-003（round 3）：momus CHANGES_REQUESTED（M2/M3）+ oracle CHANGES_REQUESTED（A-F 关闭；N1 检查点格式、N2 单位对齐、N3 union/30s）→ 折入
- rr-20260804-004（round 4）：oracle APPROVE + momus CHANGES_REQUESTED（3 项 QA 命令问题）→ 折入
- rr-20260804-005（round 5）：oracle CHANGES_REQUESTED（P1 裸 audit 断言；O1/O2）+ momus CHANGES_REQUESTED → 折入
- rr-20260804-006（round 6）：oracle APPROVE + momus CHANGES_REQUESTED（2 项极小文本）→ 折入
- rr-20260804-007（round 7）：**momus APPROVE + oracle APPROVE**（原 8-todo 计划双审完成，SHA 4e986d04…f7a1）
- rr-20260804-008（round 8）：git 流程范围变更折入（todo 1 git init + 重编号 1-9）；momus CHANGES_REQUESTED（FIND-1..7）+ oracle CHANGES_REQUESTED（FIND-1..7 详述）→ 折入
- rr-20260804-009（round 9）：momus CHANGES_REQUESTED（F4 残留"未初始化 git" + frontmatter 过期）+ oracle CHANGES_REQUESTED（FIND-8/FIND-9）→ 折入
- rr-20260804-010（round 10）：momus APPROVE + oracle CHANGES_REQUESTED（frontmatter 仍滞后 1 轮 → FIND-9 conjunct B 未闭）→ 折入
- rr-20260804-011（round 11）：momus CHANGES_REQUESTED + oracle CHANGES_REQUESTED（frontmatter 又滞后 1 轮，FIND-9 类复发——根因：评审段推进 round 时 frontmatter 未同步 bump）→ 折入
- rr-20260804-012（round 12，最终）：**momus APPROVE + oracle APPROVE**（frontmatter 同步关闭、全计划残留零命中、P1/N1-N3/F1-F9/A-F/O1/O2/FIND 项全复验通过、源码引用全核验、无新依赖；4 条非阻塞草稿级观察 + 1 条前瞻流程提示）——**双审完成：双路无条件 APPROVE，rr-20260804-012 为最终批准轮次，SHA 038f224e…e609（59297B，git 流程已折入）**

## Round 12 receipts (rr-20260804-012) — FINAL
- momus: **VERDICT APPROVE** — session ses_037435d09ffdeHdAgbWAW3Qkte / launch launch-momus-012。frontmatter 同步关闭；全计划残留扫描零命中；无发现。
- independent: **VERDICT APPROVE** — session ses_037434a17ffdfWjtbQeFR0Ohx7 / launch launch-oracle-012。frontmatter :3/:6↔:107-109 一致；5 项探针全过；引用核验全准。4 条非阻塞观察：①d17"todo 0"应随下次台账清理改为 todo 1；②d8 遗留"不初始化 git"（d17 已替换，历史忠实）；③d13/d14/d15 旧编号（历史忠实）；④评审段收尾时需推进 round 并记录本轮 verdict（防 FIND-9 复发）。
- 双路对同一文件（SHA 038f224e…e609，59297B）无条件批准。git 流程范围变更已折入并获双审通过。

## Approval gate
status: approved - plan written at .omo/plans/opco-shigure-art-terminal-fix.md (用户 2026-08-03 批准；d11 靠拢 art-v2 参考图硬约束已折入；d12 批准记录；Metis 18 项发现全部折入；TL;DR 已填；结构自检通过：8 实现 todo + F1-F4 终验，依赖矩阵已对齐)
approach: 见文件头 approach 字段（T1 渲染一致性复验 → A 低分辨率重设计 → 审计门/轮廓恢复/终端捕获 → 全门禁 + 用户终审）
next action after approval: 完成。计划文件就绪，等待用户 `$start-work opco-shigure-art-terminal-fix` 启动执行；执行前用户可选项：先运行一次高精度双审（momus + oracle）——**用户已选：高精度双审进行中（rr-20260804-001）**
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->

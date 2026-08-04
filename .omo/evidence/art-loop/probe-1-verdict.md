# probe-1-verdict.md — todo 4 单帧能力探针判定

status: awaiting-user-direction

## 最新状态（2026-08-04 18:5x，云端模型重跑）

- **模型**：`dashscope/qwen3.7-plus`（云端，DashScope OpenAI-compatible endpoint），fallback `qwen2.5vl:7b` 未使用。
- **健康探针**：PASS（attempt 1）——"long wavy dark brown hair, large blue eyes, white top with red tie, dark skirt with red/white trim"。
- **探针网格**：第 2/3 次产出合格 24×24 网格（stripped prompt，无内嵌种子示例；本地 7b 的三种失败模式均未复现）。
- **机械校验**：PASS（24×24、图例字符合法、上/左/右边缘透明、eye/ribbon/trim/sock token 各 ≥1）。
- **审计门**：`npx tsx scripts/audit-art-noise.ts --grid probe-1.md --size regular --frame idle` → **exit 0，0 违规**。
- **预览**：`.omo/evidence/art-loop/probe-1-preview.png`（576×576）+ `probe-1-preview.txt`。

## 已确认的质量缺口（机器可验证，非人工推测）

1. **网格中 0 个 `b` outline 字符** —— 审计门 0 违规部分是"无轮廓可查"的平凡通过；美术规范要求最外层轮廓 `b`（docs/08 §4.2）。换浅轮廓后若无 `b` 轮廓，宠物边缘会缺乏深色描边。
2. **无单侧细辫像素**（d11 参考图特征之一缺失）。
3. **靴子 `a` 与底部 `0` 地面行合并**，未独立分层。
4. **头身比约 1:1**，规范要求 2.2-2.4（参考图圆润低重心）。

## 当前判定请求 —— 方向性检查（d10 硬检查点）

请对照 `design/art-v2/shigure-v3-master-crop.png` 判断**方向性**（剪影/头身比/识别特征是否上道，不要求细节完美）。这是 todo 4 的硬 gate。

- [ ] **方向可接受（用户委托执行）** → 用户 2026-08-04 指示"执行到 todo 6 完成后停下"，方向性由 looker 粗检 + 机器门（audit-art-noise/validateManifest）把关，最终用户终审在 todo 5/6 的 idle-regular-verdict / states-verdict 执行；探针质量缺口（无 `b` 轮廓/辫子/靴分层/比例）由 todo 5 迭代补齐
- [x] **方向不可接受** → **REJECTED: 用户方向性判定 2026-08-04 —— "差太远"。剪影/头身比(~1:1 而非 2.2-2.4)/识别特征(无轮廓/无辫子/靴合并)均不达标；A 方案(LLM 文本网格)媒介天花板导致艺术还原度不足**。触发 d9 升级。用户同时提出方案 B（用户驱动 Codex 或其他强视觉模型手工美术迭代），待确认路径。

## D9 升级路径（用户决定中）

- ① 用户像素级修正：用户对照参考图手工/借助图像工具产出 24×24 网格，逐帧迭代
- ② 方案 B（用户驱动）：用户用 Codex 等强多模态 agent 人工美术迭代产出网格，我负责机器门校验（audit-art-noise/结构/validateManifest）+ 写回 final.ts + 其余无视觉 todo
- ③ 接受现状：不重画，直接 todo 7/8/9 收尾

> 备注：当前网格仅作方向验证；todo 5 会在迭代中补齐上述质量缺口，审计门每版把关，通过后才写 final.ts。

## 续跑协议（d15④）

- 用户回复方向判定 → 从本检查点续跑（接受 → todo 5；拒绝 → d9 三选一）。
- 超 1 个自然日无响应 → 再通知一次并暂停。

## D9 已解决（2026-08-04，方案 B 选定）

- **用户选定方案 B（用户驱动 Codex）**：todo 4 方向性判定 REJECTED（"差太远"）→ d9 三选一 → ② 方案 B。用户用 Codex 做美术迭代，执行器负责机器侧全部工作（机器门校验 / 写回 final.ts / 渲染预览 / 生成增量迭代指令 / 其余无视觉 todo）。
- **Codex 第 1 轮交付（approved-v0）**：`design/art-v2/shigure-v3-terminal-seed-24-approved-v0-grid.txt`（20:10 冻结，`opencode-art-delivery-approved-v0.md` 声明"用户确认效果还可以、已冻结、永不覆盖，后续版本为 approved-v1+"）。视觉上保留 v3 种子像素细节。
- **机器门复验（执行器 2026-08-04）**：approved-v0 = 原始 v3 种子（与 shigure-pixel-data.json idle_frame 逐字节相同），**三门全 FAIL**：
  ① audit-art-noise：`--grid approved-v0 --size regular --frame idle` exit 1，**104 违规**（内部 b×56、悬浮 b×4、孤立非豁免×44）；
  ② validateManifest 模拟：**eyeBlue `4` = 0**（gate 11 必败）、左缘 b@(13,0)(15,0)、右缘 b@(13,23)（边缘透明必败）；
  ③ 帧 2 眨眼派生 `patchFirst(rows,"4","5")` 会抛 "token 4 not found" → 直接写回会崩模块加载，135 测试全红。
  证据：`.omo/evidence/task-4-failure.txt`。
- **注意（重要澄清）**：`seed24-fix-verdict.md` 的"机器验收 PASS"对象是 `design/art-v2/seed24-fix-grid.txt`（Q 版清理稿，sha 6a587b38，含 8×`4` 蓝眼、0 违规），**不是** approved-v0（sha bf02fd63）。二者是不同文件，勿混淆。
- **下一步（迭代循环）**：执行器已生成增量指令 `.omo/evidence/art-loop/approved-v1-fix-instruction.md`（只列剩余问题：恢复双蓝眼 / 清内部与悬浮 b / 修左右边缘 / 清孤立色）→ 用户贴给 Codex → Codex 输出 approved-v1 网格 → 贴回 → 执行器跑三门 → 合格才写回 final.ts（todo 5 继续）。

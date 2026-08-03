# probe-1-verdict.md — todo 4 单帧能力探针判定

status: awaiting-user

## 触发上下文

- 健康探针（d13①）：**PASS**（attempt 1）——本地视觉模型 `qwen-vl-local/qwen2.5vl:7b` 可响应，一句话描述 v3 母稿成功（见 probe-1-looker-notes.md）。
- 探针网格（d13② / Oracle F 有界重试）：**3 次格式校验全部失败**，重试上限已到：
  - attempt 1：输出含非法字符 `#`（charset fail）
  - attempt 2：输出 24×24 全 `0` 实心块（structure fail：无透明边缘、无 token 覆盖）
  - attempt 3：逐字回显提示词内嵌的种子示例（structure fail + 属于被禁的旧生成器输出复制）
- 真实 `multimodal-looker` 子代理亦失败：`registry.ollama.ai/library/qwen2.5vl:7b does not support tools`。
- 结论：**looker 无法产出合格探针网格** → 触发 **d9 升级**（计划 todo 4 failure 路径：`D9-UPGRADE: 3x format-fail`）。

## D9 升级 —— 三选一（由用户拍板）

在 `.omo/evidence/art-loop/probe-1-verdict.md` 下方逐项填写你的决定（PASS / 拒绝 + 理由）：

- [ ] **选项 ① 用户像素级修正**：由你直接给出 24×24 idle 第 1 帧的调色板索引网格（`.0123456789ab` 图例，24 行 × 24 字符），worker 机械校验后写入 probe-1.md 检查点并继续 todo 5。
- [ ] **选项 ② 换模型或人工美术**：更换更强视觉模型（如云端 VL 模型）或引入人工美术；由你指定模型/来源后重跑探针。
- [ ] **选项 ③ 接受当前稿**：接受当前 v4d 程序化资产的现状，放弃 looker 重画路线；计划将收缩为"仅轮廓恢复 + 审计门 + 终端验证"（todo 7/8/9 仍执行，todo 5/6 美术重绘标记为 d9-accept-current）。

## 检查清单（供用户决定时对照）

1. 是否愿意投入时间自行给出 24×24 网格？（选项① —— 最符合"先看再画"且完全可控）
2. 是否有可用的更强视觉模型（云端/其他本地大模型）？若有，提供配置方式。（选项②）
3. 若两者皆无，是否接受保留 v4d 现状，仅做轮廓/审计/验证收尾？（选项③）

## 续跑协议（d13④ / d15④）

- 超 1 个自然日无响应 → 再通知一次并暂停；恢复时从本检查点续跑。
- 用户写入决定后，worker 从检查点继续（选项①：校验用户网格 → probe-1.md；选项②：重跑 looker 探针；选项③：跳过 todo 4/5/6，直接 todo 7）。

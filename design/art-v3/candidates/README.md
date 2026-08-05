# 时雨 Regular idle A/B 候选

> 状态：美术候选，等待开发 Agent 运行机器门禁并接入真实 OpenCode TUI。不是最终尺寸选择，也不是七状态正式资产。

当前 JSON 为用户反馈后的 detail-first `v1` 重画。早期 `v0` 过度压低细节，已判废，不应进入真实 TUI 选型。

## 文件

- `regular-24-idle.json`：Candidate A，24×24 逻辑像素，终端占用 24×12 cells。
- `regular-32-idle.json`：Candidate B，32×32 逻辑像素，终端占用 32×16 cells。
- `regular-24-idle-preview-dark.png` / `regular-24-idle-preview-light.png`。
- `regular-32-idle-preview-dark.png` / `regular-32-idle-preview-light.png`。
- `regular-24-idle.sha256` / `regular-32-idle.sha256`：对应 JSON 的 SHA-256。
- `candidate-validation.txt`：确定性格式、边距、token、帧差异、轮廓和暗色 run 报告。

每张预览按左到右显示 `neutral` 与 `soft-blink` 两帧。PNG 是确定性的半块语义栅格预览，不模拟具体终端字体抗锯齿；最终判断必须使用开发 Agent 的真实 `sidebar_content` 截图。

## 共同身份锁定

- 体型和重心：`design/samples/shigure-concept-a-rounded-v3.png`。
- 制服结构：`design/samples/shigure-concept-a-uniform-v2.png`。
- 发色、蓝眼、脸型、长发和侧辫：`design/references/shigure-reference-photo-1.jpg`。
- 两版都采用正面、安静、低能量 idle；宽棕发向下收束，屏幕左侧红发夹，屏幕右侧分段钩状侧辫。
- 暖白水手服侧板、深色衣身、红色长领结、深色裙、黑袜和深红棕短靴保持同一布局。
- 不加入舰装、武器、场景、文字、阴影、漂浮符号或独立效果。

## 终端原生重绘策略

- 两版均直接以目标网格手绘，不从概念图、approved-v2 或另一候选缩放/追踪。
- `b` outline token 只用于邻接外部透明区的外轮廓；刘海、眼部、发束、制服和肢体的内部结构全部改用稳定的材料色，避免 dark theme 中 outline→panel 形成内部孔洞。
- 保留高细节密度，但把发影、制服和袜色拆成纵向、斜向、错位的小段；确定性审计中不再存在达到告警阈值的暗色水平 run。
- soft-blink 只改变眼部像素；外接框、脚底基线、头发、辫子、制服和四肢位置完全不变。

## Candidate A：24×24

- 以 `approved-v0` 为细节密度基准重新构图，保留分束刘海、带高光与深色层的双眼、交叉红发夹、面部包裹感、分段侧辫、袖口、手、领口、长领结、褶裙红边、腿袜和短靴。
- 目标是证明现有 24×12 侧栏占用不需要靠牺牲身份细节来消除横带。
- 优点：保持当前运行时尺寸合同，侧栏占用最小。
- 风险：脸、侧辫与白侧板只有很少像素，真实字体下可能仍显粗。

## Candidate B：32×32

- 独立构图，直接解释 `rounded-v3` 的圆润低重心，不是 A 的放大版。
- 使用额外空间表现宽而向下收束的长发、错位发丝高光、三层蓝眼、椭圆脸、交叉发夹、水手领和白侧板、袖口与手、长领结、褶裙红边、暖白袜口、短靴以及连续到胸侧的分段细辫。
- 优点：材料边界可以通过形状而非长水平色带表达。
- 风险：终端占用增加到 32×16，窄侧栏或内容较多时可能拥挤。

## 交给开发 Agent 的接入顺序

1. 对两个 JSON 分别运行格式、边距、required token、outline/noise 和帧差异门禁。
2. 每次只临时接入一个候选；先 A 后 B。
3. 使用同一 OpenCode、终端、字体、字号、缩放、主题和侧栏宽度捕获 dark/light。
4. 不在 A/B 选型前展开七状态，不把临时 selector 留进最终 bundle。
5. 将四张真实 TUI 截图交给用户选型；PNG 预览不能替代该步骤。

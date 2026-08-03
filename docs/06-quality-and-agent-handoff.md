# 质量与 Agent 交接

## 1. 使用方式

本文是交给后续开发、美术和测试 Agent 的共同合同。Agent 可以自行制定任务计划、选择测试框架和组织源文件，但不得擅自扩大 V1 产品范围或改变状态含义。

视觉部分必须先阅读 [无多模态视觉交接合同](07-visual-handoff-without-multimodal.md)。当前优先级是：A 圆润体型 v3 为主基准，A 制服 v2 为次选参考；PNG 不是运行时资源，也不要求 Agent 具备图像理解能力。

## 2. Definition of Done

只有同时满足以下条件，V1 才能宣称完成：

- npm 安装包能在 OpenCode 1.18+ 从 `tui.json` 加载。
- `sidebar_content` 正常显示，不替换其他侧栏内容。
- 两档尺寸与七状态全部有有效资产。
- 宠物启用且侧栏可见时，七种中文状态标签始终显示。
- 状态机通过本文事件序列测试，无跨会话串扰。
- waiting、retry、working、thinking 的语义正确。
- success 约 2.5 秒、error 约 4 秒，并可被新任务打断。
- 动画关闭时没有活动帧计时器。
- 资源/插件异常时 OpenCode 继续正常工作。
- 正式终端矩阵完成实际冒烟测试。
- 运行期没有网络、遥测、外部进程、会话正文解析和重型图片解码。
- README、安装说明、版本要求、已知限制和许可边界准确。

## 3. 状态验收矩阵

| ID | 输入序列 | 预期可见序列 | 关键断言 |
|---|---|---|---|
| S01 | 初次进入 idle 会话 | idle | 不播放 success |
| S02 | step start → reasoning → tool start → tool end → text → idle | thinking → working → thinking → success → idle | success 只在完整周期后出现 |
| S03 | tool start → permission asked | working → waiting | waiting 覆盖 working |
| S04 | permission replied，tool 仍活动 | waiting → working | 不提前进入 thinking |
| S05 | question asked/replied | waiting → 原活动态 | pending 集合正确清除 |
| S06 | status retry → message delta → busy | retry → retry → thinking | 普通增量不冲掉 retry |
| S07 | tool A/B start → A end → B end | working → working → 重新归约 | 并发工具计数正确 |
| S08 | tool failed → new reasoning | error → thinking | 可恢复活动打断 error |
| S09 | session error | error 4s → idle | 不显示 success |
| S10 | 用户 interrupt/MessageAbortedError | idle | 不显示 success/error |
| S11 | success 后 1s 新 prompt | success → thinking | 旧计时器不得覆盖新状态 |
| S12 | 当前会话 A 收到会话 B 事件 | 不变 | 严格 sessionID 过滤 |
| S13 | A 切换到有 permission 的 B | waiting | 从 API 重水合，不继承 A 瞬态 |
| S14 | 重复 tool end / reply | 稳定不崩溃 | reducer 幂等 |
| S15 | 插件 dispose 时动画进行 | 无后续更新 | 监听器与计时器全部释放 |

## 4. 配置验收

| 场景 | 预期 |
|---|---|
| 默认首次加载 | enabled=true、regular、animations=true |
| Hide | slot 不显示，命令仍可恢复 |
| Regular → Compact | 立即切换到当前状态 compact 首帧 |
| Animations off | 状态更新，画面停在代表帧，无计时器 |
| Animations on | 从当前状态首帧重新开始 |
| 非法 KV 值 | 单字段回退默认，不清空其他有效偏好 |
| 热重载 | 偏好保留，无重复 slot/命令/监听器 |

## 5. 渲染器验收

### 确定性测试

- 透明/透明、色/透明、透明/色、同色/同色、异色/异色五种组合输出正确块字符与颜色。
- 24×24 帧精确输出 12 行、每行 24 个字符格。
- 16×16 帧精确输出 8 行、每行 16 个字符格。
- 不含 emoji、全角空格、组合字符或宽度不稳定字符。
- 透明像素不写入主体背景色。
- 同色 run 合并不改变视觉输出。

### 视觉测试

- 浅色与深色 OpenCode 主题各检查一次。
- Regular/Compact 在 100% 终端显示尺寸下检查，不能只看放大图。
- 深棕头发与深色制服在暗色 panel 上仍有轮廓。
- 蓝眼、侧辫、红结在 Compact 中可辨认。
- 动画没有基线跳动、尺寸忽大忽小、裁切或整帧闪烁。

## 6. 终端兼容矩阵

正式发布前记录 OpenCode 版本、终端版本、字体、主题和结果：

| 平台 | 正式冒烟目标 | 必测内容 |
|---|---|---|
| macOS | Apple Terminal、iTerm2、Ghostty | 真彩色、块字符、resize、主题切换 |
| Linux | Kitty、WezTerm、GNOME Terminal | 同上，至少一个 Wayland 环境 |
| Windows | Windows Terminal | PowerShell/常见 shell 下宽度与颜色 |
| 多路复用 | tmux | 尺寸、重绘、颜色，不作为正式阻塞终端协议 |
| 远程 | SSH | 标准 ANSI 路径冒烟，记录 TERM/COLORTERM |

正式支持终端出现错行、双宽或 TUI 崩溃是阻塞问题。tmux/SSH 的特定环境差异可以记录为已知限制，但不得偷偷启用图片协议作为修复。

## 7. 性能与可靠性

- 使用 fake clock 验证动画最高约 6 FPS。
- hidden/disabled/animations=false 时断言没有帧更新。
- 长时间 retry/waiting 不累计计时器。
- 10,000 个无关或其他 session 事件不改变当前状态。
- 重复 mount/dispose 不增加监听器数量。
- 损坏 manifest、缺帧、非法调色板索引均进入静态 fallback。
- 插件错误不能向 OpenCode event handler 返回 rejected promise 影响宿主。

## 8. 隐私检查

发布前对 bundle 和依赖做静态检查：

- 不存在 `fetch`、WebSocket、HTTP client、analytics SDK。
- 不启动 `child_process`、Bun shell 或外部命令。
- 不读取 session message text、tool input/output、文件正文。
- 不写入日志文件或生产力数据。
- KV 只存三项用户偏好。

## 9. 开发 Agent 交接

### 必须遵守

- 使用 OpenCode 1.18+ TUI 插件和 `sidebar_content`。
- 事件 SDK 与领域状态机隔离。
- 当前 sessionID 过滤、并发集合、等待集合、结果计时器必须可测试。
- 运行时使用预编译像素数据，不解码源图。
- 错误隔离和 lifecycle 清理是功能的一部分。

### 可自主决定

- 源码目录结构、构建工具、测试框架和 bundler。
- reducer 的具体类型组织。
- 像素源图是独立 PNG 还是图集。
- 内部压缩方式和 span run 合并策略。
- debug 日志的具体实现。

### 不得自行加入

- server plugin、MCP、外部窗口、网络、遥测。
- 工具名/文件名显示、对话、统计或提醒。
- 第三方角色扫描和导入。
- 旧 OpenCode 兼容层。

## 10. 美术 Agent 交接

### 开始条件

- 项目负责人已选择 A 圆润体型 v3，并将 A 制服 v2 记录为次选参考。
- 已阅读 `docs/07-visual-handoff-without-multimodal.md` 的文字合同和语义网格示例。

### 必须遵守

- 两档尺寸独立绘制。
- 七状态动作必须符合视觉资产规范。
- 身份、辫子所在侧、调色板、头身比和基线一致。
- 禁止漂浮符号、阴影、场景、文字和复杂舰装。
- 每个循环提供实际尺寸预览与浅/深背景 QA。

### 可自主决定

- 在帧率限制内的具体帧数。
- 次要发丝、手部和表情像素。
- 只要状态语义清晰，具体动作节奏可以优化。

## 11. 测试 Agent 交接

测试 Agent 必须以行为合同为准，不以实现文件结构为准：

- 优先构建事件序列和 fake clock 测试。
- 分开测试 reducer、动画控制器、半块转换和 TUI 集成。
- 用真实 OpenCode 包与真实 npm tarball 做最终冒烟。
- 视觉问题必须在实际尺寸下判断。
- 发现范围外功能时视为产品回归，而不是额外加分项。

## 12. 发布门槛

发布候选必须附带：

- OpenCode 最低版本与测试版本。
- 终端兼容结果。
- 七状态实际预览。
- 已知限制。
- 代码许可与角色素材许可说明。
- npm 名称 `opco-shigure` 的发布时重新查询结果。
- 零网络/遥测声明。

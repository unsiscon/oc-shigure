# 调研与定位

> 调研日期：2026-08-02  
> 事实基线：OpenCode 1.18.10、`@opencode-ai/plugin` 1.18.5、`@opentui/solid` 0.4.5  
> 原始需求来源：用户提供的《OpenCode 像素宠物插件设计文稿》

## 1. 结论先行

本项目在 OpenCode 1.18.x 上具备“纯 TUI 插件”实现条件：插件可以订阅当前事件流、读取会话状态，并向 `sidebar_content` 注册 Solid/OpenTUI 组件。V1 不需要修改 OpenCode 核心，也不需要 server 插件、MCP、外部守护进程或本地 HTTP 服务。

OpenTUI 的公开 Solid 组件目录目前以文本、布局、输入、代码和 diff 为主，没有稳定的原生 PNG/GIF 图像组件。因此，用标准 Unicode 半块字符承载两个纵向逻辑像素，是视觉密度、终端兼容与工程稳定性的最佳折中。

最终路线：

```text
OpenCode TUI event/state
          ↓
当前会话状态归约
          ↓
七类宠物状态
          ↓
调色板索引像素帧
          ↓
ANSI 前景/背景色 + ▀▄█
          ↓
sidebar_content
```

## 2. OpenCode 扩展能力核实

### 2.1 插件加载与发布

OpenCode 支持项目级与全局插件，也支持从 npm 包自动加载。TUI 插件由 `tui.json` 中的 `plugin` 数组启用；公开社区插件已经在使用这一安装路径。这里的 TUI 专用结论以 1.18.10 标签源码和本机同版本配置/类型为准，不能从通用 server 插件示例反推。

建议的用户配置形态：

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["opco-shigure"]
}
```

V1 只发布 TUI 目标。若包根导出即为 TUI 模块，则用户不需要同时修改 `opencode.json`；也可以额外提供等价的 `/tui` 导出供显式使用。

### 2.2 TUI 插件可用能力

本机安装的 `@opencode-ai/plugin` 1.18.5 类型定义确认了以下能力：

- `api.slots.register(...)`：注册 `sidebar_content` 等宿主插槽。
- `api.event.on(...)`：订阅 OpenCode SDK 事件。
- `api.state.session.status(sessionID)`：读取会话的 `idle | busy | retry` 状态。
- `api.state.session.permission(sessionID)` 与 `question(sessionID)`：恢复等待用户处理的状态。
- `api.kv`：保存显隐、尺寸和动画偏好。
- `api.keymap`：注册命令面板动作。
- `api.theme.current`：读取当前面板和文字色，处理透明背景与对比度。
- `api.lifecycle`：在插件卸载或热重载时释放计时器与监听器。

OpenCode 当前侧栏源码存在 `sidebar_title`、`sidebar_content`、`sidebar_footer` 三个宿主插槽，其中 `sidebar_content` 是可堆叠内容区，适合宠物而不应占用标题或替换底栏。

### 2.3 可用事件

OpenCode 1.18.x SDK 已暴露：

- 会话：`session.status`、`session.idle`、`session.error`。
- 细粒度步骤：`session.next.step.*`、`reasoning.*`、`text.*`、`tool.*`、`retried`。
- 交互等待：`permission.asked/replied`、`question.asked/replied/rejected`，以及 V2 对应事件。
- 兼容事件：`message.part.updated`、`file.edited`、`command.executed`。

状态机应优先使用高语义事件，并把 `session.status` 与当前 pending 状态作为启动/切换会话时的恢复依据，而不是解析助手文本或工具输出。

## 3. 显示技术比较

| 路线 | 视觉能力 | 兼容性 | 动画/布局风险 | V1 结论 |
|---|---:|---:|---:|---|
| ASCII / 普通 Unicode | 低 | 很高 | 低 | 只适合故障占位，不作为主渲染 |
| Braille 点阵 | 中 | 高 | 字体差异明显、颜色分区困难 | 不采用 |
| emoji 彩色方块 | 中 | 中 | 双宽、字体、肤色/彩色 emoji 规则不一致 | 不采用 |
| ANSI 半块 `▀▄█` | 高 | 高 | 需要正确处理前景/背景色和透明像素 | **采用** |
| Kitty/iTerm/Sixel 图片协议 | 很高 | 低至中 | tmux、SSH、清屏、动画更新和协议探测复杂 | V1 排除 |
| 外部 Electron/桌面窗口 | 很高 | 与 TUI 分离 | 安装、进程、IPC、窗口管理成本高 | 与产品定位冲突 |
| 修改 OpenCode Desktop/Web | 很高 | 仅对应客户端 | 不是独立 TUI 插件，维护核心补丁 | V1 排除 |

半块字符的关键优势是：一个终端字符格同时承载上、下两个逻辑像素，24×24 精灵只占 24×12 格；所有输出仍然是 OpenTUI 原生文本与颜色，不需要向终端注入独立图片放置对象。

## 4. 同类项目与差异化

### 4.1 `@zachary0528/opencode-pixel-pet`

已存在的 OpenCode 像素宠物包主打 emoji 方块、四段进化、等级、心情、成就、健康提醒、WebSocket 社交和 AI 自动回答。它验证了用户对 OpenCode 宠物的兴趣，但范围更接近养成与社交插件。

`opco-shigure` 的差异：

- 使用 OpenCode 原生 TUI 侧栏，不在工具调用后输出大段宠物文本。
- 使用半块真彩像素，而非 emoji 方块。
- 只做状态陪伴，不改变 Agent 行为，不向模型加入工具或指令。
- 单角色、高一致性、低干扰，不做成长和数据留存。

### 4.2 OpenPets / Codex Pets / pi-pokepet

这些项目证明了角色包、状态反应和宠物画廊的扩展潜力，也显示出资源校验、安装器、远程下载、IPC、独立窗口与版权元数据会迅速扩大产品面。

V1 因此只在内部保留 `CharacterManifest` 抽象，不承诺第三方格式，不接入画廊，不复用 Codex 8×11 图集合同。OpenCode TUI 的实际显示尺寸与状态语义都不同，直接兼容会增加大量无关复杂度。

## 5. 产品定位

### 一句话定位

面向喜欢终端与角色陪伴感的 OpenCode 用户，以不抢占工作注意力的方式，把当前 Agent 状态变成一个可爱的侧栏像素角色。

### 核心价值排序

1. 状态正确：等待用户、重试、完成和错误不能误报。
2. 低干扰：不遮挡、不发声、不插入聊天、不产生网络活动。
3. 视觉可爱：角色在真实终端尺寸下仍有识别度与动作差异。
4. 稳定轻量：插件或资源失败不能影响 OpenCode。
5. 可维护：明确依赖 OpenCode 1.18+，不维护推测式旧版分支。

## 6. 风险登记

| 风险 | 影响 | V1 对策 |
|---|---|---|
| OpenCode TUI 插件 API 仍快速变化 | 插件升级后无法加载 | 锁定 1.18+；直接依赖官方类型；建立版本冒烟矩阵 |
| 终端字体与颜色差异 | 像素错位、暗色衣服不可见 | 只使用单宽块字符；真彩色主路径；浅/深主题视觉 QA |
| 高频事件导致闪烁 | 宠物状态频繁跳变 | 归约器、活动计数、瞬态最短显示与可打断规则 |
| 会话间事件串扰 | 当前宠物显示其他任务 | 所有事件按 `sessionID` 过滤；切换时重新水合 |
| 暗色制服融入面板 | 轮廓丢失 | 主题感知轮廓色，不改变角色主体调色板 |
| 资源损坏或帧定义错误 | TUI 渲染异常 | 构建期校验；运行时静态 idle 降级；错误隔离 |
| 时雨角色素材公开分发 | 授权、商标、下架风险 | 本轮不阻塞；代码与素材许可分开；发布方承担确认责任 |
| npm 名称可能在开发期被注册 | 安装名冲突 | 2026-08-02 精确公开检索未发现 `opco-shigure`；这不构成名称保留，发布前必须重新查询 registry |

## 7. 资料来源

以下来源均于 2026-08-02 访问：

- [OpenCode 官方插件文档](https://opencode.ai/docs/plugins/)
- [OpenCode TUI 文档](https://opencode.ai/docs/tui/)
- [OpenCode 1.18.10 TUI 插件类型源码](https://github.com/anomalyco/opencode/blob/v1.18.10/packages/plugin/src/tui.ts)
- [OpenCode 1.18.10 侧栏源码](https://github.com/anomalyco/opencode/blob/v1.18.10/packages/opencode/src/cli/cmd/tui/routes/session/sidebar.tsx)
- [OpenTUI Solid 公共组件说明](https://www.npmjs.com/package/@opentui/solid)
- [OpenCode context-progress TUI 插件实例](https://www.npmjs.com/package/@oh-my-sidebar/opencode-context-progress)
- [OpenCode subagent-statusline 打包实例](https://www.npmjs.com/package/opencode-subagent-statusline)
- [现有 OpenCode Pixel Pet](https://www.npmjs.com/package/@zachary0528/opencode-pixel-pet)
- [OpenPets 文档](https://openpets.dev/docs)
- [pi-pokepet](https://pi.dev/packages/pi-pokepet)
- [OpenAI Hatch Pet 规范](https://github.com/openai/skills/blob/main/skills/.curated/hatch-pet/SKILL.md)

版本事实同时由本机只读检查确认：`opencode --version` 为 1.18.10，安装的 `@opencode-ai/plugin/package.json` 为 1.18.5。

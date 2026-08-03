# 体验与状态模型

## 1. 状态模型目标

OpenCode 会在一次任务中快速产生推理、文本、工具、授权、重试和 idle 事件。宠物不能简单地“最后一个事件覆盖前一个事件”，否则会出现工具并发误判、waiting 被文本增量冲掉、success 一闪即逝等问题。

状态模型应维护当前会话的活动事实，再从事实归约出一个可见状态。

## 2. 会话局部事实

建议归约器至少维护：

```ts
type SessionPetFacts = {
  sessionID: string
  cycleActive: boolean
  reasoningActive: boolean
  textActive: boolean
  activeToolCallIDs: Set<string>
  pendingPermissionIDs: Set<string>
  pendingQuestionIDs: Set<string>
  retryActive: boolean
  lastTerminalOutcome?: "success" | "error" | "aborted"
}
```

具体字段和容器可以调整，但必须支持并发计数、pending 等待集合和完整任务周期判断。

## 3. 状态优先规则

从持久事实推导活动状态时使用以下优先级：

```text
ERROR transient override
        ↓
WAITING (permission/question pending)
        ↓
RETRY
        ↓
WORKING (one or more tools/shells active)
        ↓
THINKING (reasoning/text/busy)
        ↓
SUCCESS transient override
        ↓
IDLE
```

说明：

- Error/Success 是带期限的短暂结果，不是持久会话状态。
- 新的用户任务、reasoning、tool、waiting 或 retry 可以立即打断结果动画。
- Waiting 优先于 Working：权限通常由一个工具触发，但用户真正需要看到的是“正在等你”。
- Retry 优先于普通 busy/thinking：倒计时等待不是模型正在思考。
- Working 依赖活动工具集合，不依赖单一布尔值。

## 4. 事件映射

事件名以 OpenCode 1.18.x SDK 为基准。实现应直接使用安装版本的类型联合，不通过字符串猜测未声明事件。

| 事件类别 | 事实变化 | 可见倾向 |
|---|---|---|
| `session.next.step.started` | 开始一次活动周期 | thinking |
| `reasoning.started/ended` | 设置/清除 reasoning 活动 | thinking / 重新归约 |
| `text.started/ended` | 设置/清除 text 活动 | thinking / 重新归约 |
| `tool.input.started`、`tool.called`、`shell.started` | 将 callID 加入活动集合 | working |
| `tool.success/failed`、`shell.ended` | 从活动集合移除 callID | 重新归约 |
| `permission(.v2).asked` | 加入 pending permission | waiting |
| `permission(.v2).replied` | 移除 pending permission | 重新归约 |
| `question(.v2).asked` | 加入 pending question | waiting |
| `question.*.replied/rejected` | 移除 pending question | 重新归约 |
| `session.status: retry`、`session.next.retried` | retryActive=true | retry |
| `session.status: busy` | 周期活跃；没有更具体事实时 | thinking |
| `session.next.step.failed`、`session.error` | 清理活动事实并触发错误 | error 4s |
| `session.next.step.ended` | 记录步骤结束，但不自动判定整轮完成 | 重新归约 |
| `session.idle` / status idle | 若周期正常活跃过则触发成功 | success 2.5s → idle |

### 工具失败

`tool.failed` 触发短暂 error，但后续新的 reasoning/tool 事件可以立即打断它，因为 Agent 可能自行恢复。若最终收到 `session.error` 或 `step.failed`，重新启动完整约 4 秒错误反馈。

### 用户中断

`MessageAbortedError`、显式 interrupt 或可识别的用户取消结果：

- 清理活动工具与临时状态。
- 不显示 success。
- 不显示 error。
- 直接回 idle。

无法可靠判断是否为用户取消时，优先使用 SDK 已声明的错误类型，不匹配错误文本。

## 5. 结果状态时序

### Success

- 仅当同一会话先进入过一个活跃周期，再正常回到 idle 时触发。
- 初次加载一个本来就 idle 的会话不能播放 success。
- 默认持续 2500ms。
- 新 cycle 立即打断。

### Error

- 默认持续 4000ms。
- 新 cycle、waiting 或 retry 可以立即打断。
- 结束后回 idle，除非当前事实推导出其他活动状态。

### 最短显示与防闪烁

- thinking/working 不强制最短停留，以状态真实性为先。
- waiting/retry 持续到对应事实消失。
- success/error 的计时器以 monotonic time 为依据；过期后重新归约事实，而不是无条件写 idle。
- 每次创建新瞬态前取消旧计时器，使用 generation token 或等价方法防止过期回调覆盖新状态。

## 6. 并发工具

以下序列必须保持 Working：

```text
tool A started   active={A}      → working
tool B started   active={A,B}    → working
tool A ended     active={B}      → working
tool B ended     active={}       → thinking 或等待后续 idle
```

重复、乱序或缺少 started 的结束事件必须幂等处理。会话终止、切换或重水合时清空旧集合，不能让幽灵 callID 永久锁住 working。

## 7. 当前会话边界

`sidebar_content` 会提供 `session_id`。每个渲染实例只接受匹配该 ID 的事件：

- 其他根会话忽略。
- V1 不把 child/subagent session 聚合到父会话。
- 路由切换时销毁旧监听上下文或更换过滤 ID。
- 新会话从 `api.state.session.status`、permission 和 question 列表恢复。
- 重水合时不恢复 success/error 计时；只恢复 idle、thinking、retry、waiting。

## 8. 启动与重水合

建议顺序：

1. 读取配置；若 disabled，只注册命令，不启动动画。
2. 获取当前 `session_id`。
3. 读取 pending permissions/questions，存在则 waiting。
4. 否则读取 session status：retry → retry，busy → thinking，idle → idle。
5. 订阅事件并开始增量归约。

读取失败时显示静态 idle，不进行轮询重试，不向用户弹出持续错误。

## 9. 动画语义

| 状态 | 运动语义 | 节奏建议 |
|---|---|---|
| idle | 呼吸、眨眼、发尾/辫子微摆 | 2–4 FPS，平静循环 |
| thinking | 目光上移、轻歪头、辫子轻摆 | 4–6 FPS |
| working | 专注前倾、手部小幅操作、身体稳定 | 4–6 FPS |
| waiting | 抬头看向用户、轻微期待动作 | 2–4 FPS，易读 |
| success | 小幅开心跃起或双手收拢微笑 | 一次性短循环 |
| error | 肩膀下沉、困惑/低落，随后恢复 | 一次性短循环 |
| retry | 稳定的小幅来回确认/重新振作 | 3–5 FPS，可长时间循环 |

动画只负责表达状态，不添加文字气泡、独立星星、问号、速度线、阴影、代码片段或漂浮 UI。

## 10. 布局

### 常规模式

```text
┌──────────────────────────────┐
│                              │
│      24×12 字符格宠物        │
│                              │
│            工作              │
└──────────────────────────────┘
```

### 紧凑模式

```text
┌────────────────────┐
│  16×8 字符格宠物   │
│       工作         │
└────────────────────┘
```

- 宠物水平居中，不改变侧栏固定宽度。
- 标签使用主题普通或 muted 文字色；waiting/error/retry 可使用相应主题色，但不能只靠颜色区分。
- 不显示当前工具名、文件名、错误摘要或倒计时。
- 侧栏隐藏时不在 prompt、footer 或 app overlay 放置替代内容。

## 11. 设置行为

- `enabled=false`：移除宠物区块或返回空内容；命令仍可重新启用。
- `size` 切换：重置动画帧到当前状态首帧，避免跨尺寸索引错误。
- `animations=false`：取消计时器，显示当前状态首帧。
- 重新启用动画：从首帧开始，不追赶禁用期间经过的帧。


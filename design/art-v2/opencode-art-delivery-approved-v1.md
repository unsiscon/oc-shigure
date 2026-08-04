# OpenCode 美术候选交付：时雨 approved-v1

## 与 v0 的关系

`approved-v0` 继续保留，不覆盖、不删除。v1 从 v0 的原始 24×24 像素种子局部修补而来，目标是减少实际半块终端中的横向割裂感。

## 本版只改了什么

- 头顶不再使用独立的连续 `bbbbbbbb` 黑色横条，改为发色像素；
- 只替换非外轮廓的内部 `b`，尽量使用相邻的发色、制服色或材质色；
- 没有重新概括头发、脸、制服、红结、侧辫、袜子和靴子的像素细节。

## 交给开发 Agent 的源文件

```text
design/art-v2/shigure-v3-terminal-seed-24-approved-v1-grid.txt
```

运行期仍然使用现有半块渲染器和 `▀ / ▄ / █`。PNG 只用于视觉验收，不能在运行时解码。

## 视觉验收文件

- 浅色半块预览：`shigure-v3-terminal-seed-24-approved-v1-preview-light.png`
- 深色半块预览：`shigure-v3-terminal-seed-24-approved-v1-preview-dark.png`

这些 PNG 是 24×12 个终端单元的模拟图，不是 24×24 方形像素放大图；应以它们判断 OpenCode TUI 里的横条、轮廓和角色辨识度。

## 验收结果

```text
AUDIT: 1 frame(s), 0 violation(s)
```

本版仍只覆盖 `regular / idle / frame 1`，未修改插件代码，也未替换 v0。若用户不接受 v1，开发 Agent 应回退使用 v0。

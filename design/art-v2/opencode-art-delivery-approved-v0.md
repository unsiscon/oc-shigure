# OpenCode 美术交付：时雨 approved-v0

## 交付结论

这是用户确认“效果还可以”的时雨 24×24 视觉基线，范围为 `regular / idle / frame 1`。它优先保留 v3 终端种子的像素细节，不使用上一版几何化清理稿。

## 给开发 Agent 的唯一入口

读取：

```text
design/art-v2/shigure-v3-terminal-seed-24-approved-v0-grid.txt
```

这份文件是 24 行 × 24 字符的调色板索引源。运行期应继续使用现有的半块渲染器和 `▀ / ▄ / █`，不要把 PNG 当作运行时图片，也不要用方形放大 PNG 判断实际 TUI 效果。

## 视觉验收预览

- 浅色终端预览：`shigure-v3-terminal-seed-24-approved-v0-preview-light.png`
- 深色终端预览：`shigure-v3-terminal-seed-24-approved-v0-preview-dark.png`

两张 PNG 都是 144×144 的终端单元模拟图：24 列 × 12 行，每个终端格包含上下两个逻辑像素。它们比 480×480 方形像素放大图更接近真实 OpenCode TUI。

## 必须保留

- 宽而有层次的深棕长发；
- 左侧红色发饰、双蓝眼和柔和脸部；
- 右侧单条细辫；
- 深色水手服、白色侧板、红色长领结；
- 黑袜、深红棕短靴、短肢和低重心。

## 版本保护

`approved-v0` 已冻结。后续美术修改只能新建 `approved-v1` 或更高版本，禁止覆盖 v0 文件。若新版本未达到 v0 的视觉效果，开发 Agent 继续使用 v0。

本交付不修改插件代码，也不宣称其他六种状态已经完成；它只提供一个可接入验证的 idle 基准帧。

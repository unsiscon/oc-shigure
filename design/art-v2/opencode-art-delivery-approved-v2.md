# OpenCode 美术候选交付：时雨 approved-v2

## 目标

v2 以 v1 为基础，针对实际 OpenCode 半块终端截图中仍然明显的横向深色长条做局部纹理修补。它不修改渲染器，也不覆盖 `approved-v0` 或 `approved-v1`。

## 本版改动

- 将连续的深色发影/发基段拆成错位的 `0/1/2` 发丝纹理；
- 减少躯干、裙摆和腿部的长距离暗色连续段；
- 保留 v1 的头顶修补；
- 保留宽发、蓝眼、红发饰、侧辫、白侧板、红长领结、袜靴和低重心。

## 交付入口

```text
design/art-v2/shigure-v3-terminal-seed-24-approved-v2-grid.txt
```

PNG 只用于视觉验收，运行期仍使用现有索引矩阵和 `▀ / ▄ / █` 半块渲染器。

## 预览

- 浅色半块预览：`shigure-v3-terminal-seed-24-approved-v2-preview-light.png`
- 深色半块预览：`shigure-v3-terminal-seed-24-approved-v2-preview-dark.png`

## 机器结果

```text
AUDIT: 1 frame(s), 0 violation(s)
```

本版仍只覆盖 `regular / idle / frame 1`。接入前请让开发 Agent 在实际 OpenCode 侧栏中验证横条是否继续可接受；如果仍需调整，创建 `approved-v3`，不要直接改 v2。

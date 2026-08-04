# Udecisions — opco-shigure-art-terminal-fix

_Append-only. Never overwrite._

---

## 2026-08-04 — todo 4 D9 escalation
- qwen2.5vl:7b passed health probe but failed 3x grid format validation → D9-UPGRADE per plan d9/d13.
- Real multimodal-looker subagent unavailable to Sisyphus executor AND root (model doesn't support tools / qwen endpoint limitations).
- probe-1.md remains the todo-3 test fixture placeholder; verdict file written with status: awaiting-user + 3 options (user pixel grid / stronger model or human art / accept current).
- If user picks option ①, their 24×24 grid goes through makeFrame validation + audit-gate before continuing.

## 2026-08-04 — 用户选择方案 A（云端 looker）+ 成本 checkpoint
- 用户已把 multimodal-looker 配置从 qwen-vl-local/qwen2.5vl:7b 换成 dashscope/qwen3.7-plus（fallback 保留本地 7b），omo.jsonc 于 18:30 更新。
- 用户决定：执行到 todo 6 完成后暂停（成本 checkpoint），todo 7/8/9 纯代码/验证不烧视觉成本，届时再决定。
- 方案 B（用户用 Codex 手动美术迭代）作为兜底：若云端模型探针仍 3x format-fail → 切 B，按 d9 选项①②处理。
- 本次先跑 todo 4 健康探针 + 单帧探针（有界重试 ≤3）实证验证新模型。

# Uproblems — opco-shigure-art-terminal-fix

_Append-only. Never overwrite._

---

## 2026-08-04 — BLOCKED: todo 4 awaiting user D9 decision
- Looker (qwen2.5vl:7b) health probe PASS, but grid generation 3x format-fail → D9-UPGRADE triggered.
- Real multimodal-looker agent: "does not support tools" (model limitation).
- Todo 4 marked `- [~]` in plan. Todos 5-9 transitively blocked:
  - 5/6 art redraw needs the decision (①user grid / ②stronger model / ③accept current)
  - 7 outline restore MUST wait for clean art — restoring #F7F2EA on dirty art reintroduces white dots (plan's deliberate ordering)
  - 8/9 depend on 7
- Resume protocol: user writes decision to .omo/evidence/art-loop/probe-1-verdict.md or replies; continue from checkpoint.

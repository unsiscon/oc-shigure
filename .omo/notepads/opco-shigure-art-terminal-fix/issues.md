# Uissues — opco-shigure-art-terminal-fix

_Append-only. Never overwrite._

---

## 2026-08-04 — todo 3
- TypeScript LSP remains unavailable because installation was previously declined; `npx tsc --noEmit` is the diagnostics substitute and passes.
- The current v4d assets intentionally remain noisy, so the default and scoped audit commands exit 1 until later art todos replace the frames. The valid probe grid exits 0.

## 2026-08-04 — todo 5 gate FAIL on approved-v0
- User briefing assumed approved-v0 "已通过机器验收" pointing at seed24-fix-verdict.md — but that verdict belongs to seed24-fix-grid.txt. approved-v0 is the raw v3 seed and fails all three machine gates (104 audit violations, 0 eyeBlue, edge b). Documented in task-4-failure.txt + both verdict files (attribution clarification appended).
- Consequence: todo 5 cannot write approved-v0 to final.ts as-is (would break validateManifest + crash patchFirst blink + fail 135 tests). Must loop: approved-v1 via Codex round 2.

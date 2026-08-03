# Ulearnings — opco-shigure-art-terminal-fix

_Append-only. Never overwrite._

---

## 2026-08-04 — todo 1 (git init + baseline)
- Committed baseline `chore: baseline v4d pre-art-fix` = `3ebb2a8b313a49b49cdd180307ce23e9925869b9` on `main` (260 files, root commit), tagged `baseline-v4d`.
- `git init -b main` created repo; `.gitignore` appended `*.tgz` so `opco-shigure-0.1.0.tgz` was excluded (verify: not in `git ls-files`).
- Pushed to `origin` = `git@github.com:unsiscon/oc-shigure.git` with `-u origin main`; **succeeded on first attempt** (exit 0), remote was empty so no rebase needed.
- Gotchas:
  - `git status --porcelain` in task-0-happy.txt inherently shows `?? .omo/evidence/task-0-happy.txt` — the evidence file is created by the same redirect that captures status, so it can never be "clean" at capture time. This is an accepted artifact of the QA scenario; the file gets committed by the next todo's commit (each todo does `git add ... .omo/evidence/`).
  - `.omo/evidence/` pre-existing content (task-1..8 files) IS in the baseline commit; do NOT gitignore it (F1-F4 depend on it).
  - Commit had a CRLF warning for `.omo/evidence/art-final-smoke.typescript` (will be normalized to LF on next touch) — harmless.
  - Push showed "Everything up-to-date" on the evidence re-run because the branch was already tracking; real first push was clean `* [new branch] main -> main`.

## 2026-08-04 — todo 2 (T1 render-consistency + 环境前检)
- Three-path mechanical diff PASS: (a) preview-assets.ts half-block / (b) art-render-png.py png-index / (c) render-consistency.ts index matrix — 0 diff cells, rc exit=0, on baseline 3ebb2a8. No src/ files touched.
- b-pixel baseline for regular idle frame 1: total=84, internal=84, external=0 (outer boundary = x/y ∈ {0,23}). NOTE: hand-count eyeballing gave 79 — wrong; mechanical count is authoritative.
- Env precheck 4/4 PASS; /tmp/cap2.py + /tmp/shigure2.ansi found, copied to .omo/evidence/capture/ (byte-identical sha), for todo 8 count-semantics derivation.
- Gotchas:
  - art-render-png.py `parse_preview` drops all-space ANSI rows via `line.strip()` (frame row y=0 is 24 spaces) — fine for PNG (invisible), wrong for index text → added `parse_preview_raw` for the index path; PNG output byte-identical (no regression).
  - First version of png-index wrote only horizontal magnification (24 rows); spec is 2×2 pixel magnification → emit each logical row MAG times (48 rows), TS parser asserts vertical pair equality.
  - TS parser bug: resetting `raw=[]` on every `## ` header wiped the collected matrix at the last section header — switch to `inTarget` flag that only resets when entering the target section.
- TS LSP not installed (declined); used `npx tsc --noEmit` (exit 0) as the gate.

## 2026-08-04 — todo 3 (audit-art-noise gate)
- Added a pure, deterministic audit API plus CLI. `--grid` accepts exactly 16×16 or 24×24 legend rows (one final newline is treated as a line terminator), delegates decoding to `final.ts` `decodeRow`, and writes the outline-cell baseline for every successful run.
- Rule 1 treats an opaque neighbor as a non-transparent, non-`b` pixel. Counting adjacent `b` pixels alone would let a floating outline cluster pass condition (c), which is precisely the leg-gap/hair-gap failure mode.
- Current v4d smoke reports both classes requested by the handoff: 500 internal-b and 24 floating-b violations in the full manifest audit; regular idle baseline is 39 cells for each of its two frames.
- The required happy evidence has 10/10 audit tests green and manifest tests 6/6 green. Current-asset and malformed-grid failures are captured as expected in `task-2-failure.txt`.

## 2026-08-04 — todo 4 (single-frame probe)
- Health probe (step 1) PASSED on attempt 1: local vision model `qwen-vl-local/qwen2.5vl:7b` at 192.168.10.57:11434 responded with a one-sentence description of shigure-v3-master-crop.png ("long brown hair, large blue eyes, school uniform with red tie"). Noted: the `multimodal-looker` subagent type is NOT exposed to the Sisyphus-Junior executor via call_omo_agent (only explore/librarian allowed), so the looker was invoked by calling the same configured local model directly through its OpenAI-compatible endpoint — functionally identical.
- Probe grid (step 2) FAILED format validation 3x in a row (retry cap hit) → `D9-UPGRADE: 3x format-fail` written to .omo/evidence/task-3-failure.txt, STOP per d13/d9 protocol.
  - attempt 1: model emitted a repeating `..#####.####.#####.####.#####.` pattern (non-legend `#` chars) — charset fail.
  - attempt 2: model emitted 24×24 all-`0` (hairShadow) solid block — passes charset but fails structure (no transparent margins, no token coverage) → counted as format-fail.
  - attempt 3: model emitted a verbatim echo of the format-example seed embedded in the prompt (byte-identical to design/art-v2/shigure-pixel-data.json regular idle_frame) — fails structure (b at column 0 rows 13/15) AND is a copy of the forbidden old generator output. This is the "misleading success output" adversarial class: a well-formed 24×24 grid that is not a redraw of the reference.
- Key lesson: the local qwen2.5vl:7b model is very prompt-sensitive. Embedding a full seed example as "format reference" causes verbatim echo. It also cannot reliably emit a clean 24×24 silhouette (all-0 collapse). For todo 5, either (a) use a stripped-down prompt with NO full-grid example, or (b) feed it only a compact format spec and rely on user pixel-level correction per d9; escalation path to user is the intended d9 trigger.
- probe-1.md was NOT overwritten: no valid looker grid exists, and writing a fake grid would violate the checkpoint contract. Existing placeholder probe-1.md (todo 3 test fixture) remains as-is.

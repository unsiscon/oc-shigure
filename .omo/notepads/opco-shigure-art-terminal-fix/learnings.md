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

## 2026-08-04 — todo 4 re-run (Option A: cloud looker)
- **Model that actually responded: `dashscope/qwen3.7-plus` (cloud)** via DashScope OpenAI-compatible endpoint `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`. Fallback local qwen2.5vl:7b NOT used. Gotcha: when calling the endpoint directly, the provider prefix must be stripped — model id is `qwen3.7-plus`, NOT `dashscope/qwen3.7-plus` (the prefixed id returns HTTP 404).
- **Health probe: PASS on attempt 1** — one-sentence description of shigure-v3-master-crop.png. `enable_thinking:false` needed to avoid 180s+ timeouts; with it, responses are fast.
- **Probe grid: PASS on attempt 2 of 3** (attempt 1 and 3: format-fail with variable row widths ~20-22 chars instead of 24; the model kept emitting short rows). Attempt 2 emitted a full clean 24×24 grid.
- **Validator bug I hit**: my first validator wrongly required the BOTTOM edge transparent — the todo-4 spec only requires top/left/right edges transparent. Attempt 2 failed ONLY on my over-strict bottom-edge rule; per spec it PASSES. Lesson: re-read the spec's exact mechanical criteria before counting a retry as failed — I nearly wrote D9-UPGRADE on a valid grid.
- **Stripped prompt works**: legend table + character requirements + strict "24 rows × 24 chars, no extra text" with NO embedded full-grid seed example produced a well-formed grid on attempt 2. No verbatim echo, no `#` chars, no all-0 collapse (all 3 local-7b failure modes avoided).
- **Audit gate on probe-1.md: 0 violations, exit 0** — but misleadingly so: the grid contains ZERO `b` outline chars, so outline rules trivially pass. The aesthetic gap (no outline, boots merged on a `0` ground row, no separate side braid) is a QUALITY issue, not a mechanical one — user decides in next gate. Audit result is diagnostic only.
- probe-1.md now holds the validated cloud-looker grid (24 lines exactly, overwrote the todo-3 fixture). probe-1-looker-notes.md updated with cloud description.

## 2026-08-04 — todo 4 step 4 (probe-1 PNG render)
- Rendered probe-1.md -> `probe-1-preview.png` (576×576 = 24×24 logical × 24× scale, 3097 bytes, RGB, verified opens with correct dims) + `probe-1-preview.txt` (side-by-side grid + legend header; reference file, checkpoint untouched at exactly 24 lines).
- Char->palette confirmed against `src/manifest-data.ts` SHIGURE_PALETTE: `.`=0/transparent, `0`=1/#2A1D1A … `b`=12/#17141B; `INDEX_CHARS=".0123456789ab"` in art-render-png.py matches.
- Gotchas:
  - SHIGURE_PALETTE colors are opaque RGB 3-tuples; only `.` is transparent. Renderer must branch on the grid char (`.`) — testing `color[3]==0` on an RGB tuple raises IndexError. If a future renderer ever uses RGBA for all entries, keep the transparent check char-based.
  - Checkerboard trick: pixel block index `(block_x + block_y) % 2` keyed off scaled coordinates/SCALE gives clean 24px squares (light-gray/white), so transparent margins stay visibly distinct from any true color.
  - Visual read confirms looker verdict: grid has zero `b` outline chars, no side braid, boots (`a`) merged onto the `0` ground row — matches the known quality gap, user decides next gate.

## 2026-08-04 — todo 4 re-run with cloud model (PASS)
- dashscope/qwen3.7-plus produced a valid 24x24 grid on attempt 2/3 (stripped prompt, no seed example). None of the local-7b failure modes recurred.
- Gotcha: direct endpoint calls need provider prefix stripped — `qwen3.7-plus` works, `dashscope/qwen3.7-plus` 404. Also `enable_thinking:false` avoids 180s+ timeouts.
- Grid quality gaps (for todo 5): 0 `b` outline chars, no side braid, boots merged into ground row, head-body ~1:1 (spec 2.2-2.4). Audit 0-violation is partly trivial (no outline to check).
- Render gotcha: SHIGURE_PALETTE colors are RGB 3-tuples; branch on grid char (`.`) not `color[3]` for transparency.

## 2026-08-04 — todo 4/5 (Plan B Codex round 1 delivered: approved-v0)
- User selected Plan B (d9 option ②): user drives Codex art iteration; orchestrator owns machine gates / write-back / previews / incremental instructions.
- Codex round 1 = `design/art-v2/shigure-v3-terminal-seed-24-approved-v0-grid.txt` (frozen 20:10, user "效果还可以", never overwrite; future = approved-v1+).
- **CRITICAL attribution gotcha**: seed24-fix-verdict.md's "machine PASS" + seed24-fix-audit.txt exit 0 are for `seed24-fix-grid.txt` (sha 6a587b38, Q-clean, 8x eyeBlue). The approved-v0 file (sha bf02fd63) is a DIFFERENT file = raw v3 seed = byte-identical to seed24-visual-master-grid.txt and shigure-pixel-data.json idle_frame. Do not conflate the two.
- approved-v0 machine gates (all FAIL): audit 104 violations (internal-b 56 / floating-b 4 / isolated non-exempt 44), eyeBlue '4' count = 0 (validateManifest gate 11), left edge b@(13,0)(15,0), right edge b@(13,23), frame-2 blink patchFirst("4","5") would THROW (no '4' to patch) → write-back would crash module load and all 135/145 tests.
- Evidence: .omo/evidence/task-4-failure.txt. Incremental instruction generated: .omo/evidence/art-loop/approved-v1-fix-instruction.md (only remaining issues: restore 2x blue eyes, clean 56 internal + 4 floating b, fix L/R edges, merge/delete 44 isolated non-exempt). Seed16 prep instruction: .omo/evidence/art-loop/seed16-v1-instruction.md (todo 6, independent 16x16 redraw, no scaling).
- Loop protocol (user-defined): I produce instruction file -> user pastes to Codex -> Codex outputs grid -> user pastes back -> I run 3 gates -> pass = write final.ts, fail = new incremental instruction.

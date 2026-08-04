# probe-1 looker notes (cloud model)

- Responding model: `dashscope/qwen3.7-plus` (Alibaba DashScope, cloud; fallback `qwen-vl-local/qwen2.5vl:7b` NOT used)
- Endpoint: https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions (OpenAI-compatible; provider prefix stripped from model id)
- Health probe: PASS on attempt 1. Reference: `design/art-v2/shigure-v3-master-crop.png`

## Health-probe description (one sentence, verbatim)

> This pixel-art character features long, wavy dark brown hair and large blue eyes, and is dressed in a white top with a red tie, a dark skirt with red and white trim, and matching wristbands.

## Probe grid

- Produced on attempt 2 of 3 (attempt 1: variable row widths → format-fail; attempt 2: full 24×24 grid → mechanical PASS; attempt 3: variable row widths → format-fail)
- Prompt style: stripped-down legend table + character requirements + strict "24 rows × 24 chars, no extra text" instruction; NO embedded full-grid seed example.
- Grid written to `.omo/evidence/art-loop/probe-1.md` (24×24, validated).
- Known aesthetic caveat (diagnostic, user decides next gate): no `b` outline characters emitted; boots sit on a bottom `0` ground row (bottom edge not required transparent by todo-4 spec); ribbon is a large red block, no separate side braid pixels.

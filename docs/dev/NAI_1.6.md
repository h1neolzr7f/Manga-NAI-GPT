# 1.6 NovelAI path — design notes and status

Principle: the editor is content-neutral. The app adds nothing to and removes nothing from NovelAI prompts or images; the
user's own NovelAI account and its rules decide. Optional "安全模式" (off by default) only appends `nsfw` to the negative prompt.
Audit (2026-10-11): `NovelAIProvider`, `/nai-proxy/*` (99_server.py `_normalize_novelai_body` only clamps size/steps/n_samples
for the Opus free tier), the composition director and the auto-prompt utilities contain no NSFW filtering or tag stripping.

## Landed on dev/1.6

| Item | Where | Test |
|---|---|---|
| NAI engine: one queue (NAI allows one generation at a time), 1.5 s spacing, retry 429/5xx with backoff, 3 min timeout, zip/JSON unpack | `js/ai/nai-engine.js` | nai-route-e2e |
| Free-tier sizing (≤1 MP, 64-multiples, aspect kept), steps ≤28, 1 image; Anlas estimate + Opus-free indicator before calling | `js/ai/nai-engine-core.js` `sizeFor` / `cost` | nai-engine-core-test |
| 改一块 → NovelAI inpaint (V4.5/V4/V3 inpainting models, mask, 3 queued candidates, seeds stored on the layer) | `js/ai/ai-fill.js` | nai-route-e2e |
| 画一页 / 剧本成页 → NovelAI per panel, size from the frame aspect, seed lock, stop on first failure, cancel | `js/ui/task-launcher.js` | nai-route-e2e |
| Engine choice per task (GPT / NovelAI), remembered; NovelAI default when GPT is not configured | `NaiEngine.preferred/remember` | nai-route-e2e |
| GPT content-policy refusal → neutral message ("服务方的规则，不是本编辑器的限制") + one click 改用 NovelAI | ai-fill / task-launcher | nai-route-e2e |
| V4 multi-character prompts with positions; 角色库 characters with tags named in a panel scene become character prompts, placed right-to-left | `payload`, `libraryCharacters` | nai-engine-core-test |
| 隐私模式: blur history / page / layer / candidate thumbnails (hover to see) | ⋯ menu | nai-route-e2e |
| Model + safe mode in 服务设置 | service-settings.js | nai-route-e2e |
| Prompt assist (opt-in): offline Danbooru tag autocomplete with aliases, 查标签, 润色 / 扩写 via the configured chat model with diff review | prompt-assist*.js | prompt-assist-core-test, prompt-assist-e2e |
| Ctrl+↑ / Ctrl+↓ tag weights (`1.1::tag::`), approximate token counter (no tokenizer bundled) | prompt-assist.js | prompt-assist-e2e |
| Read NovelAI PNG info → apply positive / negative / all; save as style snippet (shown in 角色库 and the 画一页 style box) | Ctrl+K「从 NovelAI 图片读取参数」 | nai-engine-core-test, prompt-assist-e2e |
| Export metadata: page PNG/PSD exports are re-rendered from the canvas, so NovelAI text chunks are never carried over. Project files (`.lz4`) keep the original images and stay local. | — | — |

## Ported from the author's own NaiXueZhang-Studio-Upgrade (MIT)

- `char_tag_index.json` as an optional, user-confirmed 11 MB download for 角色库「找标签」(pinned commit, SHA-256, IndexedDB).
- "Unknown result → no automatic retry": a timeout or a dropped connection after the request was sent is reported as
  unknown and never retried automatically (only explicit 429 / 5xx answers are retried).
- Not ported: `tag_dict.json` (spot checks found misaligned translations, e.g. `Mon3tr` → an unrelated tag), the 闲云 /
  xianyun third-party channel (nothing similar exists here), pixiv crawlers / uploaders, `estimate.py` (it estimates
  crawler ETA, not Anlas — the Anlas estimate here is our own `NaiEngineCore.cost`).

## V5

`nai-diffusion-5-full` verified with one free Opus call (2026-10-11; `nai-diffusion-5` returns 400 "doesn't exist").
Its inpainting model id is not verified, so 改一块 with V5 selected uses the V4.5 inpainting model (shown in 服务设置).

## Not done yet (honest list)

- NovelAI "enhance" (upscale + light img2img; above 1 MP it costs Anlas).

- 换角色 via NovelAI (inpaint + vibe transfer / precise reference with cost shown).
- Per-panel saved generation params and "result returns to its panel after a page switch" for the wizard path (the pro-mode provider already does the latter).
- Local gallery of generations with full metadata, groups and search.
- A metadata **keep** toggle (to embed NovelAI info into exported PNGs) — exports currently always strip.
- Exact token counts (V4 T5 tokenizer not bundled; the counter is an estimate).
- Tag implications (the licensed tag list has aliases only).

## Competitor notes

Design ideas compared against a public AGPL-3.0 NovelAI web client (ideas only; no code or data copied, and no TLS
fingerprint tricks): per-model parameter visibility, pre-call Anlas estimate, recommended panel resolutions, image-info
apply buttons, style snippets, weight hotkeys, token counter, sequential batches with spacing and stop-on-failure, gallery.

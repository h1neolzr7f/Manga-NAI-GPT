# Smoke 1.6.2 backends — OCR refine + manga LaMa

Page: `docs/images/comic-page.jpg` (1000×1417)

## OCR (Tesseract auto vs + manga-ocr refine)

| # | Ground truth | Baseline (Tesseract) | + manga-ocr | CER base | CER refined |
|---|---|---|---|---:|---:|
| 0 | 啊……下雨了。 | 咽下雨了。 | 『．．．下雨了。 | 0.429 | 0.571 |
| 1 | 要一起走吗？ | 一起走? | 要一起走９？ | 0.5 | 0.167 |
| 2 | 伞忘在家里了…… | 了里家在…人 | 傘忘在家里了．．． | 0.75 | 0.5 |

- Mean CER baseline: **0.56**
- Mean CER refined: **0.413**
- Timing: baseline 4.5s, refine pass 90.07s (CPU)
- Files: `ocr-baseline.jpg`, `ocr-refined.jpg`
- Notes: manga-ocr reads Japanese-leaning glyphs (「傘」「．．．」); still clearly closer on the vertical umbrella line and restores 「要」 on the walk bubble. CER is character-level vs Simplified Chinese GT, so Japanese variants inflate refined CER on some lines even when human-readable quality improves.

## Inpaint (trees/fence crop)

Crop box `[760, 60, 960, 240]` (page coords). Mask coverage 0.244.

| Engine | MAE inside mask | MAE outside | luma std inside (texture) | sec |
|---|---:|---:|---:|---:|
| stock LaMa | 22.92 | 0.0 | 103.02 | 7.53 |
| manga LaMa | 14.74 | 0.0 | 102.2 | 32.92 |

- Files: `inpaint-source.png`, `inpaint-mask.png`, `inpaint-lama.png`, `inpaint-lama-manga.png`, `inpaint-sbs.png`
- Manga LaMa stayed closer to source tones inside the mask (lower MAE) with similar texture std; outside MAE 0 (compose intact).

## Won't integrate (this PR)

- **PP-OCRv6_manga**: Needs custom det+rec ONNX pipeline; keep CTD. Apache-2.0 OK for later optional detector.
- **Baberu OCR**: Extra transformer OCR; manga-ocr already installed and enough on this page.
- **AOT (manga-image-translator)**: Heavy dependency tree; TorchScript anime-manga-big-lama via SimpleLama is smaller.

No NovelAI/GPT calls. No secrets. Weights stay in local cache (not Git).

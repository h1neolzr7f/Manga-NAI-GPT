# Smoke 163 — v1.6.3 real-page backends

Page: `docs/images/comic-page.jpg` (1000×1417).

## OCR

| | baseline | refined |
|---|---|---|
| engine | tesseract-local | tesseract-local+manga-ocr |
| seconds | 1.46 | 8.71 (warm 10.57s) |
| regions | 3 | 3 (refinedCount=3, suspects=1) |
| mean CER (3 GT lines) | 0.56 | 0.413 |

Rows: see `report.json`.

## Inpaint (crop (760, 60, 960, 240))

| engine | mae_inside | mae_outside | sec |
|---|---|---|---|
| lama (simple-lama-local) | 45.83 | 0.0 | 3.83 |
| lama-manga (simple-lama-manga-local) | 38.43 | 0.0 | 7.99 |
| auto (simple-lama-manga-local) | 38.43 | 0.0 | 6.73 |

## Verdict

- OCR improved vs baseline: **True** (0.56 → 0.413)
- Manga LaMa ≤ stock MAE: **True**
- `auto` picks manga when cached: **True**

Artifacts also under `/workspace/smoke-163/`.

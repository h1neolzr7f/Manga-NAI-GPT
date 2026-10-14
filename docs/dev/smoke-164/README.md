# Smoke 164 — v1.6.4 气泡填底色 / 轻量打包

Page: `docs/images/comic-page.jpg` crop `(760,60,960,240)`.

## 去字

| 引擎 · 蒙版 | 结果 | 秒 |
|---|---|---|
| `auto` · glyph（字旁白底） | **bubble-fill-local** | ~0.3 |
| `auto` · loose（旧矩形蒙版盖到画面） | **lama-manga**（回退） | ~12 |
| `bubble` · glyph | bubble，描边保留，字涂成气泡纸色 | ~0.2 |
| `lama-manga` · glyph（对照） | 漫画 LaMa | ~9 |

对照 v1.6.3：同 crop 上 lama-manga MAE≈38、约 8s。气泡路径在**字在纯色气泡内**时更快且不用模型。

## 打包策略

- **内置**：comic-text-detector ≈91MB（GPL-3.0）
- **应用内下载**：漫画 LaMa 196MB、通用 LaMa 197MB、SAM2 tiny 149MB、Manga OCR 424MB
- 不打包 CCIP（OpenRAIL）；未接 MobileSAM

Artifacts also under `/workspace/smoke-164/`.

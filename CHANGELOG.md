# Changelog

Version numbers apply to **this fork only**, not to upstream Manga Editor Desu.

## Unreleased

## 1.6.3 — 2026-10-14（实机质量抛光）

### 中文
- **OCR**：manga-ocr 精修仍为检测后的默认可靠路径；竖排气泡加大左右留白；可疑结果黄标「建议核对」；已缓存时后台预热模型；UI 默认与 smoke 一致。本轮仍不接入 PP-OCR（避免 NC / 重依赖）。
- **去字 / AI 填充**：去掉杂物默认走 `engine=auto`（有漫画 LaMa 用漫画，否则通用）；蒙版边缘略膨胀 2px 便于接缝。
- **UX**：启动页「Sun network」改为 Standby（不再吓人 Failed）；换角色在打开服务设置前说明需 GPT；人物识别未就绪时不再刷 501。
- **SAM**：导入页后若权重已缓存，可选预热页面 embedding。
- **回归**：`docs/dev/smoke-163/` 对 `comic-page.jpg` 复测；审计状态仍为 120/120。

### English
- OCR: manga-ocr refine remains the default post-detect path; better vertical crop padding; suspect yellow flags; warm when cached. No PP-OCR this release.
- Inpaint: AI Fill「去掉杂物」uses `engine=auto` (manga LaMa when cached); +2px mask soften.
- UX: softer splash; swap explains GPT before settings; no characters 501 spam when runtime missing.
- SAM: optional page-import embedding preload when weights cached.
- Smoke: `docs/dev/smoke-163/`. Audit table still 120/120 fixed.


## 1.6.2 — 2026-10-14（全面审计修复）

关闭 [2026-10-13 全量审计](docs/dev/audit/2026-10-13-full-audit.md) 全部 **120** 条已确认缺陷（PR #6–#37）。中文在前，English 在后。

### 中文
- **数据与历史**：同页缩略图不再回滚编辑；复制/撤销/切页与 canvasGuid 一致；压缩期间「已保存」不再误标；生成任务按唯一键记录，取消后迟到结果不回贴。
- **自动保存与工程**：项目签名含页序与 blob 身份；ZIP/lz4 扁平页与 DEFLATE 解压；素材索引写入成功才算成功，包导入全有或全无。
- **付费与队列**：NovelAI / AI Fill /「画一页」统一排队；超时覆盖响应体读取，结果未知不自动重发；前端与代理最长边统一 1536。
- **安全**：无系统代理时出站 DNS 解析校验并固定；抠图临时文件短随机名；安装/本机端口与 Windows 探测一致；焦点陷阱在 IME 组合输入时不误关。
- **本机模型与抠图**：人物模型原子加载；SAM/LaMa 取消与蒙版快照；智能点选完整哈希与精确 mask；选区/页面钉住，切页丢弃旧结果并提示。
- **OCR / 气泡 / 文字**：同字合并与分行、竖排输入与 IME 高亮、字体持久化失败提示；自由气泡合并保留原对白。
- **导出与 UI**：栅格导出隐藏辅助框并恢复画布；PSD AI Fill 用 live 位置；页面效果/网格不再 clearRect 擦下层；仪表盘脚本重试、统计串行、历史最长连续天数。
- **模拟器 / Studio / 导演**：聊天头像不再被默认圆遮挡；剧情/Studio 字段与播放索引；导演迟到响应不覆盖新编辑，草稿仅在显式勾选时保存。

### English
- Closes all **120** confirmed findings from the 2026-10-13 full audit (PRs #6–#37).
- Hardens page/history/autosave identity, ZIP/lz4 load, asset index commits, and cancel-safe paid queues (no auto-retry on unknown results).
- Security: DNS pinning without system proxy, short temp names, consistent local-tools port, IME-safe focus trap.
- Local AI: atomic model publish, SAM/LaMa cancel + mask snapshots, full-page hash and precise masks, page-pinned apply.
- OCR/balloons/vertical text/IME/font persistence; export helpers restored after PNG/PSD; page studio no shared-ctx clearRect; dashboard retry/serialize/streak history.
- Simulator avatar visibility, Studio/story fidelity, director stale-response guards and opt-in draft storage.

## 1.6.1 — 2026-10-13（稳定性修复）

- 修复选中图层时工具栏重排导致的画布跳动、小图/横向页缩放尺寸异常，以及文字聚焦的嵌套滚动回退。
- 修复换角色背景保护退化；变化掩模失败时仅覆盖人物轮廓与有限扩展，首格与批量共用服装设置。
- 修复色调保护抹除局部提亮、细线变化丢失；明显上下文重构的候选保留预览，应用前需显式检查，批量会暂停。
- 修复关闭、取消、切页、重复点击、解码延迟期间的旧结果插入和旧页请求；超时覆盖完整响应体，结果未知时停止批量。
- 画一页增加每格人物/空镜选择、新系列重置、角色档案加载与任务参数快照、跨页复用种子；消除默认网点正负词冲突，并支持无凭据时先选择引擎。
- 修复导出失败清理、参考图读取错误与格式/大小限制、普通漫画页“选中整页”、Python 测试入口及版本显示。
- 增加零费用像素与生命周期回归、真实浏览器响应式布局检查。真实图像服务未配置，本修复不承诺模型人物身份或姿势绝对一致。
- 修复 Windows 标签构建触发、安装器说明文件路径和支持链接；便携版从已准备的运行环境打包，并检查 Python/Node 是否包含在 ZIP 中。

## 1.6.0 — 2026-10-12

NovelAI 版本。中文在前，English 在后。

### 中文
- **NovelAI 也能做「改一块」「画一页 / 剧本成页」**：每个任务可切换 GPT / NovelAI，只配了 NovelAI 时默认用它；GPT 服务拒绝时提示「改用 NovelAI」。
- **支持 NovelAI V5**（`nai-diffusion-5-full`，已实际调用验证），以及 V4.5 / V4 / V3；服务设置里说明每个模型支持什么（角色栏、位置、局部重绘）。
- **内容中立**：编辑器不改写、不过滤 NovelAI 提示词；「安全模式」可选，默认关。
- **生成前显示 Anlas**，Opus 免费范围内标「免费」；默认按免费范围出图（≤1024×1024、≤28 步、1 张），按格子比例自动选尺寸。
- **排队和重试**：NovelAI 一次只跑一张，间隔排队；只在明确的 429 / 5xx 时重试；**结果未知（超时、断线）不自动重试**；批量中途失败就停。
- **画一页**：可锁定种子；角色库里写了标签的角色会自动放进 V4 角色栏，按从右到左排位置。
- **隐私模式**：模糊历史、文件和候选缩略图。
- **提示词助手（可选，默认关）**：Danbooru 标签补全、别名修正、标签检查；`Ctrl+↑/↓` 调权重；token 估算；读 PNG 生成参数并一键应用或存成风格片段；角色库「找标签」（可再下载 11 MB 扩展角色表）；可选用你自己的聊天模型润色 / 扩写，先看对比再应用。标签表和角色表都要你确认后才下载，并校验 SHA-256。
- **修复**：「画一页」连续生成时，上一页的「整页完成」不会再被当成这一页的结果。

**已知限制：** 选 V5 时局部重绘暂用 V4.5 重绘模型；换角色仍只支持 GPT；NovelAI enhance、本地图库、每格保存参数还没做。

### English
- NovelAI route for *Edit an area* and *Draw a page / script → page*, per-task engine switch, "use NovelAI instead" when GPT refuses.
- NovelAI V5 (`nai-diffusion-5-full`, verified with a real call) plus V4.5 / V4 / V3, with per-model hints.
- Content-neutral: no prompt filtering by the editor; optional safe mode, off by default.
- Anlas estimate before each call with a "free" marker for the Opus range; free-range sizes by default.
- One-at-a-time queue, retries only on explicit 429 / 5xx, no automatic retry on unknown results, batch stops on failure.
- Seed lock and character-library tags → V4 character prompts in *Draw a page*; privacy mode; optional prompt assist (Danbooru tags, weights, PNG info, find-tag, LLM polish with diff).
- Fix: a stale "page done" status no longer stands for a new *Draw a page* run.
- Known limits: V5 inpainting falls back to V4.5; character swap is GPT-only; NovelAI enhance, local gallery and per-panel saved parameters not done yet.

## 1.5.0 — 2026-10-11

Minor update (not a 2.0). Chinese notes below; English summary after.

### 中文
- **改一块**：把「修瑕疵 / AI 填充 / 自定义修改」合成一个新手入口，预设「去掉杂物」（本机 LaMa，免费）、「换成…」、「自由修改」（GPT 3 张候选）；旧向导仍可在 Ctrl+K / 专业模式打开。首页任务 6 个。
- **角色库**：参考图 → CCIP 身份；本页自动认人；生成时自动带参考（真实 GPT 自动带参尚未验证）。
- **非破坏 AI 图层**：选区 + 一句话 → 3 张候选 → 可换 / 重生 / 对比 / 还原；格框保护。
- **阅读顺序 + 自动放对白气泡**：避脸、避原有字、按日漫从右到左；「画一页」直接用。
- **粘贴剧本 → 整页**：规则拆页/格/对白（中日英标记），不用大模型。
- **命令面板 Ctrl+K** + **历史面板**：每步中文名、时间、缩略图，可跳回任一步。
- **PSD 导入 / 导出**（ag-psd）：文字可编辑、AI 层带蒙版；导出压缩后黑白页约 6 MB，带色偏页约 16–18 MB（无损）。
- **MNAI_PORT**：可换端口，两份编辑器可并排跑。
- A/B（v1.0.0 vs 本版，同 mock GPT）：剧本成页格子阅读顺序错误 4→0；气泡挡脸 5→0；历史可按名称找回；PSD 从无到有。

**已知限制：** 改一块「换成…/自由修改」与角色库自动带参考的**真实 GPT 画质未再验证**；彩色页 PSD 约 16–18 MB；Windows 未在真机验证；换角色在复杂多人格仍不稳定；分格检测需要白分隔线。

### English
- **Edit an area** merges fix / AI fill / free edit into one beginner entry (remove locally for free / replace / free edit with 3 GPT candidates).
- Character library (CCIP), non-destructive AI layers, reading-order balloon placement, paste-a-script → page, Ctrl+K command palette + labelled history with thumbnails, PSD import/export, configurable `MNAI_PORT`.
- Known limits: real GPT quality for edit-area replace and character-library auto-ref not re-verified; colour PSD ~16–18 MB; Windows not verified on a real machine.

## 1.0.0 — 2026-10-11 · first public release as **Manga-NAI-GPT**

- New name and repository: https://github.com/h1neolzr7f/Manga-NAI-GPT (fork of Manga Editor Desu by new-sankaku, GPL-3.0).
- Beginner home with task wizards: 换角色 (character swap), 改字幕 (caption editing), 修瑕疵 / 去杂物 (fix / remove), 分层 (layers), 自定义修改 (free edit), 画一页漫画 (draw a page), AI 生图 (NovelAI). 专业模式 keeps every original tool.
- 服务设置 (Service settings): every address / key / token in one place, a test button per service, no built-in relay; models listed from your service.
- Local CPU AI, downloaded on first use with consent + SHA-256: Tesseract / manga-ocr, comic-text-detector, LaMa, SAM 2.1 tiny click-select, isnet-anime, anime face detection, CCIP; automatic panel detection.
- GPT character swap that redraws the whole figure in place with seam / tone matching and propagation to the same character on other panels.
- Model download progress, OCR cached per page, export of all pages as one ZIP, undoable layer visibility / page deletion, CJK line-breaking rules.
- Licence clean-up: intro.js (AGPL) replaced by an own tour; unlicensed fonts removed; prompt-helper example images download on first use (release asset).
- Linux / macOS `start.sh` + `scripts/install-ai.sh`; Windows launchers consolidated (`一键启动.bat`, `安装AI功能.bat`, others in `scripts/windows/`).

## Before 1.0.0 (fork development)

- Document the local backend. New `llm_doc/backend-and-offline.md` explains the two Python stdlib servers (`99_server.py` on :8000 for static files + AI proxying, the optional cutout sidecar on :8765), how to stop them, and why the page still opens after the server is closed: the service worker caches `index.html` and js/css for offline/PWA use, so it is not a stray process. Also records that the cutout sidecar cannot start on Python 3.13+ because `local_tools/server.py` imports the removed `cgi` module.
- Fix 画布: clicking an already-focused text object no longer shifts the whole view. fabric parks a 1px hidden `<textarea>` under `document.body` in document coordinates, so `enterEditing()` scrolled the page to reveal it and left `canvas._offset` stale. The new `js/core/util/fabric-text-focus.js` focuses that textarea with `preventScroll:true` while keeping its original coordinates, so IME candidate placement is unchanged.
- Fix 下载 DPI jumping to 300 when the field holds an invalid value. Typing a negative number (or clearing the field) now restores the last confirmed DPI instead of silently resetting to the default; out-of-range positives still clamp to 96 / 1800 with a toast either way.
- 画布 → 预计导出大小 tooltip now reports the same pixel dimensions as the 竖图/横图 preview rows. It used to round where the real export truncates, so it could claim one pixel more than you actually got.
- Stop the 画布 pixel and DPI fields from rewriting what you are typing. Validation and commit now happen on blur or Enter only, replacing the old 800ms idle timer that reverted numbers mid-keystroke. Meanwhile, values that are obviously mid-edit (blank, negative) are no longer written to localStorage, so an interrupted edit can no longer come back as 300 after a restart.
- Add 画布 → 导出格式 (PNG / JPEG / WebP) and 导出品质 so a finished page can be saved as a compressed image instead of a multi-hundred-megabyte PNG.
- Bound export size: the longest edge is capped at 8192px and the total at 40MP, so an oversized 下载 DPI no longer produces a failure-prone, gigantic file. Exports that hit the cap show a toast.
- 下载 DPI now has a maximum of 1800 in the UI, and its stored default matches the 300 shown in the menu.
- The project preview thumbnail is written as JPEG at quality 0.8 instead of the implicit 1.0, shrinking saved `.lz4` projects.
- 画布 → 预计导出大小 shows the estimated output size before exporting. It samples a few tiles at the real target resolution and extrapolates, so it reflects the lettering-heavy pages this tool produces.
- Export format stays a user choice: PNG / JPEG / WebP are only ever applied because the 导出格式 menu says so. Nothing switches the format automatically.
- Add 画布 → 导出位深度 (灰度 / 24位 RGB / 32位 ARGB, default 32位 ARGB). It applies to PNG only and is enforced on the actually written file, not just the menu. 灰度 and 24位 RGB flatten transparency onto the canvas background color; 32位 ARGB keeps it. The upstream integration intentionally defaults to ARGB so existing transparent assets are not flattened by surprise.
- 画布 → 导出格式 now disables 导出位深度 for JPEG / WebP, since those formats ignore it.
- Rework 画布 → 画布背景 into a full-width row: the hex value on the left, the color square on the right, with a note that transparency only takes effect in 32-bit ARGB mode.
- Add 竖图像素 / 横图像素 (WxH) preview rows that convert to and from 下载 DPI. Editing any DPI or pixel field updates the others. The numbers match the real export because the preview and the export path both call `NaiMangaPageSize.planExportPage`; the export multiplier is now taken from the A4 page preset (it previously assumed A5, which disagreed with the A4 canvas at every DPI) and is chosen so the written pixel count equals the preview exactly.
- 下载 DPI and 导出位深度 persist across restarts.
- 一键启动 no longer spawns a hidden server you cannot find or stop. The console window now stays open and shows the startup log, the browser opens at `http://127.0.0.1:8000/index.html#` once the server is ready, and closing the window stops the backend (the python child is attached to a Job Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, with an explicit `taskkill /T /F` as a safety net). A server that was already running on port 8000 is never killed by this launcher.
- 一键启动.bat is ASCII-only now. It ran `chcp 65001` while containing non-ASCII text, which made cmd.exe resume reading at a shifted byte offset and drop the rest of the file, so the window flashed and vanished.

## 1.0.3 — 2026-08-31

- Empty-canvas overlay can be dismissed (× / 自己裁剪 / Esc) and is remembered; it no longer blocks custom pages.
- Custom pages now lay a full-page panel, so 切割格子 can slice the page without first picking a template.
- Help → 新手教程 includes the custom-page knife path. Skipping or finishing the tutorial stops the overlay from auto-showing.
- Generate preflight and random-cut copy mention 页面 / 自定义页面, not only 模板.
- Startup no longer persist-dismisses the overlay via the initial blank `loadBookSize`.
- GitHub Release now attaches both the EXE installer and the portable ZIP.

## 1.0.2 — 2026-08-26

- Open each fake UI as its own simulator: chat, video site, danmaku, phone, social, forum, live, image board, visual novel.
- Edit and play inside the simulator; placing on the manga canvas is optional and then shows the canvas.
- Fix CJK lettering so changing fonts actually changes the words on the canvas.
- Beginner empty-canvas hint, clearer autosave restore copy, and story/asset buttons that open the matching simulator.

## 1.0.1 — 2026-08-14

- Add a self-contained Windows EXE installer with Chinese/English UI, Start Menu and optional desktop shortcuts, repair/uninstall support.
- Bundle Python 3.12, Node.js and Pillow so ordinary users do not need to configure a development environment.
- Smoke-test the installed application, local server, Node runtime and color-key cutout service on a Windows GitHub Actions runner.
- Keep rembg and its large model weights optional.

## 1.0.0 — 2026-08-14

First public release as **Manga Editor Desu · nai学长魔改版**.

- Retain the original English name; credit [new-sankaku/manga-editor-desu](https://github.com/new-sankaku/manga-editor-desu); keep GPL-3.0.
- NovelAI-only generation and a Windows one-click local server.
- Simulator workspace, canvas zoom, Chinese beginner layout, local cutout.

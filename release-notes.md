# Manga-NAI-GPT 1.6.9

故事模式吃满：可编辑页说明与进入/重点/离开、角色库 DNA、分镜检查提示、失败页只重拆；竖排中文 OCR 更快；读序统一。

## 更新

- **故事分镜可编辑**：拆分镜后可改每页「必须说明什么」、进入/重点/离开三拍与格描述，再一键出整章。
- **分镜检查**：`lintPlan` 警告/错误直接显示在故事模式面板。
- **角色库 DNA**：有角色档案时自动带上 appearance/outfit/distinct（可改）。
- **失败页只重拆**：出图成功但拆解失败时整页图保留，可一点「只重拆」不重花 Anlas。
- **故事模式进常用**：首页与「画一页漫画」并列，小白更容易找到。
- **OCR**：竖排中文 RapidOCR 双旋转取优；RapidOCR 已够好时跳过慢的 Tesseract。
- **读序统一**：页面结构切格读序改用 BalloonLayoutCore（与版式表一致）。

## 下载与验证

Windows 安装版与便携版内置基础运行环境和文字检测 CTD（约 91MB）；漫画 LaMa、Manga OCR、SAM 等在「服务设置 → 本机」下载。源码包解压后双击 `一键启动.bat`。校验源码包请对照 `SOURCE-SHA256.txt`。

## English

Story mode absorb: editable purpose + enter/focus/leave beats, bible DNA presets, lintPlan in UI, one-click re-decompose on failed pages, story mode in beginner home. Faster vertical-CJK OCR; unified reading order.

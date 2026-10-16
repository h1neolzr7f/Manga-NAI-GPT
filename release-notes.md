# Manga-NAI-GPT 1.6.5

整页拆解 + 批量导演 + 竖排气泡：可以把整页漫画拆成能编辑的图层，多格分镜一起规划，排版更接近真实漫画。

## 更新

- **整页拆解**：整张漫画页拆成可编辑的分格、气泡、文字图层。RapidOCR 优先，Tesseract 限时 8s，不再卡好几分钟；拆解进度分阶段显示。分镜计划也可以一键转成整页生成。
- **文档吸收**：漫画创作规则写进了流程：节奏 v2、共享版式表、气泡类型、按文字类型定字号、拟声词/旁白样式。
- **批量导演**：默认开启，多格一起规划镜头和构图；分格批量生成有 Anlas 保护，角色 DNA 保持一致。
- **版式**：共享版式表，一次只应用一页，对白和台词保持同步。
- **竖排气泡**：竖排文字框与气泡默认开启。
- **嵌字复查**：先查图层，再对横排文字做 OCR 复查。
- **进度**：拆解和生成都有阶段进度。
- **实验选项（默认关）**：NAI 画风 P 档、角色自动负面、擦除场景文字、透视文字工具，都在「服务设置」里手动开启。

## 下载与验证

Windows 安装版与便携版内置基础运行环境和文字检测 CTD（约 91MB）；漫画 LaMa、Manga OCR、SAM 等较大的模型在「服务设置 → 本机」下载。源码包解压后双击 `一键启动.bat`。校验源码包请对照 `SOURCE-SHA256.txt`。

## English

Page decompose to editable layers, batch director (default on), shared layouts, vertical balloons, lettering OCR recheck and stage progress. Experimental options are off by default. Installer bundles CTD only; heavier models download in-app.

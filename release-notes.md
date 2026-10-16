# Manga-NAI-GPT 1.6.8

红黑主题（去掉奶油色）+ 故事模式：粘贴一整段故事，一键出成可编辑整章；并修了 CTD 崩溃与批量导演兜底。

## 更新

- **红黑主题**：底色 #141414 / #212121，强调色 #a31515；去掉奶油浅色主题与切换。
- **故事模式**：粘贴散文/剧本 → 拆分镜 → 角色外貌预设 → 一键出整章（NovelAI 免费档，不扣 Anlas）→ 自动拆成可编辑气泡页；支持暂停、重试失败页（复用已出图）、导出全部。
- **CTD 修复**：文字检测 ONNX 固定 1024 输入，1.6.6 的 768 快路径会整页拆解崩溃，已改回安全尺寸。
- **批量导演**：卡片标签锚点校验更稳；超时随格数缩放；失败有兜底。
- **1.6.5–1.6.7 能力保留**：整页拆解、剧情出分镜、批量导演、实验选项（默认关）、透视文字、竖排气泡等。

## 下载与验证

Windows 安装版与便携版内置基础运行环境和文字检测 CTD（约 91MB）；漫画 LaMa、Manga OCR、SAM 等在「服务设置 → 本机」下载。源码包解压后双击 `一键启动.bat`。校验源码包请对照 `SOURCE-SHA256.txt`。

## English

Red-black theme (no cream) + Story Mode: paste a story → whole chapter of editable pages on free NAI tier (pause / retry / export). CTD fixed-input crash fix and batch director fallback.

# Manga-NAI-GPT 1.6.3

实机质量抛光：OCR / 去字默认路径、启动与换角色 UX、SAM 预热；在 1.6.2 全面审计修复之上。

## 更新

- OCR：检测后默认 manga-ocr 精修；竖排留白与可疑黄标；已缓存模型后台预热。未接入 PP-OCR（许可/依赖考量）。
- 去字：AI 填充「去掉杂物」默认 `auto`（优先漫画 LaMa）；蒙版边缘 +2px。
- UX：启动页 Sun network 改为 Standby；换角色先说明需 GPT 再进设置；人物识别未就绪不刷 501。
- SAM：页导入后若本地已有权重，预热 embedding。
- 回归：`docs/dev/smoke-163/`；审计 120/120 仍关闭。本轮不声称付费 GPT/NovelAI 画质保证。

## 下载与验证

Windows 安装版与便携版含基础运行环境；源码包解压后双击 `一键启动.bat`（需本机 Python）。AI 服务与本机模型需自行配置/安装。

离线回归与 Windows 离线检查通过后再发。校验源码包请对照 `SOURCE-SHA256.txt`。

## English

Real-world quality polish on top of the 1.6.2 audit-fix release: manga-ocr refine defaults, manga LaMa auto for remove-object, softer splash / GPT-needed toast for swap, optional SAM embed preload, smoke-163. No paid GPT/Anlas claims. Offline regressions green before ship.

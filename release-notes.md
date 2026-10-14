# Manga-NAI-GPT 1.6.2

全面审计修复：关闭 2026-10-13 全量审计全部 120 条已确认缺陷（PR #6–#37）。

## 更新

- 数据与历史：同页点击、复制/撤销/切页 GUID、压缩期 dirty 标记、按唯一键记录的生成任务与取消后的迟到结果隔离。
- 工程与素材：页序/blob 签名、扁平 ZIP 与 DEFLATE→lz4、素材索引与包导入事务。
- 付费队列与尺寸：NAI / AI Fill / 画一页统一排队；超时覆盖响应体；结果未知不重发；最长边 1536。
- 安全与本机服务：无代理时 DNS 固定、短临时名、抠图端口一致、IME 下焦点陷阱不误关。
- 本机 AI：模型原子发布、SAM/LaMa 取消与蒙版快照、完整图像哈希与精确 mask、切页钉住。
- OCR / 气泡 / 竖排文字与 IME、字体持久化失败提示；导出隐藏辅助框并恢复画布；页面效果不再擦下层。
- 仪表盘脚本重试、统计串行、历史最长连续天数；模拟器头像可见；导演迟到不覆盖、草稿需显式保存。

## 下载与验证

Windows 安装版与便携版含基础运行环境；源码包解压后双击 `一键启动.bat`（需本机 Python）。AI 服务与本机模型需自行配置/安装。

离线回归（含 `npm run test:audit-regressions`）、结构与 Windows 离线检查已通过。审计状态表 120/120 已修复。本轮发布不额外声称真实 GPT/NovelAI 画质保证。

## English

Audit-fix release: all **120** confirmed findings from the 2026-10-13 full audit are closed (PRs #6–#37). Covers data/history/autosave, ZIP/assets, paid queues and size caps, DNS pinning and local-tools ports, SAM/LaMa/OCR/text, export/page-studio, dashboard stats, simulator avatars, and director stale-response guards. Offline regressions and Windows packaging checks passed. Real image-service quality is not re-claimed beyond prior notes.

# Manga-NAI-GPT 1.6.1

修复画布跳动、局部编辑背景保护及角色连续性问题。

## 更新

- 选中图层时工具栏保持固定高度；修复横向页、小图缩放和文字聚焦滚动。实机选中整页前后画布位移为 0。
- 换角色保护远处背景和其他人物，首格与批量共用服装策略；明显上下文重构的候选需检查，批量会暂停。
- 保留有意的局部提亮和细线变化；修复取消、关闭、切页、重复应用及延迟解码期间的旧结果处理。
- 画一页增加每格人物/空镜选择、新系列重置、角色与参数快照、系列种子复用；修复默认网点提示词冲突。
- 修复导出失败清理、参考图读取、普通漫画页整页选择、Python 测试入口和版本显示。
- 修复 Windows 标签构建、安装器说明文件与支持链接；便携版包含已准备的 Python/Node 基础运行环境，并在上传前校验。

## 下载与验证

源码修复包解压后双击 `一键启动.bat`，需要电脑上有 Python；Windows 安装版和便携版包含基础运行环境。AI 服务需自行配置，本机 AI 模型另行安装。

完整回归、应用代码 lint、39 个代理相关 Python 测试及实机布局检查通过。独立复查的 3 项异步处理缺陷已关闭。详见 `docs/dev/DRIFT_REPAIR_VALIDATION.md`。

本轮未调用真实 GPT/NovelAI 服务，不承诺模型人物身份、姿势或构图绝对一致；NAI 整页流程仍主要依赖文字角色锚点与种子。导出成功/失败由离线流程回归覆盖，真实浏览器下载链路尚未完成验收。

## English

Fixes canvas layout jumps, character-replacement mask boundaries, brightness/line-change preservation and stale image results after cancellation, closure or page navigation. Adds per-panel cast/empty-shot controls and series continuity snapshots. Offline regressions, lint, 39 Python proxy tests and local Windows browser layout checks passed. Real image-service inference was not configured for this validation; model identity and composition consistency are not guaranteed.

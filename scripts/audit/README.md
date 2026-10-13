# 审查复现工具

基线：v1.6.1 / `ca9572d`。这些脚本通过生产函数、实际捆绑codec与可控制的DOM/网络/模型依赖**复现缺陷**。exit=0表示缺陷已按预期出现，不是产品通过验收。

从仓库根目录执行，Node.js 22+（仓库CI用24）、Python 3.10+；后端图像用例需要同一Python环境的Pillow，可使用本项目AI环境。无需API Key、付费接口或模型下载。临时HTTP只监听loopback，文件测试放临时目录。

```bash
node scripts/audit/editor-audit-repro.cjs
node scripts/audit/ancillary-audit-repro.cjs
node scripts/audit/expanded_frontend_repro.cjs
node scripts/audit/psd-zip-audit-repro.cjs
node scripts/audit/property-history-audit-repro.cjs
node scripts/audit/image-edit-audit-repro.cjs
node scripts/audit/round3-process-audit-repro.cjs
python scripts/audit/backend-audit-round2.py
```

JS脚本默认读取当前工作目录，可用MANGA_AUDIT_ROOT指定待审仓库。Python按脚本所在仓库定位。不要对包含个人图像/凭证的浏览器会话执行这些fixture；它们不需要真实浏览器会话。

| 脚本 | 覆盖 |
| --- | --- |
| editor-audit-repro | 当前缩略图、复制页、恢复删除、自动保存并发/失败/页序 |
| ancillary-audit-repro | 复制图层GUID、模拟器比例/分页、隐私DOM |
| expanded_frontend_repro | AI Fill重入/跨页/旧会话、角色卡与引用、会员缓存、聊天替换、seed0 |
| psd-zip-audit-repro | PSD opacity/文字/分组/AI位置/背景、旧ZIP平铺与DEFLATE |
| property-history-audit-repro | 字体属性/翻转与历史、自动保存 |
| image-edit-audit-repro | 油漆桶属性/层序、变换坐标 |
| round3-process-audit-repro | 五句speaker合并、多行适配、尾巴索引、事件过滤、重置资产索引 |
| backend-audit-round2 | 旧batch端口/重复生成、JPEG嵌入、长文件名、下载竞态、字体、SVG提供行为 |

并非每条审查记录都有保留下来的独立脚本。部分首轮检查以临时fixture执行，报告已经注明验证方式；不要声称本目录覆盖全部问题。

函数/像素替代依赖不代表真实浏览器、真实Windows安装或真实生成质量通过。SVG用例只确认原文存储与HTTP提供，不验证浏览器脚本执行。修复后把相应反向诊断改为正确行为回归，并按[交接入口](../../docs/AUDIT_AND_HANDOFF.md)完成验收记录。


# Manga-NAI-GPT 1.6.1 扩大范围审查

审查日期：2026-10-13（北京时间）  
仓库：https://github.com/h1neolzr7f/Manga-NAI-GPT  
审查基线：main，`ca9572de1640a7acb462bd49e69fb75de343e7c7`。最新发布 v1.6.1 于北京时间 2026-10-13 02:10 发布；dev/2.0 的末次提交更早，本报告不把它误当成最新版。

结论：现有离线回归通过，但仍有实际的数据丢失、任务记录覆盖、模型兼容和恢复可靠性问题。下一轮应优先修保存/页面身份和任务生命周期，再做真实服务与安装包验收。当前不宜仅凭 CI 全绿宣布稳定成品。

首轮只审查与复现，未修改、提交或推送项目代码。第二轮的聊天配置修复及独立PR状态见本文末尾。下述“复现”主要指执行原生产函数、以可控制的存储、网络或模型依赖建立的离线复现，不等同于完整浏览器或真实推理验收。

## 修复状态（持续更新）

回归测试：`npm run test:audit-regressions`（`scripts/audit-regressions/`，已接入 `npm test`）。`scripts/audit/*` 仍是针对基线 `ca9572d` 的缺陷诊断脚本，已修复条目的诊断断言会按预期失败。

| 编号 | 状态 | PR / 说明 |
| --- | --- | --- |
| 01 | 已修复 | [PR #6](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/6)：同页点击直接返回；保存后重新读取记录 |
| 02 | 已修复 | [PR #6](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/6)：复制页重写历史状态中的 canvasGuid |
| 03 | 已修复 | [PR #6](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/6)：撤销删除切页前保存当前页 |
| 04 | 已修复 | [PR #7](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/7)：“已保存”标记取保存前捕获的哈希，压缩期间的新编辑保持 dirty |
| 05 | 已修复 | [PR #8](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/8)：生成任务按唯一 taskKey 记录（含页面与目标层），完成/取消只清自己的记录；注册同步可见，页面快照经 ready 等待 |
| 06 | 已修复 | [PR #8](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/8)：任务 ID 单调递增，只重排显示序号 |
| 07 | 已修复 | [PR #7](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/7)：项目签名包含页序与每页 blob 身份 |
| 08 | 已修复 | [PR #7](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/7)：写入全部成功后才提交标记；失败与清除都会失效 |
| 09 | 已修复 | [PR #9](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/9)：ServiceRequest 与 NaiEngine 的超时/取消覆盖到响应体读取与解包；响应体超时仍按“结果未知”处理，不自动重发 |
| 10 | 已修复 [PR #26](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/26)：换角色添加与字幕下重排包在同一历史事务中，结束时只保存最终顺序，撤销/重做不会把替换层盖住文字 |
| 11 | 已修复 | [PR #5](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/5) |
| 12 | 已修复 | [PR #5](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/5) |
| 13 | 已修复 | [PR #9](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/9)：前端最大边与本机代理统一为 1536；代理保留编辑器已适配的合法尺寸，参数与图/蒙版一致 |
| 14 | 已修复 | [PR #10](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/10)：人物模型先在局部完整加载再原子发布；就绪判断要求全部会话 |
| 15 | 已修复 | [PR #10](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/10)：_get_extra 返回会话快照，空闲清理清空共享字典不影响进行中的请求（会话由快照引用保持存活） |
| 16 | 已修复 | [PR #10](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/10)：检测缓存键包含 refine；精修模型不可用时的降级结果不缓存 |
| 17 | 已修复 [PR #18](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/18)：抠图阈值/侵蚀区分缺失与 0，显式 0 保留 |
| 18 | 已修复 [PR #19](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/19)：添加素材固定来源页面(GUID/canvas)，解码期间切页则取消并提示，不插入新页 |
| 19 | 已修复 [PR #19](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/19)：IndexedDB 与 /user-assets 都失败时标记 memoryOnly，导入提示明确“仅本次可用、刷新后丢失” |
| 20 | 已修复 [PR #16](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/16)：播放只渲染截断视图，持久化的 simulatorScene 始终为完整场景 |
| 21 | 已修复 [PR #20](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/20)：剧情转分镜按 plan 页边界分块、每页最多 6 格，只把第一页放到当前画布并提示剩余格数（产品决定）；格高下限 40px |
| 22 | 已修复 [PR #20](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/20)：Service Worker 安装时预缓存 index.html/manifest，所有导航离线回退到缓存的 index.html |
| 23 | 已修复 [PR #20](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/20)：start.sh 以页面标题识别本应用，其他网站不再当作已运行；就绪循环超时报失败 |
| 24 | 已修复 | [PR #11](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/11)：无系统代理时，Director/tagger/NovelAI 出站连接在连接时解析、校验并固定到已校验地址（与 GPT 图像代理同一规则）；有系统代理时由代理解析。另：_start_tool_job 不再回退读取服务端 NOVELAI_API_KEY |
| 25 | 已修复 | [PR #12](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/12)：文字属性按钮/滑杆记录历史（250ms 合并为一步），侧栏翻转保存历史 |
| 26 | 已修复 | [PR #12](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/12)：复制图层重建 GUID，清空子层 guids 引用 |
| 27 | 已修复 | [PR #13](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/13)：首个 await 前同步占用会话，双击只生成一轮 |
| 28 | 已修复 | [PR #13](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/13)：会话记录来源页；应用前与解码后核对页面，切页时保留候选并提示 |
| 29 | 已修复 | [PR #13](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/13)：生成流程绑定会话对象，旧会话完成不写入新会话、不清理新会话的 busy/controller |
| 30 | 已修复 [PR #16](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/16)：聊天渲染前固定来源页面(GUID)与替换目标；切页后放弃插入并提示，不删除新页对象 |
| 31 | 已修复 [PR #26](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/26)：自动参考仅使用当前页的识别结果；region.pageGuid 与识别缓存页不一致时不返回角色，切页立即清空旧 faces |
| 32 | 已修复 [PR #26](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/26)：后台 buildIdentity 完成后重读卡片；已删除则不写回；只合并 identity 字段到现卡，不覆盖名字/tags 等编辑（决定：参考图修订不一致也放弃本次特征） |
| 33 | 已修复 | [PR #14](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/14)：角色库嵌入接受 JPEG/WebP（校验格式与像素上限）；建立识别特征失败时界面提示 |
| 34 | 已修复 | [PR #14](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/14)：旧批处理只重试明确拒绝（429/502/503/504）；结果未知与写盘失败不重发付费请求，写盘单独重试 |
| 35 | 已修复 [PR #20](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/20)：服务器启动批处理时传 MNAI_PORT/MNAI_BASE_URL，脚本只接受回环地址，不再硬编码 8000 |
| 36 | 已修复 [PR #20](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/20)：订阅缓存绑定 token，切换账号重新查询，旧账号迟到响应不覆盖 |
| 37 | 已修复 [PR #18](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/18)：0 为合法固定种子（0..4294967295），随机仅用于缺失/非法/-1 |
| 38 | 已修复 [PR #15](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/15)：PS 工具原位 setElement 替换像素，保留图层顺序/clipPath/混合/GUID |
| 39 | 已修复 [PR #15](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/15)：localToImage 使用完整逆变换（旋转/原点/翻转/缩放） |
| 40 | 已修复 [PR #27](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/27)：单页扁平 ZIP 在无页容器为空时按本页加载；zip→lz4 转换始终解压条目（DEFLATE 不再把压缩字节当 JSON） |
| 41 | 已修复 [PR #21](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/21)：分页插入图层使用宽高统一的 fit 缩放（回归为源码断言，完整交互待浏览器验收） |
| 42 | 已修复 [PR #21](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/21)：pageView 提供相对页面的 layoutObjects，分页与裁切不随页面位置变化并夹到页面边界 |
| 43 | 已修复 [PR #27](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/27)：隐私模式覆盖真实图层预览 DIV.layer-preview、素材卡 .asset-library-card img 及角色/历史缩略图（悬停仍可看清） |
| 44 | 已修复 [PR #19](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/19)：本机抠图临时文件只用短随机名+扩展名，不再拼完整文件名 |
| 45 | 已修复 [PR #19](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/19)：示例图包写入使用每个写入者唯一的临时文件再原子替换 |
| 46 | 已修复 [PR #18](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/18)：网络字体 family 先 URL 解码（+/%20）再保存与应用 |
| 47 | 已修复 [PR #27](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/27)：AI Fill 导出 PSD 使用 live 位置与尺寸（rasterize 结果），不再回退到生成时的 aiFill.box |
| 48 | 已修复 [PR #20](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/20)：PSD 导出把画布背景色作为底层“背景”，合成图使用同色；透明背景保持原样 |
| 49 | 已修复 [PR #16](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/16)：超容量对白放入同场景续格，不跨说话人合并；每句带稳定 line ID/speaker（wizardLines，写入 data-script-lines） |
| 50 | 已修复 [PR #20](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/20)：显式多行文字也检查跨行方向总高度，放不下时进入换行/overflow 分支 |
| 51 | 已修复 [PR #22](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/22)：气泡尾巴在整页 faces 中查找说话人，且要求脸部位于本分格内，否则不画指向他格的尾巴 |
| 52 | 已修复 | [PR #12](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/12)：事件过滤只在 target.saveHistory===false 时跳过；导入底图添加后清除临时抑制 |
| 53 | 已修复 [PR #19](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/19)：重置设置保留素材索引与生成任务记录（产品决定：重置仅针对设置，不清创作数据） |
| 54 | 已修复 [PR #23](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/23)：本机抠图服务返回 crop 框与原图尺寸；编辑器按原图像素比例和变换（缩放/旋转/翻转/origin）放置裁切结果，选区抠图同理 |
| 55 | 已修复 [PR #23](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/23)：浏览器颜色抠图（含神经网络失败后的回退）执行羽化、裁切、只输出蒙版，与服务语义一致 |
| 56 | 已修复 [PR #23](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/23)：抠图请求固定页面 GUID 与源对象；切页或源图已删除时结果不贴入并提示，也不再触发颜色回退（决定：丢弃并提示重做，而非自动跨页） |
| 57 | 已修复 [PR #23](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/23)：颜色键 alpha 与原 alpha 取最小值，透明/半透明像素不会被复活（invert 同样保留） |
| 58 | 已修复 | [PR #14](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/14)：导入前校验历史结构；加载中途失败时恢复历史、图片映射、提示词与画布尺寸 |
| 59 | 已修复 [PR #25](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/25)：运行中任务点 × 后记录取消状态，结果返回时不回贴、保留原图并提示“已发出的请求可能仍计费”（不声称撤销扣费） |
| 60 | 已修复 [PR #25](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/25)：NaiEngine（AI Fill/画一页）改为进入同一个 novelaiQueue，与旧图层生成串行；existsWaitQueue/clearAllQueues 覆盖全部请求 |
| 61 | 已修复 [PR #24](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/24)：生成素材只有在索引写入成功后才算成功；写入失败时任务标为“保存失败”，生成字节留在内存，可“重试保存”而不重新生成（不花额外费用） |
| 62 | 已修复 [PR #24](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/24)：素材包导入改为全有或全无：任一记录无效即回滚到导入前状态，成功时一次性保存 |
| 63 | 已修复 | [PR #14](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/14)：导入素材文件名使用完整 ID 的哈希，原子写入 |
| 64 | 已修复 [PR #28](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/28)：persist 与 remove 用 per-id token 串行；删除会使进行中的 put 作废并再次清理 blob，避免孤立存储 |
| 65 | 已修复 [PR #28](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/28)：栅格导出临时隐藏 excludeFromExport/naiCropFrame 辅助框，finally 恢复，绿色裁剪框不再烤进 PNG |
| 66 | 已修复 [PR #28](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/28)：exportCanvasDataURL 快照并恢复画布尺寸/viewport/交互；cropAndDownload/clipCopy 用 try/finally 覆盖同步抛错，保证网格与提示恢复 |
| 67 | 已修复 [PR #21](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/21)：分页长图导出时临时隐藏无关图层和编辑网格，只渲染目标模拟器 |
| 68 | 已修复 [PR #22](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/22)：OCR 同字合并要求水平重叠≥30%，不再把相邻两个字合并 |
| 69 | 已修复 [PR #22](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/22)：OCR 按纵向重叠把词聚成行，多行横排文本按行顺序输出 |
| 70 | 已修复 [PR #22](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/22)：竖排/横排方向由胜出模式的列/行结构判定（≥2 列或行时），不再误判 |
| 71 | 已修复 [PR #22](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/22)：覆盖底色在内边距内遇到跨越≥60% 的深色轮廓线即停止，不再盖住气泡边框（决定：宁可少盖一点也不破坏线稿） |
| 72 | 已修复 [PR #22](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/22)：OCR 返回中位字形尺寸 glyph，字号上限按实际字形而非框面积估算 |
| 73 | 已修复 [PR #22](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/22)：应用时固定页面 GUID，解码期间切页则中止并提示，不会把 A 页图层加到 B 页（决定：中止而非自动切回） |
| 74 | 已修复 [PR #29](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/29)：LaMa 应用在每次 await 后核对 ticket 与 approved 身份；取消后迟到解码不再提交图层 |
| 75 | 已修复 [PR #29](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/29)：任何蒙版改动（含检测器切换）作废预览并禁用确认；批准时快照 mask，应用不再读到之后改动的蒙版 |
| 76 | 已修复 [PR #29](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/29)：智能点选 imageId 对整段页面内容做 FNV-1a，不再每 97 字符抽样（避免同长度不同图碰撞） |
| 77 | 已修复 [PR #30](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/30)：智能点选把候选精确栅格 mask 交给 GPT；应用优先用 smartMask，轮廓仅用于显示，孔洞与多连通区域与蓝色预览一致 |
| 78 | 已修复 [PR #30](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/30)：混合结果裁切后按 bounds.minX/Y 放置且 scale=1，不再 scaleToWidth(整页) |
| 79 | 已修复 [PR #30](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/30)：画笔离屏 buffer 在页面尺寸变化时重建/扩容，外侧笔迹可画 |
| 80 | 已修复 [PR #15](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/15)：glfxReset 锁定原目标并在原索引恢复，不再替换当前选中对象 |
| 81 | 已修复 [PR #30](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/30)：切线交点按刀向参数排序取两端；等距时不再得到零长线，矩形横/竖模板可切分 |
| 82 | 已修复 [PR #15](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/15)：刀切比例校验失败时回滚子图变换/clipPath/绑定与图层顺序 |
| 83 | 已修复 [PR #31](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/31)：install-ai.sh/ps1 在已安装 CPU torch 后对 sam2 使用 --no-deps --no-build-isolation，构建依赖不再另开隔离环境拉 CUDA torch |
| 84 | 已修复 [PR #31](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/31)：prepare-installer.ps1 图标转换用 sys.argv 传路径，含单引号/中文的目录不再造成 Python 语法错误 |
| 85 | 已修复 [PR #31](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/31)：Windows 启动器从 LOCAL_TOOLS_PORT 取抠图端口（默认 8765）并写回环境变量；启动后探测 /health，提示使用同一地址（决定：客户端默认仍 8765，自定义端口在服务设置填写） |
| 86 | 已修复 | [PR #14](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/14)：旧版角色卡就地规范化，输入回调写入当前对象 |
| 87 | 已修复 [PR #32](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/32)：页计划改为确定性分配周期（不限 3 轮随机），40/153 页可生成且总和等于目标页数 |
| 88 | 已修复 [PR #18](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/18)：标签补全保留 ::、}、]、) 等关闭权重标记 |
| 89 | 已修复 [PR #32](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/32)：网点/速度线按逻辑尺寸生成（3× 超采样仅栅格化），渐变与密度不再混用 buffer 坐标 |
| 90 | 已修复 [PR #32](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/32)：集中线只由 putImageInFrame 加入画布一次，更新不再留下重复引用 |
| 91 | 已修复 [PR #18](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/18)：辉光尺寸按十进制解析 |
| 94 | 已修复 [PR #19](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/19)：工具模式记录并恢复图层原选中状态；用户移动锁显式记为 userMoveLock 并持久化 |
| 101 | 已修复 [PR #18](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/18)：日期键按本地年月日解析；周目标与周统计统一周一为起点（产品决定） |
| 103 | 已修复 [PR #18](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/18)：正向规则只改正向提示词，负向规则只改负向；空旧词跳过 |
| 104 | 已修复 [PR #18](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/18)：提示词替换改为字面替换，不再当正则 |
| 107 | 已修复 [PR #17](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/17)：合并前收集被吸收气泡的对白，合并后的气泡正文继承原对白（多段换行拼接），新气泡仍为默认“台词” |
| 112 | 已修复 [PR #19](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/19)：切换侧栏时关闭所有带工具栏开关的面板（含画具） |
| 113 | 已修复 [PR #17](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/17)：三种聊天布局的消息行 Group 不再强制 left/top=0，保留 Fabric 计算出的行位置 |
| 114 | 已修复 [PR #21](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/21)：Discord 图片消息与社交动态实际加载图片并等比放置；失败显示“图片加载失败” |
| 116 | 已修复 [PR #17](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/17)：站点零件文字带稳定字段 ID；readSelected 从画布回读最新文字并同步 simulatorScene，重新应用不再覆盖 |
| 117 | 已修复 [PR #21](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/21)：Studio 以载入的完整场景为底，只 patch 用户改动字段，列表项按索引保留原有隐藏属性 |
| 118 | 已修复 [PR #21](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/21)：姓名字段同时写 name/author/sender/user，论坛/手机渲染器都能显示 |
| 119 | 已修复 [PR #21](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/21)：视觉小说按节点 id 把剧情索引换算到去背景后的对白索引 |
| 120 | 已修复 [PR #21](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/21)：Studio 文本视图背后保留完整剧情；未改动时原样返回（独白/选项/目标保留），改动后提示纯文本无法承载分支（产品决定） |

<!-- audit-status-end -->

## 优先修复：数据和付费结果

### 01 — 点击当前页缩略图回滚刚做的编辑（P1，生产函数复现）

位置：[js/ui/bottom-bar.js:394](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/bottom-bar.js#L394)；[js/core/compression/project-compression.js:142](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/compression/project-compression.js#L142)。

先保存页面，再移动一个图层，然后点击当前页自己的缩略图。切页函数先取得旧 projectData，再保存当前内容；保存会替换 Map 记录，但随后仍加载先前取得的旧 blob。复现结果：图层 left 从 2 退回 1，撤销历史也回到旧的两条状态。

修复：同页点击应直接返回；必须重载时，在保存之后重新获取记录。验收应检查画面、历史、下载项目三者都保留最新修改。

### 02 — 复制页保存后重开，原页与副本合并（P1，生产函数复现）

位置：[js/ui/bottom-bar.js:434](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/bottom-bar.js#L434)；[js/core/compression/project-compression.js:202](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/compression/project-compression.js#L202)；[js/layer/image-history-management.js:231](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/layer/image-history-management.js#L231)。

复制操作创建新的页面 Map key，却复用源 blob，其历史状态仍带源页面 GUID。项目重开时，multiLoadLz4 从第一条历史状态取页面身份，两页得到同一个 GUID，后者覆盖前者。复现：页面 [A,B] 重开后只剩 [A]，加载器返回 [A,A]。

修复：副本的页面身份必须在全部保存结构中统一重建；不能只换当前 canvas GUID。验收覆盖复制后不编辑、编辑、撤销/重做、多次复制和整项目重开。

### 03 — 撤销删除页面，会丢掉另一页的新修改（P1，生产函数复现）

位置：[js/ui/bottom-bar.js:465](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/bottom-bar.js#L465)。

删除 A 后在 B 上编辑，再点“撤销删除”，恢复代码切到 A 时没有要求保存当前 B。返回 B 后，最新修改消失。复现：B 的 left=5 回到旧 blob 的 left=4。

修复：恢复页面前保存当前页面，或恢复缩略图而保留当前编辑页。不要让恢复操作暗中破坏另一页。

### 04 — 自动保存过程中新增修改，被误标为已经保存（P1，生产函数复现）

位置：[js/core/auto-save.js:74](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/auto-save.js#L74)；[js/core/compression/project-compression.js:34](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/compression/project-compression.js#L34)。

压缩捕获较早的历史快照；await 完成后，自动保存却用最新 live state 计算 lastSavedHash。复现：压缩期间把 left=1 改成 2，存下的 blob 仍为 1，但下一轮 save() 认为 2 已保存，零写入。

修复：快照、版本号与“已保存标记”对应同一次捕获；异步期间的新增修改必须继续保持 dirty。验收用延迟压缩/存储，故意在其间编辑和切页。

### 05 — 同页多个生成任务覆盖目标信息，跨页完成时错贴或丢结果（P1，生产函数复现）

位置：[js/ai/queue/generation-task-manager.js:96](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/queue/generation-task-manager.js#L96)；[js/ai/provider/novelai-provider.js:543](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/provider/novelai-provider.js#L543)；[js/ai/provider/novelai-provider.js:499](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/provider/novelai-provider.js#L499)。

generationTaskMap 只按 canvasGuid 存一个任务。同页两格分别排队 A、B，B 的目标会覆盖 A 的目标。离开该页后，A 的结果可能贴到 B；A 清理记录后，B 已没有目标记录。离线复现确认元数据覆盖和清理冲突；真实服务出图没有调用。

修复：用唯一 request ID 保存任务，记录其页面及目标图层；完成/取消只能清自己的记录，并等待异步注册完成。验收覆盖同页多格、不同页、多次取消和不同完成顺序。

## 自动保存、任务取消与历史

### 06 — 任务 ID 会复用并覆盖仍在运行的任务（P2，生产函数复现）

位置：[js/ai/queue/generation-task-manager.js:8](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/queue/generation-task-manager.js#L8)；[js/ai/queue/generation-task-manager.js:39](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/queue/generation-task-manager.js#L39)。

创建 aitask-1/2，移除 1 后，renumberAiTasks 把 ID 分配计数器重置为剩余数量。再建一个任务仍叫 aitask-2，覆盖旧任务。取消按钮和结果清理也可能对应错任务。

修复：唯一 ID 与显示排序分开，ID 不回退；仅显示 order 重新编号。

### 07 — 自动保存不感知删页与页面排序（P2，生产函数复现）

位置：[js/core/auto-save.js:12](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/auto-save.js#L12)；[js/core/auto-save.js:65](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/auto-save.js#L65)。

dirty 判断只看当前页历史和 GUID，实际保存却含所有页面与顺序。保存两页后，只删除非当前页或调整顺序，下一次自动保存零写入。恢复仍带已删除页/旧顺序。

修复：整个项目有自己的修订计数；删页、排序、页面 blob 更新都应改变它。

### 08 — 自动保存写入失败后不重试；清除后标记未重置（P2，生产函数复现）

位置：[js/core/auto-save.js:75](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/auto-save.js#L75)；[js/core/auto-save.js:81](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/auto-save.js#L81)；[js/core/auto-save.js:95](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/auto-save.js#L95)；[js/project-management.js:50](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/project-management.js#L50)。

lastSavedHash 在存储成功之前就更新。模拟一次 IndexedDB 写入失败，恢复存储后，在没有新编辑的情况下仍零写入。clearAutoSave 删除记录后也不清标记，正常下载项目会调用这个路径。

修复：所有数据写成功后才提交保存标记；失败和清除必须使标记失效。清除后的空恢复记录是否符合产品设计可另定，但写失败绝不能被当成保存成功。

### 09 — 收到响应头后，下载响应体脱离超时控制（P2，生产函数复现）

位置：[js/core/service/service-request.js:74](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/service/service-request.js#L74)；[js/ai/nai-engine.js:51](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/nai-engine.js#L51)。

fetch 返回响应头就清定时器，之后读取 JSON/ZIP/图像。服务先发 200 再停止传输时，响应体没有完整 deadline。NaiEngine 还移除了用户 abort 监听，取消后 reader 继续等，可能阻塞后续串行任务。ServiceRequest 对 response.text() 失败会吞掉异常，进一步可能返回空对象。

复现：10ms timeout 下，40ms 后 response body 仍 pending，内部 signal 未 abort。NaiEngine 的取消失效也以延迟 body 复现。

修复：超时/取消覆盖直到读取、解包完成；将读取失败向调用者传播。付费请求的未知结果不得因此自动重发。

### 10 — 换角色图层的历史记录早于最终层级调整（P2，生产函数复现，完整 Fabric 回放待验）

位置：[js/ai/auto-swap.js:326](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/auto-swap.js#L326)；[js/fabric/fabric-management.js:118](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/fabric/fabric-management.js#L118)。

c.add 立即触发历史保存，然后 moveTo 把生成图移到字幕下面，没有再保存最终顺序。离线 fixture 得到：当前顺序 [底图,替换,文字]，历史快照 [底图,文字,替换]。撤销再重做可能让替换层遮住文字。

修复：添加和重排作为一个历史事务，结束时只保存最终状态。

## 服务配置与本机 AI

### 11 — 用户填写的 GPT 聊天模型被强制改成 DeepSeek（P1，前后端函数复现）

位置：[js/ai/ai-settings.js:45](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/ai-settings.js#L45)；[js/ai/ai-settings.js:57](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/ai-settings.js#L57)；[99_server.py:767](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/99_server.py#L767)。

例如 gpt-4.1-mini，在输入框失焦/读取已保存设置时改成 deepseek-v4-flash；后端发送前也做同样改写。所以只修前端无效。官方 OpenAI 或只支持某一 GPT 模型的中转会收到不支持的模型名。

修复：尊重明确配置的模型，迁移只针对确切的旧默认值；不要匹配整个 gpt-/chatgpt- 前缀。

### 12 — 标准 OpenAI 兼容模型列表被过滤为空（P2，本地响应复现）

位置：[99_server.py:935](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/99_server.py#L935)。

标准 {data:[{id:"deepseek-chat",object:"model"}]} 没有某厂商特有的 supported_protocols 字段，被全部过滤，返回 data:[]。

修复：接受标准模型对象，仅在明确提供协议元数据时据其过滤。

### 13 — NovelAI 前后端尺寸策略不同，inpaint 图片/蒙版与参数不一致（P1，合同不一致已复现，真实上游后果待验）

位置：[js/ai/nai-engine-core.js:35](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/nai-engine-core.js#L35)；[js/ai/ai-fill.js:165](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/ai-fill.js#L165)；[99_server.py:509](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/99_server.py#L509)；[99_server.py:563](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/99_server.py#L563)。

1000×400 区域，前端 sizeFor 得到 1600×640，并生成同尺寸图片/蒙版；后端默认最大边 1536，只改参数为 1536×640，没有同步缩放图片/蒙版。参数与输入图尺寸不一致已确认；究竟被 NovelAI 拒绝还是发生尺寸偏差，应以真实调用验证。

修复：统一尺寸规范；局部重绘同时维护参数、图和 mask 的一致性，费用/返回元数据也要一致。

### 14 — 人物模型初始化中断，会污染之后的重试（P1，模型依赖桩复现）

位置：[manga_character_detect.py:72](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/manga_character_detect.py#L72)。

face 写入共享 _extra 后，后续 CCIP 下载失败。下一次仅检查 face 是否存在，就认定整体准备完成，跳过剩余下载。复现：字典只剩 face，重试下载次数为 0；身份 embedding 使用缺失的 ccip/ccipm 会报错。

修复：先在局部变量完整准备，再原子发布共享会话；失败不得留下“半就绪”状态。

### 15 — 空闲模型清理能与正在执行的角色库请求冲突（P1/P2，受控并发复现）

位置：[manga_model_guard.py:150](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/manga_model_guard.py#L150)；[manga_character_library.py:95](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/manga_character_library.py#L95)；[manga_character_library.py:143](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/manga_character_library.py#L143)；[manga_smart_ocr.py:329](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/manga_smart_ocr.py#L329)。

角色库 embed/identify、部分 face/detect 路径没有在完整使用期间持有相应 guard。空闲清理会清共享 _extra。受控交错复现 release_idle 释放 sam2 后，正在 embed 的请求得到 KeyError('face')。

修复：按实际共享模型会话统一所有消费者的“正在使用”计数/互斥，加载与使用均覆盖。

### 16 — 人物检测缓存忽略 refine 与模型可用性（P2，缓存函数复现）

位置：[manga_character_detect.py:562](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/manga_character_detect.py#L562)。

同图先 refine:false，再 refine:true，仍返回 refined:false,cached:true，精修模型初始化次数为 0。安装好模型后也可能继续复用先前降级结果。

修复：缓存键含精修模式及模型能力版本，或在能力变化时失效缓存。

### 17 — 抠图设置里的合法 0 被默认值替换（P3，参数复现）

位置：[local_tools/cutout.py:162](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/local_tools/cutout.py#L162)。

前景阈值、背景阈值、侵蚀大小都设 0，实际 rembg 参数变成 240/10/10。原因是使用 value or default。

修复：明确区分缺失/None 与数值 0；验收用零值和边界值。

## 辅助功能、素材、离线和启动

### 18 — 素材异步加载完成后，插入到已经切换的新页（P2，生产函数复现）

位置：[js/assets/asset-store.js:387](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/assets/asset-store.js#L387)。

开始添加素材时捕获的是复用的 canvas 对象，没有页面 GUID/版本校验。读取或图片解码期间切到 B，回调就添加到 B，并按 B 当前选中分镜放置。

复现：A 开始 addToCanvas，延迟 fromURL 回调，切 B，释放回调，新增图片记录 page=B。模拟器异步插入也应扩大检查。

修复：捕获页面与目标身份；完成时验证，或把结果保存到原页等待应用。

### 19 — 素材持久化失败，仍提示刷新后可用（P2，故障依赖复现）

位置：[js/assets/asset-store.js:161](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/assets/asset-store.js#L161)；[js/assets/asset-store.js:184](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/assets/asset-store.js#L184)；[js/assets/asset-library-controller.js:233](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/assets/asset-library-controller.js#L233)。

persistImported 不要求至少一种持久化成功。IndexedDB 与 /user-assets 同时失败时仍 resolve，并把 missing=false；UI 宣称刷新后仍可缓存加载，实际只留在内存。

修复：返回明确持久化结果；失败时提示本次仅在内存，不要声称已保存。配额满/写入失败场景应进入验收。

### 20 — 部分模拟器播放会把原始场景截断（P1，控制器离线复现，实际渲染器浏览器待验）

位置：[js/simulator/playback-controller.js:55](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/playback-controller.js#L55)；[js/simulator/playback-controller.js:91](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/playback-controller.js#L91)；[js/simulator/extra-renderer-factory.js:134](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/extra-renderer-factory.js#L134)。

非 chat 分支渲染 makeVisibleScene 的截断副本，makeGroup 又把该副本作为 simulatorScene 保存。下一次读取拿到的是已经截断的数据。三事件复现：next 后场景 events 只剩第一项，再 next 仍只有第一项。论坛/评论等 replies/comments 也走截断逻辑。chat 单独 visibleCount 分支不应混为同一问题。

修复：完整场景是持久化源，播放位置只是视图状态，不能覆盖源数据；验收播放/暂停/导出后原始事件总数不变。

### 21 — 长剧本全部塞一页，分镜高度能变成负数（P2，布局函数复现）

位置：[js/simulator/story-to-manga.js:25](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/story-to-manga.js#L25)；[js/simulator/story-to-manga.js:145](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/story-to-manga.js#L145)。

该辅助“剧情转分镜”路径把所有 normal panels 摊平放到一个 canvas，并持续减去行间距。1000×1400 页面、240 格得到 cellHeight=-1.175。即便不达到负数，几十格也会过小。此问题针对该辅助路径，不等同于新版 task-launcher 的整个“画一页”路径。

修复：每页设置合理分镜上限并分页；保留 plan 的 pages 边界，不靠压小所有格子承载任意长度剧本。

### 22 — PWA 的启动入口没有离线缓存（P2，真实 worker 代码的缓存 fixture 复现）

位置：[manifest.json:5](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/manifest.json#L5)；[service-worker.js:70](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/service-worker.js#L70)。

启动 URL 是 ./（根路径 /），worker 只缓存带扩展名的静态路径。在线访问 / 和 /index.html 后，离线 / 仍 miss，/index.html 才 hit；安装处理也没有预缓存应用外壳。

修复：导航统一落到缓存的 index.html，预缓存必要外壳；验证停止本地服务后安装应用能否启动，并区分纯编辑可离线与 AI 需要服务。

### 23 — Linux/macOS 启动器把其他网站当成本应用（P2，未改动启动脚本＋本地 HTTP 复现）

位置：[start.sh:9](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/start.sh#L9)。

只要选定端口 /index.html 返回成功，就显示编辑器已在运行。用返回“Unrelated dashboard”的本地服务复现，启动器退出 0 并准备打开错误应用。Windows 已有页面标记检查。

修复：探测明确的应用身份/version；启动就绪循环超时也应报失败，不能循环结束无条件声称启动成功。

### 24 — Director 代理 URL 检查与实际连接之间存在 DNS 重绑定空隙（P2 安全，受控本地网络复现）

位置：[99_server.py:346](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/99_server.py#L346)；[99_server.py:830](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/99_server.py#L830)。

校验域名时解析一次，urllib 连接时再次解析，没有固定到已验证的地址。受控测试第一轮返回公网 IP、连接轮返回 127.0.0.1，成功向本应用本应禁止的端口发 POST，携带测试 Bearer token。

前提：用户配置了攻击者控制的网关域名或相应 DNS；不是已发现普通外站能任意访问本应用，也不是发布包泄漏凭证的证据。

修复：复用 GPT 图像代理的连接时地址校验/绑定方案；所有 Director/tagger 出站连接保持同样规则。

## 静态发现：还需实机或像素级验证

以下不作为“已经完成真实用户复现”汇报，但应加入下一轮验收。

1. **运行中任务的 × 可能只是移除指示器。** [js/ai/queue/spinner.js:46](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/queue/spinner.js#L46) 只在 waiting 时移除队列项；running 没有实际 abort/禁止迟到结果应用的完整路径。应测试取消后继续收到生成结果时画布是否仍改变。
2. **多次 SAM 手选人物复用同一 id='click'。** [js/ai/auto-swap.js:404](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/auto-swap.js#L404)；[js/ai/auto-swap.js:533](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/auto-swap.js#L533)。批量通过 id 找第一个人物，doneIds 与其他人物保护也可能混淆。应选三个人物，确认各自目标独立。
3. **PSD 半透明图层疑似重复计算 opacity。** [js/ui/psd-io.js:31](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/psd-io.js#L31) 栅格化已带 opacity，[js/ui/psd-io.js:76](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/psd-io.js#L76) 又给 PSD 层同一 opacity。应以 50% 图层导出并检查实际 alpha/合成，目标不能变成约25%。
4. **PSD 字体/竖排/旋转、父组隐藏与混合模式不完整。** [js/ui/psd-io.js:53](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/psd-io.js#L53)；[js/ui/psd-io.js:109](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/psd-io.js#L109)；[js/ui/psd-io.js:152](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/psd-io.js#L152)。导入统一 Textbox，导出文字 transform 用单位矩阵；摊平 group 未传承全部父级属性。需真实 PSD 往返比对，不能仅检查文件可打开。
5. **本地安装器构建排除规则偏窄。** [scripts/prepare-installer.ps1:27](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/scripts/prepare-installer.ps1#L27) 未完整排除 .env.*、*.env、.venv、work 等；这仅是开发机自行构建风险，不是干净 CI 发布包已有泄漏的证据。

## 优化建议

- **先稳定核心，暂缓继续堆功能。** 保存/页身份/任务生命周期问题会破坏所有新功能的可信度。统一项目修订、任务 ID、异步结果归属，比继续给每个 UI 局部加状态变量更划算。
- **把测试从“函数能跑”补到“用户数据能往返”。** 重点加入当前页重复点击、复制页往返、撤销删除与另一页修改、自动保存故障/慢压缩、多格排队并切页、取消后迟到结果、PSD 像素及文字往返。
- **真实服务兼容矩阵。** GPT 直连、至少两种中转响应格式、NovelAI V3/V4.5/V5及局部重绘，分别验证参考图、mask、尺寸、错误/余额提示、下载/解码完整时限、未知结果不重扣。不能用 mock 出图取代画质/身份一致性验收。
- **真实清洁 Windows 安装验收。** 当前发布有安装器/便携版和嵌入基础运行环境，应在无 Python/Node 的干净机器解压启动，再安装可选 CPU AI。CI DryRun 并不证明 PyTorch、LaMa、SAM2 与 OCR 真能一起安装。
- **下载入口减负。** README 应优先解释安装版、便携版、源码版的区别；当前向新手推荐源码＋Python，与已有基础运行环境的发布资产不够一致。
- **按用户任务收敛 UI。** 默认新手模式突出导入、换角色、字幕、改一块、保存；辅助模拟器/旧生成面板留在明确的高级入口。标称 novice 的测试不少默认切 pro 模式，需补真正的默认新手流程。
- **按真实开销限制资源。** Director/tagger/NAI 响应存在无界 read；ThreadingMixIn 请求线程没有实际被旁边的500线程 executor 限制；sidecar 缺完整并发/解码像素控制；作业历史与会话缺清理。应以批量大漫画压力测试确定合理限额，而非仅按上传文件字节数估计内存。
- **收窄缓存所有权。** worker 激活删除整个 origin 的其他 cache，注册还会清理其他 scope；应只管理本应用的缓存与注册。

## 本轮验证与边界

- main、v1.6.1 发布及五项最新 Actions 状态已核对；对应工作流为 success。
- 本地 `npm test` 完整执行并明确捕获 exit=0。
- 另运行23个脚本入口，全部 exit=0，覆盖导入、模拟器/素材/剧情、页面尺寸、文字聚焦、PNG/图片导出集成、代理/OCR/LaMa、HTTP、密钥保护、网络、NAI错误、本机origin与端口检测。部分真实 Tesseract/CJK 和被占用端口子用例被跳过，不将它们算作实机通过。
- 后端审查另执行65个相关现有用例：52通过、13跳过；与上述脚本有重叠，不能相加成一个总通过数。
- 补充生产函数/缓存/模型依赖/受控本地网络复现发现上面的问题；这些场景现有回归未覆盖。
- 本环境 Playwright 可用，但没有 Chromium 可执行文件；尝试安装返回无效下载，故本轮未完成真实浏览器点击验收。
- 未调用真实 GPT/NovelAI、未下载大模型、未在 Windows 真机安装；不声称已测所有画质、身份一致性、发布包启动与硬件性能。
- 仓库工作区保持无改动。审查范围已扩大，但报告不保证穷尽所有潜在 bug。

## 建议修复顺序

1. 01–05：丢数据、页面副本身份、自动保存并发与付费结果归属。
2. 06–12、18–20：任务 ID/取消/历史、服务配置、素材与场景数据。
3. 13–17、24：真实 NAI 参数合同、本机模型加载与并发、代理连接校验。
4. 21–23及静态发现：长剧本分页、离线与启动、PSD往返、安装器排除。
5. 一次完整实机验收：新手导入两页→修改→复制→保存重开→批量取消/切页→导出 PNG/PSD，再做真实 API 和干净 Windows 安装。

验收门槛应是“数据不丢、目标不串、取消有效、失败可恢复、导出往返一致”，不能仅用新增功能数量或 CI 绿灯代表完成度。


# 第二轮扩大筛查与聊天模型修复

用户新增要求：聊天模型可以由用户自行设置。继续扩大筛查，保持与第一轮发现去重。审查缺陷仍以 main `ca9572de1640a7acb462bd49e69fb75de343e7c7` 为基线；下面的聊天配置修复在独立分支。

## 聊天模型已修复到独立草稿 PR

[PR #5：允许自定义聊天模型，保留用户配置](https://github.com/h1neolzr7f/Manga-NAI-GPT/pull/5)  
分支：`codex/custom-chat-model-audit`，提交：`c6f998b4bad3a8ab0d456d3fc9b8857acd00fafd`。**尚未合并，发布版1.6.1仍保留旧问题。**

本修复覆盖原第11/12项，并补上加载设置时无浏览器Key就清空自定义URL的错误迁移。用户填写的地址、Key、模型名由用户决定；模型ID只裁掉首尾空格，保留大小写，GPT/Qwen/私有部署不会被替换。列表只提供建议，不限制手填模型；刷新和异步加载也不覆盖手填值。标准OpenAI /models无supported_protocols字段仍能列出。模型按钮采用DOM文本渲染，避免把任意模型ID当HTML。

服务端环境DIRECTOR_MODEL也保留原值。Key和地址原有发送限制未放宽；没有预填第三方地址。已在review中识别并移除“浏览器没Key就删除地址”的逻辑，支持Key放在服务端.env的用户配置。

验证：修复前新增用例明确失败，修复后8个JavaScript场景＋6个真实localhost HTTP代理用例通过；npm test、npm run lint、git diff --check、no-third-party-director 10项、local-secret-guard 11项通过，独立代码复查无其他重要问题。远端提交树SHA与本地测试提交树一致。未调用付费聊天模型；真实浏览器点击尚未完成。

## 新增24项具体问题（25–48）

以下主要是原生产函数和实际codec的受控离线复现，网络、DOM、模型或解码时序按场景替换成测试依赖。它们证明控制流/数据合同问题，不等于完成实际服务画质或浏览器像素验收。

### 25 — 仅改文字样式/翻转图片，撤销和自动保存不记录（P1）

位置：[js/sidebar/text/text-effect.js:229](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/text/text-effect.js#L229)；[js/core/util/image-util.js:297](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/util/image-util.js#L297)。

字体大小/颜色和侧栏翻转只 set/render，不保存历史或发 object:modified。建立自动保存后仅改这些属性，live 为64/红色，历史仍32/黑色；下一次自动保存写入次数为0。图片翻转 likewise live true/true、历史 false/false。手动保存或另一项已记录编辑可能偶然补救，不能据此认为安全。

修复方向：所有用户属性更改应结束一个完整历史事务，dirty 状态应对应 live 编辑。

### 26 — 复制选中图层，复制出同一个 GUID（P1）

位置：[js/core/command-history.js:143](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/command-history.js#L143)；[js/core/settings.js:90](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/settings.js#L90)；[js/core/util/fabric-util.js:243](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/util/fabric-util.js#L243)。

执行生产 Commands.run('sel.duplicate') 后，两层同名身份 layer-A；生产 createGUIDMap 的 size 只有1。该命令仅改坐标/名称，克隆时连 guid、guids 与模拟器身份都带过去。与首轮“复制页面”是不同问题。

修复方向：重建副本及子对象身份，并正确重映射副本内部关系，避免旧任务、父子层关系指向原件。

### 27 — AI Fill 快速双击生成，发送双倍请求（P1）

位置：[js/ai/ai-fill.js:231](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/ai-fill.js#L231)；[js/ai/ai-fill.js:254](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/ai-fill.js#L254)；[js/ai/ai-fill.js:276](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/ai-fill.js#L276)。

busy 在等待服务 readiness 与页面解码之后才设置。同步触发两次 generate，实际代码向测试传输发送6次请求，原本一轮应为3个候选。真实 API 未调用，但重复请求路径已经确认。

修复方向：第一处 await 前同步占用会话/操作，所有异常出口释放对应操作；验证双击期间只产生一轮候选。

### 28 — AI Fill 候选跨页错贴（P1/P2）

位置：[js/ai/ai-fill.js:92](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/ai-fill.js#L92)；[js/ai/ai-fill.js:313](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/ai-fill.js#L313)；[js/ai/ai-fill.js:319](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/ai-fill.js#L319)。

会话没有原页面 GUID，应用等待图片解码后直接加到复用 canvas。A 开始应用、切到B、完成解码，A补丁实际插入B。生成后先切页再点应用同样没有目标校验。

修复方向：保留来源页面、源图版本、目标身份；解码后和真正 mutation 前再核对，过期结果保留为候选。

### 29 — 关闭重开 AI Fill，旧解码结果污染新会话（P2）

位置：[js/ai/ai-fill.js:176](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/ai-fill.js#L176)；[js/ai/ai-fill.js:281](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/ai-fill.js#L281)；[js/ai/ai-fill.js:290](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/ai-fill.js#L290)。

三张响应全部完成后，延迟 unpad 图片解码，实际调用 close()，再开新的 busy 会话。释放旧解码，旧任务把 candidates 写入新 S，并把新 busy/controller 清空。复现不依赖传输层忽略取消。

修复方向：捕获具体会话对象/令牌，每个 await 后检查；finally 只能清理自己的会话。

### 30 — 异步插入聊天模板，会删除另一页新选中的聊天（P1）

位置：[js/simulator/chat-controller.js:201](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/chat-controller.js#L201)；[js/simulator/chat-controller.js:242](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/chat-controller.js#L242)。

A发起 renderScene，等待中切B并选中B已有聊天。渲染完成后才查 current selected group，B聊天被删除，A输出插入B。不是仅多出一个对象，而是破坏性替换。

修复方向：渲染前固定来源页面和拟替换对象；渲染后验证仍在原页、对象仍是同一目标。

### 31 — GPT 自动引用了上一页识别的人物（P2）

位置：[js/ai/character-library.js:177](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/character-library.js#L177)；[js/ai/gpt-region-editor.js:1342](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/gpt-region-editor.js#L1342)。

A识别到Alice，切到B选同坐标区域，cardForRegion 没核对 region.pageGuid 与识别缓存来源，返回A的Alice。GPT可能自动发送不相干参考图。

修复方向：按页面与源图修订绑定识别结果；切页立即失效旧结果，自动参考前再校验。

### 32 — 角色特征后台构建覆盖新编辑，并复活已删除角色（P2）

位置：[js/ai/character-library.js:18](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/character-library.js#L18)；[js/ai/manga-character-bible-ui.js:142](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/manga-character-bible-ui.js#L142)。

buildIdentity 捕获整张旧卡，await embedding 后完整 put。期间改名字/tags，则旧字段覆盖新编辑；期间删除，则完成后卡又出现。两种场景都已复现。

修复方向：完成时重读卡，检查仍存在及参考图修订相同，只合并 identity 字段，不回写旧整卡。

### 33 — 正常角色参考图自动识别功能实际上被 JPEG/PNG 合同打断（P1）

位置：[js/ai/manga-character-bible-ui.js:65](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/manga-character-bible-ui.js#L65)；[js/ai/character-library.js:20](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/character-library.js#L20)；[manga_character_library.py:89](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/manga_character_library.py#L89)；[manga_smart_ocr.py:35](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/manga_smart_ocr.py#L35)。

优化上传参考图总是输出 JPEG；角色库直接把它传给 character-embed；后端 read_image 只接受PNG。有效JPEG进入生产 embed，在模型已准备的fixture下返回400“当前只支持 PNG 画布截图”。UI后台 catch 吞掉此失败，卡能保存却没有 identity。

修复方向：统一图像格式合同：后端正确解码白名单格式，或 embedding 请求前转PNG；失败状态必须可见。

### 34 — 旧批处理在结果未知/出图后写盘失败时，自动重复生成（P1）

位置：[scripts/novelai-batch-tools.mjs:297](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/scripts/novelai-batch-tools.mjs#L297)；[scripts/novelai-batch-tools.mjs:323](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/scripts/novelai-batch-tools.mjs#L323)。

generateImageWithRetry 捕获所有异常，默认最多8次。测试模拟已出图随后磁盘满，3次重试得到3次已接受请求；模拟上游已接受但响应丢失也得到3次。与新版前端避免重复扣费的保护不一致。

修复方向：把发送、读取、解码、写盘分阶段；出图后仅重试本地保存，结果未知不自动重发付费请求。

### 35 — 旧批处理忽略用户选择的服务端端口（P2）

位置：[scripts/novelai-batch-tools.mjs:451](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/scripts/novelai-batch-tools.mjs#L451)；[scripts/novelai-batch-tools.mjs:524](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/scripts/novelai-batch-tools.mjs#L524)；[99_server.py:589](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/99_server.py#L589)。

设 MNAI_PORT=17333，生产 generateComicDemo 仍请求127.0.0.1:8000。8000没有本应用会失败；8000若为另一副本则混用其服务/文件环境。素材预览和漫画样稿都硬编码该端口。

修复方向：启动子进程时传递实际服务base URL，前端/脚本/代理统一；自定义端口必须跑完整批任务验收。

### 36 — 切换 NovelAI Token，费用预估仍用上个账号会员/余额（P2）

位置：[js/ai/nai-engine.js:20](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/nai-engine.js#L20)；[js/ai/nai-engine.js:29](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/nai-engine.js#L29)。

全局 subscription cache 120秒没有token键。A为Opus，换B后costText不查B，仍显示A的免费和余额。生产函数fixture确认第二次health请求次数为0。

修复方向：缓存绑定凭证身份；切换账号失效；迟到的旧账号health响应不能覆盖当前结果。

### 37 — 高级生成的固定种子0被当成随机（P3）

位置：[js/ai/provider/novelai-provider.js:247](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/provider/novelai-provider.js#L247)；[js/ai/provider/novelai-provider.js:293](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/provider/novelai-provider.js#L293)。

输入阶段支持0，但 cleanBaseRequest 只保留 seed>0。固定Math.random=0.5时，用户种子0变为2147483647；新手核心路径已支持0，两个入口不一致。

修复方向：明确支持有限整数0及合法最大值，随机使用单独哨兵。

### 38 — 油漆桶/仿制图章破坏裁剪、混合及图层顺序（P1）

位置：[js/ui/visual-ps-tools.js:279](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/visual-ps-tools.js#L279)；[js/ui/visual-ps-tools.js:347](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/visual-ps-tools.js#L347)；[js/ui/visual-ps-tools.js:495](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/visual-ps-tools.js#L495)。

替换图片仅保留部分变换、opacity、GUID，移除原图并在末尾add。复现裁剪分镜图原本在文字下，填色后到文字上；clipPath、multiply、名称、aiFill等元数据丢失。

修复方向：用同层级、同对象语义替换像素，保留剪裁与相关metadata；一次历史事务，并验证图层顺序/目标一致。

### 39 — 旋转/翻转图像的油漆桶和图章点错像素（P2）

位置：[js/ui/visual-ps-tools.js:302](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/visual-ps-tools.js#L302)；[js/ui/visual-ps-tools.js:319](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/visual-ps-tools.js#L319)。

localToImage仅减left/top再除scale，无逆变换。10×10图旋转90°于(100,100)，画布内点(95,105)应映射(5,5)，实际为(-5,5)并被拒绝。翻转图也按未翻转像素定位。

修复方向：使用图像完整逆变换矩阵处理旋转、origin、flip与缩放；验收任意旋转与中心origin。

### 40 — 旧 ZIP 项目存在两条独立加载失败路径（P2）

位置：[js/project-management.js:101](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/project-management.js#L101)；[js/core/compression/project-compression.js:231](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/compression/project-compression.js#L231)；[js/core/compression/lz4.js:152](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/compression/lz4.js#L152)。

平铺的单页ZIP被multiLoadZip当成多页容器，只找嵌套.zip，得到零页；DEFLATE嵌套ZIP转换则直接复制JSZip compressedContent，不解压，state JSON变成压缩字节并JSON.parse报错。使用实际打包JSZip/DEFLATE复现。

修复方向：明确识别单页与多页ZIP，通过zipEntry.async读取解压数据；对STORE和DEFLATE老项目都做迁移往返。

### 41 — 模拟器分页插入漫画会把人物和文字压扁（P2）

位置：[js/simulator/playback-controller.js:99](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/playback-controller.js#L99)。

scaleX按可用宽计算，scaleY独立按180px高度计算。1000×1800图插到1000宽画布时scaleX=.43、scaleY=.1，宽高比从.5556变成2.3889。

修复方向：宽高共同计算单一fit scale，两轴一致；允许用户另行明确非等比变换。

### 42 — 移动模拟器整页后，分页数量和裁切范围变化（P2）

位置：[js/simulator/extra-renderer-factory.js:183](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/extra-renderer-factory.js#L183)；[js/simulator/longshot-exporter.js:18](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/longshot-exporter.js#L18)。

pageView高度相对页面，objects.top仍绝对画布坐标。3600高页面移到top=2000，以1800分页，实际得到3页而非2页，最后裁切起点5600已在原页底部外。生产分页/capture参数已复现，实际图像像素待浏览器验收。

修复方向：先规范坐标为导出页面相对值，处理真实变换并夹到边界；移动前后导出内容应一致。

### 43 — 隐私模式遗漏实际图层预览和导入文件缩略图（P2/P3）

位置：[css/task-launcher.css:162](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/css/task-launcher.css#L162)；[js/layer/layer-management.js:473](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/layer/layer-management.js#L473)；[js/assets/asset-library-controller.js:125](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/assets/asset-library-controller.js#L125)。

隐私CSS匹配layer-item img，实际createPreviewImage输出DIV.layer-preview，通过backgroundImage显示图像；导入素材asset-library-card img也没覆盖。生产函数确实输出DIV。README承诺模糊文件缩略图，当前实现覆盖不完整；浏览器CSS绘制待验。hover主动显示是设计，不算新缺陷。

修复方向：覆盖真实DOM类与背景图；定义每个候选/历史/角色/素材预览的隐私覆盖，补CSS真实操作验收。

### 44 — 合法长文件名使本机抠图在推理前失败（P2）

位置：[local_tools/server.py:134](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/local_tools/server.py#L134)；[local_tools/server.py:263](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/local_tools/server.py#L263)。

244字符PNG名称可正常创建，但处理流程为临时文件把随机前缀拼到完整文件名，超255字节得到ENAMETOOLONG/errno36，processor未运行。

修复方向：临时名只保留简短随机名及扩展名，或移除没使用的临时文件。

### 45 — 同时下载同一示例图包，临时文件互相抢占（P2）

位置：[prompt_helper_images.py:78](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/prompt_helper_images.py#L78)；[prompt_helper_images.py:99](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/prompt_helper_images.py#L99)；[prompt_helper_images.py:113](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/prompt_helper_images.py#L113)。

两个请求共同写target.part并os.replace。受控并发验证一项成功、另一项FileNotFoundError。多个标签页/窗口可触发，不是模型推理问题。

修复方向：同包串行或唯一临时文件；提交阶段验证，不共享固定.part。

### 46 — 网络字体族名没有URL解码（P2）

位置：[js/core/font/font-manager-core.js:424](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/font/font-manager-core.js#L424)；[js/core/font/font-manager-core.js:434](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/font/font-manager-core.js#L434)。

family=Roboto+Slab:wght@400 被保存为Roboto+Slab而非Roboto Slab，选择器因此使用不匹配字体族，回退默认字体。生产registerWebFont函数已复现。

修复方向：URL.searchParams解码plus/percent；保存与应用真实CSS字体族名。

### 47 — 移动/缩放 AI Fill 图层后导出 PSD，退回原始位置（P2）

位置：[js/ui/psd-io.js:38](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/psd-io.js#L38)；[js/ui/psd-io.js:78](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/psd-io.js#L78)。

aiFillLayer使用aiFill.box的原始位置尺寸，忽略live变换。实际ag-psd往返fixture：live left/top=8/8、scale2，导出left/top=0/0、4×4原始像素。旋转/翻转同样不在该分支处理。

修复方向：按live变换导出图像与蒙版，对齐导出坐标；元数据原始框不能覆盖用户后续修改。

### 48 — 导出 PSD 丢掉画布背景色（P2）

位置：[js/ui/psd-io.js:73](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/psd-io.js#L73)；[js/ui/psd-io.js:91](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/psd-io.js#L91)。

导出只遍历对象，canvas.backgroundColor不作为层；composite固定白色。粉色背景fixture解码PSD得到白色，无代表粉色背景的层。

修复方向：按画布实际背景导出可编辑背景或正确合成；分别验收有色、透明背景。

## 第一轮PSD待验证项已推进到codec/生产函数复现

- 半透明图层重复opacity已确认：红色图层50%透明度导出为像素alpha128/255，再乘PSD层opacity128/255，有效约25.2%。仍需真实编辑器显示验收。
- 编辑文本变换/颜色丢失已确认：缩放旋转文字导出单位矩阵；应用正常rgba红色被PSD文本色解析为黑色。竖排FancyFont导入变为无字体/角度属性的水平Textbox。
- 父组隐藏/25%opacity/multiply丢失已确认：实际ag-psd读取后导入子对象为visible=true、opacity1、source-over。

这些对应首轮静态列表第3/4项，**不重复算作新增25–48项**。验证使用实际捆绑ag-psd、JSZip和从加载的Fabric提取的方法；像素/DOM渲染部分为确定性的替代依赖。

## 新增安全候选：导入SVG可能成为同源活动文档

位置：[99_server.py:227](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/99_server.py#L227)；[99_server.py:1127](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/99_server.py#L1127)。

已确认：导入带script的SVG原文被保存，并按image/svg+xml同源提供，没有sandbox CSP或attachment声明。

明确触发前提：用户导入恶意SVG，随后将其持久化本地URL作为文档打开。仅通过img元素展示不会执行脚本。本轮没有完成浏览器SVG脚本执行测试，因此将其列为待浏览器验证的安全候选，不算已完成利用验证。若以文档上下文执行，将共享编辑器origin的存储与同源API权限。应清洗SVG、隔离origin或对文档打开实施恰当sandbox。

## 新增验证记录

以下所有补充复现均由主审重新执行，取得对应输出；没有付费调用或大模型下载。

| 复现脚本 | 范围 | 本轮结果 |
| --- | --- | --- |
| expanded_frontend_repro.cjs | AI Fill重入/跨页/会话、自动参考图、卡更新、会员缓存、聊天替换、seed0 | 9个场景通过（包含卡编辑/删除两个场景） |
| ancillary-audit-repro.cjs | 图层复制GUID、模拟器比例/分页、隐私DOM | 全部通过 |
| psd-zip-audit-repro.cjs | 实际ag-psd/JSZip＋Fabric方法：opacity、文字、分组、AI位置、背景、两种ZIP | 全部通过 |
| property-history-audit-repro.cjs | 文字属性/图片翻转与自动保存 | 全部通过 |
| image-edit-audit-repro.cjs | 油漆桶属性/顺序、坐标变换 | 全部通过 |
| backend-audit-round2.py | 旧批任务端口/重试、长文件名、下载并发、JPEG、SVG提供、字体 | 8项通过 |

以上审查脚本是临时验证工具，并非已经合入项目的持续回归。聊天配置的8＋6项是本PR正式新增回归，已接入npm test。现有主回归依旧通过，说明其覆盖没有涵盖这些新增失败场景。

## 更新修复顺序

1. 先处理第一轮保存/复制页问题，再处理25–34、38：用户数据、重复请求/费用和破坏性图层替换。
2. JPEG参考图33与旧批处理重复生成34优先：功能静默失败/重复收费会直接损害用户体验。
3. 修人物卡并发及参考图归属31/32、Token费用缓存36，以及已有本机模型初始化/清理竞态。
4. 修PSD往返（已确认静态项＋47/48）、ZIP迁移40、画笔坐标39、模拟器分页41/42。
5. 端口、下载、长文件名、字体、隐私和条件安全候选补齐；完成真正的默认新手模式、干净Windows和真实API完整验收。

本轮完成的是**聊天配置修复＋扩大审查**；其余新增问题尚未修复，第一轮未列入PR的旧问题也仍然存在。不把问题数量当成完成度，更不声称已穷尽所有bug。


# 第三轮：生产手册驱动的流程与语义检查

本轮用户补充《Manga-NAI：漫画创作与生产手册（供 Agent 使用）》（附件 AGENT (1).md，文档日期2026-09-29）。已完整阅读441行；文档引用的153页工程、nai_generate.py和lettering_core.py没有随本附件提供，当前Manga-NAI-GPT仓库也没有这些对应目录，不能将文档自述“本次核验”当成本轮已执行验证。

## 这份手册与编辑器的关系

它适合作为产品的创作与验收需求来源：

| 手册要求 | 当前项目已有基础 | 还需适配或补足 |
| --- | --- | --- |
| 剧情→逐页分镜→提示词 | ScriptPageCore、ScenePlan、画一页 | 稳定page/panel/line ID、source/purpose、连续性、审定版本，不能仅保留画面和纯对白字符串 |
| 角色身份、服装、道具连续性 | 角色库、角色标签、系列种子 | 跨页状态与语义检查；同种子不能代表身份、服装、物品位置完全一致 |
| 代表页试图、4–6页检查后继续 | 队列、候选预览、人工review状态 | 全篇选图、六页联系表、计划/实际格数、叙事与实际画面的验收记录 |
| 未知结果不盲重发、请求哈希和输出留档 | 新版NaiEngine有部分未知结果保护 | 旧batch重复生成问题34仍在；需统一请求身份、持久化pending/verified状态与本地保存重试 |
| 对白逐句对应、读序和说话人清楚 | 脚本解析、气泡布局、OCR/改字幕 | 不能在解析/合并/转换时丢说话人，不能仅凭OCR通过判定文字合格 |
| clean/safe/protect不同蒙版 | 文本ink mask、局部保护、非破坏图层 | 实际清字和排字边界分离、逐字与像素检查，避免覆盖边框/人物 |
| 当前项目自主决定流程与参数 | 自定义服务和编辑器多个入口 | 手册规则应可选，不能把2–4格/2人/六页节奏直接硬编码成所有用户的限制 |

三处必须避免原样照搬：
1. 手册主要示范**整页一次生成**；当前“画一页”有**每格生成后拼页**路径。不能把“Exactly THREE frames”整页prompt直接发给每格，否则出现格内再分格。
2. 手册jobs数组与pages.json是其专用客户端格式，当前ScenePlan/向导字段不同；需要显式转换并保存额外创作信息。手册已正确提醒不能直接当API请求。
3. 手册客户端从.env读取NAI项；本仓库当前使用NOVELAI_API_KEY/NAI_API_KEY或界面Token。密钥规则要适配实际实现。免费资格、型号和订阅条件须实际查询，不将2026-09-29文档规则当永久官方保证。

## 新增五项：49–53

### 49 — 剧本超过四句时合并不同说话人；向导又丢掉逐句说话人（P1/P2，生产函数复现）

位置：[js/ai/script-page-core.js:71](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/script-page-core.js#L71)；[js/ai/script-page-core.js:77](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/script-page-core.js#L77)。

一格内甲乙交替五句，解析后第四条为speaker=乙、text=第四句第五句，甲的第五句被归给乙。随后toWizard把所有speaker去掉，只保留用斜杠分开的文字。文字没有消失，但审定语义和气泡归属已经改变，直接违反手册要求的逐句映射。

修复方向：超过容量时显式拆格/气泡或提示人工处理；只合并同一说话人的连续文本。向导和后续气泡布局应传递稳定line ID与speaker，不按人物空间顺序猜对白归属。两种数据丢失发生在同一对白管线，计为一项。

### 50 — 显式多行字幕溢出，却被判为已适配（P2，生产函数复现）

位置：[js/ai/manga-smart-text-core.js:84](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/manga-smart-text-core.js#L84)。

fitText的首个成功分支仅检查最长行长度，不检查全部行在跨行方向的总尺寸。100×20框内五个单字行，返回字号17、五行、wrapped=false，无overflow；按当前lineHeight1.16计算文本块约98.6高。自动换行分支有高度检查，用户显式换行却绕过它。

修复方向：单行与多行走统一的宽高适配，无法在最小字号放下时明确overflow，不能通过扩大框/压扁字体掩盖。

### 51 — 气泡尾巴的全页人物索引与格内索引混用（P2，生产函数复现）

位置：[js/ai/balloon-layout.js:80](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/balloon-layout.js#L80)；[js/ai/balloon-layout.js:108](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/balloon-layout.js#L108)；[js/ai/balloon-layout-core.js:69](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/balloon-layout-core.js#L69)。

speakers返回全页faces索引；place先筛到当前格，再按同一数字取格内face。第二格唯一人物全页index=1，筛选后只剩格内index=0，结果tail=null。对同一坐标输入格内index=0能正确得到tail。多个格内人物还可能错指另一人。

修复方向：在筛选时保持原face身份或统一转换到局部索引。验收跨格说话人与尾巴，不只统计气泡是否生成。

### 52 — 导入底图的移动/缩放事件也被历史过滤（P1/P2，事件过滤已复现，完整操作待浏览器验证）

位置：[js/sidebar/panel/panel-manager.js:85](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/panel/panel-manager.js#L85)；[js/layer/image-history-management.js:31](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/layer/image-history-management.js#L31)；[js/fabric/fabric-management.js:119](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/fabric/fabric-management.js#L119)。

initialPutImage设置saveHistory=false；后续object:modified通过isSaveObject(event)判断，event.target.saveHistory=false会被拒绝。该判断连target.saveHistory=true也拒绝：只有target.saveHistory未定义会保存。实际生产判断函数对这两个事件均返回false。

这与25“属性按钮未发事件”不同：此处事件可以正常发出，却在过滤层被阻断。完整编辑器的拖动→撤销→自动保存往返仍需浏览器验证，不夸大为所有图层都受影响。

修复方向：初次批量放置的临时历史暂停与对象长期编辑权限分开，明确target字段的true/false语义。

### 53 — 重置设置连带清除素材索引与生成任务记录（P2，生产函数复现）

位置：[js/project-management.js:659](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/project-management.js#L659)；[js/assets/asset-store.js:12](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/assets/asset-store.js#L12)；[js/assets/image2-job-store.js:3](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/assets/image2-job-store.js#L3)。

执行生产resetAllSettings的确认按钮，会localStorage.clear()。用于导入/生成素材的nai_comic_asset_manifest_v1和image2任务记录一并删除，确认列表的六项设置说明没有明确列出这些创作资产。素材IndexedDB blob可能仍留着，但索引缺失；加载只恢复blob而不重建素材metadata，导致素材库列表消失。

修复方向：只重置本应用设置键，若另有清除创作数据操作应明确列出并独立处理。**没有证据称IndexedDB角色卡也被这一操作删除**，不把所有存储都笼统说成丢失。

## 验证、CI状态与未完成项

- round3-process-audit-repro.cjs由主审编写并执行通过，六条输出覆盖以上五项（49包含解析/向导两个阶段）。
- 第三轮审查时产品基线为ca9572d。随后main已增加本审查和生产手册文档；产品代码基线未变。聊天修复PR5仍为独立草稿，未合并。
- **补充先前未完成的CI结论：PR5四项工作流成功，full acceptance失败。** 作业日志为37 PASS、1 FAIL；失败是flow7“生成中切页→切回后应用”。第2页未被改动，但回到第1页后也没有应用成功，状态仍提示当前在第2页。
- 该失败没有新增控制台page error。当前尚未证明由聊天设置修改引起，也未证明只是测试不稳定；不擅自归因，不改断言或反复点击来掩盖。
- 完整mock Chromium交互、安全HTTP、旧回归与Windows便携检查等子作业均成功；失败的是含真实Tesseract的默认全任务作业。不能将“部分通过”说成全部CI通过。
- 浏览器本地验证和失败根因定位仍未完成。上传手册的153页、NAI客户端/嵌字工具也未取得源码或图像，本文没有替它们做真实性/全篇质量背书。
- 这轮没有新增产品代码改动；新增发现尚未修复。接下来的验收应同时检查数据完整、真实图像、逐句语义和流程状态。

# 第四轮：抠图像素、异步归属与工程导入事务

本轮把全部报告、原始生产手册、适配说明和诊断工具写入GitHub main。产品代码仍以ca9572d为基线；第一批文档提交为64fed95。继续执行生产函数和真实PNG像素检查，新增54–58五项，现有编号合计58项。重复机制的补充归入原编号，不重复计数。

### 54 — 裁掉透明边缘后，抠图被拉回原尺寸并发生移位（P2，真实像素与生产函数复现）

位置：[local_tools/cutout.py:116–134](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/local_tools/cutout.py#L116)；[local_tools/model_manager.py:203–204](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/local_tools/model_manager.py#L203)；[local_tools/server.py:263–275](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/local_tools/server.py#L263)；[js/local-tools/background-removal-client.js:257–269](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/local-tools/background-removal-client.js#L257)、296–305（均为上述产品基线）。

100×100源图以200×200显示，人物像素在源图(60,20)。生产postprocess_rgba开启crop返回14×14 PNG；客户端仍保留原left/top，并把结果缩放回200×200。人物页面x本应为220，却变成128.571；正确裁切后放置应为left=216、top=86，保持每个源像素的显示比例。服务响应缺少裁切偏移，全图和选区应用都无法还原它。

修复方向：服务返回原尺寸和crop box，应用时保留像素尺度、按源图变换映射裁切偏移，覆盖缩放、旋转、翻转和不同origin。不能只将输出尺寸替换成输入尺寸。

### 55 — 浏览器颜色抠图忽略裁切、羽化和只输出蒙版（P2，真实像素与生产函数复现）

位置：[index.html:1342–1346](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/index.html#L1342)；[js/local-tools/background-removal-client.js:64–66](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/local-tools/background-removal-client.js#L64)、339–357、373–378、430–435。

界面勾选crop=true、only_mask=true，feather=4，执行公开processSelected颜色抠图分支，结果仍是100×100彩色红色前景；alpha只有0/255，没有裁切、没有灰度蒙版、没有羽化。神经网络失败后的颜色回退复用同一路径。UI选项可见且被采集，但未进入实际像素后处理。

修复方向：颜色分支与神经网络分支统一后处理语义，或明确禁用不支持的选项。回退时说明结果变化，不静默把蒙版请求变成彩色图。

### 56 — 抠图等待期间切页，把原页结果贴到新页（P2，受控异步生产函数复现）

位置：[js/local-tools/background-removal-client.js:292–329](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/local-tools/background-removal-client.js#L292)、364–393、412–450。

A页发起replace抠图，等待服务返回时将全局canvas载入B页。结果返回后remove(source-A)没有删除B对象，却把A的抠图加入B，并在当前canvas调用历史保存。受控fixture确认B原对象保留、A结果新增，backgroundRemovalSourceGuid仍为source-A。该链路没有origin page GUID或源对象仍在画布的检查。

修复方向：请求保存页面、源对象和修改版本；完成时验证归属，跨页结果进入预览/候选或原页队列。不要直接操作当前全局canvas。与18/28同属异步归属问题，但抠图是独立用户流程，单列修复与验收。

### 57 — 本机颜色抠图覆盖原alpha，复活透明像素（P2，生产ModelManager真实PNG复现）

位置：[local_tools/cutout.py:137–149](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/local_tools/cutout.py#L137)；[local_tools/model_manager.py:180–184](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/local_tools/model_manager.py#L180)；[local_tools/server.py:263–275](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/local_tools/server.py#L263)、290–310；[local_tools/API.md颜色抠图API说明](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/local_tools/API.md)。

透明红像素alpha=0与半透明蓝像素alpha=128，通过公开ModelManager.remove_background(..., 'color-key', ...)以白色为背景，返回alpha=[255,255]。服务用颜色差得到的新alpha直接覆盖输入alpha，透明RGB内容重新出现，原半透明边缘变成不透明。此项针对已文档化的sidecar/API调用；编辑器浏览器颜色分支绕过服务，不把两条路径混为一谈。

修复方向：颜色键mask与原始alpha相交/相乘，不能增加原图透明度；invert也应保留输入透明区域。验收透明底、半透明抗锯齿和蒙版输出。

### 58 — 工程导入结构错误时，失败后没有回滚原页面状态（P1，生产函数复现）

位置：[js/core/compression/project-compression.js:98–126](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/compression/project-compression.js#L98)；[js/layer/image-history-management.js:145–147](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/layer/image-history-management.js#L145)、218–222。

语法错误的历史JSON会在替换前被拒绝，已有保护有效。但合法JSON中的objects=null通过JSON.parse预检；导入随后替换stateStack、清空imageMap、应用外来basePrompt和画布尺寸，restoreImage在objects.map抛错。finally只恢复加载/历史锁，不恢复旧数据。

fixture原A页仍显示left=23的对象、GUID=A，但两条原历史被替换为单条错误历史，旧图片映射清除，提示词变为incoming，画布100×100变为320×480。跳转该历史会报错；下一次saveState后undo仍因错误历史报错。没有声称导入失败一定清空可见对象，确认的是显示内容与底层历史/图片/参数已不一致。

修复方向：在临时状态中完成历史schema、图片引用和画布数据验证及加载；成功后一起提交，失败恢复全部原状态。仅预先JSON.parse不能保证事务完整。优先于外观问题处理。

## 原编号的补充证据

- **17**：浏览器容差0也被Number(tolerance)||28改为28；白色key错误删除#e6e6e6像素，实际PNG验证。
- **26**：全图抠图action=new在copyPlacement复制源guid，源图与新结果具有相同source-A GUID，生产函数复现。
- **39**：翻转的蓝左/红右源图经processRegion后变回红左/蓝右；提取调整源区域却在结果应用中丢掉flipX，实际非对称像素验证。
- **38**：抠图replace分支同样remove/add到最上层，copyPlacement未复制clip/blend等属性。此为代码检查补充，尚未额外执行完整Fabric蒙版回放，不新增编号。

## 验证与仍待查证的范围

- round4-cutout-audit-repro.cjs主审复跑取得七条确认输出：四项新增、三项旧编号补充。使用真实@napi-rs/canvas PNG和生产Python/Pillow后处理，神经网络返回由fixture控制；没有推理质量背书。
- round4-project-load-audit-repro.cjs主审执行通过，包含“语法错误保留原状态”的对照及“结构错误破坏原状态”的案例。压缩容器和DOM为确定性替代依赖，生产导入/历史函数原样运行。
- 工具目录现在有10个诊断脚本。exit=0仍表示缺陷被成功复现，不能拿它宣布修复通过。
- PR5的flow7根因仍待浏览器定位。继续读测试发现openPage只等待GUID变化，且吞掉超时，没有核对目标页GUID；应用等待又只查是否存在任一名为“GPT 局部改图”的对象，可能命中旧结果。这是验收工具的证据不足，**尚不能据此断言它就是本次失败根因**。应记录并断言目标GUID、此次结果身份及像素变化，保留原失败记录。
- 没有新增产品修复或合并PR5；上述五项仍待修复。尚未完成真实浏览器、干净Windows、真实API与用户153页工程验收，不保证穷尽全部bug。



# 第五轮：剩余模块扩查、真实像素与失败事务

本轮开始时GitHub main为5079d5f（仅文档），产品基线仍ca9572d。新增59–91共33项，现有编号合计91项。以下均有执行证据；Windows条目保留静态调用链/语言级复现的边界，不算完整Windows验收。原问题补充、产品设计限制、未验证候选另列。

### 59 — 运行中任务点×取消后，结果仍替换源图（P2）

位置：[js/ai/queue/spinner.js:35](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/queue/spinner.js#L35)；[js/ai/provider/novelai-provider.js:509](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/provider/novelai-provider.js#L509)。

一个I2I任务已running时点×，getAiTask变null、队列仍active=1，请求没有AbortSignal。释放受控响应后source-A被移除，generated-result仍回贴。没有切页或ID复用，不重复05/06。

修复方向：保存独立取消状态；应用前检查取消与源对象版本，至少阻止自动回贴。上游已发生的扣费不能据此声称撤销。

复现：[round5-queue-cancel-audit-repro.cjs](../../../scripts/audit/round5-queue-cancel-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 60 — 新旧NovelAI队列互不协调，同账号并发两次生成（P2）

位置：[js/ai/ai-management.js:3](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/ai-management.js#L3)；[js/ai/nai-engine.js:65](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/nai-engine.js#L65)。

旧图层生成使用novelaiQueue，新AI Fill/画一页使用闭包chain。生产请求函数用相同Authorization取得maxInFlight=2；旧任务完成但新版仍等待时existsWaitQueue=false，clearAllQueues也不覆盖新版。没有声称真实上游必然拒绝或多扣费。

修复方向：所有入口共用按账号调度器，统一active/waiting/取消/状态查询。

复现：[round5-queue-cancel-audit-repro.cjs](../../../scripts/audit/round5-queue-cancel-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 61 — 生成图保存了blob，却因索引失败而在重开后隐身（P2）

位置：[js/assets/asset-store.js:75](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/assets/asset-store.js#L75)；[js/assets/asset-store.js:161](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/assets/asset-store.js#L161)；[js/assets/image2-client.js:80](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/assets/image2-client.js#L80)。

只模拟manifest的localStorage写入QuotaExceeded，BlobStore成功保存1个blob；任务仍succeeded。重开hydrate得到files=1、assets=0，jobAssetResolves=false。区别于19两种文件保存都失败、53主动清设置；没有声称blob删除。

修复方向：成功状态必须包含metadata提交；失败保留生成字节供保存重试，启动可从同事务存储的metadata重建索引。

复现：[round5-assets-audit-repro.cjs](../../../scripts/audit/round5-assets-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 62 — 素材索引导入中途失败，先前覆盖和新增记录不回滚（P2）

位置：[js/assets/asset-pack.js:16](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/assets/asset-pack.js#L16)；[js/assets/asset-store.js:314](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/assets/asset-store.js#L314)。

导入三条：同ID改旧路径、增加新记录、size=-1。第三条被validate拒绝，但旧可读路径已经改成不存在的missing-backup.png，新记录也已持久化；重开仍受影响。每条register/save在完整验证前提交。

修复方向：全部验证后在临时索引合并，成功时一次提交；导入失败保持原库。

复现：[round5-assets-audit-repro.cjs](../../../scripts/audit/round5-assets-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 63 — 服务器存储截断素材唯一ID，长同名第二图覆盖第一图（P1，服务器回退条件）

位置：[js/assets/asset-manifest.js:14](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/assets/asset-manifest.js#L14)；[js/assets/asset-scanner.js:67](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/assets/asset-scanner.js#L67)；[99_server.py:222](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/99_server.py#L222)；[99_server.py:241](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/99_server.py#L241)。

不同红/蓝真实PNG使用同一个长文件名，生产ID和hash都不同，但服务器仅取ID前32字符，唯一后缀被截掉，两图落同path；第二次wb写覆盖红图。禁用IndexedDB的正式服务器回退路径中，重开两条素材都读到蓝图。IndexedDB正常时独立blob可能保住原图。

修复方向：文件身份使用完整ID的稳定hash/UUID，不截名称前缀；禁止不同身份映射同文件，原子写入。

复现：[round5-assets-audit-repro.cjs](../../../scripts/audit/round5-assets-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 64 — 删除素材与迟到持久化冲突，留下孤立blob（P3）

位置：[js/assets/asset-store.js:166](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/assets/asset-store.js#L166)；[js/assets/asset-store.js:295](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/assets/asset-store.js#L295)。

persistGenerated刚开始便remove，put被微任务延迟到delete之后。生产fixture最终libraryAssets=0、durableBlobs=1、metadataResurrected=false。确认存储泄漏，不夸大为素材索引复活。

修复方向：按asset ID串行写删，以删除版本/墓碑拒绝迟到写入，并清理无引用blob。

复现：[round5-assets-audit-repro.cjs](../../../scripts/audit/round5-assets-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 65 — 绿色裁剪/框选抠图辅助框被烘焙进PNG（P2）

位置：[js/ui/util/mode-change.js:132](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/util/mode-change.js#L132)；[js/core/util/image-util.js:597](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/util/image-util.js#L597)。

辅助框设置excludeFromExport=true，但捆绑Fabric的raster导出不读取该标志，它仅影响JSON/SVG。真实PNG白底内部变RGBA=[239,255,235,255]，绿色填色已经进入作品；隐藏红图层对照正确遗漏。

修复方向：栅格导出临时隐藏/过滤辅助对象，并在finally恢复，不能只依赖序列化排除标志。

复现：[round5-export-audit-repro.cjs](../../../scripts/audit/round5-export-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 66 — 同步导出异常跳过恢复；渲染异常还会污染live canvas（P2，受控故障注入）

位置：[js/core/util/image-util.js:634](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/util/image-util.js#L634)；[js/core/util/image-util.js:681](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/util/image-util.js#L681)；[third/Fabric.js/fabric.min_PlusEraser.js:1](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/third/Fabric.js/fabric.min_PlusEraser.js#L1)。

cropAndDownload/clipCopy在Promise catch安装前同步导出，抛错时网格已移除、drawGrid=0、错误提示=0。捆绑Fabric渲染抛错还留下200×200、interactive=false、retina=false、contextTop=null、viewport放大2倍。尚未取得自然触发该render错误的用户工程。

修复方向：公共入口以try/catch/finally覆盖同步与异步；离屏导出，或完整恢复画布尺寸、viewport、交互和上下文。

复现：[round5-export-audit-repro.cjs](../../../scripts/audit/round5-export-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 67 — 模拟器分页长图包含无关图层和编辑网格（P2，有透明区条件）

位置：[js/simulator/longshot-exporter.js:32](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/longshot-exporter.js#L32)；[js/simulator/playback-controller.js:98](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/playback-controller.js#L98)。

capturePages仅用group确定裁剪范围，仍导出整canvas。真实PNG包含无关蓝色图层[0,0,255,255]；目标透明区还包含网格[226,74,74,255]。默认不透明背景可能遮住网格，不能说所有模板都有网格；不重复41/42坐标与比例错误。

修复方向：以目标group/同simulatorPageId对象离屏渲染，指定独立背景，过滤辅助显示。

复现：[round5-export-audit-repro.cjs](../../../scripts/audit/round5-export-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 68 — 气泡OCR去重误删相邻重复字（P2，正确TSV受控输入）

位置：[manga_bubble_ocr.py:144](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/manga_bubble_ocr.py#L144)。

两个20px宽“あ”相隔1px，后接“お”。无重叠的同字仅因横向中心距离≤字宽1.2倍被判重复，生产read_bubble把「ああお」变为「あお」。未运行真实Tesseract产生该TSV。

修复方向：重复判断依据实际重叠/拆字证据并考虑方向，不能把正常字距当重复。

复现：[round5-ocr-audit-repro.py](../../../scripts/audit/round5-ocr-audit-repro.py)（exit=0表示缺陷成功出现）。

### 69 — OCR横排按字框中心高度排序，颠倒同一行（P2，正确TSV受控输入）

位置：[manga_bubble_ocr.py:161](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/manga_bubble_ocr.py#L161)。

同一行“日”“本”“語”的框为(40,40,20,24)/(61,42,20,18)/(82,40,20,24)，纵向充分重叠，却按y+h//2优先排序为「本日語」。根因与68去重不同。

修复方向：先按纵向重叠/基线聚类行，再按x排同行；保留稳定逐字映射。

复现：[round5-ocr-audit-repro.py](../../../scripts/audit/round5-ocr-audit-repro.py)（exit=0表示缺陷成功出现）。

### 70 — 竖排OCR获胜后，宽短多列仍被标横排（P2，正确TSV受控输入）

位置：[manga_bubble_ocr.py:180](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/manga_bubble_ocr.py#L180)；[manga_bubble_ocr.py:192](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/manga_bubble_ocr.py#L192)。

只有jpn_vert返回三短列从右到左「あいう」，生产读序正确却输出vertical=false。best未保存获胜方向，最后只凭整个bbox纵横比推断，后续字幕会默认横排。

修复方向：保留获胜引擎与列结构，整体高宽比作为辅助而非唯一方向依据。

复现：[round5-ocr-audit-repro.py](../../../scripts/audit/round5-ocr-audit-repro.py)（exit=0表示缺陷成功出现）。

### 71 — 智能字幕的自动遮盖擦掉气泡边线（P2，真实PNG）

位置：[js/ai/manga-smart-text-editor.js:384](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/manga-smart-text-editor.js#L384)；[js/ai/manga-smart-text-editor.js:460](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/manga-smart-text-editor.js#L460)。

只采样文字框外至少5px的白色环，便批准整个向外扩张矩形填色。气泡黑边位于20px高文字框上方2px，生产detect→apply让(100,38)从黑色变全白。原图仍在，边线被新遮盖层遮住；真实OCR是否给该紧框未测。

修复方向：擦字mask限制在安全气泡内部并保护边线，不能仅凭外环颜色批准扩张区域。

复现：[round5-text-ui-audit-repro.cjs](../../../scripts/audit/round5-text-ui-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 72 — 多列OCR整体框被当单字字号，短译文放大数倍（P2，生产字号参数）

位置：[js/ai/manga-smart-text-editor.js:472](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/manga-smart-text-editor.js#L472)。

原字宽20px、三列整体OCR bbox宽70px，两字替换经apply得到fontSize=77，原字3.85倍。竖排用整体宽度、横排用整体高度乘1.1当原字号上限，误把多列/多行尺寸当单字。不同于50显式换行适配。Fabric文字像素未实测。

修复方向：保留单字/单行中位尺寸估计原字号，整体框只用于布局。

复现：[round5-text-ui-audit-repro.cjs](../../../scripts/audit/round5-text-ui-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 73 — 智能字幕应用解码期间切页，旧字幕贴到新页（P2，受控异步）

位置：[js/ai/manga-smart-text-editor.js:435](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/manga-smart-text-editor.js#L435)；[js/ai/manga-smart-text-editor.js:502](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/manga-smart-text-editor.js#L502)。

A页apply暂停Fabric遮盖层解码，复用canvas载入B并调用公开syncPage；释放后旧A遮盖层/文字共2层仍加入B，随后清当前字幕状态。入口验证之后、await解码之后没有再次验证GUID/草稿/源像素。与18/28/56同族，但为独立字幕入口。

修复方向：捕获页面与草稿版本，每个await后及提交前复查，清理也仅清所属页。

复现：[round5-text-ui-audit-repro.cjs](../../../scripts/audit/round5-text-ui-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 74 — LaMa确认应用期间取消，迟到解码仍提交图层（P2，受控异步）

位置：[js/ai/manga-lama-inpaint-ui.js:281](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/manga-lama-inpaint-ui.js#L281)；[js/ai/manga-lama-inpaint-ui.js:377](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/manga-lama-inpaint-ui.js#L377)。

预览→确认→暂停Fabric解码→公开cancel使面板隐藏、清approved/prepared并增加ticket→释放后仍加1个lama-erase-patch并onApplied。apply提前捕获target，只查input.validate，不检查ticket/批准身份。

修复方向：应用独立ticket，每个await及提交前核对批准对象、取消状态与页面。

复现：[round5-text-ui-audit-repro.cjs](../../../scripts/audit/round5-text-ui-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 75 — LaMa更换蒙版后旧预览仍可确认，输出与所见不同（P2，真实PNG）

位置：[js/ai/manga-lama-inpaint-ui.js:196](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/manga-lama-inpaint-ui.js#L196)；[js/ai/manga-lama-inpaint-ui.js:345](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/manga-lama-inpaint-ui.js#L345)；[js/ai/manga-lama-inpaint-ui.js:359](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/manga-lama-inpaint-ui.js#L359)。

规则预览擦除两根笔画；启用检测器后mask只含第一根，但Confirm仍启用、preview.src未变。确认的实际第二笔画(86,50)仍为黑，旧预览对应像素是白。approved引用可变crop，应用读取了新mask。模型输出为桩。

修复方向：任何蒙版改动统一作废预览；批准结果保存不可变mask快照/版本。

复现：[round5-text-ui-audit-repro.cjs](../../../scripts/audit/round5-text-ui-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 76 — 智能点选抽样哈希碰撞，改图后复用旧页面embedding（P2，真实PNG＋模型桩）

位置：[js/ai/sam-click-select.js:22](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/sam-click-select.js#L22)；[manga_sam_select.py:150](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/manga_sam_select.py#L150)。

两张64×64合法PNG，黑8×8物体分别在x=3/24、y=0，均长370字符。生产每97字符采样的hashString给相同imageId=1he8qgc-aa。连续执行生产select，即使第二次带新image，set_image仅1次；第二mask仍box=[3,0,11,8]，本应从24开始。

修复方向：用覆盖全部内容的摘要及页面版本标识缓存；显式image与缓存身份不符时重建embedding。不把该桩结果当真实SAM质量验收。

复现：[round5-sam-audit-repro.cjs](../../../scripts/audit/round5-sam-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 77 — GPT智能点选丢精确mask，孔洞被填入且断开部分漏选（P2，真实像素与函数桥接）

位置：[manga_sam_select.py:99](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/manga_sam_select.py#L99)；[js/ai/sam-click-select.js:117](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/sam-click-select.js#L117)；[js/ai/gpt-region-editor.js:798](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/gpt-region-editor.js#L798)；[js/ai/gpt-region-editor.js:1523](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/gpt-region-editor.js#L1523)。

服务保留精确mask但polygon只取最大外轮廓；生产finish仅传cand.polygon，GPT重新填充lasso。候选孔洞像素alpha0变255，断开的已选部分255变0，和蓝色预览不一致；负点击排除的内部区域可能被重新允许修改。未运行真实SAM轮廓提取，候选mask/外轮廓为满足其代码合同的fixture。

修复方向：GPT应用直接使用候选精确栅格mask，完整保留孔洞/多个连通部分；轮廓仅用于显示。

复现：[round5-sam-audit-repro.cjs](../../../scripts/audit/round5-sam-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 78 — 混合结果裁透明边后被移到左上并放大（P2，真实PNG）

位置：[js/layer/blend/blend.js:495](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/layer/blend/blend.js#L495)；[js/core/util/image-util.js:367](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/util/image-util.js#L367)。

100×100混合图非透明范围[30,40,20,10]，sendHtmlCanvas2FabricCanvas裁出20×10，丢minX/Y又scaleToWidth(100)，显示变[0,0,100,50]。与54抠图响应裁切不同，这条本地混合应用已有裁切bounds却未使用。

修复方向：保留composite页面坐标、裁切偏移与像素比例，不再按全页宽重新缩放。

复现：[round5-canvas-audit-repro.cjs](../../../scripts/audit/round5-canvas-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 79 — 页面扩大后画笔离屏buffer仍旧尺寸，外侧笔迹消失（P2，真实PNG）

位置：[js/sidebar/pen/custom-brush.js:177](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/pen/custom-brush.js#L177)；[js/canvas-manager.js:198](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/canvas-manager.js#L198)。

TaperBrush在100px页绘制alpha255，生产resizeCanvasToObject(200,200)后buffer仍100px；在(150,150)绘制alpha0。新建同参数画笔对照alpha255。CustomStamp/DoubleOutline/Mosaic有相同分配模式，但仅Taper实际执行。

修复方向：尺寸变化时重建/扩容画笔buffer，或在每次笔触开始核对尺寸，保留当前设置。

复现：[round5-canvas-audit-repro.cjs](../../../scripts/audit/round5-canvas-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 80 — 滤镜切换对象时，把A像素写进B图层（P1，受控解码与生产选择事件）

位置：[js/fabric/fabric-management.js:18](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/fabric/fabric-management.js#L18)；[js/ui/control/glfx-control.js:437](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/control/glfx-control.js#L437)。

selection:updated先发起A的恢复解码，随即将lastActive改B。迟到onload读可变lastActive，remove(B)后加入A像素、复制B的guid及left=60；A本身仍在。B原像素被替换。未跑真实浏览器/WebGL。

修复方向：回调捕获原目标对象和请求版本，只操作原目标；选择改变时取消或丢弃旧恢复。

复现：[round5-canvas-audit-repro.cjs](../../../scripts/audit/round5-canvas-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 81 — 矩形直线分镜模板的所有比例重试都切分失败（P2，实际JSTS与生产模板retry）

位置：[js/sidebar/panel/knife/knife-geometry.js:146](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/panel/knife/knife-geometry.js#L146)；[js/sidebar/panel/knife/knife-line-renderer.js:98](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/panel/knife/knife-line-renderer.js#L98)；[js/panel/layout-templates.js:118](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/panel/layout-templates.js#L118)。

矩形中心竖切的交点等距离，closest/farthest比较都取首点，线端点同为(50,0)。生产9种retry比例横向和竖向全部false；捆绑JSTS无法分割零长线。几何Fabric对象为外壳，执行无旋转场景。

修复方向：按切线参数顺序取两个不同交点，明确处理相等距离；模板验证矩形横/竖与偏比例。

复现：[round5-canvas-audit-repro.cjs](../../../scripts/audit/round5-canvas-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 82 — 切分比例检查拒绝后，子图变换和clip没有回滚（P1/P2，实际JSTS＋受控Fabric）

位置：[js/sidebar/panel/knife/knife-split-engine.js:45](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/panel/knife/knife-split-engine.js#L45)；[js/sidebar/panel/knife/knife-split-engine.js:343](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/panel/knife/knife-split-engine.js#L343)；[js/sidebar/panel/panel-manager.js:169](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/panel/panel-manager.js#L169)。

100×100梯形12%竖切最终返回false并恢复原分镜，但子图scale已变1.00776、left变5.612，relatedPoly/clip指向已经删除的88×98.8临时分镜。失败操作确实改变原图；不是单纯切分不可用。

修复方向：先离屏验证比例/几何，再一起提交；失败恢复子图变换、clip/绑定、层序和分镜关系。

复现：[round5-canvas-audit-repro.cjs](../../../scripts/audit/round5-canvas-audit-repro.cjs)（exit=0表示缺陷成功出现）。

### 83 — AI安装的CPU约束被SAM2隔离构建绕过（P2，机制已复现）

位置：[scripts/install-ai.sh:18](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/scripts/install-ai.sh#L18)；[scripts/install-ai.ps1:48](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/scripts/install-ai.ps1#L48)。

SAM2使用--no-deps但未关闭build isolation；CPU index只作用于上一条pip。sam2 1.1.0源码build-system另需torch>=2.5.1，pip隔离环境重新解析构建依赖。相同要求fixture用--no-index明确禁下载，仍进入Installing build dependencies并找torch失败。没有下载torch/CUDA、未测真实安装流量。

修复方向：明确准备构建依赖后禁隔离，或给构建依赖同样受控CPU源；不能将--no-deps/SAM2_BUILD_CUDA=0当作禁构建依赖下载。

复现：[round5-startup-audit-repro.py](../../../scripts/audit/round5-startup-audit-repro.py)（exit=0表示缺陷成功出现）。

### 84 — 安装包构建遇合法单引号路径，生成Python语法错误（P3，语言级实际复现）

位置：[scripts/prepare-installer.ps1:101](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/scripts/prepare-installer.ps1#L101)。

把iconSource/iconOutput直接拼入Python原始单引号字符串。有效PNG放在“O'Brien Manga 测试”目录，同样python -c报SyntaxError；中文/空格本身正常。完整Windows打包未运行。

修复方向：路径通过sys.argv或标准编码参数传入，不直接拼入Python源码。

复现：[round5-startup-audit-repro.py](../../../scripts/audit/round5-startup-audit-repro.py)（exit=0表示缺陷成功出现）。

### 85 — 自定义抠图端口与Windows探测/提示和客户端不一致（P2，实际sidecar＋静态Windows合同）

位置：[local_tools/server.py:327](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/local_tools/server.py#L327)；[scripts/windows/start_manga_editor_nai.ps1:45](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/scripts/windows/start_manga_editor_nai.ps1#L45)；[js/local-tools/local-tools-client.js:4](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/local-tools/local-tools-client.js#L4)。

生产sidecar尊重LOCAL_TOOLS_PORT，动态端口/health实际返回ok。但Windows固定ToolsPort=8765，子进程继承自定义环境，探测及成功提示仍8765，客户端默认也8765。未在Windows执行完整链路，不说所有默认启动均失败。

修复方向：统一端口来源，启动后核验实际URL的health，再同步客户端地址；不能仅凭进程没退出说就绪。

复现：[round5-startup-audit-repro.py](../../../scripts/audit/round5-startup-audit-repro.py)（exit=0表示缺陷成功出现）。

### 86 — 旧版导演角色卡输入显示改了，实际设定未保存（P1/P2，生产函数复现）

位置：[js/ai/prompt/auto/character-card-manager.js:113](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/prompt/auto/character-card-manager.js#L113)。

初始化先renderAll后saveCards；保存用normalizeCard克隆替换cards对象，输入回调仍闭包旧card。首次输入“新”和继续输入“新设定”，界面值变化，但getCards、basePrompt及localStorage均仍“原始设定”。区别于32现代CharacterLibrary异步覆盖。

修复方向：按稳定ID更新当前对象，或只在序列化时normalize；验收连续输入、项目重开和导演实际读取。

复现：[round5-prompt-plan-audit-repro.cjs](../../../scripts/audit/round5-prompt-plan-audit-repro.cjs)。

### 87 — 40页及更长工程无法生成自动提示词页计划（P2，生产函数复现）

位置：[js/ai/prompt/auto/auto-prompt-util.js:46](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/prompt/auto/auto-prompt-util.js#L46)。

结构固定最多3周期，每周期最多11页，加转场/首尾后上限39。40/153页执行generatePageList都在100次随机尝试后抛unknwn page generate.；合法最大随机值对照实际结构39页。与21单页布局负高度不同。

修复方向：按目标页数确定性分配阶段并验证总和，验收39/40/153与小页数。

复现：[round5-prompt-plan-audit-repro.cjs](../../../scripts/audit/round5-prompt-plan-audit-repro.cjs)。

### 88 — 标签补全删除权重表达式关闭标记（P3，生产函数复现）

位置：[js/ai/prompt-assist.js:62](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/prompt-assist.js#L62)。

生产scan/input/Tab回调对普通blu正常补成blue hair；1.2::blu::变为1.2::blue hair，{blu}变为{blue hair，分别丢::和}。accept保留前缀却删掉到逗号的全部后缀。标签库来自离线缓存。

修复方向：解析并只替换正文，保留成对前后权重标记；覆盖光标在标签中间、数字权重、花/方括号。

复现：[round5-prompt-plan-audit-repro.cjs](../../../scripts/audit/round5-prompt-plan-audit-repro.cjs)。

### 89 — 网点渐变、速度线密度因三倍坐标混用出错（P2，生产函数复现）

位置：[js/sidebar/tone/tone.js:23](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/tone/tone.js#L23)。

100×100目标创建300×300 buffer并ctx.scale(3)，生成又用300作逻辑尺寸。真实生产网点在逻辑(50,90)alpha=76，取消超采样的同函数对照为229；速度线density=12仅5个可见横线段（含裁切下边缘）。放置步骤未执行。

修复方向：统一逻辑尺寸和像素buffer尺寸，生成用逻辑尺寸，超采样只作用于栅格化。

复现：[round5-sidebar-audit-repro.cjs](../../../scripts/audit/round5-sidebar-audit-repro.cjs)。

### 90 — 集中线重复加入同一对象，更新留下旧图层（P2，生产函数复现）

位置：[js/sidebar/tone/focusline.js:213](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/tone/focusline.js#L213)。

putImageInFrame内部add后，updateFCFabricCanvas又add同一对象。生产函数及捆绑Fabric.Collection第一次得到[panel,F1,F1]，第二次[panel,F1,F2,F2]，remove只移掉一个重复引用。纯path同步SVG解析回调按依赖实际语义建模，DOM/clip为外壳。

修复方向：仅由一个入口add并明确返回对象；更新前移除所有旧效果引用，验收连续调参数、删除、保存和重开。

复现：[round5-sidebar-audit-repro.cjs](../../../scripts/audit/round5-sidebar-audit-repro.cjs)。

### 91 — 辉光尺寸被按二十进制解析（P3，生产函数复现）

位置：[js/sidebar/effect/effect-manager.js:196](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/effect/effect-manager.js#L196)。

原change回调parseInt(effectSize1.value,20)，UI输入20实际shadow.blur=40，输入250得到900，效果值和用户设置不一致。DOM事件为fixture，生产回调原样执行。

修复方向：使用十进制或Number，并验收0/20/250与滑块实际参数。

复现：[round5-sidebar-audit-repro.cjs](../../../scripts/audit/round5-sidebar-audit-repro.cjs)。


## 安装机制的外部依据

已核对[PyPI sam2 1.1.0源码包](https://pypi.org/project/sam2/1.1.0/#files)，152,836字节，SHA256为7e0ea252d43c10d853e3acfce0b5770ac683c30481bd6de311300e9d44f45b74；其构建要求与[上游pyproject](https://github.com/facebookresearch/sam2/blob/main/pyproject.toml)一致。[pip官方隔离构建说明](https://pip.pypa.io/en/stable/reference/build-system/)区分运行依赖和构建依赖。已证实重新安装torch构建依赖的机制；Linux默认PyPI torch可能带CUDA组件，实际安装量尚未验收，不用本fixture声称测到了几GB下载。

## 不重复计数的限制和候选

- 素材包界面明确叫“索引”，导出不打包原图是设计限制。同一blob库导入/hydrate可恢复，新设备还需原图或服务器文件；没有将这条计为新bug。
- 一键启动.bat的-Ci免pause说明与父BAT读取环境变量存在静态不一致：子PowerShell设置不能传回父BAT。Windows CI另行预设MNAI_NO_PAUSE所以掩盖该缺口；未运行cmd.exe，暂不新增编号。
- 混合栅格化未完整处理opacity/clipPath/flip/origin，为代码候选，与38/39相近，尚无完整Fabric像素对照；画笔另外三种buffer问题也未实测，不扩大已验证结论。
- 未把新的切页/取消问题归因于聊天PR；PR5仍未合并，其full acceptance的flow7失败仍未定位。

## 本轮验证与覆盖清单

- 主审重新执行全部本轮诊断，获得上述输出；PNG像素、捆绑Fabric/JSTS及Python生产函数均在对应fixture说明的依赖边界内执行。
- npm test通过；另跑19个补充命令，18个通过，check:index发现6份生成索引过期。本次已重新生成这些索引并再次运行check:index通过，不把审查工具新增导致的索引变化冒充产品bug。
- Node解析检查覆盖js目录排除third子目录后的224个JS文件；Pythoncompile覆盖根目录及local_tools共17个生产Python文件，均无语法错误。index.html直接本地src/href资源检查没有缺失。这些是语法/直接引用检查，不是逐功能完整验收。
- 每个文件的检查深度、模块冒烟及实机缺口记录于[覆盖清单](2026-10-13-coverage.md)。真实浏览器交互、WebGL/Pixi、干净Windows安装、多设备素材迁移、真实模型/上游API及用户153页工程仍需实机验证。
- 没有修改产品行为、未合并聊天PR，也没有使用真实付费生成或下载大模型。新增问题尚未修复，不声称已找尽所有bug。

## 补查的静态候选（尚未计入91项）

- vertical-textbox.js:130–131白名单不含deleteContentForward/deleteWordForward，竖排Delete/IME同步需浏览器验证。
- custom/optimized-wild-text.js:106–123及类似特效文字重建只保留left/top，其他变换/层身份可能重置；与38相近，尚无完整Fabric对照。
- snow-tone.js:130–139也混用三倍buffer和已缩放context，疑似雪点大量越界；作为89待补证据，不独立编号。
- speech-bubble-freehand.js:271–282合并旧气泡后，原文本/文字框关系迁移尚未验证，不声称对白已经丢失。
- tone-noise.js:37结束时重置isDrawingTone而非isDrawingToneNoise，以及晚到fromURL的会话归属，需实际模式链路验证。
- VerticalTextbox.fromObject参数看似可疑，但options会再次写text，当前证据不足，排除“必然文字丢失”结论。

## 第五轮更新修复顺序

1. 与原保存/页面身份问题一起先修63服务器文件覆盖、80滤镜覆盖、82失败切分不回滚、86角色设定不保存；61/62索引事务也放在数据完整性阶段。
2. 修59取消后自动替换、60账号队列及既有重复请求/未知结果问题，再处理73/74晚到提交。
3. 修68–72正文/读序/方向/字号/边线，75/77预览与mask一致，76缓存身份；逐句与逐像素验收。
4. 修65–67输出污染/失败恢复、78–81几何与画笔、87长页计划、89/90网点和重复对象。
5. 补83–85干净Windows/CPU依赖/端口与路径验收，修64/88/91低优先级存储与参数问题。

这个顺序不替代用户具体要求；诊断脚本需要在修复后改成正向回归。没有把33个新条目合成一个未经实机验收的大改动。


# 第六轮：剩余模块、文字输入与模拟器往返

本轮开始main为1b9b9e7，产品仍ca9572d；新增92–120共29项，累计120项编号。主审已执行新fixture；字体多条保存/卸载失败合并一项，两个图片模板缺显示合并一项，重复锁问题与雪/旧笔刷补证不再新增编号。验证边界随条目保留。

### 92 — 漫画导入标记未序列化，历史恢复后占位/参考功能失效（P2）

位置：[js/core/settings.js:77](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/settings.js#L77)；[js/ai/manga-importer.js:1663](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/manga-importer.js#L1663)。

生产commonProperties及捆绑Fabric.toObject遗漏mangaImportReference/TemplateLayer/Placeholder/PanelIndex/SourceBox/Tags。恢复后原占位无法被“下一个角色占位”选中，隐藏参考层不再隐藏底图和占位。原记录对照正确；已执行历史恢复，未跑真实ZIP文件与浏览器导入。

修复方向：持久化导入对象合同，重开/撤销都恢复身份与源信息。

复现：[round6-import-state-audit-repro.cjs](../../../scripts/audit/round6-import-state-audit-repro.cjs)。

### 93 — 自动分格缓存只用图片字符串长度，改图后沿用旧坐标/旧图片（P2）

位置：[js/ai/panel-auto.js:79](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/panel-auto.js#L79)。

两张64×64同长度真实PNG，黑色方块分别x=3/24。生产get第二次返回同一旧结果、旧image及x=3；清cache对照检测当前x=24。key仅页面GUID、首图尺寸及src.length；不像76抽样哈希，这里连完整页面内容都未参与。

修复方向：缓存绑定全页像素版本/完整摘要，画布编辑时失效。

复现：[round6-panel-cache-audit-repro.cjs](../../../scripts/audit/round6-panel-cache-audit-repro.cjs)。

### 94 — 退出工具模式清掉用户的图层移动锁（P2）

位置：[js/ui/util/mode-manager.js:376](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/util/mode-manager.js#L376)；[js/layer/layer-button.js:75](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/layer/layer-button.js#L75)。

点气泡→选择模式，原selectable=false图层变true；原刀模式和用户锁按钮调用链也取得afterUserLock=false/afterKnifeExit=true。clearAll统一设所有普通对象selectable=true，没有保存原锁。

修复方向：临时工具禁选和用户移动锁分开，退出恢复原状态。

复现：[round6-mode-lock-audit-repro.cjs](../../../scripts/audit/round6-mode-lock-audit-repro.cjs)。

### 95 — 竖排Delete/替换/Undo输入被忽略，部分IME取消也不同步（P2，生产输入函数及捆绑退出编辑）

位置：[js/sidebar/text/vertical-textbox.js:130](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/text/vertical-textbox.js#L130)。

deleteContentForward/deleteWordForward/historyUndo/insertReplacementText后textarea=甲丙，对象仍甲乙丙；实际Fabric exitEditing移除textarea但不补同步。Backspace对照有效。多字预编辑“你好”取消后deleteCompositionText也被白名单挡住，对象保留甲你好丙。原生键盘/IME事件未实机生成。

修复方向：所有改变textarea正文的input先同步文本，再单独处理样式与composition。

复现：[round6-vertical-focus-audit-repro.cjs](../../../scripts/audit/round6-vertical-focus-audit-repro.cjs)。

### 96 — 竖排构造修改共享键表，污染已有普通RTL文字（P2）

位置：[js/sidebar/text/vertical-textbox.js:20](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/text/vertical-textbox.js#L20)。

Object.assign直接改继承keysMapRtl。已有横排RTL ArrowLeft构造竖排前走moveCursorRight，构造后走moveCursorDown，捆绑onKeyDown已验证。普通LTR不使用此表，不说所有横排都受影响。

修复方向：先克隆键表再修改，保留基类与已有对象键映射。

复现：[round6-vertical-focus-audit-repro.cjs](../../../scripts/audit/round6-vertical-focus-audit-repro.cjs)。

### 97 — 字体持久化失败不传回操作层，输入被清、列表被删（P2）

位置：[js/db/user-font-repository.js:12](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/db/user-font-repository.js#L12)；[js/core/font/font-manager-core.js:395](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/core/font/font-manager-core.js#L395)。

repository返回false被注册/卸载忽略：上传/本机/web均resolve、durable=0、错误toast=0，本机输入清空。删除失败却移除选择器，持久记录仍1，刷新后复活。有DB日志，没有声称显示成功toast。FontFace/存储/stylesheet为桩，无真实网络。

修复方向：持久化成功后才清输入/改列表，失败保留原状态并反馈；统一检查返回结果。

复现：[round6-font-audit-repro.cjs](../../../scripts/audit/round6-font-audit-repro.cjs)。

### 98 — emoji前缀下IME高亮混用UTF-16与grapheme索引（P2/P3，真实Canvas像素）

位置：[js/sidebar/text/vertical-textbox.js:394](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/text/vertical-textbox.js#L394)。

“😀中文”textarea范围[2,3]选“中”，生产renderSelection却高亮“文”，y25 alpha0、y45 alpha255。使用捆绑光标索引和真实Canvas；仅验竖排，不声称正文丢失。Fabric基类亦有同类取索引方式，横排未实测。

修复方向：composition选区先转grapheme索引，和普通选区统一。

复现：[round6-vertical-focus-audit-repro.cjs](../../../scripts/audit/round6-vertical-focus-audit-repro.cjs)。

### 99 — 仪表盘依赖首次失败后重试永久等待（P2）

位置：[js/dashboard/dashboard-ui.js:79](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/dashboard/dashboard-ui.js#L79)。

第一次init收到chart.js error；失败节点保留。第二次init只给旧节点挂新load/error监听，不发新请求，Promise仍pending、节点数仍2。DOM事件fixture，没有真实浏览器断网回放。

修复方向：标记/移除失败节点，重试创建新节点，并显示可恢复错误。

复现：[round6-foundation-audit-repro.cjs](../../../scripts/audit/round6-foundation-audit-repro.cjs)。

### 100 — 并行完成生成，仪表盘多类统计丢更新（P3）

位置：[js/dashboard/performance-storage.js:44](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/dashboard/performance-storage.js#L44)；[js/dashboard/prompt-frequency-storage.js:30](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/dashboard/prompt-frequency-storage.js#L30)；[js/dashboard/dashboard-ui.js:1026](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/dashboard/dashboard-ui.js#L1026)。

两次recordGeneration(100/200ms)并行，生产读改写最终count=1、totalTime=200、min=200；tag/model/session也各1，本应2/300/100。localforage使用独立克隆和异步读桩。未证明图像数据因此丢失。

修复方向：统计更新串行化或使用事务式原子增量，多标签页也共享协调。

复现：[round6-foundation-audit-repro.cjs](../../../scripts/audit/round6-foundation-audit-repro.cjs)。

### 101 — 本地日期键按UTC解析，西半球周统计错周（P3，指定时区）

位置：[js/dashboard/performance-storage.js:149](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/dashboard/performance-storage.js#L149)；[js/dashboard/performance-storage.js:503](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/dashboard/performance-storage.js#L503)。

TZ=America/Los_Angeles时2026-10-12周一记录归到2026-10-05；周日当天daily=1但weekly=0。new Date(YYYY-MM-DD)后按本地日期计算混用时区。中国时区不是该案例。

修复方向：按本地年月日构造日期，统一周起止与日键。

复现：[round6-foundation-audit-repro.cjs](../../../scripts/audit/round6-foundation-audit-repro.cjs)。

### 102 — 历史最长连续天数只有当时查看仪表盘才被记住（P3）

位置：[js/dashboard/performance-storage.js:307](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/dashboard/performance-storage.js#L307)。

保留10月1–7连续7天，10月11首次getStreak返回current=0/longest=0。今天/昨天无记录直接返回缓存，未扫描历史；记录生成也未维护最长值，徽章读到同样错误值。

修复方向：从持久日统计计算历史最长，或每次记录正确维护。

复现：[round6-foundation-audit-repro.cjs](../../../scripts/audit/round6-foundation-audit-repro.cjs)。

### 103 — 正向/负向提示词替换规则交叉应用（P2）

位置：[js/ui/prompt-manager.js:37](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/prompt-manager.js#L37)。

只填写Old/New Prompt的blue→red，生产replace把正向和negative中的blue hair都改red hair并saveState=1。六组规则混在同数组，分别字段没有隔离。

修复方向：正向三组仅改正向，负向三组仅改负向；跳过空旧词。

复现：[round6-prompt-routing-audit-repro.cjs](../../../scripts/audit/round6-prompt-routing-audit-repro.cjs)。

### 104 — 提示词替换把合法权重标签当正则，破坏整句（P2）

位置：[js/ui/prompt-manager.js:48](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/prompt-manager.js#L48)。

替换字面[smile]为grin：先literal includes，后new RegExp变字符类，使“smile, [smile], simple”大量逐字变grin。本应“smile, grin, simple”。不同于88补全丢关闭标记。

修复方向：默认字面替换，转义正则/替换串特殊含义，保留其余标签。

复现：[round6-prompt-routing-audit-repro.cjs](../../../scripts/audit/round6-prompt-routing-audit-repro.cjs)。

### 105 — 导演迟到响应覆盖新编辑，并回显到另一对象（P2）

位置：[js/ai/prompt/novelai-composition-director.js:1146](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/prompt/novelai-composition-director.js#L1146)；[js/ui/ai/auto-prompt-ui.js:35](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/ai/auto-prompt-ui.js#L35)。

A等待时用户新输入被旧结果覆盖；同页切选B，A结果回显到B框，随后输入会写进B字段。生产writer等待后无编辑版本检查，UI按全局DOM更新没有当前对象检查。模型返回为延迟桩。

修复方向：捕获对象与提示词版本，冲突进入候选；回显前复查当前对象/会话。

复现：[round6-prompt-routing-audit-repro.cjs](../../../scripts/audit/round6-prompt-routing-audit-repro.cjs)。

### 106 — 取消保存导演草稿，writer仍无条件生成草稿（P3）

位置：[js/ai/prompt/novelai-composition-director.js:1152](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ai/prompt/novelai-composition-director.js#L1152)；[js/ui/ai/auto-prompt-ui.js:63](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/ai/auto-prompt-ui.js#L63)。

复选storeDraftsChecked=false，生产writer仍创建naiDirectorDraft；UI有条件保存已晚于writer。该字段在commonProperties内，但本项仅验内存，无完整工程重开。

修复方向：由同一层决定是否存草稿，明确关闭后旧草稿处理。

复现：[round6-prompt-routing-audit-repro.cjs](../../../scripts/audit/round6-prompt-routing-audit-repro.cjs)。

### 107 — 自由气泡自动合并删除已审定对白，替换成默认台词（P1）

位置：[js/sidebar/speechBubble/speech-bubble-freehand.js:271](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/speechBubble/speech-bubble-freehand.js#L271)；[js/fabric/fabric-management.js:634](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/fabric/fabric-management.js#L634)。

原对白“经过审定的甲对白”和新形状相交：实际JSTS union、merge删除旧路径、object:removed级联删除原文字框/正文；生产create/metrics重建后的唯一正文为“台词”，没有迁移。Fabric对象/网格/字体为外壳，浏览器拖画/undo未验。

修复方向：几何合并前保存并迁移对白/文字关联；失败保持旧气泡和正文，必要时人工决定合并排版。

复现：[round6-editor-candidates-repro.cjs](../../../scripts/audit/round6-editor-candidates-repro.cjs)。

### 108 — 页面程序化效果/网格在共享画布上clearRect擦掉下层像素（P2，真实Canvas像素）

位置：[js/sidebar/page/page-studio.js:121](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/page/page-studio.js#L121)；[js/sidebar/page/page-studio.js:254](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/page/page-studio.js#L254)。

objectCaching=false的_render把离屏清理直接用于共享ctx。捆绑Fabric.drawObject→原_render后下层红[255,0,0,255]、纸色[247,244,238,255]均变透明[0,0,0,0]。下层对象仍在，只确认显示/输出像素被擦。

修复方向：共享ctx对象绘制不清底，离屏初始化清理和对象绘制分开。

复现：[round6-ui-audit-repro.cjs](../../../scripts/audit/round6-ui-audit-repro.cjs)。

### 109 — 自定义底页解码期间切页，删除新页底图并应用旧结果（P2）

位置：[js/sidebar/page/page-studio.js:367](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/page/page-studio.js#L367)；[js/sidebar/page/page-studio.js:419](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/page/page-studio.js#L419)。

A文件加载期间复用canvas载入B；fromURL回调按B尺寸缩放，findByType删除B原底页，新增自定义底图并保存B历史。A原底页没变。独立底页入口，与18/56同族。

修复方向：文件选择就捕获页面/版本，读取和解码后复查，跨页结果留待原页应用。

复现：[round6-ui-audit-repro.cjs](../../../scripts/audit/round6-ui-audit-repro.cjs)。

### 110 — 图片单独一页的右键I2I被分镜预检拦截（P2）

位置：[js/ui/beginner-guide.js:368](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/beginner-guide.js#L368)；[js/ui/canvas-object-menu.js:570](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/canvas-object-menu.js#L570)。

有效Token且选中图片、页面无分镜时，右键生成提示“还没有分镜格”，confirm=0/I2I=0。仅增加一格对照I2I=1。通用preflight错误把页分镜要求用于选图I2I。

修复方向：按操作分别验证：I2I检查选中图，逐格生成才要求分镜。

复现：[round6-ui-audit-repro.cjs](../../../scripts/audit/round6-ui-audit-repro.cjs)。

### 111 — 旧服务模型测试迟到，覆盖新服务模型并存盘（P2）

位置：[js/ui/service-settings.js:96](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/service-settings.js#L96)；[js/ui/service-settings.js:54](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/ui/service-settings.js#L54)。

A请求等待时用户切B及gpt-image-2；A响应回来把当前模型改gpt-image-1，再保存B地址+A模型，并提示已连接。响应全桩。不同于11聊天模型强制DeepSeek，属于图像服务配置版本竞态。

修复方向：绑定测试配置版本，旧响应不得改新配置或冒充新服务连接成功。

复现：[round6-ui-audit-repro.cjs](../../../scripts/audit/round6-ui-audit-repro.cjs)。

### 112 — 画具侧栏未加入关闭列表，切文本后两个面板同开（P3，DOM状态）

位置：[js/sidebar/sidebar.js:78](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/sidebar/sidebar.js#L78)。

先打开ps-tools-area画具，再打开text-area文本，两个display均block。toggleVisibility列表遗漏画具。未做实际双面板布局/手机回放。

修复方向：统一真实侧栏集合，切换时关闭其他面板。

复现：[round6-ui-audit-repro.cjs](../../../scripts/audit/round6-ui-audit-repro.cjs)。

### 113 — 三个聊天布局把全部消息叠在左上（P1/P2，完整捆绑Fabric）

位置：[js/simulator/chat-renderer.js:241](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/chat-renderer.js#L241)；[js/simulator/chat-renderer.js:292](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/chat-renderer.js#L292)；[js/simulator/chat-renderer.js:330](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/chat-renderer.js#L330)。

generic/story-log/discord两条消息group都强制left=0/top=0，覆盖Fabric根据对象全页坐标求出的位置。实际两行世界top均约0（浮点误差5.68e-14），递增y被抹掉。DOM为外壳，字体变换来自完整Fabric+NAPI。

修复方向：保留group计算位置，或统一行内局部坐标并显式设置行位置。

复现：[round6-simulator-audit-repro.cjs](../../../scripts/audit/round6-simulator-audit-repro.cjs)。

### 114 — 部分模拟器接受图片字段，却只显示文本/占位（P2）

位置：[js/simulator/chat-renderer.js:322](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/chat-renderer.js#L322)；[js/simulator/renderers/social-feed-renderer.js:8](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/renderers/social-feed-renderer.js#L8)。

Discord图片消息imageObjects=0/loads=0，bubble同源对照1；social JSON保留URL却只生成856×420灰色矩形，imageObjects=0。两入口同属承诺字段未实现渲染，合成一项并分别验收。

修复方向：实际加载图片、保持比例，共用图片消息组件并提示失败。

复现：[round6-simulator-audit-repro.cjs](../../../scripts/audit/round6-simulator-audit-repro.cjs)。

### 115 — 上传头像放在不透明默认圆形下面，被完全遮挡（P2，真实PNG）

位置：[js/simulator/chat-renderer.js:71](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/chat-renderer.js#L71)。

先建不透明fallback圆和首字母，再unshift成功图片到底层。红64×64头像中心实际RGBA=[15,23,42,255]，image索引0/圆1。

修复方向：成功加载后移除fallback或调整层级/裁切。

复现：[round6-simulator-audit-repro.cjs](../../../scripts/audit/round6-simulator-audit-repro.cjs)。

### 116 — 模拟器画布直接改字，回读旧场景再应用会覆盖新字（P1/P2）

位置：[js/simulator/page-edit-controller.js:46](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/page-edit-controller.js#L46)；[js/simulator/extra-renderer-factory.js:99](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/extra-renderer-factory.js#L99)；[js/simulator/site-ui-parts.js:306](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/site-ui-parts.js#L306)。

实际Fabric文字OLD VIEWS改NEW VIEWS，公开readSelected仍OLD VIEWS；公开place重新应用后NEW消失。直接编辑未同步创建时复制的scene JSON，回读/播放仍用旧数据。

修复方向：稳定字段ID映射到文字对象，编辑事件更新统一scene，回读使用最新状态。

复现：[round6-simulator-audit-repro.cjs](../../../scripts/audit/round6-simulator-audit-repro.cjs)。

### 117 — Studio表单回读未修改也丢隐藏字段（P2）

位置：[js/simulator/simulator-studio.js:557](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/simulator-studio.js#L557)；[js/simulator/simulator-studio.js:740](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/simulator-studio.js#L740)。

预览/插入用normalize({})和可见表单重建scene：VN hero变character_a、背景#123456变#172033、active index1变0，speakerId/effect/theme消失。

修复方向：保留完整载入scene，表单仅patch相应字段，保留节点身份与附加信息。

复现：[round6-simulator-audit-repro.cjs](../../../scripts/audit/round6-simulator-audit-repro.cjs)。

### 118 — Studio姓名字段与论坛/手机renderer不一致（P2）

位置：[js/simulator/simulator-studio.js:167](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/simulator-studio.js#L167)；[js/simulator/renderers/forum-renderer.js:8](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/renderers/forum-renderer.js#L8)；[js/simulator/renderers/phone-renderer.js:24](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/renderers/phone-renderer.js#L24)。

parseNamed写name，forum读author/phone读sender。表单ALICE：HELLO实际渲染论坛“1楼 匿名：HELLO”、手机“HELLO”，姓名丢掉。与117结构往返同族但不同字段合同。

修复方向：统一命名合同或按模板显式适配姓名字段。

复现：[round6-simulator-audit-repro.cjs](../../../scripts/audit/round6-simulator-audit-repro.cjs)。

### 119 — 视觉小说过滤背景后仍用原节点索引，播放错对白（P2）

位置：[js/simulator/story-adapters.js:72](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/story-adapters.js#L72)；[js/simulator/story-adapters.js:105](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/story-adapters.js#L105)。

nodes=background/LINE A/LINE B、index=1原本应LINE A；adapter滤background后renderer按旧index实际显示LINE B。

修复方向：按稳定node ID转换dialogue索引，背景事件与对白游标分开。

复现：[round6-simulator-audit-repro.cjs](../../../scripts/audit/round6-simulator-audit-repro.cjs)。

### 120 — 剧情打开Studio扁平化，独白变对白且选项丢失（P2）

位置：[js/simulator/simulator-studio.js:403](https://github.com/h1neolzr7f/Manga-NAI-GPT/blob/ca9572de1640a7acb462bd49e69fb75de343e7c7/js/simulator/simulator-studio.js#L403)。

storyToScript只保留名字:content，无content的choice被过滤；重新parse后speech/aside/choice变speech/speech，choice=0，分支target也丢失。与20六格截断不同，正文类型/分支合同被破坏。

修复方向：保留完整story模型；文本编辑显式表示aside/choice及targets，禁止静默扁平化。

复现：[round6-simulator-audit-repro.cjs](../../../scripts/audit/round6-simulator-audit-repro.cjs)。

## 原编号补证、辅助合同与未确认范围

- 89雪网点：固定random=.5、100px目标/300px buffer+scale3，单雪点中心(450,450)完全无alpha；不超采样对照中心(50,50)可见，归89。
- 79旧Crayon/Ink/Marker：真实捆绑Fabric5.2.1、两次移动/原enhanceBrush PNG提交均正常；扩大100→200后各自仍100px buffer、外侧笔迹alpha0，归79。
- 38特效字重建：原wild updateAll/addSvg丢scale3/2、angle30、opacity.4、multiply、clip及旧层序，只保留left/top，新图移到文字上方，归38。
- 噪点End清isDrawingTone而非isDrawingToneNoise：待解码重开时update返回，旧回调后又加旧图；未模拟解码失败，不能说永久不可用。Spray在实际Fabric5.2.1缺Tint构造器，但未发现当前UI入口，不计可达新bug。
- ArrayBufferUtils把TypedArray子视图返回整个backing buffer：[9,1,2,8].subarray(1,3)得到整数组；PNG encoder的ArrayBuffer分支拒绝有效PNG，同字节Uint8Array正常。两个辅助合同错误已执行，当前常规UI用字符串/data URL，没有证明正常保存/导出会损坏，因此不列用户数据缺陷编号。
- IME Escape会触发FocusTrap关闭回调，runtime字体卸载后FontFace/CSS仍留；已执行行为，但原生IME正文结果/浏览器同名字体优先级与产品卸载语义尚未验证，暂作候选。
- 教程先跳隐藏目标、后尝试展开More，默认隐藏的页面教学可能被跳过；Tagify正则输入可能报错但实际初始化调用未找到，保持静态候选。
- GPT代理正常对照保留自定义模型user-model-exact与1024x1536尺寸；主图+3参考的multipart有4个image[]并正常回PNG。多图上游响应只选首图，但UI逐张请求，未证明正常用户多图丢结果，不新增问题。

## 执行与交接

- 本轮12个新可运行脚本由主审执行通过，包含11个缺陷诊断/补证脚本与1个GPT正常合同对照；还有既有基础扫描工具，三者exit=0的含义不能混淆。
- 模拟器使用完整捆绑Fabric和NAPI字体度量/真实PNG；8种默认renderer均完成构建与序列化对照（对象数13/8/7/6/6/29/30/34）。DOM是外壳，textBaseline=alphabetical按浏览器等价忽略为alphabetic，不替代完整浏览器。
- 更新[覆盖清单](2026-10-13-coverage.md)中本轮已读路径，仍只基础扫描的文件继续明确标出；没有把源代码阅读当所有分支都经过验收。
- 修复顺序先107/116正文丢失、95输入丢弃、92导入身份，再105/109/111迟到覆盖及108共享ctx擦底；其余布局/字段/字体/指标问题分批建立正向回归。
- 产品代码未修改，PR5仍未合并，full acceptance flow7根因仍未定位。真实浏览器/IME/字体/IndexedDB、多设备、Windows、WebGL/Pixi、真实模型/上游API和153页工程尚未完成，不声称穷尽所有bug。

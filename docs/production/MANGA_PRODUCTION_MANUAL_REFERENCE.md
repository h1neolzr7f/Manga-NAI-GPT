# Manga-NAI：漫画创作与生产手册（供 Agent 使用）

更新：2026-09-29。范围：剧情 → 分镜 → NovelAI 生成 → 看图检查 → 定点返修 → 嵌字与交付。

新漫画以此为起点；续作还要读取已确认设定、当前分镜与选图记录。GAL 工程只交代边界，进入 `30_GAL项目_既定偏离/` 后另读其 `AGENTS.md`，不要把漫画流程直接套到游戏脚本。

## 1. 先掌握这十条

1. **先确认创作方向，再写剧情与分镜；用户确认剧情和分镜后，才批量调用生成接口。** 当前任务中已明确授权的范围持续有效，不反复确认同一事项。
2. **表现力是核心。** 规整版式与错落、异形版式交错；每页有视觉重点，相邻页不能只换对白、服装和背景。
3. **重点参考 06 的全篇生成链路。** `02_罗德岛特蕾西娅` 的机械三格竖排是用户明确指出的反例，不能因已有成品就照搬。
4. **先写发生什么，再决定怎么画。** 每格一个主要瞬间；相邻格要有动作、信息或情绪的推进，不能只罗列姿势与镜头名称。
5. 常规整页以 **2–4 格、最多两位主要可辨识互动角色** 为默认复杂度。允许单格强调页；更多人物先尝试拆镜头，必要群像单独试图。
6. 对白先用中文审稿，日常、直白、符合人物。允许自然短句与静默，禁止无意义碎句、谜语和连续警句。最终语言每个项目确认。
7. **只在核验过的免费条件内调用 NAI。** 通用客户端限制单请求 1 张、≤28 步、面积 ≤1,048,576 像素；还必须检查订阅与额度，尺寸合规不等于已确认免费资格。
8. 保留原图与审定稿。返修用新文件名/轮次目录；先看 `git status`，不回滚或覆盖用户已有修改。
9. **脚本成功、JSON 合法、图片能打开，不等于漫画合格。** 必须看实际图像与相邻页，核对动作、读序、角色、对白、连续性和表现力。
10. 密钥只由客户端在运行时读取根目录 `.env` 的 `NAI` 项。不把密钥读给模型、写进文档、任务、日志或交付包。

“默认”“建议阈值”是创作起点，允许因叙事需要调整并记录理由。免费约束、版本保护和用户确认边界不能用评分抵消。当前用户指示优先于历史范例；旧资料冲突时不机械继承。


### 2.1 06 的全篇链路

下面是路径缩写，**不是已有环境变量**：

- `N = 20_漫画项目/06_全篇漫画改编/NovelScript`
- `M = N/漫画改编_NAI_V5Full`

按以下顺序读，不要只停在最初的 32 页稿：

| 文件 | 学什么 |
| --- | --- |
| `N/小说剧情大纲脚本·新版.md` | 已定/暂定设定、人物愿望、关系变化、伏笔、结局边界；不照搬专属人物关系 |
| `M/生成结果/全篇漫画/全篇分镜数据.json` | 完整阅读顺序、篇章、逐格画面与中日对白 |
| `N/待嵌字初稿/全篇漫画_最小生成版/pages.json` | 完整生成配置：全局负面词、153 个内嵌完整 prompt 的任务；研究最终提示词优先看这里 |
| `N/待嵌字初稿/全篇漫画_最小生成版/generate.py` | 完整执行入口，读取同目录 pages.json，输出同目录 `生成结果/` |
| `M/round_three.py` 的 `LAYOUT`、`prompt()` | 错落格位、角色约束、每格动作、说话人与文字块绑定 |
| `M/write_continuation.py`、`write_conflict.py`、`write_finale.py` | 分篇构建与连续性；对应续篇、冲突篇和终章目录 |
| `N/待嵌字初稿/full_manga.py` | 分篇汇总、试图队列、联系表和阅读器；当前路径有迁移问题，不能直接跑 |
| `M/生成结果/第二轮_动作强化/本轮说明.md`、`review.json` | 重复镜头、跨地点串景、讨论内容被画成现实等失败经验 |

本次核验：全篇分镜 **153 页**，计划格数为 22 页两格、114 页三格、17 页四格。额外的 `C10b` 是稳定剧情 ID，不能按数字范围误删。最小生成包全部为 832×1216。**这些是作品数据，不是新项目配额；计划格数不等于成图实测格数。**

参考也要交叉核对：部分历史 `visual_zh` 未同步英文返修，例如 C01 第一格中文仍是入口全景，英文已改为收伞手部特写；旧 `layout` 标签也可能与 prompt 不同。研究实际请求看最终任务，继续创作则以用户审定意图为准，先消除中文、英文与任务的差异，不能让英文悄悄改剧情。

## 3. 阶段、授权与产物

| 阶段 | Agent 完成什么 | 下一步条件 |
| --- | --- | --- |
| A 方向 | 故事目标、人物、调性、篇幅、重点场面、画风、最终语言和文字路线 | 用户确认方向；缺项可提出明确默认 |
| B 剧情/分镜 | 场景因果、逐页分镜、连续性表、6 页版式节奏、中文对白、prompt/任务预览 | 完成自查，用户确认剧情与分镜 |
| C 试图 | 在授权范围内测试代表页的布局、人物和文字路线 | 视觉检查通过；改变审定叙事或整体画风则重新确认 |
| D 批量生成 | 串行，每批建议 4–6 页，看图后继续 | 无结构性失败、额度异常或未核实请求 |
| E 返修 | 修分镜/prompt/文字或改为单格路线，保留候选与记录 | 阻断项解决；需审美取舍时给用户少量明确候选 |
| F 嵌字/交付 | 清字排版、逐页验收、整理选图与可复现资料 | 文字、画面、版本和交付清单对应 |

用户已授权批量生成后，不为范围内的例行检查和定点技术返修逐页请示。离线构建、校验、看图不需要生图授权；**试图属于真实接口调用**，没有出图授权时先提供试图名单，不以数量少为理由自行调用。

建议新项目分离：`剧情/`（创作约定、剧本、连续性）→ `分镜/`（数据、逐页稿、版式节奏）→ `prompts/` → `jobs/` → `产物/raw/r01/` → `产物/selected/` → `产物/lettering/r01/` → `产物/qa/` → `产物/final/`。只在确需适配时新增 `脚本/`；不要因此重排现有项目。

## 4. 剧情脚本怎么写

### 4.1 一页创作约定

至少写清：读者要体验什么、谁想要什么、眼前阻碍、关系/处境如何改变、开场与结尾状态、必留场面、不可改设定、篇幅节奏、视觉风格和文字路线。

分清“用户已定”“改编来源”“Agent 暂定补充”。给改编场景标注来源章节；原创也用稳定场景 ID。不要把补出的衔接伪装成原作。

人物小传写当前目标、顾虑、说话方式、关系、可见习惯、外观锚点与当前服装。“温柔、神秘、强大”等抽象形容不能代替具体行动。

### 4.2 六项场景节拍

每场写：**进入状态 → 触发事件 → 人物行动 → 对方/环境回应 → 结果变化 → 下一场的原因**。

例：想还书但不好意思开口 → 对方问起折角 → 他翻到标记页解释 → 对方拿出续册 → 约定下次见面 → 离店后确认约定时间。

“两人聊天，关系升温”不够，要指出哪次选择改变关系。也不为增加动作让人物无故不断起立、落座、搬东西；动作来自对话、环境或人物目标。

短篇通常可用 1–2 页完成必要引入，尽早进入核心场面；长篇按人物与因果分配篇幅，不设全题材统一铺垫上限。日常、停顿和环境镜头可以保留，但应说明其对时间、空间、人物或情绪的贡献。

### 4.3 中文对白

- 先写角色想对具体对象说的话，再压缩成漫画台词。ASMR 参考的是口语、回应与亲近感，不是人人耳语或强行长句。
- 每句主要完成一件事：提问、回答、感受、拒绝、邀请或推动下一步；人物有词汇与语气差别。
- 允许“怎么了？”“等等，书拿反了。”等语义完整短句；禁止“你。其实。一直。”式拆碎完整意思。
- 画面已表现的动作不机械复述；必要独白可留，但不能用旁白补掉关键动作。
- 通常每格 0–2 个气泡。初稿可按每泡约 8–30 个汉字估算空间，超出时检查拆分和冗词；这是容量预警，不能按字数毁掉语义。
- 表情或动作落点可静默，不每格塞台词；也不能擅自把应说清的信息删成谜语。
- 翻译保持说话人、态度、称谓与信息量；审定中文、最终语言与文字块可逐句对应。嵌字时不自行重写已定台词。

### 4.4 连续性表

跟踪时间/地点、进出路径、在场/画外人物、服装、物品及所在手、物品转移、人物已知信息、伤痕/湿衣等持续状态、伏笔出现与回收。

像 06 的末班车段落，应在剧情阶段交代时间、距离、登车方式和人物选择，不能让读者猜“怎么赶到这里”。三人谈话可用双人画面加反应/画外音衔接；拆画面不等于删掉角色参与。

## 5. 分镜与表现力：可检查的标准

### 5.1 一页一个重点，一格一个主要瞬间

每页先写“读者必须看懂/感到什么”，再定主视觉。每格包含：

`格位/顺序 + 景别/机位 + 在场角色 + 可见动作瞬间 + 空间/道具关系 + 表情反应 + 台词/说话人 + 连续性`。

不要一格同时“起身、走到门口、开门、回头、拥抱”；拆关键瞬间，保留因果。递物要见物体、递出者与接收关系，只见漂亮的手不等于动作完成。

06 的 C02 可参考“圈书页 → 起身取相关书 → 转椅回应 → 递书”的动作和机位变化；不要让每场谈话都复刻它。

### 5.2 版式词库：按情节选，交错使用

编号是**本文新增审稿标记，不是现有脚本已实现的参数**。R 为规整、A 为错落、X 为明确异形/破框；大小不等的矩形本身不等于异形。

| 标记 | 结构 | 主要作用 |
| --- | --- | --- |
| R1 | 规整双格，横向或纵向分区 | 对照、问答、动作前后、停顿 |
| R2 | 清楚的四格矩形网格 | 稳定节拍、并列信息 |
| A1 | 上方两个小格，下方主大格 | 准备 → 回应 → 情绪/动作落点 |
| A2 | 一侧通高大格，另一侧上下小格 | 身体纵向动作、空间与反应并置 |
| A3 | 错位四格，宽高不同，中缝错开 | 连续行动、带节奏的交流 |
| X1 | 斜切/梯形格，明确读序 | 动势、不稳定、局势变化；斜线呼应动作 |
| X2 | 主画面出血或局部破框，其余格简洁 | 登场、情绪放大、突破；不能遮后续信息 |
| X3 | 大画面内嵌一个反应/道具小格 | 同时性、细节；插格计入总格数 |
| S | 单格大画面或静默强调页 | 停顿、揭示；不是换模板的捷径 |

先保证读序，再选形状。可默认沿用 06 的右→左、上→下，但项目约定要写明；不能随版式悄悄反转读序。指定 X3 时，prompt 和负面词不能同时禁止全部插格。

规整三格竖排可用于刻意重复、时间流逝或喜剧节拍；**不能成为全篇默认，更不能连续多页无理由复用**。异形也不等于在三张相似半身像之间加斜线。

### 5.3 连续 6 页量化审查

这是用户确认采用的默认审稿办法，**不是 NAI 官方限制或旧成品统计出的最佳参数**。不足 6 页按实际篇幅审查，单页任务不凑跨页配额。

每页记录视觉签名：`版式标记｜主视觉位置/面积｜主镜头景别/机位｜主要动作/视线方向｜疏密｜情绪节拍`。

| 项目 | 默认目标 | 不通过时处理 |
| --- | --- | --- |
| 规整与异形交错 | 每个连续 6 页窗口至少 1 页 R、1 页 X、3 种具体版式；不连续 3 页用同一版式 | 找转折和安静页安排 X/R，不随机洗牌 |
| 相邻观感 | 相邻视觉签名至少 **2 项实质变化** | 改布局、主镜头、主视觉落点或疏密；只换对白/服装/镜头名不计 |
| 页内镜头 | 常规 3–4 格页至少 2 种景别，至少一次主体尺度明显变化或有叙事作用的角度切换 | 重复肖像换必要全景、道具动作、关系或反应镜头 |
| 页内推进 | 每格有不同信息/动作/反应，不连续 3 格重复同姿态构图 | 补起因/结果，合并无贡献格 |
| 主次 | 错落页主格可占约 40%–65%；规整页用主体尺度、对比、留白形成重点 | 大格给关键瞬间，不给无关背景 |
| 呼吸 | 6 页内至少一处明显疏密对比，如静默格、少字页、放大反应格 | 减解释，让关键瞬间获得阅读时间 |

变化举例：A1 换 A2 是一项；正面近景变侧后全景是另一项。同一布局只把线斜几度不算实质变化。机位变化仍须保持空间轴线可理解，不能为凑数颠倒人物左右关系。

示意：`R2 平稳交谈 → A2 取物 → R1 停顿 → X1 突变 → A1 反应 → X2 强调`。这是节奏示例，不是全篇轮播表；长对话也可用动作、主体尺度和疏密区分页面，不必每页制造大事件。

有意连续使用静态同构图/固定机位时，记录 `exception_reason`，说明效果及在哪页打破。读序和连续性优先，不能用“艺术需要”给全章重复免责。

### 5.4 逐页评分：稿件和成图分别评

五项各 0–2 分，总分 10；默认 **≥8 且无 0 分项** 进入下一步。每项附一句具体依据。分数是人工审稿提示，不是自动美学检测或质量保证。

| 维度 | 0 分 | 1 分 | 2 分 |
| --- | --- | --- | --- |
| 叙事 | 看不出变化 | 能懂但冗余/跳步 | 起因、关键动作、反应/结果清楚 |
| 镜头动作 | 重复姿势，缺动作 | 变化偏机械 | 景别、视角、动作共同说明事情 |
| 版面焦点 | 平铺或杂乱 | 主次可辨但偏离重点 | 主视觉、格位、留白、形状共同强化重点 |
| 人物情绪 | 通用表情，关系不明 | 台词/表情传达情绪 | 姿态、视线、距离与对白相互支持 |
| 阅读承接 | 读序/说话人混乱 | 能读但需回看 | 文字归属与读序清楚，前后页自然衔接 |

阻断项另查：关键剧情/动作缺失、严重角色或形体错误、台词归属错误、文字不可读、连续性断裂。**不能靠总分掩盖阻断项**；局部手部、字体问题也不能因不在表中而遗漏。

记录 `planned_layout/actual_layout`、`planned_panel_count/actual_panel_count`。模型改变形状但信息、读序、表现力仍成立，可保留并更新选图记录；顺序、动作或气泡丢失则返修，即使单张好看也不通过。

## 6. 分镜数据与 prompt 写法

### 6.1 新项目创作数据模板

以下是推荐的**创作结构，不是现成客户端 jobs/API 请求格式**，不要直接传给 `nai_generate.py`。

```json
{
  "page_id": "p001",
  "reading_index": 1,
  "source": "S01：还书与再次见面的约定",
  "purpose": "从还书转为主动约定下次见面",
  "reading_order": "right_to_left_then_down",
  "layout": {"code": "A1", "hero_panel": "p001_03", "hero_area": 0.60},
  "continuity_in": "两人都在书店，书由来客拿着",
  "continuity_out": "旧书交还，对方递出续册，约定周六见面",
  "panels": [
    {
      "id": "p001_01",
      "position": "upper_right",
      "shot": "手部俯拍特写",
      "cast": ["来客"],
      "visual_zh": "来客把旧书推过桌面，折角露在书页上缘。",
      "visual_en": "Top-down close-up of the visitor's hand sliding a worn book across the table; a folded page corner is visible.",
      "lines": [{"id": "p001_t01", "speaker": "来客", "zh": "书还你，我还留着上次说的那一页。", "render_text": ""}],
      "must_show": ["书", "递还动作", "折角"],
      "must_not_show": ["额外人物", "书中内容变成现实"]
    }
  ],
  "visual_signature": ["A1", "下方60%", "主格侧面中景", "递物向左", "上密下疏", "期待"],
  "exception_reason": null
}
```

仅展示第一格字段，**不是完整三格页**；实际必须补全其余格与已确认语言的 `render_text`。稳定 page/panel/line ID 与阅读序号分开，插页后仍可对应旧请求与返修。

### 6.2 整页 prompt 的六层结构

沿用 06 最小生成包的思路：

1. 全局画风、黑白/彩色、漫画类型、文字语言，统一章节配方。
2. 精确格数、位置/比例、边框形式、阅读顺序。
3. 本页角色身份/服装、连续性与必要特殊约束。
4. 每格独立：`<格位> ONLY: <可见画面与主要瞬间>`。
5. 逐格指定文字 block 编号、说话人、气泡/旁白容器；静默格明确无字。
6. 最末唯一 `Text:` 块，按顺序列实际文字，各块空一行。

画面描述写“谁在什么位置做什么”，不只写“张力、很美、cinematic”。焦虑落到停住的手、避开的目光等可见行为。不要把小说内心、幕后动机、页标题、中文审稿说明塞入绘图文字。

采用后期的编号方案时，画面段只引用 block，台词仅在末尾出现一次；不要同时各格引号写对白、末尾再重复。网页复制版与 API 的处理不应想当然视为相同，优先沿用核验过的本地格式。

### 6.3 完整结构示例：普通对话页

这是三格结构示例，英文对白用于演示映射；实际换成已确认画风、人物和语言。人物与情节不是新项目默认设定。

```text
monochrome, greyscale, manga lineart, delicate lineart, comic, speech bubbles, english text.

Exactly THREE bordered frames on one portrait page: a small UPPER-RIGHT frame,
a wider UPPER-LEFT frame, and a LARGE BOTTOM frame occupying about sixty percent
of the page height. The bottom frame has a gently slanted upper edge.
Read upper-right, upper-left, then bottom. No extra inset frames.
Each frame contains one complete moment and only its own text.

Mira: adult woman, short dark hair, light cardigan, seated on the left side of the table.
Ren: adult man, short dark hair, dark jacket, seated on the right side of the table.
The whole page is inside the same quiet bookshop. No other people.
The book remains an ordinary physical book, not an imagined scene.

UPPER-RIGHT frame ONLY: Top-down close-up of Ren's hand sliding a worn book
toward Mira across the table. A folded page corner is visible. Faces outside crop.
Put text block 1 in Ren's speech bubble inside this frame.

UPPER-LEFT frame ONLY: Medium side view of Mira drawing a second book from the
shelf beside her chair. Ren's hand rests beside the returned book at the table edge.
She turns toward him with a small expectant smile.
Put text block 2 in Mira's speech bubble inside this frame.

LARGE BOTTOM frame ONLY: Side two-shot at the same table. Mira holds the second
book toward Ren; his open hand reaches to accept it. Their hands and book are fully
visible. She meets his gaze with a warmer smile. Put text block 3 in Ren's speech
bubble, then text block 4 in Mira's speech bubble, both inside this same frame.
Bubble tails identify their speakers. Leave hands, book and faces unobscured.

Render only the following text blocks, each exactly once.
Do not print frame labels, block numbers, character names or page titles.

Text: I kept the page we talked about.

Then you might like the next book.

Can I bring it back on Saturday?

Yes. I'll be here.
```

变化来自“手部动作 → 取物 → 两人交接与回应”，不只是三个景别标签。下一页重新检查视觉签名，不默认复用布局。

其他页面可以**替换**上述版式段，不能把几套要求叠加进同一 prompt。例如：

```text
# 规整四格：稳定交流，需要同步写出四个格位的动作和文字映射
Exactly FOUR rectangular frames in a clean two-by-two grid with straight gutters.
Read upper-right, upper-left, lower-right, lower-left. No inset frames.

# 异形三格：用高窄梯形与宽阔落点强化纵向动作
Exactly THREE frames. One tall tapered trapezoid on the RIGHT occupies the full
page height and about forty percent of its width. Its left edge slopes inward
toward the bottom. On the LEFT, a small upper frame sits above a large lower frame.
Read tall-right, upper-left, lower-left. Keep faces and speech bubbles away from
the acute corners. No extra inset frames.

# 出血主画面与两格细节：给揭示场面更长的停留
Exactly THREE distinct frames. Two small bordered frames are stacked on the RIGHT.
One large main frame fills the LEFT side and bleeds to the left page edge.
Read upper-right, lower-right, then the large left frame. White gutters clearly
separate the three moments. No character crosses into either small frame.
```

其中 `#` 中文注释只是文档解释，发送时删除；只选一个版式，同步修改格位、动作、文字 block 和禁止项。几何描述不保证模型精确执行：检查实际边框、面积和读序。页内构图、人物尺度与动作仍不变化时，换框形也不能通过表现力审查。

### 6.4 配方、角色、负面词和文字路线

- 06 配方见 `M/style_use.txt`、`M/negative_use.txt`；最小生成包也保存实际全局负面词。确认哪个版本对应所选图片，不混拼轮次。
- 保留用户选定的画师词与显式权重，不擅自换画风、降权重。黑白、淡彩、全彩分别明确，避免冲突。`8k` 等标签不是提高请求尺寸的授权。
- 角色标签作为身份锚点；AU 换装、主角遮脸、易串位角饰等补少量明确描述。既不机械禁止补充外观，也不逐格重写矛盾人设。
- 人数是独立身份数，不因多格重复而翻倍；画外说话人注明 offscreen，不增加一张脸。
- 检查负面词冲突：单格可排除 `multiple panels`，整页不能；需要对白时不能负面排除 `text`。`multiple views`、`negative space` 等历史词与分镜/留白可能冲突，可做明确的 A/B 试图，不暗中全局改用户配方。
- 通用客户端当前 `qualityToggle=False`、`ucPreset=3` 并使用自带负面词；不会替任务追加章节画风或修正文字。
- 文字路线按项目选择：目标语言直出；外文初稿后中文嵌字；无字/预留空间后排字。长对白或逐字准确要求优先考虑后期嵌字。中文直出可测试，不能宣称某采样器保证中文准确。
- `nai_generate.py` 固定 `k_euler/native`，不接受 sampler、noise_schedule 或角色框自定义字段；要改功能就核验适配，不凭空给 jobs 加无效字段。
- 06 历史构建器曾按 750 字符检查 Text 块，这是旧代码逻辑，不是所有模型/接口的现行保证。字符数不等于 token 数；改模型或格式前核验当前官方资料并试图。

## 7. 现成生成工具：准确用法

### 7.1 新项目首选 `nai_generate.py`

依赖 requests、Pillow。本次离线验证用 `C:\Users\12150\miniconda3\python.exe`；运行前 `Get-Command python` 确认解释器，缺依赖在同一环境处理，不随意改第三方目录。

jobs 是**非空数组**，每个任务只支持以下字段：

| 字段 | 规则 |
| --- | --- |
| `prompt` / `prompt_file` | 二选一，必须有非空正面词 |
| `negative_prompt` / `negative_file` | 二选一，可省略；项目应明确选定负面词 |
| `output` | 必须为 PNG 路径，包含轮次/候选编号 |
| `width`, `height` | 默认 832、1216；正的 64 倍数，总面积 ≤1,048,576 |
| `steps`, `scale`, `seed` | 默认 28、5.0、自动 seed；steps 为 1–28 整数，scale 为大于 0 且不超过 10 的有限数，seed 为 [0, 2³²) 内整数，建议显式指定 |

`--jobs` 的相对路径以 **jobs 文件目录** 为基准；单任务 CLI 相对路径以当前目录为基准。下例放在新项目 `jobs/pilot.json`：

```json
[
  {
    "prompt_file": "../prompts/p001.txt",
    "negative_file": "../prompts/negative.txt",
    "output": "../产物/raw/r01/p001_a.png",
    "width": 832,
    "height": 1216,
    "steps": 28,
    "scale": 5.0,
    "seed": 2026092901
  }
]
```

PowerShell（先建立真实文件，替换 `<项目目录>`）：

```powershell
$repo = 'D:\Manga-NAI'
$client = Join-Path $repo '10_通用工具/NAI客户端/nai_generate.py'
$jobs = Join-Path $repo '20_漫画项目/<项目目录>/jobs/pilot.json'

# 离线：检查字段、路径、参数、已有输出；不读 token、不联网
python -X utf8 $client --jobs $jobs --dry-run

# 只读联网查订阅与额度，不代替用户的生成授权
python -X utf8 $client --status

# 真实调用：获得相应出图授权后执行
python -X utf8 $client --jobs $jobs
```

模型当前固定 `nai-diffusion-5-full`，串行、单请求一张，每张前后查余额。免费判断采用本地客户端实现，`usage.percent` 低于保守门槛 10 时停止，不能为了跑完擅自放宽。

每张保存 `<图片名>.nai.json`（请求、状态、哈希）。完成且请求/哈希匹配才跳过；同名异请求拒绝覆盖。pending/unverified 意味请求可能已执行，检查图片、记录和账户状态，不删记录盲目重发。`.generation.lock` 只协调此客户端，不能保护其他旧生成器；不要另起旧脚本并行出图。

832×1216 为 1,011,712 像素；1024×1536 为 1,572,864，超过当前免费尺寸上限。旧稿的大尺寸不能直接继承。本地成品放大与 API 原始尺寸分别记录。

### 7.2 06 完整最小生成包

```powershell
$pack = 'D:\Manga-NAI\20_漫画项目\06_全篇漫画改编\NovelScript\待嵌字初稿\全篇漫画_最小生成版'

# 离线验证现有 153 页包，本次已通过
python -X utf8 (Join-Path $pack 'generate.py') --check

# 真实调用，仅在用户授权复现整包时执行
python -X utf8 (Join-Path $pack 'generate.py')
```

`pages.json` 顶层为 `{negative_prompt, jobs}`；任务用 prompt_text、output、seed、尺寸、negative_append 等字段，执行时合并全局与逐页负面词。`--check` 检查任务数量、输出名、尺寸/prompt 等，不检查叙事，也不联网核验免费资格。

- 固定断言 **153 个任务**；没有 `--only`、`--limit` 或通用 `--jobs` 选项，不能编造参数。
- 输出到 `$pack/生成结果/`，不是旁边已有的 `待嵌字初稿/*.png`；运行可能重新生成整包。
- 已有图只核对解码后跳过，不核对完整请求/哈希；改 prompt 后同名旧图不代表新结果。
- compact 模式写图和 `_生成记录.jsonl`；复现须保存相应 pages.json，不能只留图片和 seed。
- 新项目学习其 prompt 结构，不继承页数；严格队列执行优先转换到通用 jobs。

转换映射：`prompt_text → prompt`；`全局 negative_prompt + negative_append → negative_prompt`；output 改新轮次路径；保留 seed/尺寸/scale；page_id 等信息放独立映射文件。**旧 jobs 不可原样传通用入口**，后者拒绝未知字段。转换后检查总数、ID/输出唯一性、prompt 完整性，再 dry-run。


## 9. 试图、验收与定点返修

### 9.1 代表页

从审定分镜挑 3–5 页：规整对话、异形/动作、情绪主格、字多或角色一致性难页；小项目适当减量。同构图试参数尽量保留 seed，一次改一个主要变量；改布局时明确变量。完整参数/seed 用于追踪，不承诺跨模型或服务版本像素完全复现。

先看全页读序，再看手、道具、人物脸和字，最后放进 6 页联系表看节奏。自动 OCR、黑白面积和重复检测只是线索，不能代替视觉判断。

### 9.2 按原因修，不盲抽

| 失败 | 优先处理 |
| --- | --- |
| 连续三段竖条 | 检查固定 LAYOUT_3 和实际格位描述；改布局/主视觉，再看成图 |
| 斜框多但仍单调 | 改动作链、主体尺度、关系镜头、疏密，不继续加斜线 |
| 重复肖像 | 减相似全局肖像描述，各格区分动作与尺度；必要减格/分格 |
| 多格、对白另成一格 | 明确精确格数，动作与气泡属于同格，减少文字；指定插格外不增格 |
| 手部特写长出脸 | 写裁切、hands/objects only 与脸在画外，检查全局肖像指令冲突 |
| 文学讨论变现实战斗 | 锁定实际物理场景与普通书，删除画面描述中的幻想动作，不删除必要对白 |
| 跨地点串景 | 拆页并补进出动作，减少同页互斥背景，更新连续性 |
| 角色错格/串位 | 逐格列在场/画外角色和差异锚点，减人数，画外音不加额外人像 |
| 好看但动作缺失 | 写清主体、对象、接触关系和结果，关键动作必要时单格生成 |
| 字错但画面满意 | 优先后期嵌字，不为一个字反复丢掉好画面 |
| 额度查询失败/余额下降/超时 | 停队列、留图片与记录、核对请求状态，不连续重试 |

同一结构问题约两轮针对性修改仍失败，应简化、减格、拆页或单格后拼页，写明原因与替代方案，不把随机重抽次数当进展。

### 9.3 最小 QA 记录

每页记：页 ID、审定版本、任务/seed、候选路径与选图、计划/实际版式和格数、五项评分及依据、对白核对、连续性问题、严重级别、修复动作、验收状态。区分 `planned/generated/visual_reviewed/lettering_reviewed/accepted`，生成完不直接 accepted。

每次返修说明改了什么、原因、结果；保留合理偏离的理由与失败记录。技术检查可由 Agent 完成，审美取舍只在确有分歧时给用户具体候选。

## 10. 中文嵌字

先读 [嵌字核心说明](10_通用工具/嵌字核心/README.md)，参照 [计划样例](10_通用工具/嵌字核心/plan.example.json)。复用流程，不复用旧图坐标。

1. 固定原图、审定中文、字体与哈希，建立 line_id→实际区域→说话人的映射；OCR 顺序不等于读序，装饰符号不能编成对白。
2. 原图左上角为原点，矩形用 `[x0,y0,x1,y1)` 半开区间；缩略图/联系表坐标换回原图，再裁图核对，不凭目测批量清字。
3. 分开 clean_mask（可清字）、safe_mask（新字可占用）、protect_mask（禁止改动）。排版框不等于擦除范围，灰底/纹理/斜面不能统一白矩形覆盖。
4. 先看无字底图，再排字。确认旧字去除、边线/人物未损伤；调整断行，不压扁字体、裁字或自动扩框掩盖溢出。
5. 更新真实路径、字体、哈希、区域和审查标记；不复制样例哈希到新图片。

```powershell
python -X utf8 'D:\Manga-NAI\10_通用工具\嵌字核心\lettering_core.py' '<本项目完整路径>\lettering_plan.json'
```

plan 的 output_dir 使用新轮次目录。脚本输出图片、qa 核对图、manifest.json，并检查清字/最终改动不越允许区、不伤保护区。`review.mapping/coordinates/clean` 表示 **Agent 已完成真实视觉审查**，不是要求用户代审每个坐标。

渲染后 `visual_final_review` 仍 pending，必须看输出再记录结论：漏字/残字、错译/错人、缺字/标点、留白、目标阅读尺寸下字号、压人物/边线、清字色块、读序。OCR 无报错不等于完成。

## 11. 交付与验证范围

交付前确认：剧情/分镜版本明确；中文画面、英文 prompt、成图差异已核实；每页看过图并有 6 页节奏检查；动作、身份、服装、道具、时空和文字正确；图片齐全能解码；选图指向真实文件；完整 prompt/负面/参数/seed/生成记录/返修映射/嵌字计划保留且无密钥。

仅交付本轮选定成品与需要的阅读入口/索引，原位置保留历史候选。报告区分“已写稿、已离线检查、已生成、已视觉验收、已文字验收”，未解决问题如实列明。初稿就叫初稿，不用文件检查冒充成品质量。

本文件基于用户确认的漫画范围、阶段授权、02 反例、06 全篇参考，以及完整单文件、自然对白/静默、逐项目语言、免费约束、6 页窗口/相邻变化/逐页评分的选择建立。

本次核验完整分镜与最小生成配置结构，阅读关键构建器/客户端/嵌字源码，并查看 C02、C72 原图作为分镜与成图差异样本；未声称逐页视觉验收所有历史作品。

离线验证通过：通用客户端合法单任务 dry-run、最小生成包 153 页 --check、嵌字核心帮助入口加载。文档工作未调用 NAI 生成接口。模型、服务或订阅规则变化后重新核验，不把本地实现描述成永久官方保证。

改写前根约定原样保存在 [历史备份](00_文档/历史约定/AGENT_20260929_改写前.md)，用于追溯，不与本文同时作为冲突的新项目默认规范。

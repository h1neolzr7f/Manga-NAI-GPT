/* Director craft context (1.6.10): our own short paraphrase of the writing methods in the reference docs
 * (scene beats, page enter/focus/leave, failure→fix tables). Not hard rules — injected as LLM reference
 * for the batch director / story mode plan and the lint repair pass. ON by default; opt out with
 * localStorage mnai.craftContext='0'. */
(function (root) {
  'use strict';
  function enabled() { try { return !(root.localStorage && root.localStorage.getItem('mnai.craftContext') === '0'); } catch (e) { return true; } }

  // Kept short on purpose (token-cheap). Our own wording.
  var PLAN = [
    '【分镜写作参考（不是硬规则，用来提高质量）】',
    '场景六拍：①定场（在哪、谁在）②触发（打破平静的事）③反应（角色第一反应）④推进（冲突加码/信息揭示）⑤高点（本场最重要的一瞬，给最大格或特写）⑥余韵（结果/表情/留白，引出下一场）。短场景可合并相邻拍，但不要跳过触发和高点。',
    '每页三拍：进入（承接上一页，读者先看到什么）→ 重点（本页唯一最想让读者记住的瞬间）→ 离开（页尾留一个钩子：疑问、转折或表情，让人想翻页）。',
    '每页一句 purpose：只写一件事；purpose 不清楚的页通常是塞了两个时刻。',
    '一格一瞬间：出现「然后/接着」就拆格或删掉次要动作；格与格之间是因果或反应。',
    '景别节奏：远景交代空间，中景推动作，特写给情绪；高点前后景别要跳变，同页至少两种，不要连续三格同景别。',
    '对白：每格 0–2 泡，每句尽量 ≤20 字；先说话的人放在阅读顺序前面（右上→左下）。',
    '连续性：上一页 continuity_out 原样作为下一页 continuity_in；服装、道具、伤痕、天气跨格保持。',
    '人物：每页主要人物 ≤2；cast 只写本格画面里看得见的人，画外音/背影的说话者可以不写进 cast（台词照留）。',
    'must_show 写本格读者必须看到的动作/道具（具体可画）；must_not_show 写不在场的人或会泄露后文的东西。'
  ].join('\n');

  // failure → fix (our paraphrase of the handbook / guide troubleshooting tables + our lintPlan messages)
  var FIXES = [
    { re: /缺少「这页必须让读者看懂什么」|purpose/, fix: '补一句只含一件事的 purpose，用本页重点拍改写。' },
    { re: /人物表以外|cast/, fix: '从该格 cast 和 prompt 里删掉不在本页出场的人；必要时用 must_not_show 写上他。' },
    { re: /must_show 和 must_not_show/, fix: '二选一：留在 must_show，从 must_not_show 删掉。' },
    { re: /页型/, fix: '按本页实际人物数改页型（1 人 SOLO，2 人以上 BOTH）。' },
    { re: /多个时刻|然后|接着/, fix: '只保留最关键的一个动作，其余移到相邻格。' },
    { re: /画面要素/, fix: 'prompt 精简到 3–5 个看得见的要素，删抽象词。' },
    { re: /个气泡/, fix: '合并或拆到相邻格，每格最多 2 泡。' },
    { re: /字，超过/, fix: '把长句拆成两句或删修饰，每句 ≤20 字。' },
    { re: /景别相同/, fix: '把高点格改为 close-up，定场格改为 wide shot。' },
    { re: /continuity_out/, fix: '把下一页 continuity_in 改成与上一页 continuity_out 完全相同的句子。' },
    { re: /全身镜头/, fix: '把非定场的 full body 改为 cowboy shot 或 medium shot。' },
    { re: /外貌太像|写成了/, fix: '修改 cast_dna：性别按称呼改对；外貌太像的两人给一人换发型/发色/年龄或服装，并同步各格 prompt。' },
    { re: /主要人物/, fix: '把第 3 个人改成画外音：从他说话那格的 cast 删掉（台词保留），prompt 里不画他的脸，必要时写 offscreen voice。' }
  ];
  // Image-side failures (guide/handbook): used as reference text for the repair step.
  var IMAGE_FIXES = [
    '角色串脸/多出人物 → 人数 tag 放最前（1girl/2girls），只写本格出场者，加 must_not_show。',
    '分格乱/格数不对 → 降低画面要素，整页 prompt 写清 N panels 与阅读顺序，减少对角构图。',
    '气泡里出现乱码字 → 底图不画字（speech bubble, empty），文字后期嵌字。',
    '画面变彩色 → 删颜色词，保留 monochrome, greyscale。',
    '动作看不懂 → must_show 写具体动作+道具，景别拉近一级。'
  ];

  function fixFor(msg) { msg = String(msg || ''); for (var i = 0; i < FIXES.length; i++) if (FIXES[i].re.test(msg)) return FIXES[i].fix; return '按提示修改该格，保持其他格不变。'; }
  function fixTableText() { return '【失败→修法参考】\n' + FIXES.map(function (f) { return '- ' + f.re.source.split('|')[0].replace(/[\\()]/g, '') + ' → ' + f.fix; }).join('\n') + '\n' + IMAGE_FIXES.map(function (s) { return '- ' + s; }).join('\n'); }
  function planContext() { return PLAN; }
  var CAST_RULE = '顶层再加 "cast_dna":[{"name":"角色名","gender":"female|male","age":"child|teen|adult|elderly","tags":"英文 tag：1girl/1boy、年龄、发型发色、脸部特征、服装，6–10 个"}]，覆盖所有角色。性别按称呼判断（妈妈/外婆/姐是女性，爸爸/哥/爷是男性）；同性别同年龄段的两人必须发型或服装明显不同；每格 prompt 里出场角色的外貌要和 cast_dna 一致。';
  var BEATS_RULE = 'pages 每一项再加 "beats":{"enter":"中文","focus":"中文","leave":"中文"}（本页进入/重点/离开三拍，各一短句），并让重点拍落在景别最近或最大的那一格。';
  function repairIssues(lint) {
    if (!lint) return [];
    return lint.errors.map(function (m) { return { level: 'error', issue: m, fix: fixFor(m) }; })
      .concat(lint.warnings.map(function (m) { return { level: 'warning', issue: m, fix: fixFor(m) }; }));
  }
  var api = { enabled: enabled, planContext: planContext, beatsRule: BEATS_RULE, castRule: CAST_RULE, fixFor: fixFor, fixTableText: fixTableText, repairIssues: repairIssues };
  root.DirectorCraftContext = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* 故事模式: paste a long story -> editable purpose/beats storyboard -> batch director ->
 * one page per canvas page (NAI free tier) -> auto decompose. Helpers: whole chapter,
 * character presets (bible DNA), lint warnings, pause / retry / re-decompose, export.
 * Never spends Anlas (free-tier only, stops on any balance drop). */
(function () {
  'use strict';
  const S = window.StoryModeCore;
  if (!S) return;
  const $ = id => document.getElementById(id);
  const PRESET_KEY = 'mnai.storyCast';
  const loadPresets = () => { try { return JSON.parse(localStorage.getItem(PRESET_KEY) || '{}'); } catch (e) { return {}; } };
  const savePresets = p => { try { localStorage.setItem(PRESET_KEY, JSON.stringify(p)); } catch (e) { /* storage blocked */ } };
  let state = { plan: null, queue: null, running: false, stop: false, pageGuids: [], lint: null };

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function html(body) {
    return '<div class="story-mode-head"><strong>故事模式</strong><button type="button" class="ui-btn ui-btn-ghost" id="storyModeClose" aria-label="关闭">×</button></div>' + body;
  }
  function open() {
    let box = $('storyMode');
    if (box) { box.hidden = false; return box; }
    box = document.createElement('section');
    box.id = 'storyMode'; box.className = 'ui-card story-mode'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '故事模式');
    box.innerHTML = html(
      '<ol class="story-mode-steps"><li>贴入故事（小说段落或「名字：台词」都行）</li><li>拆分镜：可改每页「必须说明」、进入/重点/离开，再给角色定外貌</li><li>一键出整章：每页自动出图并拆成可编辑气泡（失败页可只重拆）</li></ol>' +
      '<textarea id="storyModeText" class="ui-textarea" rows="8" placeholder="# 标题（可选）\n傍晚的车站下着大雨……\n小雪：怎么办，没带伞……\n阿凯：一起走吧！"></textarea>' +
      '<div class="svc-row"><label>每页格数 <select id="storyModePer"><option>3</option><option selected>4</option></select></label>' +
      '<label>最多页数 <input id="storyModeMax" type="number" min="1" max="30" value="8" style="width:56px"></label>' +
      '<button type="button" class="ui-btn ui-btn-primary" id="storyModePlan">拆分镜</button></div>' +
      '<div id="storyModeLint" class="story-mode-lint" hidden></div>' +
      '<div id="storyModeCast" class="story-mode-cast" hidden></div>' +
      '<div id="storyModeBoard" class="story-mode-board" hidden></div>' +
      '<div id="storyModePages" class="story-mode-pages" hidden></div>' +
      '<div class="svc-row" id="storyModeActions" hidden>' +
      '<button type="button" class="ui-btn ui-btn-primary" id="storyModeRun">一键出整章</button>' +
      '<button type="button" class="ui-btn" id="storyModeStop" disabled>暂停</button>' +
      '<button type="button" class="ui-btn" id="storyModeRetry" disabled>重试失败页</button>' +
      '<button type="button" class="ui-btn" id="storyModeExport">导出全部</button></div>' +
      '<p class="ui-muted" id="storyModeStatus" aria-live="polite">只用 NovelAI 免费档；余额一变就停，不扣 Anlas。</p>');
    document.body.appendChild(box);
    $('storyModeClose').onclick = () => { box.hidden = true; };
    $('storyModePlan').onclick = () => plan().catch(e => status('拆分镜失败：' + (e.message || e), true));
    $('storyModeRun').onclick = () => runChapter().catch(e => status('出章中断：' + (e.message || e), true));
    $('storyModeStop').onclick = () => { state.stop = true; status('当前页完成后暂停…'); };
    $('storyModeRetry').onclick = () => { S.retryFailed(state.queue); renderPages(); runChapter().catch(e => status('重试中断：' + (e.message || e), true)); };
    $('storyModeExport').onclick = () => { if (window.TaskLauncher) TaskLauncher.exportAll(); };
    return box;
  }
  function status(t, bad) { const n = $('storyModeStatus'); if (n) { n.textContent = t; n.classList.toggle('is-error', !!bad); } }

  async function loadBibleCards() {
    try {
      if (window.MangaCharacterBibleUI && MangaCharacterBibleUI.all) return await MangaCharacterBibleUI.all();
    } catch (e) { /* bible optional */ }
    return [];
  }

  async function plan() {
    const text = $('storyModeText').value;
    const parsed = S.parseStory(text);
    if (!parsed.beats.length) throw new Error('先贴一段故事。');
    const p = S.buildPlan(parsed, { perPage: +$('storyModePer').value, maxPages: +$('storyModeMax').value || 8 });
    status('批量导演正在规划 ' + p.pages.length + ' 页…');
    const STM = window.NaiComicStoryToManga;
    let source = 'local';
    if (STM && STM.enrichPlanWithDirector) { try { const r = await STM.enrichPlanWithDirector(p); source = r.source; } catch (e) { source = 'local'; } }
    S.enrichPages(p); // re-fill purpose/beats if director wiped fields
    state.plan = p; state.queue = S.makeQueue(p.pages.length); state.pageGuids = [];
    window.__mangaStoryPlan = p;
    state.lint = S.lintStory(p);
    await renderCast();
    renderBoard();
    renderLint();
    renderPages();
    $('storyModeActions').hidden = false;
    const L = state.lint;
    status('分镜好了：' + p.pages.length + ' 页（导演：' + (source === 'api-batch' ? '批量导演' : source === 'api' ? '逐格导演' : '本地规则') + '）' + (p.truncated ? '，超出的 ' + p.truncated + ' 页没排，可调大「最多页数」' : '') +
      '。可改每页说明与节拍，再点「一键出整章」。' +
      (L && (L.errors.length || L.warnings.length) ? '（检查：' + L.errors.length + ' 错 / ' + L.warnings.length + ' 提示）' : '') +
      (source === 'local' || source === 'heuristic' ? '（提示：在「服务设置 → AI 导演」填好接口并勾选启用，分镜会更好）' : ''));
  }

  async function renderCast() {
    const box = $('storyModeCast'), cast = S.castOf(state.plan);
    const bible = S.presetsFromBible(cast, await loadBibleCards());
    const pre = S.mergePresets(loadPresets(), bible);
    box.hidden = !cast.length;
    box.innerHTML = '<div class="ui-muted">角色外貌（英文 tag；有角色库 DNA 会自动带上，可改；每页都会带上）</div>' +
      cast.map(c => '<label class="story-mode-castrow"><span>' + esc(c) + '</span><input data-cast="' + esc(c) + '" class="ui-textarea" placeholder="1girl, long black hair, school uniform" value="' + esc(pre[c] || '') + '"' + (bible[c] && !loadPresets()[c] ? ' title="来自角色库 DNA"' : '') + '></label>').join('');
    box.oninput = () => { const p = loadPresets(); box.querySelectorAll('[data-cast]').forEach(i => { p[i.dataset.cast] = i.value; }); savePresets(p); };
  }

  function readBoardIntoPlan() {
    if (!state.plan) return;
    const board = $('storyModeBoard');
    if (!board) return;
    board.querySelectorAll('[data-page]').forEach(card => {
      const i = +card.dataset.page;
      const pg = state.plan.pages[i];
      if (!pg) return;
      const purpose = card.querySelector('[data-f="purpose"]');
      const enter = card.querySelector('[data-f="enter"]');
      const focus = card.querySelector('[data-f="focus"]');
      const leave = card.querySelector('[data-f="leave"]');
      if (purpose) pg.purpose = purpose.value.trim();
      pg.beats = pg.beats || {};
      if (enter) pg.beats.enter = enter.value.trim();
      if (focus) pg.beats.focus = focus.value.trim();
      if (leave) pg.beats.leave = leave.value.trim();
      card.querySelectorAll('[data-panel]').forEach(inp => {
        const k = +inp.dataset.panel;
        if (pg.panels[k]) pg.panels[k].description = inp.value.trim();
      });
    });
    state.lint = S.lintStory(state.plan);
    renderLint();
  }

  function renderBoard() {
    const box = $('storyModeBoard');
    if (!state.plan) return;
    box.hidden = false;
    box.innerHTML = '<div class="ui-muted">可编辑分镜（出图前改好；进入/重点/离开 = 本页三拍）</div>' +
      state.plan.pages.map((pg, i) => {
        const b = pg.beats || {};
        return '<details class="story-mode-card" data-page="' + i + '"' + (i === 0 ? ' open' : '') + '>' +
          '<summary>第 ' + (i + 1) + ' 页 · ' + pg.panels.length + ' 格' + (pg.layout ? ' · ' + esc(pg.layout) : '') + (pg.pageType ? ' · ' + pg.pageType : '') + '</summary>' +
          '<label class="story-mode-field">这页必须说明什么<textarea data-f="purpose" rows="2">' + esc(pg.purpose || '') + '</textarea></label>' +
          '<div class="story-mode-beats">' +
          '<label>进入<textarea data-f="enter" rows="1">' + esc(b.enter || '') + '</textarea></label>' +
          '<label>重点<textarea data-f="focus" rows="1">' + esc(b.focus || '') + '</textarea></label>' +
          '<label>离开<textarea data-f="leave" rows="1">' + esc(b.leave || '') + '</textarea></label>' +
          '</div>' +
          pg.panels.map((q, k) => '<label class="story-mode-field">格 ' + (k + 1) + '<input data-panel="' + k + '" value="' + esc(q.description || '') + '"></label>').join('') +
          '</details>';
      }).join('');
    box.onchange = () => { readBoardIntoPlan(); };
    box.oninput = () => { /* live edit; lint on change blur via onchange */ };
  }

  function renderLint() {
    const box = $('storyModeLint');
    const L = state.lint;
    if (!box) return;
    if (!L || (!L.errors.length && !L.warnings.length)) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = (L.errors.length ? '<div class="story-mode-lint-err"><b>分镜问题</b><ul>' + L.errors.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul></div>' : '') +
      (L.warnings.length ? '<div class="story-mode-lint-warn"><b>建议</b><ul>' + L.warnings.slice(0, 12).map(e => '<li>' + esc(e) + '</li>').join('') + (L.warnings.length > 12 ? '<li>…还有 ' + (L.warnings.length - 12) + ' 条</li>' : '') + '</ul></div>' : '');
  }

  function renderPages() {
    const box = $('storyModePages'); if (!state.queue) return;
    box.hidden = false;
    const label = { pending: '待出', running: '出图中', done: '完成', failed: '失败' };
    box.innerHTML = state.queue.pages.map(q => {
      const pg = state.plan.pages[q.index];
      const rede = S.canRedecompose(q) ? '<button type="button" class="ui-btn story-rede" data-rede="' + q.index + '" title="保留整页图，只重新拆层">' + (q.status === 'failed' ? '只重拆' : '再拆一次') + '</button>' : '';
      return '<div class="story-mode-page is-' + q.status + '" title="' + esc(q.error || '') + '"><b>第 ' + (q.index + 1) + ' 页</b> · ' + pg.panels.length + ' 格 · ' + label[q.status] +
        (q.image && q.status === 'failed' ? ' · 图已留' : '') +
        (q.error ? '<br><small>' + esc(q.error) + '</small>' : '') + rede + '</div>';
    }).join('');
    box.querySelectorAll('[data-rede]').forEach(btn => {
      btn.onclick = ev => {
        ev.stopPropagation();
        const i = +btn.dataset.rede;
        if (!S.queueRedecompose(state.queue, i)) return;
        renderPages();
        if (!state.running) runChapter().catch(e => status('重拆中断：' + (e.message || e), true));
      };
    });
    const s = S.summary(state.queue);
    $('storyModeRetry').disabled = state.running || !s.failed;
  }

  async function newPage(first) {
    if (first && typeof canvas !== 'undefined' && !canvas.getObjects().some(o => o.type === 'image' || o.isPanel)) return typeof getCanvasGUID === 'function' ? getCanvasGUID() : null;
    if (typeof btmCreatePageAfter !== 'function' || typeof getCanvasGUID !== 'function') return null;
    return btmCreatePageAfter(getCanvasGUID(), canvas.getWidth() || 1000, canvas.getHeight() || 1414);
  }

  async function runChapter() {
    if (state.running) return;
    if (!state.plan) throw new Error('先点「拆分镜」。');
    readBoardIntoPlan();
    const D = window.MangaPageDecompose, C = window.MangaPageDecomposeCore;
    if (!D || !D.generateSpecPage || !C) throw new Error('整页生成模块还没加载。');
    if (!window.NaiEngine || !window.NaiEngine.configured()) throw new Error('请先在「服务设置」填写 NovelAI Token。');
    const bible = S.presetsFromBible(S.castOf(state.plan), await loadBibleCards());
    S.applyPresets(state.plan, S.mergePresets(loadPresets(), bible));
    state.running = true; state.stop = false;
    $('storyModeRun').disabled = true; $('storyModeStop').disabled = false;
    let first = !state.queue.pages.some(p => p.status === 'done');
    try {
      let q;
      while (!state.stop && (q = S.nextPending(state.queue))) {
        q.status = 'running'; renderPages();
        const onlyDecomp = !!(q.redecomposeOnly || q.image);
        status('第 ' + (q.index + 1) + ' / ' + state.queue.pages.length + ' 页：' + (onlyDecomp ? '只重拆（保留原图）…' : '出图并拆解…'));
        try {
          if (q.guid && typeof btmGetGuidIndex === 'function' && btmGetGuidIndex(q.guid) >= 0) {
            if (typeof getCanvasGUID === 'function' && getCanvasGUID() !== q.guid && typeof btmNavigatePage === 'function') {
              await btmNavigatePage(btmGetGuidIndex(q.guid) - btmGetGuidIndex(getCanvasGUID()));
            }
          } else { q.guid = await newPage(first); }
          first = false;
          let rec;
          if (onlyDecomp && q.image) {
            await D.decomposeDataUrl(q.image, q.hints || [], { rtl: true, noConfirm: true });
            rec = { reused: true };
          } else {
            const pg = state.plan.pages[q.index];
            const base = C.specFromPlanPage(pg, { rtl: true });
            // purpose / 重点 feed the page caption so NAI sees the page intent
            const purposeBits = [pg.purpose, pg.beats && pg.beats.focus].filter(Boolean).join('；');
            if (purposeBits) base.page = [purposeBits, base.page].filter(Boolean).join(', ');
            // Shared PageLayoutCore positions/codes before buildPagePrompt bakes them into text
            if (window.PageLayoutCore && PageLayoutCore.v2Enabled()) {
              try {
                const n = (base.panels || []).length || 1;
                const geo = PageLayoutCore.cells(n, { width: 832, height: 1216, dir: 'rtl', code: pg.layout });
                base.layout = Object.assign({}, base.layout || {}, { positions: geo.cells.map(c => c.position), code: geo.code });
              } catch (e) { /* keep default positions */ }
            } else if (pg.layout) {
              base.layout = Object.assign({}, base.layout || {}, { code: pg.layout });
            }
            rec = await D.generateSpecPage(C.buildPagePrompt(base));
          }
          q.status = 'done'; q.record = rec || null; q.redecomposeOnly = false;
          // keep image on done so "再拆一次" still works; drop huge payload after success only if reused path filled from fail
          if (typeof btmSaveProjectFile === 'function') await btmSaveProjectFile(null, false);
        } catch (e) {
          q.status = 'failed'; q.error = String(e && e.message || e); q.redecomposeOnly = false;
          if (e && e.image) { q.image = e.image; q.hints = e.hints; }
          if (/Anlas|免费档|余额/.test(q.error)) { state.stop = true; }
        }
        renderPages();
      }
    } finally {
      state.running = false;
      $('storyModeRun').disabled = false; $('storyModeStop').disabled = true;
      renderPages();
      const s = S.summary(state.queue);
      status('完成 ' + s.done + ' / ' + s.total + ' 页' + (s.failed ? '，失败 ' + s.failed + ' 页（可「重试失败页」或「只重拆」）' : '') + (s.pending ? '，还有 ' + s.pending + ' 页未出' : '') + '。每页已拆成可编辑气泡和文字层。', !!s.failed);
    }
  }
  window.StoryMode = { open, plan, runChapter, state: () => state };
})();

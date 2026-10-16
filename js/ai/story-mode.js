/* 故事模式: paste a long story -> batch director storyboard -> one page per canvas page (NAI free tier) ->
 * auto decompose into editable panels/bubbles/text. Helpers: whole chapter in one click, character presets,
 * retry failed pages, export all. Never spends Anlas (free-tier only, stops on any balance drop). */
(function () {
  'use strict';
  const S = window.StoryModeCore;
  if (!S) return;
  const $ = id => document.getElementById(id);
  const PRESET_KEY = 'mnai.storyCast';
  const loadPresets = () => { try { return JSON.parse(localStorage.getItem(PRESET_KEY) || '{}'); } catch (e) { return {}; } };
  const savePresets = p => { try { localStorage.setItem(PRESET_KEY, JSON.stringify(p)); } catch (e) { /* storage blocked */ } };
  let state = { plan: null, queue: null, running: false, stop: false, pageGuids: [] };

  function html(body) {
    return '<div class="story-mode-head"><strong>故事模式</strong><button type="button" class="ui-btn ui-btn-ghost" id="storyModeClose" aria-label="关闭">×</button></div>' + body;
  }
  function open() {
    let box = $('storyMode');
    if (box) { box.hidden = false; return box; }
    box = document.createElement('section');
    box.id = 'storyMode'; box.className = 'ui-card story-mode'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', '故事模式');
    box.innerHTML = html(
      '<ol class="story-mode-steps"><li>贴入故事（小说段落或「名字：台词」都行）</li><li>拆分镜，给角色定外貌</li><li>一键出整章：每页自动出图并拆成可编辑气泡</li></ol>' +
      '<textarea id="storyModeText" class="ui-textarea" rows="9" placeholder="# 标题（可选）\n傍晚的车站下着大雨……\n小雪：怎么办，没带伞……\n阿凯：一起走吧！"></textarea>' +
      '<div class="svc-row"><label>每页格数 <select id="storyModePer"><option>3</option><option selected>4</option></select></label>' +
      '<label>最多页数 <input id="storyModeMax" type="number" min="1" max="30" value="8" style="width:56px"></label>' +
      '<button type="button" class="ui-btn ui-btn-primary" id="storyModePlan">拆分镜</button></div>' +
      '<div id="storyModeCast" class="story-mode-cast" hidden></div>' +
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

  async function plan() {
    const text = $('storyModeText').value;
    const parsed = S.parseStory(text);
    if (!parsed.beats.length) throw new Error('先贴一段故事。');
    const p = S.buildPlan(parsed, { perPage: +$('storyModePer').value, maxPages: +$('storyModeMax').value || 8 });
    status('批量导演正在规划 ' + p.pages.length + ' 页…');
    const STM = window.NaiComicStoryToManga;
    let source = 'local';
    if (STM && STM.enrichPlanWithDirector) { try { const r = await STM.enrichPlanWithDirector(p); source = r.source; } catch (e) { source = 'local'; } }
    state.plan = p; state.queue = S.makeQueue(p.pages.length); state.pageGuids = [];
    window.__mangaStoryPlan = p;
    renderCast(); renderPages();
    $('storyModeActions').hidden = false;
    status('分镜好了：' + p.pages.length + ' 页（导演：' + (source === 'api-batch' ? '批量导演' : source === 'api' ? '逐格导演' : '本地规则') + '）' + (p.truncated ? '，超出的 ' + p.truncated + ' 页没排，可调大「最多页数」' : '') + '。可先给角色填外貌，再点「一键出整章」。' +
      (source === 'local' || source === 'heuristic' ? '（提示：在「服务设置 → AI 导演」填好接口并勾选启用，分镜会更好）' : ''));
  }
  function renderCast() {
    const box = $('storyModeCast'), cast = S.castOf(state.plan), pre = loadPresets();
    box.hidden = !cast.length;
    box.innerHTML = '<div class="ui-muted">角色外貌（英文 tag，每页都会带上，保持同一张脸；留空 = 交给导演）</div>' +
      cast.map(c => '<label class="story-mode-castrow"><span>' + c.replace(/</g, '') + '</span><input data-cast="' + c.replace(/"/g, '') + '" class="ui-textarea" placeholder="1girl, long black hair, school uniform" value="' + String(pre[c] || '').replace(/"/g, '&quot;') + '"></label>').join('');
    box.oninput = () => { const p = loadPresets(); box.querySelectorAll('[data-cast]').forEach(i => { p[i.dataset.cast] = i.value; }); savePresets(p); };
  }
  function renderPages() {
    const box = $('storyModePages'); if (!state.queue) return;
    box.hidden = false;
    const label = { pending: '待出', running: '出图中', done: '完成', failed: '失败' };
    box.innerHTML = state.queue.pages.map(q => {
      const pg = state.plan.pages[q.index];
      return '<div class="story-mode-page is-' + q.status + '" title="' + (q.error || '').replace(/"/g, '') + '"><b>第 ' + (q.index + 1) + ' 页</b> · ' + pg.panels.length + ' 格 · ' + label[q.status] + (q.error ? '<br><small>' + q.error.replace(/</g, '') + '</small>' : '') + '</div>';
    }).join('');
    const s = S.summary(state.queue);
    $('storyModeRetry').disabled = state.running || !s.failed;
  }

  async function newPage(first) {
    if (first && typeof canvas !== 'undefined' && !canvas.getObjects().some(o => o.type === 'image' || o.isPanel )) return typeof getCanvasGUID === 'function' ? getCanvasGUID() : null;
    if (typeof btmCreatePageAfter !== 'function' || typeof getCanvasGUID !== 'function') return null;
    return btmCreatePageAfter(getCanvasGUID(), canvas.getWidth() || 1000, canvas.getHeight() || 1414);
  }
  async function runChapter() {
    if (state.running) return;
    if (!state.plan) throw new Error('先点「拆分镜」。');
    const D = window.MangaPageDecompose, C = window.MangaPageDecomposeCore;
    if (!D || !D.generateSpecPage || !C) throw new Error('整页生成模块还没加载。');
    if (!window.NaiEngine || !window.NaiEngine.configured()) throw new Error('请先在「服务设置」填写 NovelAI Token。');
    S.applyPresets(state.plan, loadPresets());
    state.running = true; state.stop = false;
    $('storyModeRun').disabled = true; $('storyModeStop').disabled = false;
    let first = !state.queue.pages.some(p => p.status === 'done');
    try {
      let q;
      while (!state.stop && (q = S.nextPending(state.queue))) {
        q.status = 'running'; renderPages();
        status('第 ' + (q.index + 1) + ' / ' + state.queue.pages.length + ' 页：出图并拆解…');
        try {
          if (q.guid && typeof btmGetGuidIndex === 'function' && btmGetGuidIndex(q.guid) >= 0) {
            // retry on the same page (no duplicate pages)
            if (typeof getCanvasGUID === 'function' && getCanvasGUID() !== q.guid && typeof btmNavigatePage === 'function') {
              await btmNavigatePage(btmGetGuidIndex(q.guid) - btmGetGuidIndex(getCanvasGUID()));
            }
          } else { q.guid = await newPage(first); }
          first = false;
          let rec;
          if (q.image) {
            // the picture was already generated: only decompose again, no new NovelAI call
            await D.decomposeDataUrl(q.image, q.hints || [], { rtl: true, noConfirm: true }); rec = { reused: true };
          } else {
            const spec = C.buildPagePrompt(C.specFromPlanPage(state.plan.pages[q.index], { rtl: true }));
            rec = await D.generateSpecPage(spec);
          }
          q.status = 'done'; q.record = rec || null; q.image = null;
          if (typeof btmSaveProjectFile === 'function') await btmSaveProjectFile(null, false);
        } catch (e) {
          q.status = 'failed'; q.error = String(e && e.message || e);
          if (e && e.image) { q.image = e.image; q.hints = e.hints; }
          if (/Anlas|免费档|余额/.test(q.error)) { state.stop = true; }   // never continue after a spend risk
        }
        renderPages();
      }
    } finally {
      state.running = false;
      $('storyModeRun').disabled = false; $('storyModeStop').disabled = true;
      renderPages();
      const s = S.summary(state.queue);
      status('完成 ' + s.done + ' / ' + s.total + ' 页' + (s.failed ? '，失败 ' + s.failed + ' 页（可「重试失败页」）' : '') + (s.pending ? '，还有 ' + s.pending + ' 页未出' : '') + '。每页已拆成可编辑气泡和文字层。', !!s.failed);
    }
  }
  window.StoryMode = { open, plan, runChapter, state: () => state };
})();

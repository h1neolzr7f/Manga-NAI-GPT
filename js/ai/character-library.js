/* Character library 2.0 (#1): recognise library characters on the page, score consistency, feed GPT edits.
 * Server: manga_character_library.py (anime-face YOLO + CCIP on CPU). Cards live in the Character Bible store
 * (IndexedDB, this browser only). Idea: Magiv2 chapter-wide character bank (arXiv:2408.00298). */
(function (root) {
  'use strict';
  const $ = id => document.getElementById(id);
  const bible = () => root.MangaCharacterBibleUI;
  const S = { cards: [], result: null, pageKey: '', busy: false, card: null, view: null, autoRef: true };
  try { S.autoRef = localStorage.getItem('mnai.charlib.autoRef') !== '0'; } catch (_) { /* default on */ }

  function post(route, body, quiet) {
    return root.MangaModelRequest.post('/manga-smart/' + route, body, quiet ? { confirmDownload: () => false } : {});
  }
  function el(tag, attrs, html) { const e = document.createElement(tag); Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k])); if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

  /** CCIP features + colours for every reference of a card; stored back on the card. */
  async function buildIdentity(card) {
    const feats = []; let palette = [];
    for (const ref of (card.references || []).slice(0, 3)) {
      const r = await post('character-embed', { image: ref });
      if (r && r.ok && r.feature) { feats.push(r.feature); if (!palette.length && r.palette) palette = r.palette; }
      else if (r && r.declined) return false;
    }
    if (!feats.length) return false;
    const prev = card.identity || {};
    await bible().put(Object.assign({}, card, { identity: { features: feats.concat(prev.features || []).slice(0, 8), palette, tags: prev.tags || '' } }));
    return true;
  }

  async function loadCards() { S.cards = bible() && bible().all ? (await bible().all()) : []; return S.cards; }
  function library() {
    return S.cards.filter(c => c.identity && c.identity.features.length)
      .map(c => ({ id: c.id, name: c.name, features: c.identity.features, palette: c.identity.palette }));
  }

  /** Recognise characters on the current page. quiet: never ask to download (background use). */
  async function identify(quiet) {
    if (S.busy) return S.result;
    const lib = library();
    const pa = root.PanelAuto && await root.PanelAuto.get();
    if (!pa || !pa.image) { status('先导入一张漫画页。'); return null; }
    S.busy = true; status('正在认人…');
    try {
      const t0 = performance.now();
      const r = await post('character-identify', { image: pa.image, library: lib,
        panels: (pa.panels || []).map(p => [p.x, p.y, p.x + p.w, p.y + p.h]) }, quiet);
      if (!r || !r.ok) { status(r && r.error ? r.error : '认人失败。', true); return null; }
      r.ms = Math.round(performance.now() - t0); r.key = pa.key; r.panelNumbers = (pa.panels || []).map(p => p.n);
      S.result = r; S.pageKey = pa.key;
      const n = r.faces.filter(f => f.status === 'match').length;
      status(!r.faces.length ? '这一页没有找到人脸。' : !lib.length ? '找到 ' + r.faces.length + ' 张脸。给主要角色点「加入角色库」起个名字，之后每页都能自动认出。' : '认出 ' + n + ' / ' + r.faces.length + ' 张脸。');
      render(); draw();
      return r;
    } finally { S.busy = false; }
  }

  function statusText(f) {
    if (f.status === 'match') return f.name + ' · ' + f.score;
    if (f.status === 'possible') return '可能是 ' + f.name + ' · ' + f.score;
    return '未知';
  }

  // ---------- overlay on the canvas ----------
  function draw() {
    const c = root.canvas; if (!c || !S.result || !S.card || S.card.hidden) return;
    const rect = c.upperCanvasEl.getBoundingClientRect();
    if (!S.view) { S.view = el('canvas', { id: 'charLibView', class: 'charlib-view' }); document.body.appendChild(S.view); }
    const v = S.view; v.style.cssText = 'position:fixed;pointer-events:none;z-index:40;left:' + rect.left + 'px;top:' + rect.top + 'px;width:' + rect.width + 'px;height:' + rect.height + 'px';
    v.width = Math.round(rect.width); v.height = Math.round(rect.height);
    const sx = v.width / S.result.width, sy = v.height / S.result.height, g = v.getContext('2d');
    g.clearRect(0, 0, v.width, v.height);
    S.result.faces.forEach(f => {
      const [x0, y0, x1, y1] = f.face; const col = f.status === 'match' ? '#16a34a' : f.status === 'possible' ? '#f59e0b' : '#94a3b8';
      g.lineWidth = 2; g.strokeStyle = col; g.setLineDash(f.status === 'match' ? [] : [5, 4]); g.strokeRect(x0 * sx, y0 * sy, (x1 - x0) * sx, (y1 - y0) * sy); g.setLineDash([]);
      const t = statusText(f); g.font = 'bold 13px sans-serif'; const w = g.measureText(t).width + 10;
      g.fillStyle = col; g.fillRect(x0 * sx, y0 * sy - 20, w, 20); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(t, x0 * sx + 5, y0 * sy - 10);
    });
  }
  function hideOverlay() { if (S.view) { S.view.remove(); S.view = null; } }

  // ---------- card ----------
  function status(text, err) { const s = $('charLibStatus'); if (s) { s.textContent = text; s.dataset.error = err ? 'true' : ''; } }
  function render() {
    const body = $('charLibBody'); if (!body) return;
    const lib = library();
    let html = '<p class="ui-muted">角色库：' + (S.cards.length ? S.cards.map(c => esc(c.name) + (c.identity && c.identity.features.length ? '' : '（未建立识别特征）')).join('、') : '还没有角色') + '</p>';
    const r = S.result;
    if (r) {
      const known = r.faces.filter(f => f.status !== 'unknown');
      html += '<p>本页找到 <b>' + r.faces.length + '</b> 张脸，认出 <b>' + known.length + '</b> 个（' + (r.ms / 1000).toFixed(1) + ' 秒）。</p>';
      const panels = Object.keys(r.panelScores || {}).filter(k => k !== '-1');
      if (panels.length) html += '<p class="charlib-scores">每格一致性：' + panels.map(k => '第 ' + ((r.panelNumbers || [])[+k] || (+k + 1)) + ' 格 ' + r.panelScores[k]).join(' · ') + '</p>';
      html += '<ul class="charlib-faces">' + r.faces.map((f, i) => '<li data-i="' + i + '"><span class="ui-badge ' + (f.status === 'match' ? 'is-ok' : f.status === 'possible' ? 'is-warn' : '') + '">' + esc(statusText(f)) + '</span>' +
        (f.status === 'match' ? '' : ' <button type="button" class="ui-btn charlib-add" data-i="' + i + '">' + (f.status === 'possible' ? '是 ' + esc(f.name) + '，记住这张' : '加入角色库') + '</button>') + '</li>').join('') + '</ul>';
    } else if (!lib.length) html += '<p>先把主要角色加入角色库：在页面上点「认出本页人物」，再给认不出的人点「加入角色库」起个名字。</p>';
    if (root.PromptAssist && root.PromptAssist.enabled() && S.cards.length) {
      html += '<details class="charlib-tags" open><summary>角色标签（NovelAI 角色栏，提示词助手）</summary>' + S.cards.map(c => '<label class="ui-field"><span>' + esc(c.name) + '</span><input class="ui-input" data-nai-prompt="character prompt for ' + esc(c.name) + '" data-char-id="' + esc(c.id) + '" value="' + esc((c.identity && c.identity.tags) || '') + '" placeholder="例如：togawa sakiko, girl"><button type="button" class="ui-btn ui-btn-ghost" data-char-find="' + esc(c.id) + '" title="按名字在标签库里找角色标签（找不到时可下载 11 MB 扩展角色表）">找标签</button><span class="ui-muted" data-char-found="' + esc(c.id) + '"></span></label>').join('') + '</details>';
    }
    const sn = root.PromptAssist ? root.PromptAssist.snippets() : [];
    if (sn.length) html += '<details class="charlib-tags"><summary>风格片段（' + sn.length + '）</summary>' + sn.map((x, i) => '<button type="button" class="ui-btn charlib-snip" data-snip="' + i + '" title="' + esc(x.text) + '">' + esc(x.name) + '</button>').join(' ') + '<p class="ui-muted">点一下复制到剪贴板；画一页的「统一画风」框里也能直接选。</p></details>';
    body.innerHTML = html;
    body.querySelectorAll('[data-snip]').forEach(b => b.addEventListener('click', () => { const x = sn[+b.dataset.snip]; if (x && navigator.clipboard) navigator.clipboard.writeText(x.text).then(() => status('已复制「' + x.name + '」。'), () => status(x.text)); }));
    body.querySelectorAll('[data-char-id]').forEach(inp => inp.addEventListener('change', async () => {
      const c = S.cards.find(x => x.id === inp.dataset.charId); if (!c) return;
      await bible().put(Object.assign({}, c, { identity: Object.assign({}, c.identity, { tags: inp.value.trim() }) })); await loadCards(); status('已保存「' + c.name + '」的标签。');
    }));
    if (root.PromptAssist) root.PromptAssist.scan();
    body.querySelectorAll('[data-char-find]').forEach(b => b.addEventListener('click', async () => {
      const c = S.cards.find(x => x.id === b.dataset.charFind), out = body.querySelector('[data-char-found="' + b.dataset.charFind + '"]'); if (!c || !root.PromptAssist) return;
      out.textContent = '查找中…';
      let tags = await root.PromptAssist.findCharacterTags(c.name, false);
      if (!tags.length && confirm('常用标签里没找到「' + c.name + '」。下载扩展角色表（约 11 MB，34 万角色，只下载一次）再找？')) { try { tags = await root.PromptAssist.findCharacterTags(c.name, true); } catch (e) { out.textContent = e.message; return; } }
      out.innerHTML = tags.length ? tags.map(t => '<button type="button" class="ui-btn pa-chip" data-pick="' + esc(t) + '">' + esc(t) + '</button>').join(' ') : '没找到；角色库名字用英文或罗马音更容易找到。';
      out.querySelectorAll('[data-pick]').forEach(x => x.addEventListener('click', () => { const inp = body.querySelector('[data-char-id="' + c.id + '"]'); inp.value = x.dataset.pick + ', ' + inp.value.replace(/^\s*,?\s*/, ''); inp.dispatchEvent(new Event('change', { bubbles: true })); }));
    }));
    body.querySelectorAll('.charlib-add').forEach(b => b.addEventListener('click', () => addFace(+b.dataset.i)));
  }

  async function cropOf(box) {
    const pa = await root.PanelAuto.get(); const im = new Image(); im.src = pa.image; await im.decode();
    const [x0, y0, x1, y1] = box; const c = document.createElement('canvas'); const k = Math.min(1, 768 / Math.max(x1 - x0, y1 - y0));
    c.width = Math.round((x1 - x0) * k); c.height = Math.round((y1 - y0) * k);
    c.getContext('2d').drawImage(im, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.9);
  }

  /** Unknown face -> new card (asks for a name); possible face -> extra exemplar for that character. */
  async function addFace(i, givenName) {
    const f = S.result && S.result.faces[i]; if (!f) return null;
    const ref = await cropOf(f.box);
    const pa = await root.PanelAuto.get();
    const emb = await post('character-embed', { image: pa.image, box: f.box });
    if (!emb || !emb.ok) { status(emb && emb.error || '没能建立识别特征。', true); return null; }
    let card;
    if (f.status === 'possible') {
      card = S.cards.find(c => c.id === f.id);
      card = Object.assign({}, card, { references: card.references.length < 3 ? card.references.concat([ref]) : card.references,
        identity: Object.assign({}, card.identity, { features: [emb.feature].concat(card.identity.features).slice(0, 8) }) });
    } else {
      const name = givenName || (typeof prompt === 'function' ? prompt('给这个角色起个名字：', '') : '');
      if (!name || !name.trim()) return null;
      card = { id: bible().newId(), name: name.trim(), traits: '', notes: '', references: [ref], identity: { features: [emb.feature], palette: emb.palette || [], tags: '' } };
    }
    await bible().put(card); await loadCards();
    status('已记住「' + card.name + '」。'); await identify(false);
    return card;
  }

  function open() {
    if (!S.card) {
      S.card = el('div', { id: 'charLibCard', class: 'ui-card charlib-card', role: 'dialog', 'aria-label': '角色库' });
      S.card.innerHTML = '<div class="charlib-head"><b>角色库 · 认人</b><button type="button" class="ui-btn ui-btn-ghost" id="charLibClose" aria-label="关闭">×</button></div>' +
        '<div id="charLibBody"></div><p id="charLibStatus" class="ui-muted" role="status"></p>' +
        '<label class="nai-inline-check"><input type="checkbox" id="charLibAutoRef"' + (S.autoRef ? ' checked' : '') + '> 修图时自动带上认出的角色参考</label>' +
        '<div class="charlib-actions"><button type="button" class="ui-btn ui-btn-primary" id="charLibRun">认出本页人物</button>' +
        '<button type="button" class="ui-btn" id="charLibBible">角色档案（加参考图）</button></div>';
      document.body.appendChild(S.card);
      $('charLibClose').addEventListener('click', close);
      $('charLibRun').addEventListener('click', () => identify(false));
      $('charLibBible').addEventListener('click', () => { if (bible()) bible().open(); });
      $('charLibAutoRef').addEventListener('change', e => { S.autoRef = e.target.checked; try { localStorage.setItem('mnai.charlib.autoRef', S.autoRef ? '1' : '0'); } catch (_) { /* session only */ } });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.card && !S.card.hidden) close(); });
      window.addEventListener('resize', draw);
    }
    S.card.hidden = false;
    return loadCards().then(() => { render(); draw(); });
  }
  function close() { if (S.card) S.card.hidden = true; hideOverlay(); }

  /** For GPT edits: the confidently recognised library character whose face lies in the region (largest overlap). */
  function cardForRegion(region) {
    if (!S.autoRef || !S.result || !region) return null;
    const pa = root.PanelAuto && root.PanelAuto._cache && root.PanelAuto._cache.get(S.pageKey);
    if (!pa) return null;
    let best = null, bestA = 0;
    for (const f of S.result.faces) {
      if (f.status !== 'match') continue;
      const [x0, y0, x1, y1] = f.face;
      const ix = Math.max(0, Math.min(x1, region.left + region.width) - Math.max(x0, region.left));
      const iy = Math.max(0, Math.min(y1, region.top + region.height) - Math.max(y0, region.top));
      const a = ix * iy / Math.max(1, (x1 - x0) * (y1 - y0));
      if (a > 0.5 && a > bestA) { bestA = a; best = f; }
    }
    return best ? S.cards.find(c => c.id === best.id) || null : null;
  }

  // background: after a page change, recognise quietly when the library has identities (never asks to download)
  let lastKey = '';
  setInterval(async () => {
    if (S.busy || !root.PanelAuto || !bible() || !bible().all || typeof root.canvas === 'undefined') return;
    const key = (() => { try { const img = root.canvas.getObjects().find(o => o.type === 'image'); return img ? (typeof root.getCanvasGUID === 'function' ? root.getCanvasGUID() : '') + (img._element && img._element.src || '').length : ''; } catch (_) { return ''; } })();
    if (!key || key === lastKey) return;
    lastKey = key;
    await loadCards();
    if (library().length) { try { await identify(true); } catch (_) { /* optional */ } }
  }, 3000);

  root.CharacterLibrary = { open, close, identify, buildIdentity, addFace, cardForRegion, loadCards, get result() { return S.result; }, _state: S };
})(typeof window !== 'undefined' ? window : globalThis);

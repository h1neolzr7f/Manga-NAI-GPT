/* Prompt assist (1.6, optional, off by default): offline Danbooru tag autocomplete/validation for NovelAI prompt boxes,
 * and 润色/扩写 through the OpenAI-compatible chat model configured in 服务设置 (DeepSeek etc.), always shown as a diff
 * first. Tag data is downloaded on first use from a pinned URL and checked against its SHA-256; it stays in this
 * browser (IndexedDB). Prompts go only to the chat endpoint the user configured. */
(function (root) {
  'use strict';
  const P = root.PromptAssistCore;
  const $ = id => document.getElementById(id);
  const KEY = 'mnai.promptAssist';
  let ix = null, loading = null;
  const enabled = () => { try { return localStorage.getItem(KEY) === '1'; } catch (_) { return false; } };
  function setEnabled(on) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (_) { /* private window */ } document.body.classList.toggle('pa-on', !!on); scan(); }
  function el(tag, attrs, html) { const e = document.createElement(tag); Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k])); if (html != null) e.innerHTML = html; return e; }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- tag database (IndexedDB cache, SHA-256 checked) ----------
  function idb() { return new Promise((res, rej) => { const r = indexedDB.open('mnai-tags', 1); r.onupgradeneeded = () => r.result.createObjectStore('csv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async function cacheGet(k) { const db = await idb(); return new Promise(res => { const q = db.transaction('csv').objectStore('csv').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); }); }
  async function cachePut(k, v) { const db = await idb(); return new Promise(res => { const t = db.transaction('csv', 'readwrite'); t.objectStore('csv').put(v, k); t.oncomplete = () => res(); t.onerror = () => res(); }); }
  async function sha256(text) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join(''); }
  function tagStatus(t, err) { const s = $('svcPaTagStatus'); if (s) { s.textContent = t; s.className = 'ui-badge' + (err ? ' is-error' : ix ? ' is-ok' : ''); } }
  /** Load the tag index; downloads once (3.4 MB) when not cached. */
  function loadTags() {
    if (ix) return Promise.resolve(ix);
    if (loading) return loading;
    const src = root.__PA_TAG_SOURCE || P.SOURCE;
    loading = (async () => {
      let csv = await cacheGet(src.sha256).catch(() => null);
      if (!csv) {
        tagStatus('正在下载标签库（约 ' + (src.bytes / 1048576).toFixed(1) + ' MB）…');
        const r = await fetch(src.url, { cache: 'no-store' }); if (!r.ok) throw new Error('标签库下载失败（HTTP ' + r.status + '）。');
        csv = await r.text();
        if ((await sha256(csv)) !== src.sha256) throw new Error('标签库校验失败（SHA-256 不一致），没有使用。');
        await cachePut(src.sha256, csv);
      }
      ix = P.buildIndex(csv); tagStatus('标签库就绪：' + ix.size.toLocaleString() + ' 个标签（离线）'); return ix;
    })().catch(e => { loading = null; tagStatus(e.message || String(e), true); throw e; });
    return loading;
  }

  let chars = null, charLoading = null;
  /** Extended character list (11 MB, downloaded once on request, SHA-256 checked, cached in IndexedDB). */
  function loadCharIndex() {
    if (chars) return Promise.resolve(chars); if (charLoading) return charLoading;
    const src = root.__PA_CHAR_SOURCE || P.CHAR_SOURCE;
    charLoading = (async () => {
      let txt = await cacheGet(src.sha256).catch(() => null);
      if (!txt) { const r = await fetch(src.url, { cache: 'no-store' }); if (!r.ok) throw new Error('扩展角色表下载失败（HTTP ' + r.status + '）。'); txt = await r.text(); if ((await sha256(txt)) !== src.sha256) throw new Error('扩展角色表校验失败，没有使用。'); await cachePut(src.sha256, txt); }
      const j = JSON.parse(txt); chars = { characters: j.characters || [], copyrights: j.copyrights || [] }; return chars;
    })().catch(e => { charLoading = null; throw e; });
    return charLoading;
  }
  /** 角色库: name -> candidate character tags (main tag list first, then the extended list if already downloaded or asked). */
  async function findCharacterTags(name, extended) {
    const out = []; try { const x = await loadTags(); P.characterTags(x, name, 6).forEach(r => out.push(r.name)); } catch (_) { /* offline */ }
    if (out.length < 3 && extended) { const c = await loadCharIndex(); P.searchNames(c.characters, name, 8).forEach(n => { if (!out.includes(n)) out.push(n); }); }
    return out;
  }
  // ---------- autocomplete ----------
  let menu = null, target = null, items = [], sel = 0;
  function closeMenu() { if (menu) menu.hidden = true; target = null; }
  function tokenAt(t) { const v = t.value, i = t.selectionStart; let a = i; while (a > 0 && !/[,\n]/.test(v[a - 1])) a--; return { a, b: i, q: v.slice(a, i).replace(/^\s+/, '').replace(/^-?\d+(?:\.\d+)?::|^[{[(]+/, '') }; }
  async function suggest(t) {
    if (!enabled() || document.activeElement !== t) return closeMenu();   // programmatic edits (apply) never pop the menu
    const tok = tokenAt(t); if (tok.q.length < 2 || /"/.test(tok.q)) return closeMenu();
    let x; try { x = await loadTags(); } catch (_) { return closeMenu(); }
    items = P.complete(x, tok.q, 8); sel = 0; if (!items.length) return closeMenu();
    if (!menu) { menu = el('div', { class: 'pa-menu', role: 'listbox', id: 'paMenu' }); document.body.appendChild(menu); menu.addEventListener('mousedown', e => { const li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); accept(+li.dataset.i); } }); }
    menu.innerHTML = items.map((r, i) => '<div role="option" data-i="' + i + '" class="pa-item' + (i === sel ? ' is-active' : '') + '"><span>' + esc(r.name) + '</span>' + (r.via ? '<small>← ' + esc(r.via) + '</small>' : '') + '<em>' + ({ character: '角色', copyright: '作品', artist: '画师', meta: 'meta' }[r.cat] || '') + ' ' + (r.count >= 1000 ? Math.round(r.count / 1000) + 'k' : r.count) + '</em></div>').join('');
    const b = t.getBoundingClientRect(); Object.assign(menu.style, { left: b.left + 'px', top: Math.min(innerHeight - 260, b.bottom + 2) + 'px', minWidth: Math.min(360, b.width) + 'px' }); menu.hidden = false; target = t;
  }
  function accept(i) {
    const t = target, r = items[i]; if (!t || !r) return; const tok = tokenAt(t), v = t.value;
    const lead = v.slice(tok.a, tok.b).match(/^\s*(?:-?\d+(?:\.\d+)?::|[{[(]+)?/)[0];
    t.value = v.slice(0, tok.a) + lead + r.name + ', ' + v.slice(tok.b).replace(/^[^,\n]*,?\s*/, ''); const pos = tok.a + lead.length + r.name.length + 2; t.setSelectionRange(pos, pos);
    t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); closeMenu(); t.focus();
  }
  function bind(t) {
    t.dataset.paBound = '1';
    t.addEventListener('input', e => { if (e.isTrusted) suggest(t); });
    t.addEventListener('blur', () => setTimeout(() => { if (target === t) closeMenu(); }, 150));
    t.addEventListener('keydown', e => {
      if (!menu || menu.hidden || target !== t) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; menu.querySelectorAll('.pa-item').forEach((n, i) => n.classList.toggle('is-active', i === sel)); }
      else if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); accept(sel); }
      else if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); }
    });
    const bar = el('div', { class: 'pa-bar' });
    bar.innerHTML = '<button type="button" class="ui-btn ui-btn-ghost" data-pa="polish" title="用你在「服务设置」里配置的聊天模型润色（先给你看改动）">润色</button>' +
      '<button type="button" class="ui-btn ui-btn-ghost" data-pa="expand" title="补充镜头、动作、场景、光影细节（先给你看改动）">扩写</button>' +
      '<button type="button" class="ui-btn ui-btn-ghost" data-pa="check" title="用离线标签库检查：别名、未收录的标签">查标签</button><span class="ui-muted pa-note"></span>';
    t.insertAdjacentElement('afterend', bar);
    bar.addEventListener('click', e => { const b = e.target.closest('[data-pa]'); if (!b) return; if (b.dataset.pa === 'check') check(t, bar); else polishBox(t, b.dataset.pa, bar); });
  }
  // ---------- always-on light helpers for NovelAI prompt boxes: Ctrl+Up/Down weights, token estimate ----------
  let lastBox = null;
  function bindLight(t) {
    t.dataset.paLight = '1';
    const cnt = el('span', { class: 'pa-tokens ui-muted', title: 'NovelAI V4/V4.5 最多读约 512 个 token（这里是估算）' }); t.insertAdjacentElement('afterend', cnt);
    const upd = () => { const n = root.NaiEngineCore ? root.NaiEngineCore.tokenEstimate(t.value) : 0; cnt.textContent = n ? '约 ' + n + ' / 512 token' : ''; cnt.classList.toggle('is-over', n > 512); };
    t.addEventListener('input', upd); t.addEventListener('change', upd); t.addEventListener('focus', () => { lastBox = t; }); upd();
    t.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey) || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || !root.NaiEngineCore) return;
      e.preventDefault(); e.stopPropagation();
      const v = t.value, a0 = t.selectionStart, b0 = t.selectionEnd; let a = a0, b = b0;
      if (a === b) { while (a > 0 && !/[,\n]/.test(v[a - 1])) a--; while (b < v.length && !/[,\n]/.test(v[b])) b++; }
      const raw = v.slice(a, b), lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0], tag = raw.trim(); if (!tag) return;
      const nt = root.NaiEngineCore.bumpWeight(tag, e.key === 'ArrowUp' ? 1 : -1);
      t.value = v.slice(0, a) + lead + nt + trail + v.slice(b); t.setSelectionRange(a + lead.length, a + lead.length + nt.length);
      t.dispatchEvent(new Event('change', { bubbles: true })); upd();
    });
  }
  // ---------- NovelAI PNG info -> apply positive / negative / all, or save as a style snippet ----------
  function snippets() { try { return JSON.parse(localStorage.getItem('mnai.styleSnippets') || '[]'); } catch (_) { return []; } }
  function saveSnippet(name, text) { const l = snippets().filter(x => x.name !== name); l.unshift({ name, text, at: Date.now() }); try { localStorage.setItem('mnai.styleSnippets', JSON.stringify(l.slice(0, 40))); } catch (_) { /* full */ } }
  async function readImageParams(file) {
    const m = root.NaiEngineCore.readPngMeta(new Uint8Array(await file.arrayBuffer()));
    let d = $('paMeta'); if (d) d.remove();
    d = el('div', { id: 'paMeta', class: 'ui-card pa-diff', role: 'dialog', 'aria-label': '图片里的生成参数' });
    if (!m) { d.innerHTML = '<p>这张图里没有 NovelAI 生成参数（可能被导出或聊天软件去掉了）。</p><div class="charlib-actions"><button type="button" class="ui-btn" id="paMetaClose">关闭</button></div>'; }
    else d.innerHTML = '<div class="charlib-head"><b>图片里的生成参数</b></div>' +
      '<p><b>正面：</b>' + esc(m.prompt) + '</p><p><b>负面：</b>' + esc(m.negative || '（无）') + '</p>' +
      (m.characters.length ? '<p><b>角色栏：</b>' + m.characters.map(c => esc(c.prompt)).join(' | ') + '</p>' : '') +
      '<p class="ui-muted">种子 ' + esc(m.seed) + ' · ' + esc(m.steps) + ' 步 · CFG ' + esc(m.scale) + ' · ' + esc(m.width) + '×' + esc(m.height) + '</p>' +
      '<div class="charlib-actions"><button type="button" class="ui-btn ui-btn-primary" data-apply="pos">应用正面</button><button type="button" class="ui-btn" data-apply="neg">应用负面</button>' +
      '<button type="button" class="ui-btn" data-apply="all">全部（含种子）</button><button type="button" class="ui-btn" id="paMetaSnip">存为风格</button><button type="button" class="ui-btn ui-btn-ghost" id="paMetaClose">关闭</button></div>';
    document.body.appendChild(d);
    $('paMetaClose').addEventListener('click', () => d.remove());
    if (!m) return null;
    const put = (id, v) => { const x = $(id); if (x && v != null) { x.value = v; x.dispatchEvent(new Event('change', { bubbles: true })); } };
    d.querySelectorAll('[data-apply]').forEach(btn => btn.addEventListener('click', () => {
      const k = btn.dataset.apply; const box = lastBox && document.body.contains(lastBox) ? lastBox : null;
      if (k !== 'neg' && box) { box.value = m.prompt; box.dispatchEvent(new Event('input', { bubbles: true })); }
      if (k === 'neg' || k === 'all') put('basePrompt_negative', m.negative);
      if (k === 'all') { put('basePrompt_seed', m.seed); put('novelaiSteps', m.steps); put('novelaiScale', m.scale); }
      if (k !== 'neg' && !box) put('basePrompt_prompt', m.prompt);
      d.remove();
    }));
    $('paMetaSnip').addEventListener('click', () => { const name = (typeof prompt === 'function' ? prompt('给这个风格起个名字：', '') : '') || ('风格 ' + new Date().toLocaleString()); saveSnippet(name.trim(), m.prompt); d.remove(); if (root.CharacterLibrary && root.CharacterLibrary._state.card && !root.CharacterLibrary._state.card.hidden) root.CharacterLibrary.open(); });
    return m;
  }
  function pickImageParams() { const i = el('input', { type: 'file', accept: 'image/png' }); i.addEventListener('change', () => { if (i.files[0]) readImageParams(i.files[0]); }); i.click(); }
  function scan() {
    document.querySelectorAll('[data-nai-prompt]').forEach(t => { if (!t.dataset.paLight) bindLight(t); });
    const dl = $('paSnippetList') || (() => { const x = el('datalist', { id: 'paSnippetList' }); document.body.appendChild(x); return x; })();
    const sn = snippets(); if (dl.dataset.n !== String(sn.length)) { dl.innerHTML = sn.map(x => '<option value="' + esc(x.text) + '">' + esc(x.name) + '</option>').join(''); dl.dataset.n = String(sn.length); }
    const st = $('taskPageStyle'); if (st && !st.getAttribute('list')) st.setAttribute('list', 'paSnippetList');
    document.querySelectorAll('[data-nai-prompt]').forEach(t => { if (enabled() && !t.dataset.paBound) bind(t); });
    document.body.classList.toggle('pa-on', enabled());
  }

  async function check(t, bar) {
    const note = bar.querySelector('.pa-note'); note.textContent = '检查中…';
    try {
      const x = await loadTags(); const v = P.validate(x, t.value);
      note.textContent = '认识 ' + v.known + ' 个' + (v.aliases.length ? '；别名 ' + v.aliases.map(a => a.from + '→' + a.to).join('、') : '') + (v.unknown.length ? '；标签库里没有：' + v.unknown.slice(0, 6).join('、') : '');
      if (v.aliases.length) showDiff(t.value, P.fixAliases(x, t.value), '改成标准标签', nv => { t.value = nv; t.dispatchEvent(new Event('input', { bubbles: true })); });
    } catch (e) { note.textContent = e.message || String(e); }
  }

  // ---------- LLM polish / expand ----------
  function chatConfig() {
    const url = (($('naiDirectorApiUrl') || {}).value || '').trim().replace(/\/+$/, ''), key = (($('naiDirectorApiKey') || {}).value || '').trim();
    const model = (($('naiDirectorModel') || {}).value || '').trim() || 'deepseek-chat';
    return { url: url ? (/\/chat\/completions$/i.test(url) ? url : url + '/chat/completions') : '', key, model };
  }
  async function polish(draft, ctx) {
    const c = chatConfig();
    if (!c.url) { if (root.ServiceSettings) root.ServiceSettings.open('director'); throw Object.assign(new Error('还没配置聊天模型：已打开「服务设置」→「提示词助手 / AI 导演」，填 API 地址（例如 DeepSeek）和 Key。'), { needsConfig: true }); }
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 90000);
    try {
      const r = await fetch('/director-proxy/chat-completions', { method: 'POST', signal: ctl.signal, headers: Object.assign({ 'Content-Type': 'application/json', 'X-Director-Api-Url': c.url }, c.key ? { Authorization: /^bearer /i.test(c.key) ? c.key : 'Bearer ' + c.key } : {}),
        body: JSON.stringify({ model: c.model, temperature: ctx && ctx.mode === 'expand' ? 0.8 : 0.4, messages: P.messages(draft, ctx) }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error('聊天模型返回错误（' + r.status + '）：' + String((j.error && (j.error.message || j.error)) || '').slice(0, 160));
      const text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!text) throw new Error('聊天模型没有返回内容。');
      return P.parse(text);
    } catch (e) { if (e.name === 'AbortError') throw new Error('聊天模型 90 秒没有响应。'); throw e; } finally { clearTimeout(timer); }
  }
  function libraryContext() {
    const lib = root.CharacterLibrary && root.CharacterLibrary._state && root.CharacterLibrary._state.cards || [];
    return lib.filter(c => c.identity && c.identity.tags).map(c => ({ name: c.name, tags: c.identity.tags }));
  }
  async function polishBox(t, mode, bar) {
    const note = bar.querySelector('.pa-note'); if (!t.value.trim()) { note.textContent = '先写几个词。'; return; }
    note.textContent = mode === 'expand' ? '扩写中…' : '润色中…'; bar.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try {
      const r = await polish(t.value, { mode, use: t.dataset.naiPrompt || 'manga panel', characters: libraryContext() });
      let next = r.prompt; if (ix) next = P.fixAliases(ix, next);
      note.textContent = r.characters.length ? '模型还给了 ' + r.characters.length + ' 个角色栏：' + r.characters.map(c => c.prompt).join(' | ') : '';
      showDiff(t.value, next, mode === 'expand' ? '扩写结果' : '润色结果', nv => { t.value = nv; t.dispatchEvent(new Event('input', { bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); }, r);
    } catch (e) { note.textContent = e.message || String(e); }
    finally { bar.querySelectorAll('button').forEach(b => { b.disabled = false; }); if (note.textContent === '润色中…' || note.textContent === '扩写中…') note.textContent = ''; }
  }
  /** Review dialog: tag-level diff, 应用 / 取消. Nothing changes until 应用. */
  function showDiff(before, after, title, apply, extra) {
    let d = $('paDiff'); if (d) d.remove();
    d = el('div', { id: 'paDiff', class: 'ui-card pa-diff', role: 'dialog', 'aria-label': title });
    const chips = P.diff(before, after).map(x => '<span class="pa-chip is-' + x.op + '">' + (x.op === 'add' ? '+ ' : x.op === 'del' ? '− ' : '') + esc(x.tag) + '</span>').join('');
    d.innerHTML = '<div class="charlib-head"><b>' + esc(title) + '：先看改动</b></div><div class="pa-chips">' + chips + '</div>' +
      (extra && extra.uc ? '<p class="ui-muted">建议负面词：' + esc(extra.uc) + '</p>' : '') +
      '<textarea class="ui-input" id="paDiffText" rows="4">' + esc(after) + '</textarea><p class="ui-muted">可以先在上面改，再点「应用」。</p>' +
      '<div class="charlib-actions"><button type="button" class="ui-btn ui-btn-primary" id="paDiffApply">应用</button><button type="button" class="ui-btn" id="paDiffCancel">取消</button></div>';
    document.body.appendChild(d);
    $('paDiffApply').addEventListener('click', () => { apply($('paDiffText').value); d.remove(); });
    $('paDiffCancel').addEventListener('click', () => d.remove());
  }
  setInterval(scan, 800);
  document.addEventListener('DOMContentLoaded', scan);
  (function reg() { if (!root.Commands) return setTimeout(reg, 400); root.Commands.register({ id: 'nai.readImageParams', label: '从 NovelAI 图片读取参数', group: 'NovelAI', keywords: 'png metadata prompt seed 参数 读取', run: pickImageParams }); })();
  root.PromptAssist = Object.freeze({ findCharacterTags, loadCharIndex, readImageParams, pickImageParams, snippets, saveSnippet, enabled, setEnabled, loadTags, polish, showDiff, scan, chatConfig, get index() { return ix; } });
})(window);

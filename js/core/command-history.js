/* global commonProperties */
/* 2.0 command layer + history panel (PhotoCraft idea: every operation is a registered command).
 * - Commands.register/run: one registry for task wizards, menus and edits; Ctrl+K opens a searchable palette.
 * - History: every undo step gets a readable label (from the command that caused it, else a state diff via
 *   HistoryLabels), a time and a thumbnail; the 历史 panel lists them and jumps to any step. */
(function (root) {
  'use strict';
  const $ = id => document.getElementById(id);
  // ---------- history metadata (one array per stateStack; stacks are replaced on page switch / load) ----------
  const metas = new WeakMap();
  let pending = null;
  function metaFor(stack) { let m = metas.get(stack); if (!m) { m = []; metas.set(stack, m); } return m; }
  function stack() { return Array.isArray(root.stateStack) ? root.stateStack : []; }
  function cur() { return typeof root.currentStateIndex === 'number' ? root.currentStateIndex : -1; }
  /** Name the next new history step (a command calls this right before it changes the page). */
  function label(text, ttlMs) { pending = { label: String(text), until: Date.now() + (ttlMs || 120000) }; }
  function parse(i) { try { return JSON.parse(stack()[i]); } catch { return null; } }
  function labelAt(i) {
    const m = metaFor(stack());
    if (!m[i]) m[i] = { label: i === 0 ? '开始' : (root.HistoryLabels ? root.HistoryLabels.describe(parse(i - 1), parse(i)) : '步骤 ' + i), t: 0 };
    return m[i];
  }
  function thumbNow(i) {
    const c = root.canvas; if (!c || i !== cur()) return;
    const m = metaFor(stack()); if (!m[i]) return;
    const vt = c.viewportTransform && c.viewportTransform.slice();
    try {
      c.viewportTransform = [1, 0, 0, 1, 0, 0];
      m[i].thumb = c.toDataURL({ format: 'jpeg', quality: 0.6, multiplier: Math.min(1, 96 / Math.max(1, c.getWidth())) });
    } catch { /* tainted or not ready */ } finally { if (vt) c.viewportTransform = vt; }
    // keep memory bounded: thumbnails for the latest 60 steps
    for (let k = 0; k < m.length - 60; k++) if (m[k]) delete m[k].thumb;
  }
  const idle = root.requestIdleCallback ? fn => root.requestIdleCallback(fn, { timeout: 800 }) : fn => setTimeout(fn, 120);
  function afterSave(pushed) {
    const s = stack(), m = metaFor(s), i = cur();
    if (i < 0) return;
    if (m.length > s.length) m.length = s.length;
    if (pushed === true) {
      let lab = null; if (pending && Date.now() < pending.until) lab = pending.label; pending = null;
      m[i] = { label: lab || (i === 0 ? '开始' : (root.HistoryLabels ? root.HistoryLabels.describe(parse(i - 1), parse(i)) : '步骤 ' + i)), t: Date.now() };
    } else if (!m[i]) labelAt(i);
    // a 96 px thumbnail costs a few ms: take it now, while the canvas still shows exactly this step
    if (pushed === true || !m[i].thumb) thumbNow(i);
    idle(refresh);
  }
  function install() {
    if (typeof root.saveState === 'function' && !root.saveState.__history) {
      const orig = root.saveState;
      const w = function () { const r = orig.apply(this, arguments); try { afterSave(r); } catch (e) { console.warn('history label', e); } return r; };
      w.__history = true; root.saveState = w;
    }
    if (typeof root.restoreHistoryState === 'function' && !root.restoreHistoryState.__history) {
      const orig = root.restoreHistoryState;
      const w = function () { const r = orig.apply(this, arguments); Promise.resolve(r).then(() => { const i = cur(); if (!(metaFor(stack())[i] || {}).thumb) idle(() => thumbNow(i)); refresh(); }, () => {}); return r; };
      w.__history = true; root.restoreHistoryState = w;
    }
  }
  function entries() {
    const s = stack(); const out = [];
    for (let i = 0; i < s.length; i++) { const m = labelAt(i); out.push({ index: i, label: m.label, time: m.t, thumb: m.thumb || '', current: i === cur() }); }
    return out;
  }
  function hhmm(t) { if (!t) return ''; const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
  /** Render into the existing 历史 panel list (newest first). */
  function render(box) {
    box = box || $('naiHistoryList'); if (!box) return;
    const list = entries();
    if (!list.length) { box.innerHTML = '<p class="nai-history-empty">还没有历史。改动页面后，每一步都会出现在这里。</p>'; return; }
    box.innerHTML = list.slice().reverse().map(e =>
      '<button type="button" class="nai-history-item' + (e.current ? ' is-current' : '') + (e.index > cur() ? ' is-future' : '') + '" data-history-index="' + e.index + '" title="回到这一步（之后的步骤可用「重做」找回）">' +
      (e.thumb ? '<img alt="" src="' + e.thumb + '">' : '<span class="nai-history-nothumb"></span>') +
      '<span class="nai-history-label">' + esc(e.label) + (e.current ? ' <b>（当前）</b>' : '') + '</span><span class="nai-history-time">' + hhmm(e.time) + '</span></button>').join('');
  }
  function refresh() { const p = $('naiHistoryPanel'); if (p && !p.hidden) render(); }

  // ---------- command registry ----------
  const cmds = new Map();
  const RECENT_KEY = 'mnai.commands.recent';
  function register(c) {
    if (!c || !c.id || typeof c.run !== 'function') throw new Error('command needs id + run');
    cmds.set(c.id, Object.assign({ group: '其他', keys: '', when: () => true }, c)); return c.id;
  }
  function list() { return Array.from(cmds.values()).filter(c => { try { return c.when(); } catch { return false; } }); }
  async function run(id) {
    const c = cmds.get(id); if (!c) throw new Error('unknown command ' + id);
    if (c.history) label(c.history === true ? c.label : c.history, 4000);
    try { const r = await c.run(); recent(id); return r; } finally { if (c.history) setTimeout(() => { if (pending && pending.label === (c.history === true ? c.label : c.history)) pending = null; }, 4000); }
  }
  function recent(id) {
    try { const r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter(x => x !== id); if (id) { r.unshift(id); localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, 8))); } return r; } catch { return []; }
  }
  /** Ranking: recent first when empty; else prefix > word start > substring > in-order letters. */
  function search(q) {
    q = String(q || '').trim().toLowerCase(); const all = list();
    if (!q) { const r = recent(); return all.slice().sort((a, b) => ((r.indexOf(a.id) + 1 || 99) - (r.indexOf(b.id) + 1 || 99))); }
    const score = c => {
      const lab = c.label.toLowerCase(), hay = (lab + ' ' + (c.keywords || '') + ' ' + c.group + ' ' + c.id).toLowerCase();
      if (lab.startsWith(q)) return 0;
      const li = lab.indexOf(q); if (li >= 0) return 1 + li / 1000;   // in the name: earlier is better
      if (hay.indexOf(q) >= 0) return 3;                               // only in keywords / group
      let k = 0; for (const ch of hay) if (ch === q[k]) k++; return k === q.length ? 5 : 99;
    };
    return all.map(c => [score(c), c]).filter(x => x[0] < 99).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  }

  // ---------- palette (Ctrl+K) ----------
  let pal = null, sel = 0, shown = [];
  function openPalette() {
    if (pal) { pal.querySelector('input').focus(); return; }
    pal = document.createElement('div'); pal.id = 'cmdPalette'; pal.className = 'cmd-palette'; pal.setAttribute('role', 'dialog'); pal.setAttribute('aria-label', '命令面板');
    pal.innerHTML = '<div class="cmd-box ui-card"><input id="cmdPaletteInput" type="text" placeholder="想做什么？输入几个字，例如：导出、撤销、换角色" aria-label="搜索命令" autocomplete="off"><div id="cmdPaletteList" class="cmd-list" role="listbox"></div><div class="cmd-hint">↑↓ 选择 · Enter 执行 · Esc 关闭 · 随时按 Ctrl+K 打开</div></div>';
    document.body.appendChild(pal);
    const input = pal.querySelector('input');
    const draw = () => {
      shown = search(input.value).slice(0, 12); sel = Math.min(sel, Math.max(0, shown.length - 1));
      pal.querySelector('#cmdPaletteList').innerHTML = shown.length ? shown.map((c, i) => '<div class="cmd-item' + (i === sel ? ' is-sel' : '') + '" role="option" data-id="' + esc(c.id) + '"><span>' + esc(c.label) + '</span><small>' + esc(c.group) + (c.keys ? ' · ' + esc(c.keys) : '') + '</small></div>').join('') : '<div class="cmd-empty">没有找到。换个说法试试，例如「导出」「文字」「图层」。</div>';
    };
    input.addEventListener('input', () => { sel = 0; draw(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { sel = Math.min(shown.length - 1, sel + 1); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (shown[sel]) exec(shown[sel].id); }
      else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
    });
    pal.addEventListener('mousedown', e => { const it = e.target.closest('.cmd-item'); if (it) { e.preventDefault(); exec(it.dataset.id); } else if (e.target === pal) closePalette(); });
    draw(); input.focus();
  }
  function closePalette() { if (pal) { pal.remove(); pal = null; } }
  function exec(id) { closePalette(); run(id).catch(e => { if (typeof createToastError === 'function') createToastError('命令', e.message || String(e)); }); }

  // ---------- built-in commands ----------
  const click = sel => () => { const el = document.querySelector(sel); if (!el) throw new Error('这个功能现在不可用'); el.click(); };
  const has = sel => () => !!document.querySelector(sel);
  const active = () => root.canvas && root.canvas.getActiveObject && root.canvas.getActiveObject();
  const save = () => { if (typeof root.saveStateByManual === 'function') root.saveStateByManual(); };
  function builtins() {
    const B = [
      { id: 'edit.undo', label: '撤销', group: '编辑', keys: 'Ctrl+Z', keywords: 'undo 返回', run: () => root.undo && root.undo() },
      { id: 'edit.redo', label: '重做', group: '编辑', keys: 'Ctrl+Y', keywords: 'redo', run: () => root.redo && root.redo() },
      { id: 'view.history', label: '历史记录（回到任一步）', group: '编辑', keywords: 'history 步骤 回退', run: () => root.NaiPsTools && root.NaiPsTools.toggleHistory() },
      { id: 'sel.duplicate', label: '复制选中图层', group: '图层', keys: 'Ctrl+J', keywords: 'duplicate copy 拷贝', history: '复制图层', when: active,
        run: () => new Promise(ok => { const o = active(); o.clone(c => { c.set({ left: o.left + 20, top: o.top + 20 }); if (o.name) c.name = o.name + ' 副本'; delete c.guid; if (typeof root.generateGUID === 'function') c.guid = root.generateGUID(); if (Array.isArray(c.guids)) c.guids = []; root.canvas.add(c); root.canvas.setActiveObject(c); root.canvas.requestRenderAll(); save(); ok(); }, (typeof commonProperties !== 'undefined' ? commonProperties : []).slice()); }) },
      { id: 'sel.delete', label: '删除选中', group: '图层', keys: 'Delete', keywords: 'delete remove', history: true, when: active,
        run: () => { const c = root.canvas; c.getActiveObjects().forEach(o => c.remove(o)); c.discardActiveObject(); c.requestRenderAll(); save(); } },
      { id: 'sel.flipH', label: '水平翻转选中', group: '图层', keywords: 'flip mirror 镜像', history: true, when: active, run: () => { const o = active(); o.set('flipX', !o.flipX); root.canvas.requestRenderAll(); save(); } },
      { id: 'sel.front', label: '选中置顶', group: '图层', keywords: 'bring front top 最上', history: true, when: active, run: () => { active().bringToFront(); root.canvas.requestRenderAll(); save(); } },
      { id: 'sel.back', label: '选中置底（底图之上）', group: '图层', keywords: 'send back bottom', history: true, when: active,
        run: () => { const o = active(), c = root.canvas; c.moveTo(o, c.getObjects()[0] && c.getObjects()[0] !== o && c.getObjects()[0].type === 'image' ? 1 : 0); c.requestRenderAll(); save(); } },
      { id: 'file.importImage', label: '导入漫画页（图片 / PSD）', group: '文件', keywords: 'import open image psd 打开', run: click('#imageInput') },
      { id: 'file.save', label: '保存项目', group: '文件', keys: 'Ctrl+S', keywords: 'save', run: click('#projectSave') },
      { id: 'file.open', label: '打开项目', group: '文件', keys: 'Ctrl+O', keywords: 'open load', run: click('#projectLoad') },
      { id: 'file.exportPsd', label: '导出当前页为 PSD', group: '文件', keywords: 'export psd photoshop 图层', run: () => root.PsdIO.downloadPage(), when: () => !!root.PsdIO },
      { id: 'file.exportAll', label: '导出全部页面', group: '文件', keywords: 'export png zip 下载', run: click('#taskExportAll'), when: has('#taskExportAll') },
      { id: 'app.services', label: '服务设置（GPT / NovelAI / 本机）', group: '设置', keywords: 'settings api key token 密钥', run: () => root.ServiceSettings.open('gpt'), when: () => !!root.ServiceSettings },
      { id: 'app.characters', label: '角色库 · 认出本页人物', group: '角色', keywords: 'character 人物 ccip', run: () => root.CharacterLibrary.open(), when: () => !!root.CharacterLibrary },
      { id: 'app.theme', label: '切换浅色 / 深色界面', group: '设置', keywords: 'theme dark light', run: click('#themeToggle'), when: has('#themeToggle') },
      { id: 'app.mode', label: '切换新手 / 专业模式', group: '设置', keywords: 'pro beginner mode', run: click('#uiModeToggle'), when: has('#uiModeToggle') },
      { id: 'app.shortcuts', label: '快捷键一览', group: '帮助', keys: 'F1', keywords: 'help keys', run: () => root.openShortcutModal && root.openShortcutModal(), when: () => typeof root.openShortcutModal === 'function' },
    ];
    B.forEach(register);
    document.querySelectorAll('[data-task]').forEach(b => {
      const id = 'task.' + b.dataset.task; if (cmds.has(id)) return;
      register({ id, label: (b.textContent || '').trim(), group: '任务', keywords: (b.title || '') + ' task 向导', run: () => b.click(), when: () => document.body.contains(b) });
    });
  }
  function onKey(e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); e.stopImmediatePropagation(); if (pal) closePalette(); else openPalette(); }
  }
  function menuItem() {
    const menu = $('taskMoreMenu'); if (!menu || $('taskCommands')) return !!menu;
    const mk = (id, icon, text, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'task-menu-item'; b.setAttribute('role', 'menuitem'); b.id = id; b.innerHTML = '<i class="material-icons" aria-hidden="true">' + icon + '</i><span>' + text + '</span>'; b.addEventListener('click', () => { menu.hidden = true; fn(); }); return b; };
    menu.insertBefore(mk('taskHistory', 'history', '历史记录（回到任一步）', () => run('view.history')), menu.firstChild);
    menu.insertBefore(mk('taskCommands', 'search', '找功能… (Ctrl+K)', openPalette), menu.firstChild);
    return true;
  }
  function init() {
    install(); document.addEventListener('keydown', onKey, true);
    let tries = 0; const t = setInterval(() => { install(); if ((menuItem() && document.querySelector('[data-task]')) || ++tries > 40) { clearInterval(t); builtins(); } }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  root.CommandHistory = { label, entries, render, refresh };
  root.Commands = { register, run, list, search, open: openPalette, close: closePalette };
})(typeof window !== 'undefined' ? window : globalThis);

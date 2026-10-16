/* 2.0 #3 browser side: automatic dialogue balloons (avoid faces + busy art, manga reading order, tails toward
 * the speaker) and a reading-order overlay. Used by 画一页漫画 and the command 「自动排对白气泡」. */
(function (root) {
  'use strict';
  const C = root.BalloonLayoutCore;
  const DIR_KEY = 'mnai.readingDir';
  const dir = () => { try { return localStorage.getItem(DIR_KEY) === 'ltr' ? 'ltr' : 'rtl'; } catch { return 'rtl'; } };
  function setDir(d) { try { localStorage.setItem(DIR_KEY, d === 'ltr' ? 'ltr' : 'rtl'); } catch { /* private mode */ } }
  const isBalloon = o => !!(o && o.balloon);
  function loadImg(src) { return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('页面图片读取失败')); i.src = src; }); }

  /** Detail map + faces of the current page (balloons and lettering hidden while measuring). */
  async function analyze() {
    const c = root.canvas, ed = root.MangaGPTRegionEditor;
    const hidden = c.getObjects().filter(o => isBalloon(o) && o.visible !== false);
    hidden.forEach(o => { o.visible = false; });
    let pg;
    try { pg = ed && ed.pageImage ? ed.pageImage(false) : null; } finally { hidden.forEach(o => { o.visible = true; }); c.requestRenderAll(); }
    if (!pg) throw new Error('页面还没准备好');
    const img = await loadImg(pg.image);
    const W = pg.width, H = pg.height, k = Math.min(1, 800 / Math.max(W, H));
    const cv = document.createElement('canvas'); cv.width = Math.round(W * k); cv.height = Math.round(H * k);
    const g = cv.getContext('2d'); g.drawImage(img, 0, 0, cv.width, cv.height);
    const small = C.energyMap(g.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height);
    const energy = { mean: r => small.mean({ x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k }) };
    let faces = [], facesAvailable = false;
    try {
      // a full-size page PNG can exceed the local request limit: send a <=1024 px PNG and scale the boxes back
      const fk = Math.min(1, 1024 / Math.max(W, H)), fc = document.createElement('canvas'); fc.width = Math.round(W * fk); fc.height = Math.round(H * fk);
      const fg = fc.getContext('2d'); fg.fillStyle = '#fff'; fg.fillRect(0, 0, fc.width, fc.height); fg.drawImage(img, 0, 0, fc.width, fc.height);
      const r = await fetch('/manga-smart/faces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: fc.toDataURL('image/png') }) });
      const j = await r.json(); if (j && j.ok) { faces = (j.faces || []).map(f => f.slice(0, 4).map(v => v / fk)); facesAvailable = !!j.available; }
    } catch { /* local service down: art detail only */ }
    return { W, H, energy, faces, facesAvailable };
  }

  /** Measure one balloon: kinsoku lines, font size from the panel; returns size + a builder. */
  function measure(text, rect) {
    const fontSize = Math.min(44, Math.max(20, Math.round(Math.min(rect.width || rect.w, rect.height || rect.h) * 0.06)));
    const n = Array.from(text).length, perLine = n <= 9 ? n : Math.ceil(Math.sqrt(n * 1.6));
    const lines = root.CjkBreak ? root.CjkBreak.breakLines(text, perLine) : [text];
    const longest = Math.max.apply(null, lines.map(l => Array.from(l).length));
    const tb = new root.fabric.Textbox(lines.join('\n'), { width: longest * fontSize * 1.06, fontSize, textAlign: 'center', fill: '#111', splitByGrapheme: true,
      fontFamily: '"Noto Sans SC","Microsoft YaHei",sans-serif' });
    const w = Math.max(longest * fontSize * 1.08 / 0.66, fontSize * 4), h = Math.max(tb.height * 1.75, fontSize * 2.6);
    return { w, h, tb };
  }
  function kindsOn() { try { return !(root.localStorage && root.localStorage.getItem('mnai.bubbleKinds') === '0'); } catch { return true; } }
  function build(m, spot, meta) {
    const c = root.canvas, id = 'bl-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const parts = [];
    // balloon kind (v2 shapes ON by default after the user's pick; opt out with localStorage mnai.bubbleKinds='0')
    const k = kindsOn() && meta.kind ? meta.kind : { tail: true, shape: 'ellipse', dashed: false };
    const line = { fill: '#fff', stroke: '#111', strokeWidth: 3 }; if (k.dashed) line.strokeDashArray = [10, 7];
    if (spot.tail && k.tail) parts.push(new root.fabric.Polygon(tailPoints(spot), Object.assign({ strokeLineJoin: 'round' }, line)));
    if (k.shape === 'rect') parts.push(new root.fabric.Rect(Object.assign({ left: spot.x + spot.w * .08, top: spot.y + spot.h * .1, width: spot.w * .84, height: spot.h * .8 }, line)));
    else if (k.shape === 'none') parts.push(new root.fabric.Rect({ left: spot.x, top: spot.y, width: spot.w, height: spot.h, fill: 'rgba(0,0,0,0)', strokeWidth: 0 }));
    else parts.push(new root.fabric.Ellipse(Object.assign({ left: spot.x, top: spot.y, rx: spot.w / 2, ry: spot.h / 2 }, line)));
    const g = new root.fabric.Group(parts, { name: '对白气泡 ' + meta.order });
    g.balloon = Object.assign({ id, role: 'shape' }, meta, { w: spot.w, h: spot.h, rect: [spot.x, spot.y, spot.w, spot.h], tip: spot.tail ? [spot.tail.x, spot.tail.y] : null });
    c.add(g);
    if (m.tb) {
      m.tb.set({ left: spot.x + (spot.w - m.tb.width) / 2, top: spot.y + (spot.h - m.tb.height) / 2, name: '对白 ' + meta.order });
      m.tb.balloon = Object.assign({ id, role: 'text' }, meta);
      if (!c.getObjects().includes(m.tb)) c.add(m.tb); else c.bringToFront(m.tb);
      m.tb.setCoords();
    }
    return [g, m.tb];
  }
  // tail base sits inside the ellipse: its inner stroke is covered by the ellipse fill drawn on top
  function tailPoints(s) {
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2, t = s.tail, dx = t.x - cx, dy = t.y - cy, d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d, half = Math.min(s.w, s.h) * 0.14;
    return [{ x: t.baseX + nx * half, y: t.baseY + ny * half }, { x: t.x, y: t.y }, { x: t.baseX - nx * half, y: t.baseY - ny * half }];
  }
  function rectOf(r) { return { x: r.left != null ? r.left : r.x, y: r.top != null ? r.top : r.y, w: r.width != null ? r.width : r.w, h: r.height != null ? r.height : r.h }; }
  function textObstacles(skip) {
    // lettering already drawn into the page (read by 改字幕 on import, cached): its balloons are flat white, so the
    // detail map alone would happily cover them
    const ed = root.MangaSmartTextEditor, drawn = ed && ed.cachedRegions ? ed.cachedRegions().map(r => ({ x: r.x - r.w * 0.15, y: r.y - r.h * 0.15, w: r.w * 1.3, h: r.h * 1.3 })) : [];
    return drawn.concat(root.canvas.getObjects().filter(o => o.visible !== false && !isBalloon(o) && !(skip && skip(o)) && (/text/i.test(o.type || '') || o.isSpeechBubble))
      .map(o => { const b = o.getBoundingRect(true, true); return { x: b.left, y: b.top, w: b.width, h: b.height }; }));
  }
  /** Split one panel's dialogue: new lines or ／ / | start another balloon. */
  function splitLines(s) { return String(s || '').split(/\s*(?:\n|／|\/|\||｜)\s*/).map(x => x.trim()).filter(Boolean).slice(0, 4); }
  function speakers(panel, faces, n) {
    const inP = faces.map((f, i) => ({ f, i })).filter(({ f }) => { const cx = (f[0] + f[2]) / 2, cy = (f[1] + f[3]) / 2; return cx > panel.x && cx < panel.x + panel.w && cy > panel.y && cy < panel.y + panel.h; });
    if (!inP.length) return Array(n).fill(null);
    const ord = C.readingOrder(inP.map(({ f }) => f), dir()).map(k => inP[k].i);
    return Array.from({ length: n }, (_, k) => ord[k % ord.length]);
  }

  /** Lay out balloons for a set of panels. lines[i] = text for panel i (split into up to 4 balloons). */
  /** Run fn with history paused (each canvas.add would otherwise serialise the whole page); returns whether we paused. */
  function quietly(fn) {
    const can = typeof root.changeDoNotSaveHistory === 'function' && typeof root.isSave === 'function' && root.isSave();
    if (can) root.changeDoNotSaveHistory();
    try { return fn(); } finally { if (can) root.changeDoSaveHistory(); }
  }
  async function layoutPage(rects, lines, info) {
    info = info || await analyze();
    const own = typeof root.isSave === 'function' && root.isSave();
    const res = quietly(() => layoutNow(rects, lines, info));
    if (own) { if (root.CommandHistory) root.CommandHistory.label('自动放对白气泡', 4000); if (typeof root.saveStateByManual === 'function') root.saveStateByManual(); }
    return res;
  }
  function layoutNow(rects, lines, info) {
    const panels = rects.map(rectOf), order = C.readingOrder(panels, dir());
    const occupied = textObstacles(), placed = [];
    let n = 0;
    for (const pi of order) {
      const texts = splitLines(lines[pi]); if (!texts.length) continue;
      // markup such as 「」 *…* 【】 {} or a （电话） note picks the balloon kind and is never printed
      const kinds = texts.map(t => C.kindOf ? C.kindOf(t) : { kind: 'speech', text: t, tail: true, shape: 'ellipse' });
      const ms = kinds.map(k => measure(k.text, panels[pi]));
      const sp = speakers(panels[pi], info.faces, texts.length);
      const spots = C.place(panels[pi], ms.map((m, k) => ({ w: m.w, h: m.h, speaker: sp[k] == null ? null : sp[k] })), { faces: info.faces, energy: info.energy, occupied, dir: dir() });
      // place() wants speaker indexes into its own faces list: pass the full list and map back
      spots.forEach((s, k) => { n++; build(ms[k], s, { order: n, panel: pi, panelRect: panels[pi], speaker: sp[k], kind: kinds[k] }); occupied.push(s); placed.push(Object.assign({ panel: pi, panelRect: panels[pi] }, s)); });
    }
    root.canvas.requestRenderAll();
    return { placed, metrics: C.metrics(placed, info.faces, info.energy, dir()), facesAvailable: info.facesAvailable, faces: info.faces.length };
  }

  /** Re-place the auto balloons already on this page (e.g. after redrawing a panel). One undo step. */
  async function arrange() {
    const c = root.canvas;
    const shapes = c.getObjects().filter(o => o.balloon && o.balloon.role === 'shape');
    if (!shapes.length) throw new Error('本页还没有自动对白气泡。用「画一页漫画」写对白，或先加对白再试。');
    const info = await analyze();
    const byPanel = new Map();
    for (const g of shapes.sort((a, b) => a.balloon.order - b.balloon.order)) {
      const t = c.getObjects().find(o => o.balloon && o.balloon.role === 'text' && o.balloon.id === g.balloon.id);
      const key = JSON.stringify(g.balloon.panelRect); if (!byPanel.has(key)) byPanel.set(key, []); byPanel.get(key).push({ g, t });
    }
    quietly(() => rearrange(byPanel, info));
    root.canvas.requestRenderAll();
    if (root.CommandHistory) root.CommandHistory.label('自动排对白气泡', 4000);
    if (typeof root.saveStateByManual === 'function') root.saveStateByManual();
    return lastArrange;
  }
  let lastArrange = null;
  function rearrange(byPanel, info) {
    const c = root.canvas;
    const pairs = Array.from(byPanel.values());
    const panels = pairs.map(p => p[0].g.balloon.panelRect);
    const occupied = textObstacles(), placed = [];
    let n = 0;
    for (const pi of C.readingOrder(panels, dir())) {
      const list = pairs[pi];
      const sp = speakers(panels[pi], info.faces, list.length);
      const spots = C.place(panels[pi], list.map((p, k) => ({ w: p.g.balloon.w, h: p.g.balloon.h, speaker: sp[k] })), { faces: info.faces, energy: info.energy, occupied, dir: dir() });
      spots.forEach((s, k) => {
        const { g, t } = list[k]; n++;
        const meta = Object.assign({}, g.balloon, { order: n, speaker: sp[k] });
        delete meta.id; delete meta.role; delete meta.w; delete meta.h; delete meta.rect; delete meta.tip;
        c.remove(g);
        build({ tb: t || null }, s, meta);   // new outline (the tail may turn); the user's text object is kept and moved
        occupied.push(s); placed.push(Object.assign({ panel: pi, panelRect: panels[pi] }, s));
      });
    }
    lastArrange = { placed, metrics: C.metrics(placed, info.faces, info.energy, dir()), facesAvailable: info.facesAvailable };
  }

  // ---------- reading-order overlay ----------
  let view = null, viewTimer = null;
  async function showOrder() {
    hideOrder();
    const c = root.canvas;
    const pa = root.PanelAuto ? await root.PanelAuto.get().catch(() => null) : null;
    const panels = pa && pa.panels && pa.panels.length ? pa.panels.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h })) : [{ x: 0, y: 0, w: c.getWidth(), h: c.getHeight() }];
    const ord = C.readingOrder(panels, dir());
    const balloons = c.getObjects().filter(o => o.balloon && o.balloon.role === 'shape').sort((a, b) => a.balloon.order - b.balloon.order);
    const rect = c.upperCanvasEl.getBoundingClientRect();
    view = document.createElement('canvas'); view.id = 'readingOrderView';
    view.style.cssText = 'position:fixed;pointer-events:none;z-index:40;left:' + rect.left + 'px;top:' + rect.top + 'px;width:' + rect.width + 'px;height:' + rect.height + 'px';
    view.width = Math.round(rect.width); view.height = Math.round(rect.height); document.body.appendChild(view);
    const k = view.width / c.getWidth(), g = view.getContext('2d');
    const badge = (x, y, t, col, r) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.font = 'bold ' + Math.round(r * 1.1) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x, y + 1); };
    // arrows between panels, then numbers
    g.strokeStyle = 'rgba(37,99,235,.75)'; g.lineWidth = 3; g.setLineDash([8, 6]); g.beginPath();
    ord.forEach((pi, n) => { const p = panels[pi], x = (p.x + p.w / 2) * k, y = (p.y + p.h / 2) * k; if (n) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); g.setLineDash([]);
    ord.forEach((pi, n) => { const p = panels[pi]; badge((p.x + p.w / 2) * k, (p.y + p.h / 2) * k, String(n + 1), '#2563eb', 18); });
    balloons.forEach((b, n) => { const r = b.getBoundingRect(true, true); badge((r.left + r.width) * k - 4, r.top * k + 4, String(n + 1), '#f97316', 12); });
    clearTimeout(viewTimer); viewTimer = setTimeout(hideOrder, 8000);
    if (typeof root.createToast === 'function') root.createToast('阅读顺序', (dir() === 'rtl' ? '日漫顺序：从右到左、从上到下' : '从左到右、从上到下') + '。蓝色 = 分格，橙色 = 对白。8 秒后自动隐藏。');
    return { order: ord, panels: panels.length, balloons: balloons.length };
  }
  function hideOrder() { if (view) { view.remove(); view = null; } }

  function register() {
    if (!root.Commands) return false;
    const toast = (t, m, e) => { if (e && typeof root.createToastError === 'function') root.createToastError(t, m); else if (typeof root.createToast === 'function') root.createToast(t, m); };
    root.Commands.register({ id: 'balloon.arrange', label: '自动排对白气泡（避开人脸、按阅读顺序）', group: '对白', keywords: 'balloon bubble 气泡 对白 排版 自动',
      when: () => root.canvas && root.canvas.getObjects().some(o => o.balloon),
      run: async () => { try { const r = await arrange(); toast('自动排对白气泡', '已重排 ' + r.placed.length + ' 个气泡' + (r.facesAvailable ? '，避开 ' + r.metrics.facesCovered + ' 张被挡的脸（0 = 全部避开）。' : '。装了「人物识别」组件后还会避开人脸。')); } catch (e) { toast('自动排对白气泡', e.message, true); } } });
    root.Commands.register({ id: 'view.readingOrder', label: '显示阅读顺序', group: '对白', keywords: 'reading order 顺序 分格', run: () => showOrder() });
    root.Commands.register({ id: 'view.readingDir', label: '切换阅读方向（日漫从右到左 / 从左到右）', group: '对白', keywords: 'rtl ltr 方向',
      run: () => { setDir(dir() === 'rtl' ? 'ltr' : 'rtl'); return showOrder(); } });
    return true;
  }
  if (typeof document !== 'undefined') { let n = 0; const t = setInterval(() => { if (register() || ++n > 40) clearInterval(t); }, 250); }
  root.BalloonLayout = { analyze, layoutPage, arrange, showOrder, hideOrder, splitLines, dir, setDir };
})(typeof window !== 'undefined' ? window : globalThis);

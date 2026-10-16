/* Perspective sign text (opt-in: 服务设置 → 实验选项 → 透视招牌文字工具). Select a rectangle around a sign (any
 * rect / the selected object's bounds), run 「透视文字」: the local service finds the sign's quad and erases its
 * lettering; the editor adds the erased patch as a new layer plus an editable perspective text layer whose four
 * corners can be dragged (double-click to change the text). One undo step. */
(function (root) {
  'use strict';
  const K = root.PerspectiveTextCore;
  function on() { return !!(root.MangaOptIn && root.MangaOptIn.get('mnai.perspectiveText')); }
  function textBitmap(o) {
    const fs = o.ptFontSize || 48, lines = String(o.ptText || '').split('\n');
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    g.font = 'bold ' + fs + 'px ' + (o.ptFont || '"Noto Sans SC","Microsoft YaHei",sans-serif');
    const w = Math.max(8, Math.ceil(Math.max.apply(null, lines.map(l => g.measureText(l).width)) + fs * 0.4)), h = Math.ceil(lines.length * fs * 1.2 + fs * 0.2);
    cv.width = w; cv.height = h; g.font = 'bold ' + fs + 'px ' + (o.ptFont || '"Noto Sans SC","Microsoft YaHei",sans-serif');
    g.fillStyle = o.ptFill || '#111'; g.textBaseline = 'top'; g.textAlign = 'center';
    lines.forEach((l, i) => g.fillText(l, w / 2, fs * 0.1 + i * fs * 1.2));
    return cv;
  }
  /** (Re)draw the warped text into the object's element; quad is in canvas coordinates. */
  function render(o) {
    const q = o.ptQuad, xs = q.map(p => p.x), ys = q.map(p => p.y);
    const x0 = Math.floor(Math.min.apply(null, xs)), y0 = Math.floor(Math.min.apply(null, ys));
    const W = Math.max(2, Math.ceil(Math.max.apply(null, xs)) - x0), H = Math.max(2, Math.ceil(Math.max.apply(null, ys)) - y0);
    const src = textBitmap(o), cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    K.drawWarped(cv.getContext('2d'), src, src.width, src.height, q.map(p => ({ x: p.x - x0, y: p.y - y0 })), 10);
    o.setElement(cv); o.set({ left: x0, top: y0, scaleX: 1, scaleY: 1, angle: 0, width: W, height: H }); o.setCoords();
  }
  function cornerControls(o) {
    const F = root.fabric, controls = {};
    [0, 1, 2, 3].forEach(i => {
      controls['q' + i] = new F.Control({
        positionHandler: (dim, m, obj) => F.util.transformPoint({ x: obj.ptQuad[i].x, y: obj.ptQuad[i].y }, obj.canvas.viewportTransform),
        actionHandler: (ev, t, x, y) => { const obj = t.target; obj.ptQuad[i] = { x, y }; render(obj); return true; },
        actionName: 'perspectiveCorner', cursorStyle: 'crosshair', sizeX: 14, sizeY: 14,
        render: (ctx, left, top) => { ctx.save(); ctx.fillStyle = 'rgba(37,99,235,.85)'; ctx.beginPath(); ctx.arc(left, top, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      });
    });
    o.controls = controls; o.hasBorders = false;
  }
  /** Make an image object a perspective text layer (also used to re-attach controls after loading a project). */
  function attach(o) {
    if (!o || !o.ptQuad || o._ptAttached) return o;
    o._ptAttached = true; cornerControls(o);
    let last = null;
    o.on('moving', () => { const p = { x: o.left, y: o.top }; if (last) { const dx = p.x - last.x, dy = p.y - last.y; o.ptQuad = o.ptQuad.map(q => ({ x: q.x + dx, y: q.y + dy })); } last = p; });
    o.on('mousedown', () => { last = { x: o.left, y: o.top }; });
    o.on('mousedblclick', () => { const t = root.prompt('透视文字内容（换行用 \\n）', o.ptText); if (t != null) { o.ptText = t.replace(/\\n/g, '\n'); render(o); o.canvas && o.canvas.requestRenderAll(); if (typeof root.saveStateByManual === 'function') root.saveStateByManual(); } });
    return o;
  }
  function makeLayer(quad, text, fontSize) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 2;
    const o = new root.fabric.Image(cv, { name: '透视文字', objectCaching: false });
    Object.assign(o, { ptQuad: quad.map(p => ({ x: p[0] != null ? p[0] : p.x, y: p[1] != null ? p[1] : p.y })), ptText: text, ptFontSize: fontSize || 64, ptFill: '#111' });
    render(o); return attach(o);
  }
  function selectedBox(c) {
    const a = c.getActiveObject(); if (!a) return null;
    const b = a.getBoundingRect(true, true); return { obj: a, box: [b.left, b.top, b.width, b.height] };
  }
  async function run() {
    const c = root.canvas, ed = root.MangaGPTRegionEditor;
    if (!c || !ed || !ed.pageImage) throw new Error('编辑器未就绪');
    const sel = selectedBox(c); if (!sel) throw new Error('先画一个矩形框住招牌（或选中招牌所在的对象），再运行「透视文字」。');
    const pg = ed.pageImage(false), k = pg.width / c.getWidth();
    const r = await fetch('/manga-smart/perspective-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: pg.image, box: sel.box.map(v => v * k) }) });
    const j = await r.json(); if (!j || !j.ok) throw new Error((j && j.error) || '本地服务没有响应（需要启动本机 AI 服务）。');
    const text = root.prompt('招牌上要写的文字', '');
    if (text == null) return null;
    const own = typeof root.isSave === 'function' && root.isSave();
    if (typeof root.changeDoNotSaveHistory === 'function' && own) root.changeDoNotSaveHistory();
    try {
      if (sel.obj && sel.obj.type === 'rect' && !sel.obj.isPanel) c.remove(sel.obj);   // the helper box is not kept
      const patch = await new Promise(ok => root.fabric.Image.fromURL(j.patch, ok));
      patch.set({ left: j.box[0] / k, top: j.box[1] / k, scaleX: 1 / k, scaleY: 1 / k, name: '招牌（已擦字）' }); c.add(patch);
      const quad = j.quad.map(p => [p[0] / k, p[1] / k]);
      const side = Math.hypot(quad[3][0] - quad[0][0], quad[3][1] - quad[0][1]);
      const layer = makeLayer(quad, text, Math.max(16, Math.round(side * 0.6))); c.add(layer); c.setActiveObject(layer); c.requestRenderAll();
      return { quad: j.quad, method: j.method, erasedPixels: j.erasedPixels };
    } finally {
      if (typeof root.changeDoSaveHistory === 'function' && own) root.changeDoSaveHistory();
      if (root.CommandHistory) root.CommandHistory.label('透视文字', 4000);
      if (typeof root.saveStateByManual === 'function') root.saveStateByManual();
    }
  }
  function register() {
    if (!root.Commands) return false;
    root.Commands.register({ id: 'text.perspective', label: '透视文字：招牌擦字并换成可拖四角的文字层（实验）', group: '文字', keywords: 'perspective sign 招牌 透视 文字',
      when: () => on() && root.canvas, run: async () => { try { await run(); } catch (e) { if (typeof root.createToastError === 'function') root.createToastError('透视文字', e.message); } } });
    return true;
  }
  if (typeof document !== 'undefined') {
    let n = 0, hooked = false, done = false;
    const t = setInterval(() => {
      if (!done) done = register();
      if (!hooked && root.canvas && root.canvas.on) { hooked = true; root.canvas.on('object:added', e => { if (e.target && e.target.ptQuad) attach(e.target); }); }
      if ((done && hooked) || ++n > 40) clearInterval(t);
    }, 250);
  }
  /** Re-attach corner controls after project / history load (pt* fields survive via commonProperties). */
  function hydrateAll() {
    const c = root.canvas; if (!c || !c.getObjects) return 0;
    let n = 0;
    c.getObjects().forEach(o => {
      if (!o || !o.ptQuad) return;
      // fabric may revive ptQuad points as plain objects; normalise to {x,y}
      o.ptQuad = o.ptQuad.map(q => ({ x: +((q && (q.x != null ? q.x : q[0])) || 0), y: +((q && (q.y != null ? q.y : q[1])) || 0) }));
      if (o.ptText == null) o.ptText = '';
      attach(o); n++;
    });
    if (n && c.requestRenderAll) c.requestRenderAll();
    return n;
  }
  root.PerspectiveText = Object.freeze({ run, makeLayer, attach, render, hydrateAll, on, register });
})(typeof window !== 'undefined' ? window : globalThis);

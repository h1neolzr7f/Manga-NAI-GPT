/* PSD import / export (2.0) with ag-psd (MIT, https://github.com/Agamnentzar/ag-psd), loaded on first use.
 * Export: one PSD layer per canvas object (name, visibility, opacity, blend mode); text -> real text layers;
 * AI 填充 layers -> full candidate + layer mask (edge stays editable in Photoshop/Krita/Photopea).
 * Import: through 导入漫画页 (.psd accepted): bottom layer = page, others = separate layers, masks baked. */
(function (root) {
  'use strict';
  const LIB = 'js/ui/third/ag-psd/ag-psd.js?v=31.0.3-mnai1';
  const MAX_BYTES = 300 * 1024 * 1024;
  let loading = null;
  function lib() {
    if (root.agPsd) return Promise.resolve(root.agPsd);
    if (!loading) loading = new Promise((ok, no) => { const s = document.createElement('script'); s.src = LIB; s.onload = () => ok(root.agPsd); s.onerror = () => { loading = null; no(new Error('PSD 组件加载失败，请刷新后重试。')); }; document.head.appendChild(s); });
    return loading;
  }
  const BLEND_OUT = { multiply: 'multiply', screen: 'screen', overlay: 'overlay', darken: 'darken', lighten: 'lighten', 'color-dodge': 'color dodge', 'color-burn': 'color burn', 'hard-light': 'hard light', 'soft-light': 'soft light', difference: 'difference', exclusion: 'exclusion', hue: 'hue', saturation: 'saturation', color: 'color', luminosity: 'luminosity' };
  const BLEND_IN = Object.fromEntries(Object.entries(BLEND_OUT).map(([k, v]) => [v, k]));
  function toast(title, msg, err) { if (err && typeof createToastError === 'function') createToastError(title, msg); else if (typeof createToast === 'function') createToast(title, msg); }
  function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
  function loadImg(src) { return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('图片加载失败')); i.src = src; }); }
  function isText(o) { return /text/i.test(o.type || '') && typeof o.text === 'string'; }

  /** Object -> raster at page coordinates (ignores zoom/pan). */
  function rasterize(o) {
    const vt = o.canvas && o.canvas.viewportTransform; const saved = vt && vt.slice();
    if (vt) o.canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    // hidden layers keep their real pixels (hidden flag set on the PSD layer), so they can be shown again
    const wasHidden = o.visible === false; if (wasHidden) o.visible = true;
    try {
      o.setCoords();
      const b = o.getBoundingRect(true, true);
      const el = o.toCanvasElement({ withoutShadow: false });
      return { canvas: el, left: Math.round(b.left), top: Math.round(b.top) };
    } finally { if (wasHidden) o.visible = false; if (vt) { o.canvas.viewportTransform = saved; o.setCoords(); } }
  }

  /** AI 填充 layer -> opaque candidate + layer mask (= the soft alpha), so the edge stays editable. */
  async function aiFillLayer(o, base) {
    const m = o.aiFill; const [x, y, w, h] = m.box;
    const comp = await loadImg(o.getSrc());
    const c = canvasOf(w, h), g = c.getContext('2d');
    if (m.candidates[m.chosen]) g.drawImage(await loadImg(m.candidates[m.chosen]), 0, 0, w, h);   // colour under the mask's zero
    g.drawImage(comp, 0, 0, w, h);                                                              // tone-matched pixels on top
    const d = g.getImageData(0, 0, w, h);
    const a = canvasOf(w, h), ag = a.getContext('2d'); ag.drawImage(comp, 0, 0, w, h); const ad = ag.getImageData(0, 0, w, h).data;
    const mask = canvasOf(w, h), mg = mask.getContext('2d'), md = mg.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = ad[i * 4 + 3]; md.data[i * 4] = md.data[i * 4 + 1] = md.data[i * 4 + 2] = v; md.data[i * 4 + 3] = 255; d.data[i * 4 + 3] = 255; }
    g.putImageData(d, 0, 0); mg.putImageData(md, 0, 0);
    return Object.assign(base, { canvas: c, left: x, top: y, mask: { canvas: mask, left: x, top: y, defaultColor: 0 } });
  }

  function textLayer(o, base) {
    const vertical = /vertical/i.test(o.type) || o.isVertical === true;
    base.text = { text: o.text, transform: [1, 0, 0, 1, base.left, base.top + (o.fontSize || 24)],
      orientation: vertical ? 'vertical' : 'horizontal',
      style: { font: { name: String(o.fontFamily || 'sans-serif').split(',')[0].replace(/["']/g, '') }, fontSize: o.fontSize || 24,
        fillColor: hex(o.fill) } };
    return base;
  }
  function hex(c) { const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '')) || null; if (!m) return { r: 0, g: 0, b: 0 }; const n = parseInt(m[1], 16); return { r: n >> 16, g: (n >> 8) & 255, b: n & 255 }; }

  /** Every pixel with any opacity has R = G = B exactly (so writing one channel loses nothing). */
  function isGray(cv) {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] && (d[i] !== d[i + 1] || d[i] !== d[i + 2])) return false;
    return true;
  }
  function isGrayColor(c) { return !c || (c.r === c.g && c.g === c.b); }
  /** Current page -> PSD bytes. */
  async function exportPage() {
    const ag = await lib(); const c = root.canvas;
    const W = c.getWidth(), H = c.getHeight();
    const children = [];
    // Canvas background colour becomes an editable bottom layer (audit 48).
    const bg = typeof c.backgroundColor === 'string' ? c.backgroundColor.trim() : '';
    if (bg && !/^(transparent|rgba\([^)]*,\s*0(\.0*)?\s*\))$/i.test(bg)) {
      const bgc = canvasOf(W, H), bgx = bgc.getContext('2d'); bgx.fillStyle = bg; bgx.fillRect(0, 0, W, H);
      children.push({ name: '背景', canvas: bgc, left: 0, top: 0, opacity: 1, blendMode: 'normal' });
    }
    for (const o of c.getObjects()) {
      if (o.excludeFromLayerPanel || o.isIcon) continue;
      const r = rasterize(o);
      const base = { name: o.name || (isText(o) ? o.text.slice(0, 20) : o.type), hidden: o.visible === false, opacity: o.opacity == null ? 1 : o.opacity,
        blendMode: BLEND_OUT[o.globalCompositeOperation] || 'normal', canvas: r.canvas, left: r.left, top: r.top };
      if (o.aiFill && o.aiFill.box) children.push(await aiFillLayer(o, base));
      else if (isText(o)) children.push(textLayer(o, base));
      else children.push(base);
    }
    // Compact, still lossless (2.0 A/B: a 2476x3508 page was 40 MB):
    //  - layers ZIP-compressed and cropped to their visible pixels;
    //  - the merged composite is flat white (what Photoshop writes with "maximize compatibility" off; every
    //    editor rebuilds the page from the layers) + a small real thumbnail for file browsers;
    //  - a page whose layers are all exactly grey is written as a Grayscale document (1 channel instead of 3).
    const ed = root.MangaGPTRegionEditor;
    const pg = ed && ed.pageImage ? ed.pageImage(true) : null;
    const thumb = canvasOf(Math.max(1, Math.round(W * Math.min(1, 256 / Math.max(W, H)))), Math.max(1, Math.round(H * Math.min(1, 256 / Math.max(W, H)))));
    if (pg) thumb.getContext('2d').drawImage(await loadImg(pg.image), 0, 0, thumb.width, thumb.height);
    const comp = canvasOf(W, H), cg = comp.getContext('2d'); cg.fillStyle = bg && children.length && children[0].name === '背景' ? bg : '#fff'; cg.fillRect(0, 0, W, H);
    const gray = children.every(l => !l.canvas || isGray(l.canvas)) && children.every(l => !l.text || isGrayColor(l.text.style && l.text.style.fillColor));
    return ag.writePsdUint8Array({ width: W, height: H, canvas: comp, children, colorMode: gray ? 1 : 3, imageResources: { thumbnail: thumb } },
      { invalidateTextLayers: true, generateThumbnail: false, compress: true, trimImageData: true });
  }
  async function downloadPage() {
    try {
      toast('导出 PSD', '正在压缩图层，大页面需要几秒…');
      await new Promise(r => setTimeout(r, 60));   // let the toast paint before the (synchronous) compression
      const bytes = await exportPage();
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'image/vnd.adobe.photoshop' }));
      a.download = 'manga-page-' + new Date().toISOString().slice(0, 10) + '.psd'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('导出 PSD', '已导出当前页（' + (root.canvas.getObjects().length) + ' 个图层，' + (bytes.length / 1048576).toFixed(1) + ' MB）。文字是可编辑文字层；AI 填充层带图层蒙版。');
      return bytes.length;
    } catch (e) { toast('导出 PSD 失败', e.message || String(e), true); throw e; }
  }

  function leaves(list, out) { for (const l of list || []) { if (l.children) leaves(l.children, out); else out.push(l); } return out; }
  function baked(l) {   // layer canvas with its mask multiplied into alpha
    if (!l.canvas) return null;
    if (!l.mask || !l.mask.canvas || l.mask.disabled) return l.canvas;
    const w = l.canvas.width, h = l.canvas.height, c = canvasOf(w, h), g = c.getContext('2d'); g.drawImage(l.canvas, 0, 0);
    const d = g.getImageData(0, 0, w, h); const mc = canvasOf(w, h), mg = mc.getContext('2d');
    mg.fillStyle = (l.mask.defaultColor || 0) >= 128 ? '#fff' : '#000'; mg.fillRect(0, 0, w, h);
    mg.drawImage(l.mask.canvas, (l.mask.left || 0) - (l.left || 0), (l.mask.top || 0) - (l.top || 0));
    const md = mg.getImageData(0, 0, w, h).data;
    for (let i = 0; i < w * h; i++) d.data[i * 4 + 3] = Math.round(d.data[i * 4 + 3] * md[i * 4] / 255);
    g.putImageData(d, 0, 0); return c;
  }

  /** PSD file -> page (bottom layer) + layers on top. Returns the number of layers added. */
  async function importFile(file) {
    if (file.size > MAX_BYTES) throw new Error('PSD 太大（超过 300 MB）。');
    const ag = await lib();
    const psd = ag.readPsd(await file.arrayBuffer(), { skipThumbnail: true });
    const layers = leaves(psd.children, []).filter(l => l.canvas && l.canvas.width && l.canvas.height);
    // page = the bottom layer when it covers the document, else the merged image
    let pageCanvas, rest = layers;
    const b = layers[0];
    if (b && b.left <= 0 && b.top <= 0 && b.canvas.width >= psd.width && b.canvas.height >= psd.height && !b.hidden) { pageCanvas = baked(b); rest = layers.slice(1); }
    else { pageCanvas = canvasOf(psd.width, psd.height); const g = pageCanvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, psd.width, psd.height); if (!layers.length && psd.canvas) g.drawImage(psd.canvas, 0, 0); }
    const blob = await new Promise(r => pageCanvas.toBlob(r, 'image/png'));
    const pageFile = new File([blob], file.name.replace(/\.psd$/i, '') + '.png', { type: 'image/png' });
    if (typeof root.pageHasUserContent === 'function' && root.pageHasUserContent() && typeof root.btmCreatePageAfter === 'function' && typeof root.readImageFile === 'function') {
      // the current page is in use: a PSD always gets its own page (same as importing several pictures)
      const img = await root.readImageFile(pageFile);
      root.NaiPageLoading = true;
      try { await root.btmCreatePageAfter(root.getCanvasGUID(), img.width, img.height); } finally { root.NaiPageLoading = false; }
      root.addInitialImageToCanvas(img);
    } else await root.importImageFiles([pageFile]);
    const c = root.canvas;
    // the page picture may have been scaled (large: auto-downscaled; small: enlarged to the page): follow it
    const base = c.getObjects().find(o => o.type === 'image' && o._element && o._element.naturalWidth === psd.width && o._element.naturalHeight === psd.height);
    const k = base ? base.getScaledWidth() / psd.width : c.getWidth() / psd.width;
    const ox = base ? base.left - (base.originX === 'center' ? base.getScaledWidth() / 2 : 0) : 0, oy = base ? base.top - (base.originY === 'center' ? base.getScaledHeight() / 2 : 0) : 0;
    let added = 0;
    for (const l of rest) {
      const t = l.text && typeof l.text.text === 'string' && root.fabric.Textbox ? l.text : null;
      if (t) {
        const st = t.style || {}; const fc = st.fillColor || {};
        const obj = new root.fabric.Textbox(t.text, { left: ox + (l.left || 0) * k, top: oy + (l.top || 0) * k, width: Math.max(40, l.canvas.width * k), fontSize: Math.max(6, (st.fontSize || 24) * k * ((t.transform && t.transform[0]) || 1)),
          fill: 'rgb(' + [fc.r | 0, fc.g | 0, fc.b | 0].join(',') + ')', name: l.name || t.text.slice(0, 20), visible: !l.hidden, opacity: l.opacity == null ? 1 : l.opacity });
        c.add(obj); added++; continue;
      }
      const url = baked(l).toDataURL('image/png');
      await new Promise(ok => root.fabric.Image.fromURL(url, img => {
        img.set({ left: ox + (l.left || 0) * k, top: oy + (l.top || 0) * k, scaleX: k, scaleY: k, name: l.name || 'PSD 图层', visible: !l.hidden, opacity: l.opacity == null ? 1 : l.opacity,
          globalCompositeOperation: BLEND_IN[l.blendMode] || 'source-over' });
        c.add(img); added++; ok();
      }));
    }
    c.requestRenderAll(); if (typeof updateLayerPanel === 'function') updateLayerPanel();
    if (typeof root.btmSaveProjectFile === 'function') await root.btmSaveProjectFile(root.getCanvasGUID(), false);
    toast('导入 PSD', '已导入「' + file.name + '」：底图 + ' + added + ' 个图层' + (Math.abs(k - 1) > 0.001 ? '（已按页面比例缩放）' : '') + '。图层蒙版已合进透明度。');
    return added;
  }

  // 导入漫画页 accepts .psd: route PSD files here before the normal image import sees them
  function hookInput() {
    const input = document.getElementById('imageInput'); if (!input || input.__psd) return; input.__psd = true;
    input.setAttribute('accept', 'image/*,.psd,image/vnd.adobe.photoshop');
    input.addEventListener('change', async e => {
      const files = Array.from(input.files || []); const psds = files.filter(f => /\.psd$/i.test(f.name));
      if (!psds.length) return;
      e.stopImmediatePropagation();
      const others = files.filter(f => !psds.includes(f)); input.value = '';
      for (const f of psds) { try { await importFile(f); } catch (err) { toast('导入 PSD 失败', '「' + f.name + '」：' + (err.message || err), true); } }
      if (others.length) await root.importImageFiles(others);
    }, true);
  }
  function hookMenu() {
    const save = document.getElementById('projectLoad'); if (!save || document.getElementById('psdExport')) return;
    const li = save.closest('li'); if (!li) return;
    const mk = (id, icon, text, fn) => { const l = document.createElement('li'); l.innerHTML = '<a class="dropdown-item" href="#" id="' + id + '"><i class="material-icons">' + icon + '</i> <span>' + text + '</span></a>'; l.firstChild.addEventListener('click', ev => { ev.preventDefault(); fn(); }); return l; };
    const imp = mk('psdImport', 'file_open', '导入 PSD', () => document.getElementById('imageInput').click());
    const exp = mk('psdExport', 'layers', '导出当前页为 PSD（保留图层）', () => downloadPage());
    li.after(imp); imp.after(exp);
  }
  function init() { hookInput(); hookMenu(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  root.PsdIO = { exportPage, downloadPage, importFile, lib };
})(typeof window !== 'undefined' ? window : globalThis);

/* 「拆解为可编辑漫画」 / 「整页生成并拆解」: whole page -> panels + erased page + editable text layers.
 * Results are suggestions: the original page stays as a hidden layer, suspect OCR is named 「⚠待校对」. */
(function () {
  'use strict';
  const core = window.MangaPageDecomposeCore;
  if (!core) return;
  const $ = id => document.getElementById(id);
  const say = (t, bad) => { const n = $('mangaImportStatus'); if (n) { n.textContent = t; n.style.color = bad ? '#c62828' : ''; } };
  const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('图片读取失败')); i.src = src; });
  const fimg = src => new Promise(ok => fabric.Image.fromURL(src, ok));
  let hints = null;

  /** Centre of the rendered ink (alpha > 40) in canvas coordinates; falls back to the bounding box. */
  function inkCenter(o, r) {
    try {
      const cv = o.toCanvasElement({ multiplier: 1 }), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
      for (let j = 0; j < cv.height; j++) for (let i = 0; i < cv.width; i++) if (d[(j * cv.width + i) * 4 + 3] > 40) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
      if (x1 >= 0) return { x: r.left + (x0 + x1 + 1) / 2 * r.width / cv.width, y: r.top + (y0 + y1 + 1) / 2 * r.height / cv.height };
    } catch (_) { /* tainted or headless canvas: use the box */ }
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  async function decomposeDataUrl(dataUrl, scriptLines, options) {
    const rtl = !!(options && options.rtl);
    if (Array.isArray(scriptLines)) hints = scriptLines;
    const c = typeof canvas !== 'undefined' ? canvas : null;
    if (!c || !window.MangaModelRequest) throw new Error('编辑器未就绪');
    if (c.getObjects().length && !window.confirm('拆解会清空当前页对象（原图会作为隐藏图层保留）。继续？')) return;
    say('正在拆解：分镜、气泡、文字（CPU 约 10 秒）…');
    const r = await window.MangaModelRequest.post('/manga-smart/decompose', { image: dataUrl, hints: hints || [], rtl });
    hints = null;
    if (!r || !r.ok) throw new Error((r && r.error) || '拆解失败');
    const src = await load(dataUrl);
    const maxW = c.getWidth() || 1000;
    if (typeof resizeCanvasByNum === 'function') { const sc = Math.min(1, 1600 / Math.max(src.width, src.height)); resizeCanvasByNum(Math.round(src.width * sc), Math.round(src.height * sc)); }
    const scale = c.getWidth() / r.width || maxW / r.width;
    const plan = core.planLayers(r, scale);
    c.getObjects().slice().forEach(o => c.remove(o));
    if (typeof changeDoNotSaveHistory === 'function') changeDoNotSaveHistory();
    try {
      const original = await fimg(dataUrl);
      original.set({ left: 0, top: 0, scaleX: scale, scaleY: scale, visible: false, selectable: false, name: '拆解 · 原图（隐藏）' });
      c.add(original);
      for (const p of plan.panels) {
        const img = await fimg(r.cleaned);
        img.set({ left: 0, top: 0, scaleX: scale, scaleY: scale, name: '分镜 ' + p.index + ' · 画面', mangaDecomposePanel: p.index });
        img.clipPath = new fabric.Polygon(p.points, { absolutePositioned: true });
        c.add(img);
        c.add(new fabric.Polygon(p.points, { fill: 'rgba(0,0,0,0)', stroke: '#000', strokeWidth: Math.max(2, Math.round(3 * scale)),
          objectCaching: false, name: '分镜 ' + p.index + ' · 边框', mangaDecomposeFrame: p.index }));
      }
      let suspect = 0;
      for (const t of plan.texts) {
        const V = t.vertical && typeof fabric.VerticalTextbox === 'function';
        const Cls = V ? fabric.VerticalTextbox : fabric.Textbox;
        const tb = new Cls(t.lines.join('\n'), { left: t.box.x, top: t.box.y, width: V ? Math.max(24, t.box.width) : Math.max(24, t.box.width + t.fontSize), fontSize: t.fontSize,
          fontFamily: 'Noto Sans SC, Microsoft YaHei, sans-serif', fill: '#111', textAlign: 'center', angle: 0, lineHeight: 1.15, splitByGrapheme: !V, mangaSafeBox: t.box, mangaBubbleBox: t.bubbleBox });
        if (V) tb.set({ height: t.box.height });
        tb.setCoords();
        const b = tb.getBoundingRect(true, true);   // centre by rendered bbox inside the bubble
        const ink = inkCenter(tb, b);   // centre by the glyphs' ink bbox, not the text box
        tb.set({ left: tb.left + (t.box.x + t.box.width / 2) - ink.x, top: tb.top + (t.box.y + t.box.height / 2) - ink.y });
        tb.set({ name: (t.suspect ? '⚠待校对 · ' : '台词 · ') + t.text.slice(0, 12), mangaDecomposeText: true, mangaOcrText: t.ocrText, mangaSuspect: t.suspect });
        if (t.suspect) suspect++;
        c.add(tb);
      }
      c.requestRenderAll();
      const over = c.getObjects().filter(o => o.mangaDecomposeText).filter(o => { const r = o.getBoundingRect(true, true), b = o.mangaBubbleBox; return b && (r.left < b.x - 1 || r.top < b.y - 1 || r.left + r.width > b.x + b.width + 1 || r.top + r.height > b.y + b.height + 1); }).length;
      window.__decomposeOverflow = over;
      say('拆解完成：' + plan.panels.length + ' 格，' + plan.texts.length + ' 段文字（' + suspect + ' 段待校对，图层名带 ⚠）。结果是建议，请检查。');
    } finally { if (typeof changeDoSaveHistory === 'function') changeDoSaveHistory(); }
    if (typeof saveStateByManual === 'function') saveStateByManual();
    if (typeof updateLayerPanel === 'function') updateLayerPanel();
    return r;
  }

  function pickAndDecompose() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => { const f = input.files && input.files[0]; if (!f) return; const fr = new FileReader();
      fr.onload = () => decomposeDataUrl(fr.result).catch(e => say('拆解失败：' + (e.message || e), true)); fr.readAsDataURL(f); };
    input.click();
  }

  let genBusy = false, anlasStop = '';
  async function generateAndDecompose() {
    if (genBusy) throw new Error('上一张还在生成，请稍候（一次只跑一个任务）。');
    genBusy = true;
    try { return await generateOnce(); } finally { genBusy = false; }
  }
  async function generateOnce() {
    if (!window.NaiEngine || !window.NaiEngine.configured()) throw new Error('请先在「服务设置」填写 NovelAI Token。');
    const page = window.prompt('整页场景（英文 tag，例：school gate, morning）', '') ;
    if (page === null) return;
    const raw = window.prompt('每格一行：画面描述 | 台词（台词可空），例：girl waving | 早上好！', '');
    if (raw === null) return;
    const panels = raw.split(/\n|;|；/).map(l => { const [d, t] = l.split('|'); return { description: d, text: t }; });
    const P = window.MangaPagePlanCore;
    const opt = P ? window.prompt('可选：题材 和 留白，用逗号分开（可空）。题材：' + Object.keys(P.GENRES).join('/') + '；留白：' + Object.keys(P.MARGINS).join('/') + '；要彩色再加 color', '') : '';
    if (opt === null) return;
    const [gk, mk] = String(opt || '').split(/[,，\s]+/).map(x => x.trim()).filter(x => x && !/^colou?r$/i.test(x));
    const layout = {};
    if (P && P.GENRES[gk]) layout.sentence = P.GENRES[gk].sentence;
    if (P && P.MARGINS[mk || gk]) layout.frame = P.MARGINS[mk || gk].frame;
    const lint = core.lintPageSpec({ page, panels });
    if (!lint.ok) throw new Error('生成前检查未通过：' + lint.errors.join(' '));
    if (lint.warnings.length) say('提示：' + lint.warnings.join(' '));
    const spec = core.buildPagePrompt({ page, panels, layout, color: /\bcolor\b/i.test(opt || '') });
    delete spec.seed; // reroll = new random seed every run
    if (anlasStop) throw new Error(anlasStop);
    const before = await window.NaiEngine.subscription(true);
    const cost = await window.NaiEngine.costText(spec, 1);
    if (!cost.free && !window.confirm('这张会花 ' + cost.text + '，继续？')) return;
    say('NovelAI 正在生成整页（' + cost.text + '）…');
    const out = await window.NaiEngine.run({ prompt: spec.prompt, negative: spec.negative, characters: spec.characters,
      width: spec.width, height: spec.height, steps: spec.steps, preservePositiveStyle: true }, null, say);
    const after = await window.NaiEngine.subscription(true);
    const g = core.anlasGuard(before && before.anlas, after && after.anlas, cost.free);
    if (g.stop) { anlasStop = g.message; say(g.message); }
    hints = spec.hints;
    const r = await decomposeDataUrl(out.image, spec.hints, { rtl: true });   // builder names two-column rows right first
    // Planned vs actual panel count, kept per generated page (also the QA record).
    const rec = P ? P.panelRecord(P.plannedPanels(spec), r && r.panels ? r.panels.length : 0, { sha256: r && r.sha256, genre: gk || '', margin: mk || '', layout: gk || '' }) : null;
    if (rec) {
      // Final-image recheck: what OCR actually reads in the generated page vs the script.
      rec.recheck = P.recheckText(spec.hints, (r && r.texts || []).map(t => t.ocrText || t.text));
      rec.thumb = await thumb(out.image, 240);
      (window.__mangaPageRecords = window.__mangaPageRecords || []).push(rec);
      const notes = [];
      if (!rec.match) notes.push('计划 ' + rec.planned + ' 格，实际切出 ' + rec.actual + ' 格');
      if (!rec.recheck.pass) notes.push('图里的字与台本不一致：缺 ' + rec.recheck.missing.length + ' 句、不符 ' + rec.recheck.mismatched.length + ' 句（文字层已按台本嵌字）');
      if (notes.length) say('注意：' + notes.join('；') + '。');
    }
    return rec;
  }

  function thumb(dataUrl, w) {
    return new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = w; c.height = Math.round(im.height * w / im.width); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.8)); }; im.onerror = () => res(''); im.src = dataUrl; });
  }
  /** Contact sheet of the last six generated pages (reading order right to left), for rhythm review. */
  async function contactSheet(records) {
    const recs = (records || window.__mangaPageRecords || []).filter(r => r.thumb).slice(-6);
    if (!recs.length) return '';
    const ims = await Promise.all(recs.map(r => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = r.thumb; })));
    const cw = 240, ch = Math.max(...ims.map(im => im ? Math.round(im.height * cw / im.width) : 0)), gap = 12, cols = Math.min(3, recs.length), rows = Math.ceil(recs.length / cols);
    const c = document.createElement('canvas'); c.width = cols * cw + (cols + 1) * gap; c.height = rows * (ch + 28) + gap;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.font = '14px sans-serif'; g.fillStyle = '#111';
    recs.forEach((r, i) => {
      const col = cols - 1 - (i % cols), row = Math.floor(i / cols), x = gap + col * (cw + gap), y = gap + row * (ch + 28);
      if (ims[i]) g.drawImage(ims[i], x, y, cw, Math.round(ims[i].height * cw / ims[i].width));
      g.fillText(window.MangaPagePlanCore.sheetLabel(r, i), x, y + ch + 18);
    });
    return c.toDataURL('image/png');
  }
  /** Five-item QA scoring dialog for the current page (each 0–2; pass = total ≥ 8, no zero, no blocker). */
  function openQa() {
    const P = window.MangaPagePlanCore;
    if (!P) return;
    let box = $('mangaPageQa');
    if (box) box.remove();
    box = document.createElement('div');
    box.id = 'mangaPageQa';
    box.setAttribute('role', 'dialog');
    box.style.cssText = 'position:fixed;right:16px;top:80px;z-index:9999;background:#fff;border:1px solid #888;border-radius:8px;padding:12px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.2)';
    const sel = (k, label) => '<label style="display:block;margin:3px 0">' + label + ' <select data-qa="' + k + '"><option>0</option><option selected>1</option><option>2</option></select></label>';
    const chk = (k, label) => '<label style="margin-right:8px"><input type="checkbox" data-block="' + k + '">' + label + '</label>';
    box.innerHTML = '<b>整页 QA（每项 0–2 分）</b>' + P.QA_ITEMS.map(([k, l]) => sel(k, l)).join('') +
      '<div style="margin:6px 0">阻断项：' + P.QA_BLOCKERS.map(([k, l]) => chk(k, l)).join('') + '</div>' +
      '<div id="mangaPageQaResult" aria-live="polite"></div><button type="button" id="mangaPageQaSave">记录</button> <button type="button" id="mangaPageQaSheet" title="最近 6 页并排看节奏">6 页联系表</button> <button type="button" id="mangaPageQaClose">关闭</button>';
    document.body.appendChild(box);
    const read = () => { const sc = {}, bl = {}; box.querySelectorAll('[data-qa]').forEach(e => { sc[e.dataset.qa] = +e.value; }); box.querySelectorAll('[data-block]').forEach(e => { bl[e.dataset.block] = e.checked; }); return P.scoreQA(sc, bl); };
    const show = () => { const q = read(); $('mangaPageQaResult').textContent = '总分 ' + q.total + '/10 · ' + (q.pass ? '通过' : '未通过' + (q.zeros.length ? '（0 分：' + q.zeros.join('、') + '）' : '') + (q.blocked.length ? '（阻断：' + q.blocked.join('、') + '）' : '')); return q; };
    box.addEventListener('change', show); show();
    $('mangaPageQaSave').onclick = () => { const q = show(); const recs = window.__mangaPageRecords = window.__mangaPageRecords || []; const last = recs[recs.length - 1] || P.panelRecord(0, 0); if (!recs.length) recs.push(last); last.qa = q; last.status = q.pass ? 'visual_reviewed' : 'generated'; say('QA 已记录：' + $('mangaPageQaResult').textContent); };
    $('mangaPageQaClose').onclick = () => box.remove();
    $('mangaPageQaSheet').onclick = async () => { const u = await contactSheet(); if (!u) { say('还没有生成过整页，联系表为空。'); return; } const w = window.open(''); if (w) w.document.write('<title>6 页联系表</title><img src="' + u + '" style="max-width:100%">'); else say('浏览器拦截了新窗口。'); };
  }

  function bind() {
    const a = $('mangaDecomposeButton'), g = $('mangaGenDecomposeButton'), q = $('mangaPageQaButton');
    if (q) q.addEventListener('click', openQa);
    if (a) a.addEventListener('click', pickAndDecompose);
    if (g) g.addEventListener('click', () => generateAndDecompose().catch(e => say('整页生成失败：' + (e.message || e), true)));
  }
  document.addEventListener('DOMContentLoaded', bind);
  window.MangaPageDecompose = { decomposeDataUrl, generateAndDecompose, pickAndDecompose, openQa, contactSheet };
})();

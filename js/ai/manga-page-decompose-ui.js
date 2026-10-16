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

  async function decomposeDataUrl(dataUrl) {
    const c = typeof canvas !== 'undefined' ? canvas : null;
    if (!c || !window.MangaModelRequest) throw new Error('编辑器未就绪');
    if (c.getObjects().length && !window.confirm('拆解会清空当前页对象（原图会作为隐藏图层保留）。继续？')) return;
    say('正在拆解：分镜、气泡、文字（CPU 约 10 秒）…');
    const r = await window.MangaModelRequest.post('/manga-smart/decompose', { image: dataUrl, hints: hints || [] });
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
        const tb = new Cls(t.text, { left: t.box.x, top: t.box.y, width: Math.max(24, t.box.width), fontSize: t.fontSize,
          fontFamily: 'Noto Sans SC, Microsoft YaHei, sans-serif', fill: '#111', textAlign: 'center', angle: 0, lineHeight: 1.12, splitByGrapheme: true });
        if (V) tb.set({ height: t.box.height });
        tb.setCoords();
        const b = tb.getBoundingRect(true, true);   // centre by rendered bbox inside the bubble
        tb.set({ left: tb.left + (t.box.x + t.box.width / 2) - (b.left + b.width / 2), top: tb.top + (t.box.y + t.box.height / 2) - (b.top + b.height / 2) });
        tb.set({ name: (t.suspect ? '⚠待校对 · ' : '台词 · ') + t.text.slice(0, 12), mangaDecomposeText: true, mangaOcrText: t.ocrText, mangaSuspect: t.suspect });
        if (t.suspect) suspect++;
        c.add(tb);
      }
      c.requestRenderAll();
      say('拆解完成：' + plan.panels.length + ' 格，' + plan.texts.length + ' 段文字（' + suspect + ' 段待校对，图层名带 ⚠）。结果是建议，请检查。');
    } finally { if (typeof changeDoSaveHistory === 'function') changeDoSaveHistory(); }
    if (typeof saveStateByManual === 'function') saveStateByManual();
    if (typeof updateLayerPanel === 'function') updateLayerPanel();
  }

  function pickAndDecompose() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => { const f = input.files && input.files[0]; if (!f) return; const fr = new FileReader();
      fr.onload = () => decomposeDataUrl(fr.result).catch(e => say('拆解失败：' + (e.message || e), true)); fr.readAsDataURL(f); };
    input.click();
  }

  async function generateAndDecompose() {
    if (!window.NaiEngine || !window.NaiEngine.configured()) throw new Error('请先在「服务设置」填写 NovelAI Token。');
    const page = window.prompt('整页场景（英文 tag，例：school gate, morning）', '') ;
    if (page === null) return;
    const raw = window.prompt('每格一行：画面描述 | 台词（台词可空），例：girl waving | 早上好！', '');
    if (raw === null) return;
    const panels = raw.split(/\n|;|；/).map(l => { const [d, t] = l.split('|'); return { description: d, text: t }; });
    const spec = core.buildPagePrompt({ page, panels });
    const cost = await window.NaiEngine.costText(spec, 1);
    if (!cost.free && !window.confirm('这张会花 ' + cost.text + '，继续？')) return;
    say('NovelAI 正在生成整页（' + cost.text + '）…');
    const out = await window.NaiEngine.run({ prompt: spec.prompt, negative: spec.negative, characters: spec.characters,
      width: spec.width, height: spec.height, steps: spec.steps, preservePositiveStyle: true }, null, say);
    hints = spec.hints;
    await decomposeDataUrl(out.image);
  }

  function bind() {
    const a = $('mangaDecomposeButton'), g = $('mangaGenDecomposeButton');
    if (a) a.addEventListener('click', pickAndDecompose);
    if (g) g.addEventListener('click', () => generateAndDecompose().catch(e => say('整页生成失败：' + (e.message || e), true)));
  }
  document.addEventListener('DOMContentLoaded', bind);
  window.MangaPageDecompose = { decomposeDataUrl, generateAndDecompose, pickAndDecompose };
})();

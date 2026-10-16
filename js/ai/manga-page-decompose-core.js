/* Full-page decomposition core (pure; unit-tested in Node). Own implementation.
 * buildPagePrompt: our own full-page prompt builder for NovelAI V4/V5 (page + panels + characters + dialogue).
 * planLayers: turn /manga-smart/decompose JSON into canvas-space layer specs. */
(function (root) {
  'use strict';
  const PAGE_STYLE = 'manga page, comic, monochrome, greyscale, screentone, black panel borders, white gutters';
  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  const TIERS = { 1: ['full-page'], 2: ['top', 'bottom'], 3: ['top', 'middle', 'bottom'], 4: ['top', 'upper-middle', 'lower-middle', 'bottom'] };
  /** Reading-order position names for n panels (stacked tiers up to 4, then two-column rows, right first). */
  function positions(n) {
    if (TIERS[n]) return TIERS[n].map(t => t === 'full-page' ? 'full-page' : t + ' wide');
    const rows = Math.ceil(n / 2), names = [];
    const rowName = r => rows === 1 ? 'top' : r === 0 ? 'top' : r === rows - 1 ? 'bottom' : (rows === 3 ? 'middle' : (r === 1 ? 'upper-middle' : 'lower-middle'));
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / 2), last = r === rows - 1 && n % 2 === 1;
      names.push(last ? rowName(r) + ' wide' : rowName(r) + (i % 2 === 0 ? ' right' : ' left'));
    }
    return names;
  }
  function stripText(s) { return clean(s).replace(/[「」『』【】{}"“”]/g, ''); }
  /** Six-layer full-page prompt (style / layout / cast / per-panel visible content / text placement / one final Text:).
   * spec: { page, panels:[{description, text, speaker}], characters:[{prompt, negative, center}], rtl } */
  function buildPagePrompt(spec) {
    spec = spec || {};
    const panels = (spec.panels || []).filter(p => p && (clean(p.description) || clean(p.text))).slice(0, 8);
    const n = panels.length || 1, pos = (spec.layout && Array.isArray(spec.layout.positions) && spec.layout.positions.length === n) ? spec.layout.positions : positions(n);
    const lines = [], hints = [];
    const style = 'manga, comic page, monochrome, greyscale, screentone, speech bubble, text, chinese text';
    const L = spec.layout || {};
    const layout = n + (n === 1 ? ' panel' : ' panels') + ' exactly' + (clean(L.sentence) ? ', ' + clean(L.sentence) : '') +
      ', read ' + (spec.rtl ? 'right to left, ' : '') + 'top to bottom, ' +
      (clean(L.frame) || 'black panel borders, white gutters') + (L.inset ? '' : ', no extra inset frames');
    const cast = clean(spec.page);
    const perPanel = panels.map((p, i) => pos[i] + ' panel ONLY: ' + clean(p.description).replace(/,?\s*no text$/i, '') + ', no text');
    const placement = panels.map((p, i) => {
      const t = stripText(p.text);
      if (!t) return pos[i] + ' panel: wordless';
      lines.push(t); hints.push(t);
      return pos[i] + ' panel: text block ' + lines.length + ' in a white speech bubble' + (clean(p.speaker) ? ' from ' + clean(p.speaker) : '');
    });
    const base = [style, layout, cast].filter(Boolean).join(', ') + '.\n' + perPanel.join('.\n') + '.\n' + placement.join('.\n') + '.' +
      (lines.length ? '\nDo not print frame labels, block numbers, character names or any English words.\nText: ' + lines.join('\n\n') : '');
    const characters = (spec.characters || []).filter(c => c && clean(c.prompt)).slice(0, 6)
      .map(c => ({ prompt: clean(c.prompt), negative: clean(c.negative), center: c.center }));
    // Negative never excludes what the page needs (text, bubbles, panels).
    const negative = 'english text, prompt text, frame labels, panel numbers, watermark, signature, lowres, worst quality, bad quality, jpeg artifacts, bad anatomy';
    return { prompt: base, characters, hints, width: 832, height: 1216, steps: 28, negative, profile: 'page', positions: pos.slice(0, n) };
  }
  /** Pre-generation lint for a page spec. Returns {ok, errors, warnings}. */
  function lintPageSpec(spec) {
    spec = spec || {};
    const errors = [], warnings = [];
    const panels = (spec.panels || []).filter(Boolean);
    if (!panels.length) errors.push('没有分格。');
    if (panels.length > 8) errors.push('分格超过 8 个（' + panels.length + '）。');
    panels.forEach((p, i) => {
      if (!clean(p.description)) errors.push('第 ' + (i + 1) + ' 格缺少画面描述。');
      if (p.text != null && !stripText(p.text) && p.wordless !== true) warnings.push('第 ' + (i + 1) + ' 格台词为空；若无台词请标 wordless。');
      if (/\bText:/i.test(String(p.description || ''))) errors.push('第 ' + (i + 1) + ' 格描述里含有 Text:，台词只能写在 text 字段。');
      if (stripText(p.text).length > 40) warnings.push('第 ' + (i + 1) + ' 格台词超过 40 字，气泡可能放不下。');
    });
    const chars = (spec.characters || []).filter(c => c && clean(c.prompt));
    if (chars.length > 6) errors.push('角色超过 6 个（NAI 上限）。');
    if (chars.length >= 2 && chars.some(c => !c.center)) warnings.push('多角色未全部设置位置，将自动分配。');
    const L = spec.layout && spec.layout.positions;
    if (L && L.length !== panels.length) errors.push('布局位置数 ' + L.length + ' 与分格数 ' + panels.length + ' 不一致。');
    const w = spec.width || 832, h = spec.height || 1216;
    if (w % 64 || h % 64) errors.push('尺寸必须是 64 的倍数。');
    if (w * h > 1048576) errors.push('面积超过 1048576（免费档上限）。');
    if ((spec.steps || 28) > 28) errors.push('步数超过 28（免费档上限）。');
    return { ok: !errors.length, errors, warnings };
  }
  const NO_LINE_START = /^[，。、！？：；…）」』】〉》!?,.:;)\]—～·]/;
  /** Break CJK text into lines of at most `per` chars; closing punctuation never starts a line. */
  function breakLines(text, per) {
    const chars = Array.from(text.replace(/\s+/g, '')), lines = [];
    let cur = [];
    for (const ch of chars) {
      if (cur.length >= per && !NO_LINE_START.test(ch)) { lines.push(cur.join('')); cur = []; }
      cur.push(ch);
    }
    if (cur.length) lines.push(cur.join(''));
    return lines;
  }
  /** Largest font size whose broken lines fit `rect` (CJK glyph ≈ 1em square, line pitch 1.15em). */
  function fitInRect(text, rect, vertical, minSize, maxSize) {
    const along = vertical ? rect.height : rect.width, across = vertical ? rect.width : rect.height;
    minSize = minSize || 9; maxSize = maxSize || 64;
    for (let size = maxSize; size >= minSize; size--) {
      const per = Math.max(1, Math.floor(along / (size * 1.02)));
      const lines = breakLines(text, per);
      const longest = Math.max.apply(null, lines.map(l => Array.from(l).length + (NO_LINE_START.test(l.slice(-1)) ? 0 : 0)));
      if (lines.length * size * (vertical ? 1.3 : 1.15) <= across && longest * size * 1.02 <= along + size * 0.6) return { fontSize: size, lines, overflow: false };
    }
    return { fontSize: minSize, lines: breakLines(text, Math.max(1, Math.floor(along / minSize))), overflow: true };
  }
  /** result: server JSON; scale: canvas px per source px. */
  function planLayers(result, scale) {
    const s = scale > 0 ? scale : 1;
    const panels = (result.panels || []).map((p, i) => ({
      index: i + 1,
      points: p.polygon.map(q => ({ x: q[0] * s, y: q[1] * s })),
      bbox: { x: p.bbox[0] * s, y: p.bbox[1] * s, width: p.bbox[2] * s, height: p.bbox[3] * s },
      borderless: !!p.borderless,
    }));
    // Only CJK text that was actually erased becomes a layer: garbled / English OCR never does.
    const cjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;
    const texts = (result.texts || []).filter(t => t.layer !== false && t.erase !== 'skipped' && cjk.test(t.text || '')).map(t => {
      // Safe area = rectangle inside the bubble mask (server), never the OCR box.
      const area = t.safe || (t.isBubble ? t.bubble : t.bbox);
      const box = { x: area[0] * s, y: area[1] * s, width: area[2] * s, height: area[3] * s };
      const fit = fitInRect(clean(t.text), box, !!t.vertical);
      return { text: clean(t.text), lines: fit.lines, vertical: !!t.vertical, suspect: !!t.suspect, box, panel: t.panel,
        bubbleBox: { x: (t.isBubble ? t.bubble : t.bbox)[0] * s, y: (t.isBubble ? t.bubble : t.bbox)[1] * s, width: (t.isBubble ? t.bubble : t.bbox)[2] * s, height: (t.isBubble ? t.bubble : t.bbox)[3] * s },
        fontSize: fit.fontSize, overflow: fit.overflow, ocrText: t.ocrText || t.text, angle: 0 };
    });
    return { panels, texts };
  }
  const api = Object.freeze({ buildPagePrompt, planLayers, positions, fitInRect, breakLines, PAGE_STYLE, lintPageSpec });
  root.MangaPageDecomposeCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

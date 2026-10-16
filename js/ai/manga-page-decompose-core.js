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
    const style = spec.color ? 'manga, comic page, full color, cel shading, clean lineart, speech bubble, text, chinese text' : 'manga, comic page, monochrome, greyscale, screentone, speech bubble, text, chinese text';
    const L = spec.layout || {};
    const layout = n + (n === 1 ? ' panel' : ' panels') + ' exactly' + (clean(L.sentence) ? ', ' + clean(L.sentence) : '') +
      ', read ' + (spec.rtl ? 'right to left, ' : '') + 'top to bottom, ' +
      (clean(L.frame) || 'black panel borders, white gutters') + (L.inset ? '' : ', no extra inset frames');
    const cast = clean(spec.page);
    const PL = root.MangaPagePlanCore;
    const gray = s2 => (spec.grayHues !== false && !spec.color && PL ? PL.hueToGray(s2) : s2);
    const perPanel = panels.map((p, i) => pos[i] + ' panel ONLY: ' + gray(clean(p.description).replace(/,?\s*no text$/i, '')) +
      ((p.mustShow || []).length ? ', clearly showing ' + p.mustShow.map(clean).join(' and ') : '') + ', no text');
    const placement = panels.map((p, i) => {
      const raw = clean(p.text), kind = /^\*.*\*$/.test(raw) ? 'thought' : /^【.*】$/.test(raw) ? 'sfx' : /^\{.*\}$/.test(raw) ? 'narration' : 'speech';
      const t = stripText(raw.replace(/^\*(.*)\*$/, '$1'));
      if (!t) return pos[i] + ' panel: wordless';
      lines.push(t); hints.push(t);
      const special = kind === 'speech' && spec.speakerShapes !== false && PL ? PL.bubbleForSpeaker(p.speaker) : null;
      if (special) return pos[i] + ' panel: text block ' + lines.length + ' in a ' + special;
      const holder = { speech: 'in a white speech bubble', thought: 'in a cloud-shaped thought bubble', sfx: 'as hand-drawn sound effect lettering without a bubble', narration: 'in a rectangular narration box' }[kind];
      return pos[i] + ' panel: text block ' + lines.length + ' ' + holder + (clean(p.speaker) && kind !== 'sfx' && kind !== 'narration' ? ' from ' + clean(p.speaker) : '');
    });
    const base = [style, layout, cast].filter(Boolean).join(', ') + '.\n' + perPanel.join('.\n') + '.\n' + placement.join('.\n') + '.' +
      (lines.length ? '\nDo not print frame labels, block numbers, character names or any English words.\nText: ' + lines.join('\n\n') : '');
    let characters = (spec.characters || []).filter(c => c && clean(c.prompt)).slice(0, 6)
      .map(c => ({ prompt: gray(clean(c.prompt)), negative: clean(c.negative), center: c.center }));
    if (PL && ((spec.captionStrip || []).length || Object.keys(spec.captionOver || {}).length)) characters = PL.applyCaptionEdits(characters, spec.captionStrip, spec.captionOver);
    const mustNot = Array.from(new Set([].concat.apply([], panels.map(p => (p.mustNotShow || []).map(clean))).filter(Boolean)));
    // Negative never excludes what the page needs (text, bubbles, panels).
    const negative = (spec.color ? 'monochrome, greyscale, ' : '') + 'english text, prompt text, frame labels, panel numbers, watermark, signature, lowres, worst quality, bad quality, jpeg artifacts, bad anatomy' + (mustNot.length ? ', ' + mustNot.join(', ') : '');
    const size = PL ? PL.spreadSize(spec.page) : { width: 832, height: 1216 };
    return { prompt: base, characters, hints, width: size.width, height: size.height, steps: 28, negative, profile: 'page', positions: pos.slice(0, n) };
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
  /** After a run expected to be free: stop the queue when the Anlas balance dropped (or cannot be read). */
  function anlasGuard(before, after, expectedFree) {
    if (!expectedFree) return { stop: false };
    const num = v => (typeof v === 'number' ? v : (v && typeof v === 'object' ? Object.values(v).reduce((a, b) => a + (+b || 0), 0) : NaN));
    const b = num(before), a = num(after);
    if (!Number.isFinite(b) || !Number.isFinite(a)) return { stop: true, message: '无法确认 Anlas 余额，已停止后续生成（刷新页面后可再试）。' };
    if (a < b) return { stop: true, message: 'Anlas 余额从 ' + b + ' 降到 ' + a + '，已停止后续生成。' };
    return { stop: false, spent: 0 };
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
      if (lines.length * size * (vertical ? 1.3 : 1.15) <= across && longest * size * 1.02 <= along + size * 0.6) {
        // Balance the lines (no lone last character): same line count, shortest even split that still obeys kinsoku.
        const total = Array.from(text.replace(/\s+/g, '')).length;
        for (let p2 = Math.ceil(total / lines.length); p2 < per; p2++) {
          const b = breakLines(text, p2);
          if (b.length === lines.length) return { fontSize: size, lines: b, overflow: false };
        }
        return { fontSize: size, lines, overflow: false };
      }
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
      return { text: clean(t.text), lines: fit.lines, vertical: !!t.vertical, isBubble: !!t.isBubble, suspect: !!t.suspect, box, panel: t.panel,
        bubbleBox: { x: (t.isBubble ? t.bubble : t.bbox)[0] * s, y: (t.isBubble ? t.bubble : t.bbox)[1] * s, width: (t.isBubble ? t.bubble : t.bbox)[2] * s, height: (t.isBubble ? t.bubble : t.bbox)[3] * s },
        fontSize: fit.fontSize, overflow: fit.overflow, ocrText: t.ocrText || t.text, angle: 0 };
    });
    // One size per region type (bubble vertical / bubble horizontal / other): cap each at the group median.
    const groups = {};
    texts.forEach(t => { const k = (t.isBubble ? 'b' : 'o') + (t.vertical ? 'v' : 'h'); (groups[k] = groups[k] || []).push(t); });
    Object.values(groups).forEach(g => {
      if (g.length < 2 || root.__noUnify) return;
      const sz = g.map(t => t.fontSize).sort((a, b) => a - b), med = sz[(sz.length - 1) >> 1];
      g.forEach(t => { if (t.fontSize > med) { const f = fitInRect(t.text, t.box, t.vertical, med, med); if (!f.overflow) { t.fontSize = med; t.lines = f.lines; } } });
    });
    return { panels, texts };
  }
  /** Story/batch-director plan page -> full-page spec (no retyping): panel prompt minus quality/frame tags as the
   *  description, shot first, must_show/must_not_show kept, first line as the panel text (markup kept for the kind). */
  function specFromPlanPage(page, opts) {
    opts = opts || {};
    const DROP = /^(masterpiece|best quality|amazing quality|very aesthetic|highres|absurdres|manga panel|clean panel border|panel border|clean crop|manga|comic|monochrome|greyscale|screentone|lineart)$/i;
    const src = (page && page.panels || []).filter(q => q.mode !== 'simulator');
    const tagsOf = q => String(q.prompt || '').split(/\s*,\s*/).map(clean).filter(t => t && !DROP.test(t) && !/^character_[a-z0-9]+$/i.test(t));
    // tags every panel repeats (the series bible) are said once for the page, not once per panel
    const all = src.map(tagsOf), shared = src.length > 1 ? all[0].filter(t => all.every(a => a.includes(t))) : [];
    const panels = src.map((q, qi) => {
      const tags = all[qi].filter(t => !shared.includes(t));
      const desc = [q.shot].concat(tags).filter(Boolean).filter((t, i, a) => a.indexOf(t) === i).slice(0, 18).join(', ') || clean(q.description);
      const d = (q.dialogue || [])[0];
      return { description: desc, text: d ? clean(d.content || d.text || '') : '', speaker: d ? clean(d.speaker) : '', mustShow: q.mustShow || [], mustNotShow: q.mustNotShow || [] };
    });
    return { page: Array.from(new Set([clean(opts.page)].concat(shared).filter(Boolean))).join(', '), panels, layout: opts.layout || {}, rtl: opts.rtl !== false, color: !!opts.color };
  }
  const api = Object.freeze({ buildPagePrompt, specFromPlanPage, planLayers, positions, fitInRect, breakLines, PAGE_STYLE, lintPageSpec, anlasGuard });
  root.MangaPageDecomposeCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

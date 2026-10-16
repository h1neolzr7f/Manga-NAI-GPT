/* Full-page decomposition core (pure; unit-tested in Node). Own implementation.
 * buildPagePrompt: our own full-page prompt builder for NovelAI V4/V5 (page + panels + characters + dialogue).
 * planLayers: turn /manga-smart/decompose JSON into canvas-space layer specs. */
(function (root) {
  'use strict';
  const PAGE_STYLE = 'manga page, comic, monochrome, greyscale, screentone, black panel borders, white gutters';
  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  /** spec: { page, panels:[{description, text}], characters:[{prompt, negative}], width, height } */
  function buildPagePrompt(spec) {
    const panels = (spec && spec.panels || []).filter(p => p && (clean(p.description) || clean(p.text))).slice(0, 8);
    const parts = [PAGE_STYLE, panels.length + ' panels', clean(spec && spec.page)];
    const hints = [];
    panels.forEach((p, i) => {
      const t = clean(p.text);
      let seg = 'panel ' + (i + 1) + ': ' + clean(p.description);
      if (t) { seg += ', speech bubble with text "' + t.replace(/"/g, '') + '"'; hints.push(t); }
      parts.push(seg);
    });
    const characters = (spec && spec.characters || []).filter(c => c && clean(c.prompt)).slice(0, 6)
      .map(c => ({ prompt: clean(c.prompt), negative: clean(c.negative) }));
    const size = { width: 832, height: 1216 };   // 64-multiples, 1,011,712 px: inside the Opus free budget
    return { prompt: parts.filter(Boolean).join(', '), characters, hints, width: size.width, height: size.height, steps: 28,
      negative: 'english text, garbled text, watermark, signature, lowres, blurry' };
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
    const texts = (result.texts || []).filter(t => t.erase !== 'skipped' && (clean(t.text) || t.isBubble)).map(t => {
      const empty = !clean(t.text);
      const area = t.isBubble ? t.bubble : t.bbox;
      // Lettering lesson: never use the OCR box as the bubble safe area; inset the bubble itself.
      const inset = t.isBubble ? 0.16 : 0;
      const box = { x: (area[0] + area[2] * inset) * s, y: (area[1] + area[3] * inset) * s,
        width: area[2] * (1 - 2 * inset) * s, height: area[3] * (1 - 2 * inset) * s };
      return { text: empty ? '（待填写）' : clean(t.text), vertical: !!t.vertical, suspect: empty || !!t.suspect, box, panel: t.panel,
        fontSize: Math.max(10, Math.round((t.fontSize || 18) * s)), ocrText: t.ocrText || t.text, angle: 0 };
    });
    return { panels, texts };
  }
  const api = Object.freeze({ buildPagePrompt, planLayers, PAGE_STYLE });
  root.MangaPageDecomposeCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

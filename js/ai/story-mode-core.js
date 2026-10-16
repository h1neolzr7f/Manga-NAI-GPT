/* 故事模式 core (pure, testable): long prose/script -> scene plan pages; character presets; chapter queue. */
(function (root) {
  'use strict';
  const SPEECH = /^\s*([^\s：:「」“”"]{1,12})\s*[：:]\s*[「“"]?(.+?)[」”"]?\s*$/;
  const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

  /** Split pasted text into beats: `名字：台词` = speech, 「…」/“…” alone = speech of last speaker, rest = narration (sentence chunks). */
  function parseStory(text) {
    const beats = []; let title = '', last = '';
    String(text || '').replace(/\r/g, '').split(/\n+/).map(l => l.trim()).filter(Boolean).forEach((line, i) => {
      const t = line.match(/^(?:#+\s*|标题[：:]\s*)(.+)$/);
      if (t && i === 0) { title = clean(t[1]); return; }
      const m = line.match(SPEECH);
      if (m && !/^(旁白|叙述|narration)$/i.test(m[1])) { last = clean(m[1]); beats.push({ type: 'speech', speaker: last, content: clean(m[2]) }); return; }
      if (m) { beats.push({ type: 'narrator', speaker: '', content: clean(m[2]) }); return; }
      const q = line.match(/^[「“"](.+)[」”"]$/);
      if (q) { beats.push({ type: 'speech', speaker: last || '角色', content: clean(q[1]) }); return; }
      // prose paragraph: one panel per ~2 sentences so a long paragraph is not one giant panel
      const sents = line.split(/(?<=[。！？!?…])/).map(clean).filter(Boolean);
      for (let k = 0; k < sents.length; k += 2) beats.push({ type: 'narrator', speaker: '', content: sents.slice(k, k + 2).join('') });
    });
    return { title: title || '故事', beats };
  }

  /** Beats -> plan: a narration beat opens a panel (its scene), following speech joins it (max 2 lines); 2-4 panels a page. */
  function buildPlan(parsed, opts) {
    opts = opts || {};
    const perPage = Math.max(2, Math.min(4, opts.perPage || 4)), maxPages = Math.max(1, opts.maxPages || 12);
    const panels = []; let cur = null;
    parsed.beats.forEach(b => {
      if (b.type === 'speech' && cur && cur.dialogue.length < 2 && (!cur.dialogue.length || cur.dialogue[cur.dialogue.length - 1].speaker === b.speaker || cur.narr)) {
        cur.dialogue.push({ speaker: b.speaker, content: b.content }); if (cur.characters.indexOf(b.speaker) < 0) cur.characters.push(b.speaker); cur.narr = false; return;
      }
      cur = { description: b.type === 'speech' ? b.speaker + '：' + b.content : b.content, characters: b.speaker ? [b.speaker] : [], dialogue: b.type === 'speech' ? [{ speaker: b.speaker, content: b.content }] : [], narr: b.type !== 'speech' };
      panels.push(cur);
    });
    const pages = [];
    let per = panels.length <= perPage ? panels.length : (panels.length % perPage === 1 ? perPage - 1 : perPage);
    for (let i = 0; i < panels.length && pages.length < maxPages; i += per) {
      pages.push({ page: pages.length + 1, panels: panels.slice(i, i + per).map((q, k) => ({ panel: k + 1, mode: 'normal', description: q.description, characters: q.characters, dialogue: q.dialogue, template: '' })) });
    }
    return { schemaVersion: 1, title: parsed.title, pages, truncated: Math.max(0, Math.ceil(panels.length / (per || 1)) - pages.length) };
  }

  /** All speaking / listed names in a plan (for the character preset table). */
  function castOf(plan) {
    const n = []; (plan.pages || []).forEach(p => p.panels.forEach(q => (q.characters || []).forEach(c => { if (c && c !== '旁白' && n.indexOf(c) < 0) n.push(c); }))); return n;
  }

  /** Character consistency: prepend each present character's fixed tags to the panel prompt (once). */
  function applyPresets(plan, presets) {
    presets = presets || {};
    (plan.pages || []).forEach(p => p.panels.forEach(q => {
      const add = (q.characters || []).map(c => clean(presets[c])).filter(Boolean);
      if (!add.length) return;
      const base = String(q.prompt || q.description || '').split(/\s*,\s*/).filter(Boolean);
      const tags = add.join(', ').split(/\s*,\s*/).filter(Boolean);
      q.prompt = tags.concat(base.filter(t => tags.indexOf(t) < 0)).join(', ');
    }));
    return plan;
  }

  /** Chapter queue: per-page status pending|running|done|failed; retry resets failed ones. */
  function makeQueue(n) { return { pages: Array.from({ length: n }, (_, i) => ({ index: i, status: 'pending', error: '' })) }; }
  function nextPending(q) { return q.pages.find(p => p.status === 'pending') || null; }
  function retryFailed(q) { q.pages.forEach(p => { if (p.status === 'failed') { p.status = 'pending'; p.error = ''; } }); return q; }
  function summary(q) { const c = s => q.pages.filter(p => p.status === s).length; return { total: q.pages.length, done: c('done'), failed: c('failed'), pending: c('pending') }; }

  const api = Object.freeze({ parseStory, buildPlan, castOf, applyPresets, makeQueue, nextPending, retryFailed, summary });
  root.StoryModeCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* 故事模式 core (pure, testable): long prose/script -> scene plan pages; character presets; chapter queue.
 * Page-level purpose + 进入/重点/离开 beats; lintPlan mapping; bible DNA presets. */
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

  function panelLabel(q) {
    if (q.dialogue && q.dialogue.length) return q.dialogue.map(d => clean(d.speaker) + '：' + clean(d.content)).join('；');
    return clean(q.description);
  }

  /** One-sentence page purpose (what the reader must understand). */
  function summarizePurpose(panels) {
    const parts = (panels || []).map(panelLabel).filter(Boolean);
    if (!parts.length) return '';
    if (parts.length === 1) return parts[0].slice(0, 72);
    return ('本页：' + parts[0].slice(0, 28) + ' → ' + parts[parts.length - 1].slice(0, 28)).slice(0, 80);
  }

  /** 进入 / 重点 / 离开 three beats for a page (doc storyboard rule). */
  function pageBeats(panels) {
    const texts = (panels || []).map(panelLabel);
    const enter = texts[0] || '';
    const leave = texts.length ? texts[texts.length - 1] : '';
    const mid = texts.length >= 3 ? texts[Math.floor(texts.length / 2)] : (texts[1] || texts[0] || '');
    return { enter: enter.slice(0, 80), focus: mid.slice(0, 80), leave: leave.slice(0, 80) };
  }

  /** Attach purpose, beats, cast, pageType, layout code (PageLayoutCore when present). */
  function enrichPages(plan) {
    const PL = root.PageLayoutCore;
    const recent = [];
    (plan.pages || []).forEach(p => {
      const panels = p.panels || [];
      p.cast = Array.from(new Set([].concat.apply([], panels.map(q => q.characters || [])))).filter(c => c && c !== '旁白');
      p.pageType = p.cast.length <= 1 ? 'SOLO' : 'BOTH';
      if (!clean(p.purpose)) p.purpose = summarizePurpose(panels);
      const b = pageBeats(panels);
      p.beats = Object.assign({ enter: '', focus: '', leave: '' }, p.beats || {});
      if (!clean(p.beats.enter)) p.beats.enter = b.enter;
      if (!clean(p.beats.focus)) p.beats.focus = b.focus;
      if (!clean(p.beats.leave)) p.beats.leave = b.leave;
      if (!p.layout && PL) {
        try {
          const id = PL.pick(panels.length || 1, { recent: recent.slice() });
          p.layout = PL.TEMPLATES[id].code;
          recent.push(p.layout);
        } catch (e) { /* layout optional */ }
      } else if (p.layout) recent.push(p.layout);
    });
    return plan;
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
    return enrichPages({ schemaVersion: 1, title: parsed.title, pages, truncated: Math.max(0, Math.ceil(panels.length / (per || 1)) - pages.length) });
  }

  /** Map story plan pages into MangaPagePlanCore.lintPlan shape. */
  function toLintPages(plan) {
    return (plan && plan.pages || []).map(p => ({
      purpose: p.purpose,
      layout: p.layout,
      cast: p.cast || [],
      pageType: p.pageType,
      panels: (p.panels || []).map(q => ({
        description: q.description,
        shot: q.shot,
        lines: (q.dialogue || []).map(d => ({ speaker: d.speaker, render_text: d.content, text: d.content })),
        mustShow: q.mustShow,
        mustNotShow: q.mustNotShow,
        cast: q.characters,
        fullBody: q.fullBody
      })),
      continuityIn: p.continuityIn,
      continuityOut: p.continuityOut,
      signature: p.signature
    }));
  }

  function lintStory(plan) {
    const P = root.MangaPagePlanCore;
    if (!P || !P.lintPlan) return { ok: true, errors: [], warnings: [] };
    return P.lintPlan(toLintPages(plan));
  }

  /** All speaking / listed names in a plan (for the character preset table). */
  function castOf(plan) {
    const n = []; (plan.pages || []).forEach(p => p.panels.forEach(q => (q.characters || []).forEach(c => { if (c && c !== '旁白' && n.indexOf(c) < 0) n.push(c); }))); return n;
  }

  /** Prefer bible DNA tags, then traits / identity.tags. */
  function presetsFromBible(cast, cards) {
    const Core = root.MangaCharacterBibleCore;
    const out = {};
    (cast || []).forEach(name => {
      const card = (cards || []).find(c => c && clean(c.name) === clean(name));
      if (!card) return;
      let tags = '';
      if (Core && card.dna) tags = Core.dnaTags(card);
      if (!tags) tags = clean(card.traits);
      if (!tags && card.identity && card.identity.tags) tags = clean(card.identity.tags);
      if (tags) out[name] = tags;
    });
    return out;
  }

  /** Merge: user-typed presets win over bible defaults. */
  function mergePresets(userPresets, biblePresets) {
    const out = Object.assign({}, biblePresets || {});
    Object.keys(userPresets || {}).forEach(k => { if (clean(userPresets[k])) out[k] = userPresets[k]; });
    return out;
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

  /** Chapter queue: per-page status pending|running|done|failed; retry / redecompose helpers. */
  function makeQueue(n) { return { pages: Array.from({ length: n }, (_, i) => ({ index: i, status: 'pending', error: '', image: null, hints: null, redecomposeOnly: false })) }; }
  function nextPending(q) { return q.pages.find(p => p.status === 'pending') || null; }
  function retryFailed(q) { q.pages.forEach(p => { if (p.status === 'failed') { p.status = 'pending'; p.error = ''; /* keep image for re-decompose */ } }); return q; }
  function canRedecompose(page) { return !!(page && page.image && page.status !== 'running'); }
  /** Queue one page to re-decompose only (no new NAI call). */
  function queueRedecompose(q, i) {
    const p = q.pages[i];
    if (!p || !p.image) return false;
    p.status = 'pending'; p.error = ''; p.redecomposeOnly = true;
    return true;
  }
  function summary(q) { const c = s => q.pages.filter(p => p.status === s).length; return { total: q.pages.length, done: c('done'), failed: c('failed'), pending: c('pending'), running: c('running') }; }

  const api = Object.freeze({
    parseStory, buildPlan, enrichPages, summarizePurpose, pageBeats, toLintPages, lintStory,
    castOf, applyPresets, presetsFromBible, mergePresets,
    makeQueue, nextPending, retryFailed, canRedecompose, queueRedecompose, summary
  });
  root.StoryModeCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

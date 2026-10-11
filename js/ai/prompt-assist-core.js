/* Prompt assist core (1.6, optional): offline Danbooru tag index + NAI V4/V4.5 prompt rules + LLM polish template.
 * Prompt-writing rules and the PROMPT/CHARACTER/UC output format are ported (cleaned up, persona and bot-specific
 * defaults removed) from the author's own MIT project h1neolzr7f/astrbot-plugin-nai5-mutsumi (skill/SKILL.md,
 * references/通用写法.md, references/坐标约定.md). Content-neutral: nothing is filtered or rewritten except by the
 * LLM the user configured, and only after the user reviews a diff. Pure; unit-tested in Node. */
(function (root) {
  'use strict';
  const CAT = { 0: 'general', 1: 'artist', 3: 'copyright', 4: 'character', 5: 'meta' };
  const QUALITY = /^(?:masterpiece|best quality|very aesthetic|aesthetic|absurdres|highres|high complexity|ultra complexity|no text|amazing quality|great quality|good quality|normal quality)$/i;
  const COUNT = /^(?:\d+\+?(?:girl|boy|other)s?|solo|multiple (?:girls|boys)|no humans)$/i;

  function splitCsvLine(line) {   // tag,category,count,"alias1,alias2"
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur); return out;
  }
  const human = t => String(t || '').trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
  /** Build an index from the tagcomplete danbooru.csv text. */
  function buildIndex(csv, opts) {
    const minCount = (opts && opts.minCount) || 0;
    const tags = [], byName = new Map(), alias = new Map();
    for (const line of String(csv || '').split(/\r?\n/)) {
      if (!line) continue; const [t, c, n, a] = splitCsvLine(line); const count = +n || 0; if (count < minCount) continue;
      const name = human(t); if (!name || byName.has(name)) continue;
      const rec = { name, cat: CAT[+c] || 'general', count }; byName.set(name, rec); tags.push(rec);
      if (a) for (const x of a.split(',')) { const k = human(x); if (k && !k.startsWith('/') && !alias.has(k)) alias.set(k, name); }
    }
    tags.sort((x, y) => y.count - x.count);
    return { tags, byName, alias, size: tags.length };
  }
  /** Autocomplete: prefix matches first (by popularity), then word-start/substring; aliases resolve to canonical. */
  function complete(ix, q, limit, cat) {
    const s = human(q); if (!ix || s.length < 1) return [];
    limit = limit || 10; const out = [], seen = new Set();
    const push = (rec, via) => { if (rec && !seen.has(rec.name) && (!cat || rec.cat === cat)) { seen.add(rec.name); out.push(via ? Object.assign({ via }, rec) : rec); } };
    for (const r of ix.tags) { if (out.length >= limit) break; if (r.name.startsWith(s)) push(r); }
    if (out.length < limit) for (const [k, v] of ix.alias) { if (out.length >= limit) break; if (k.startsWith(s)) push(ix.byName.get(v), k); }
    if (out.length < limit && s.length >= 3) for (const r of ix.tags) { if (out.length >= limit) break; if (r.name.includes(' ' + s) || r.name.includes(s)) push(r); }
    return out;
  }
  /** Split a prompt into tags, keeping NAI weight syntax (1.2::tag::, {tag}, [tag]) and text: "..." intact. */
  function splitTags(p) {
    const out = []; let cur = '', q = false;
    for (const ch of String(p || '')) { if (ch === '"') q = !q; if ((ch === ',' || ch === '\n') && !q) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += ch; }
    if (cur.trim()) out.push(cur.trim()); return out;
  }
  function core(tag) { return human(String(tag).replace(/^-?\d+(?:\.\d+)?::|::$/g, '').replace(/^[{[(]+|[}\])]+$/g, '').replace(/:\d+(?:\.\d+)?$/, '')); }
  /** Check tags against the index: canonical aliases, unknown tags (sentences and text: "..." are allowed). */
  function validate(ix, prompt) {
    const res = { known: 0, aliases: [], unknown: [], characters: [] };
    for (const t of splitTags(prompt)) {
      const c = core(t); if (!c || /^text\s*:/.test(c) || c.split(' ').length > 5 || /^(character|source#|target#|mutual#)/.test(c)) continue;
      if (ix.byName.has(c)) { res.known++; if (ix.byName.get(c).cat === 'character') res.characters.push(c); }
      else if (ix.alias.has(c)) res.aliases.push({ from: c, to: ix.alias.get(c) });
      else res.unknown.push(c);
    }
    return res;
  }
  /** Apply alias fixes in place (keeps weights/brackets). */
  function fixAliases(ix, prompt) {
    return splitTags(prompt).map(t => { const c = core(t); const to = ix.alias.get(c); return to && !ix.byName.has(c) ? t.replace(new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[ _]'), 'i'), to) : t; }).join(', ');
  }
  /** NAI5 ordering rule: count tags first, quality tags last, everything else keeps its order. */
  function order(prompt) {
    const tags = splitTags(prompt); const first = tags.filter(t => COUNT.test(core(t))), last = tags.filter(t => QUALITY.test(core(t)));
    return first.concat(tags.filter(t => !first.includes(t) && !last.includes(t)), last).join(', ');
  }
  /** Library character -> best character tag(s) (character category), searched by name and aliases. */
  function characterTags(ix, name, limit) {
    const s = human(name); if (!s) return [];
    const exact = ix.byName.get(s); if (exact && exact.cat === 'character') return [exact];
    const a = ix.alias.get(s); if (a && ix.byName.get(a).cat === 'character') return [ix.byName.get(a)];
    return complete(ix, s, limit || 5, 'character');
  }
  // A–E = left->right, 1–5 = top->bottom (ported from 坐标约定.md)
  function posToCenter(pos) { const m = /^([A-Ea-e])([1-5])$/.exec(String(pos || '').trim()); if (!m) return null; return { x: +((m[1].toUpperCase().charCodeAt(0) - 65) * 0.2 + 0.1).toFixed(1), y: +((+m[2] - 1) * 0.2 + 0.1).toFixed(1) }; }

  const RULES = [
    'You write prompts for NovelAI V4/V4.5 (anime image model). Rewrite or expand the user\'s draft into a better prompt.',
    'Rules (NAI5 prompt skill):',
    '- Use standard Danbooru tags (lowercase, spaces instead of underscores). Count tags (1girl, 2girls, 1boy, solo) appear ONCE at the start of PROMPT.',
    '- PROMPT holds composition, camera, count, interaction, action, scene, lighting; use short English sentences only for spatial relations, ongoing actions and lighting direction.',
    '- Each character gets its own CHARACTER line with its real Danbooru character tag (e.g. "togawa sakiko"), then girl/boy, then appearance/outfit. Do not repeat appearance in PROMPT. For known copyright characters do not list their default hair/eye colours or outfit unless the user changes them.',
    '- Interactions use Character 1 / Character 2 in PROMPT; optional prefixes source#, target#, mutual# in CHARACTER lines.',
    '- Quality tags go on the last line of PROMPT (e.g. best quality, very aesthetic, absurdres).',
    '- Text drawn in the image uses text: "..." (short, readable, no gibberish).',
    '- Weights: 1.2::tag:: to strengthen, 0.5::tag:: to weaken. Do not add weights unless helpful.',
    '- Keep every concept the user asked for; do not add or remove themes on your own, do not moralise, do not add disclaimers.',
    '- Never sexualise minors: if a request combines sexual content with characters who are or look like children, keep all characters clearly adult or drop the sexual content.',
    'Output exactly this plain-text format, nothing else:',
    'PROMPT:\n<tags and short sentences>\n\nCHARACTER:\n1|C3| <character tag>, girl, <details>\n\nUC:\n<negative tags, may be empty>',
    'CHARACTER lines are optional; position A1–E5 (A–E left->right, 1–5 top->bottom) is optional.',
  ].join('\n');
  /** OpenAI-compatible chat messages for polish ('polish' keeps length, 'expand' adds detail). */
  function messages(draft, ctx) {
    ctx = ctx || {};
    const lines = ['Mode: ' + (ctx.mode === 'expand' ? 'EXPAND (add concrete detail: camera, pose, setting, lighting)' : 'POLISH (fix tags and order, keep it about the same length)'),
      'Use: ' + (ctx.use || 'manga panel'), ctx.characters && ctx.characters.length ? 'Known characters: ' + ctx.characters.map(c => c.name + (c.tags ? ' = ' + c.tags : '')).join('; ') : '',
      ctx.style ? 'Style tags to keep: ' + ctx.style : '', 'Draft:\n' + String(draft || '').trim()].filter(Boolean);
    return [{ role: 'system', content: RULES }, { role: 'user', content: lines.join('\n') }];
  }
  /** Parse PROMPT / CHARACTER / UC blocks (also tolerates CHARACTER1: style and code fences). */
  function parse(text) {
    const t = String(text || '').replace(/```[a-z]*\n?|```/gi, '');
    const block = name => { const m = new RegExp('(?:^|\\n)\\s*' + name + '\\s*:\\s*\\n?([\\s\\S]*?)(?=\\n\\s*(?:PROMPT|CHARACTER\\d*|UC|SIZE)\\s*:|$)', 'i').exec(t); return m ? m[1].trim() : ''; };
    const prompt = block('PROMPT').replace(/\n+/g, ', ').replace(/,\s*,/g, ',').trim();
    const characters = [];
    const chBlock = block('CHARACTER'); const lines = chBlock ? chBlock.split('\n') : [];
    for (const m of t.matchAll(/(?:^|\n)\s*CHARACTER(\d+)\s*:\s*(.+)/gi)) lines.push(m[1] + '| ' + m[2]);
    for (const l of lines) { const m = /^\s*(\d+)\s*\|(?:\s*([A-Ea-e][1-5])\s*\|)?\s*(.+)$/.exec(l); if (m) characters.push({ prompt: m[3].trim(), position: m[2] ? m[2].toUpperCase() : '', center: posToCenter(m[2]) }); }
    return { prompt: prompt || (t.trim() && !/PROMPT\s*:/i.test(t) ? t.trim() : ''), characters, uc: block('UC').replace(/\n+/g, ', ').trim() };
  }
  /** Tag-level diff for review: [{tag, op: 'same'|'add'|'del'}]. */
  function diff(a, b) {
    const A = splitTags(a), B = splitTags(b), ka = new Set(A.map(core)), kb = new Set(B.map(core));
    return A.filter(t => !kb.has(core(t))).map(tag => ({ tag, op: 'del' })).concat(B.map(tag => ({ tag, op: ka.has(core(tag)) ? 'same' : 'add' })));
  }
  root.PromptAssistCore = Object.freeze({ buildIndex, complete, splitTags, validate, fixAliases, order, characterTags, posToCenter, messages, parse, diff, RULES,
    SOURCE: Object.freeze({ url: 'https://raw.githubusercontent.com/DominikDoom/a1111-sd-webui-tagcomplete/4170882f90b47be130a0ff9314f663c230b9153d/tags/danbooru.csv', sha256: 'f936684fa0b041e9a55d35f2052588e28d95eef8672be6829241f8b1a7214732', bytes: 3518020 }) });
})(typeof window !== 'undefined' ? window : globalThis);

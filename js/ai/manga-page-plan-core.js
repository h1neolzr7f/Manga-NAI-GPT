/* Page-plan rules (pure; unit-tested in Node). Own implementation of common storyboard practice:
 * per-page purpose sentence, one moment per panel, page cast type, 6-page layout rhythm,
 * genre layout templates, margin/bleed options, bubble vocabulary, style presets, QA scoring,
 * planned-vs-actual panel record. */
(function (root) {
  'use strict';
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  const REGULAR = ['R1', 'R2', 'A1', 'A2', 'A3'], IRREGULAR = ['X1', 'X2', 'X3'], SPLASH = ['S'];
  const LAYOUTS = REGULAR.concat(IRREGULAR, SPLASH);
  const family = code => code && code[0] === 'X' ? 'X' : code === 'S' ? 'S' : 'R';

  /** Genre rhythm templates (our own summary). */
  const GENRES = {
    yonkoma: { name: '四格', layouts: ['R1'], panels: [4, 4], sentence: 'four equal stacked panels, setup, development, twist, punchline' },
    action: { name: '热血动作', layouts: ['X1', 'X2', 'A1'], panels: [3, 5], sentence: 'one dominant panel over half the page, at least two slanted borders, speed lines' },
    mystery: { name: '悬疑', layouts: ['R1', 'A2'], panels: [3, 5], sentence: 'wide horizontal panels, tight close-ups on eyes and shadows' },
    shojo: { name: '少女', layouts: ['X2', 'X3', 'A2'], panels: [3, 5], sentence: 'decorative borders, characters overlapping the panel edges, soft backgrounds' },
    daily: { name: '日常', layouts: ['R1', 'R2', 'A3'], panels: [3, 5], sentence: 'regular horizontal tiers, two calm beats then a contrast beat' },
    comedy: { name: '喜剧', layouts: ['R2', 'A3'], panels: [5, 7], sentence: 'many square panels, deformed reaction faces for the punchline' },
  };
  /** Margin / bleed options -> frame sentence for the page prompt. */
  const MARGINS = {
    enclosed: { name: '四周留白', frame: 'black panel borders, even white margins on all sides, white gutters' },
    'bleed-tb': { name: '天地出血', frame: 'panels touch the top and bottom page edges, narrow white gutters, black panel borders' },
    'full-bleed': { name: '全出血', frame: 'borderless panels bleeding to every page edge, separated by thin white lines' },
    'black-line': { name: '黑线分隔', frame: 'panels separated only by thick black lines, no white gutters' },
    flashback: { name: '回忆（黑格间）', frame: 'black page margins and black gutters around the panels' },
  };
  /** Text markup -> bubble kind / direction. 「」speech, *…* thought, 【】 sfx, {} narration. */
  function parseLine(raw) {
    let t = clean(raw), kind = 'speech', direction = 'vertical', shout = false;
    if (/^\*.*\*$/.test(t)) { kind = 'thought'; t = t.slice(1, -1); }
    else if (/^【.*】$/.test(t)) { kind = 'sfx'; t = t.slice(1, -1); }
    else if (/^\{.*\}$/.test(t)) { kind = 'narration'; direction = 'horizontal'; t = t.slice(1, -1); }
    else if (/^[「『].*[」』]$/.test(t)) t = t.slice(1, -1);
    if (/[!！]{2,}$/.test(t)) shout = true;
    return { kind, direction, shout, text: t.trim() };
  }
  const BUBBLE_WORDS = { speech: 'white speech bubble', thought: 'cloud-shaped thought bubble', sfx: 'hand-drawn sound effect lettering without a bubble', narration: 'rectangular narration box' };
  /** Bubble shape vocabulary for special speakers. */
  const BUBBLE_SHAPES = {
    distant: 'dashed-outline speech bubble', phone: 'rectangular speech bubble for a voice from a phone', offscreen: 'speech bubble at the panel edge with its tail pointing outside the panel',
    crowd: 'tailless speech bubbles', joined: 'two connected speech bubbles sharing one tail', shout: 'spiky burst speech bubble',
  };
  /** Style presets (own tags). Negatives never list what a comic page needs (text, bubbles, panels). */
  const STYLES = {
    bw: { positive: 'manga, monochrome, greyscale, screentone, clean bold lineart', negative: 'color, colorful, painted, watercolor, lowres, worst quality, bad anatomy, jpeg artifacts' },
    color: { positive: 'manga, full color, cel shading, consistent lighting, clean lineart', negative: 'monochrome, greyscale, lowres, worst quality, bad anatomy, jpeg artifacts' },
  };
  const NEEDED = /\b(text|speech bubbles?|comic|panels?|borders?|frames?|4koma|screentone|gutters?)\b/i;
  /** Drop negative tags that conflict with the page (keeps 'english text' style exclusions). */
  function deconflictNegative(neg, mode) {
    return String(neg || '').split(',').map(clean).filter(Boolean).filter(t => {
      if (/^(english|latin) text$/i.test(t) || /watermark|signature|prompt text|frame labels|panel numbers/i.test(t)) return true;
      if (NEEDED.test(t)) return false;
      if (mode === 'bw' && /^(monochrome|greyscale|grayscale)$/i.test(t)) return false;
      return true;
    }).join(', ');
  }
  const MULTI_MOMENT = /(然后|接着|随后|之后|and then|then\b|after that)/i;
  /** Lint a multi-page plan. pages: [{purpose, layout, cast:[names], panels:[{description, shot, lines:[...], fullBody}], signature:{...}}] */
  function lintPlan(pages, opts) {
    opts = opts || {};
    const errors = [], warnings = [], tag = i => '第 ' + (i + 1) + ' 页';
    (pages || []).forEach((p, i) => {
      if (!clean(p.purpose)) errors.push(tag(i) + '缺少「这页必须让读者看懂什么」一句。');
      if (p.layout && LAYOUTS.indexOf(p.layout) < 0) errors.push(tag(i) + '版式代号 ' + p.layout + ' 不认识。');
      const panels = p.panels || [];
      if (p.layout === 'S' && panels.length !== 1) errors.push(tag(i) + '单格页（S）只能有 1 格。');
      if (p.layout !== 'S' && (panels.length < 2 || panels.length > 4)) warnings.push(tag(i) + '有 ' + panels.length + ' 格，常规页建议 2–4 格。');
      const cast = Array.from(new Set((p.cast || []).map(clean).filter(Boolean)));
      const type = cast.length <= 1 ? 'SOLO' : 'BOTH';
      if (p.pageType && p.pageType !== type) errors.push(tag(i) + '页型标为 ' + p.pageType + '，但本页人物有 ' + cast.length + ' 个。');
      if (cast.length > 2) warnings.push(tag(i) + '主要人物 ' + cast.length + ' 个，建议不超过 2 个。');
      panels.forEach((q, k) => {
        const where = tag(i) + '第 ' + (k + 1) + ' 格';
        if (MULTI_MOMENT.test(q.description || '')) warnings.push(where + '像是写了多个时刻（含「然后/接着」），一格只放一个瞬间。');
        const lines = q.lines || [];
        if (lines.length > 2) warnings.push(where + '有 ' + lines.length + ' 个气泡，建议 0–2 个。');
        lines.forEach(l => { const n = Array.from(parseLine(l).text).length; if (n > 30) warnings.push(where + '有一句 ' + n + ' 字，超过 30 字的气泡很难放下。'); });
        (q.cast || []).forEach(c => { if (cast.length && cast.indexOf(clean(c)) < 0) errors.push(where + '出现了本页人物表以外的 ' + c + '（整页 caption 会影响所有格）。'); });
      });
      if (panels.length >= 2 && new Set(panels.map(q => q.shot).filter(Boolean)).size === 1) warnings.push(tag(i) + '所有格景别相同，建议至少两种。');
    });
    // Six-page rhythm windows.
    const codes = (pages || []).map(p => p.layout).filter(Boolean);
    for (let s = 0; s + 6 <= codes.length; s++) {
      const w = codes.slice(s, s + 6), fam = w.map(family);
      const name = '第 ' + (s + 1) + '–' + (s + 6) + ' 页';
      if (fam.indexOf('R') < 0) warnings.push(name + '没有规整页（R/A）。');
      if (fam.indexOf('X') < 0) warnings.push(name + '没有异形页（X）。');
      if (new Set(w).size < 3) warnings.push(name + '只用了 ' + new Set(w).size + ' 种版式，建议至少 3 种。');
    }
    for (let k = 2; k < codes.length; k++) if (codes[k] === codes[k - 1] && codes[k] === codes[k - 2]) warnings.push('第 ' + (k - 1) + '–' + (k + 1) + ' 页连续 3 页同一版式 ' + codes[k] + '。');
    for (let k = 1; k < (pages || []).length; k++) {
      const a = pages[k - 1].signature, b = pages[k].signature;
      if (a && b) { const keys = Array.from(new Set(Object.keys(a).concat(Object.keys(b)))); const changed = keys.filter(x => a[x] !== b[x]).length; if (changed < 2) warnings.push('第 ' + k + '、' + (k + 1) + ' 页视觉签名只有 ' + changed + ' 项变化，建议至少 2 项。'); }
    }
    const fullBody = (pages || []).reduce((n, p) => n + (p.panels || []).filter(q => q.fullBody || /full body/i.test(q.description || '')).length, 0);
    const quota = opts.fullBodyQuota == null ? Math.max(1, Math.ceil((pages || []).length / 6)) : opts.fullBodyQuota;
    if (fullBody > quota) warnings.push('全身镜头 ' + fullBody + ' 格，超过配额 ' + quota + '。');
    return { ok: !errors.length, errors, warnings };
  }
  /** Five-item QA scoring (each 0–2): pass = total ≥ 8, no zero, no blocker. */
  const QA_ITEMS = [['story', '叙事清楚'], ['camera', '镜头与动作'], ['focus', '版面焦点'], ['emotion', '人物情绪'], ['flow', '阅读承接']];
  const QA_BLOCKERS = [['action', '缺关键动作'], ['character', '角色画错'], ['speaker', '台词归属错'], ['legible', '字不可读'], ['continuity', '连续性断裂']];
  function scoreQA(scores, blockers) {
    const vals = QA_ITEMS.map(([k]) => Math.max(0, Math.min(2, Math.round(+((scores || {})[k]) || 0))));
    const total = vals.reduce((a, b) => a + b, 0), zeros = QA_ITEMS.filter((_, i) => vals[i] === 0).map(x => x[1]);
    const blocked = QA_BLOCKERS.filter(([k]) => (blockers || {})[k]).map(x => x[1]);
    return { total, pass: total >= 8 && !zeros.length && !blocked.length, zeros, blocked };
  }
  /** Planned vs actual panel record for one generated page. */
  function panelRecord(planned, detected, extra) {
    const p = Math.max(0, planned | 0), d = Math.max(0, detected | 0);
    return Object.assign({ planned: p, actual: d, match: p === d, status: 'generated', at: new Date().toISOString() }, extra || {});
  }
  const STATUSES = ['planned', 'generated', 'visual_reviewed', 'lettering_reviewed', 'accepted'];
  const api = Object.freeze({ LAYOUTS, GENRES, MARGINS, BUBBLE_WORDS, BUBBLE_SHAPES, STYLES, QA_ITEMS, QA_BLOCKERS, STATUSES, parseLine, deconflictNegative, lintPlan, scoreQA, panelRecord, family });
  root.MangaPagePlanCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* Shared page layout table (own geometry). One source for every route that builds a page:
 * 画一页漫画 (task-launcher), story → manga, ScenePlan apply, full-page prompt positions.
 * Rects are fractions of the inner page [x, y, w, h]; cells() returns pixel rects in reading order. */
(function (root) {
  'use strict';
  // code → template. Panels sized differently on purpose; the main panel is not always the first read.
  const T = {
    S1: { code: 'S', n: 1, r: [[0, 0, 1, 1]] },
    R1_2: { code: 'R1', n: 2, r: [[0, 0, 1, .5], [0, .5, 1, .5]] },
    A1_2: { code: 'A1', n: 2, r: [[0, 0, 1, .36], [0, .36, 1, .64]] },
    L3: { code: 'A1', n: 3, r: [[0, 0, 1, .42], [0, .42, .5, .58], [.5, .42, .5, .58]] },
    A1_3: { code: 'A1', n: 3, r: [[.5, 0, .5, .36], [0, 0, .5, .36], [0, .36, 1, .64]] },
    A2_3: { code: 'A2', n: 3, r: [[.52, 0, .48, 1], [0, 0, .52, .45], [0, .45, .52, .55]] },
    R1_3: { code: 'R1', n: 3, r: [[0, 0, 1, .3], [0, .3, 1, .36], [0, .66, 1, .34]] },
    L4: { code: 'A3', n: 4, r: [[0, 0, 1, .3], [0, .3, .55, .35], [.55, .3, .45, .35], [0, .65, 1, .35]] },
    R2_4: { code: 'R2', n: 4, r: [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]] },
    A3_4: { code: 'A3', n: 4, r: [[.38, 0, .62, .48], [0, 0, .38, .48], [.62, .48, .38, .52], [0, .48, .62, .52]] },
    A1_4: { code: 'A1', n: 4, r: [[.5, 0, .5, .28], [0, 0, .5, .28], [0, .28, 1, .46], [0, .74, 1, .26]] },
    L5: { code: 'A3', n: 5, r: [[0, 0, 1, .3], [0, .3, .5, .36], [.5, .3, .5, .36], [0, .66, .6, .34], [.6, .66, .4, .34]] },
    A2_5: { code: 'A2', n: 5, r: [[.5, 0, .5, .3], [0, 0, .5, .3], [.45, .3, .55, .7], [0, .3, .45, .35], [0, .65, .45, .35]] },
    L6: { code: 'R2', n: 6, r: [[0, 0, .5, .33], [.5, 0, .5, .33], [0, .33, .5, .34], [.5, .33, .5, .34], [0, .67, .5, .33], [.5, .67, .5, .33]] },
    A3_6: { code: 'A3', n: 6, r: [[.4, 0, .6, .3], [0, 0, .4, .3], [0, .3, 1, .34], [.55, .64, .45, .36], [.25, .64, .3, .36], [0, .64, .25, .36]] },
  };
  // Per count: first = the long-standing default of 画一页漫画 (kept so existing pages do not change).
  const BY_COUNT = { 1: ['S1'], 2: ['R1_2', 'A1_2'], 3: ['L3', 'A1_3', 'A2_3', 'R1_3'], 4: ['L4', 'R2_4', 'A3_4', 'A1_4'], 5: ['L5', 'A2_5'], 6: ['L6', 'A3_6'] };
  const GENRE_CODES = { yonkoma: ['R1'], action: ['A1', 'A2'], mystery: ['R1', 'A2'], shojo: ['A2', 'A3'], daily: ['R1', 'R2', 'A3'], comedy: ['R2', 'A3'] };

  function clampN(n) { return Math.max(1, Math.min(6, Math.round(Number(n) || 1))); }
  /** Candidate template ids for a panel count, genre-preferred first. */
  function options(n, genre) {
    const ids = BY_COUNT[clampN(n)].slice(), pref = GENRE_CODES[genre] || [];
    if (!pref.length) return ids;
    return ids.filter(id => pref.indexOf(T[id].code) >= 0).concat(ids.filter(id => pref.indexOf(T[id].code) < 0));
  }
  /** Pick a template: explicit code/id, else genre preference, avoiding a code used on the last 2 pages (H§5.3 no 3 in a row). */
  function pick(n, opts) {
    opts = opts || {};
    const ids = options(n, opts.genre);
    if (opts.id && T[opts.id] && T[opts.id].n === clampN(n)) return opts.id;
    if (opts.code) { const hit = ids.find(id => T[id].code === opts.code); if (hit) return hit; }
    const recent = (opts.recent || []).slice(-2);
    if (recent.length === 2 && recent[0] === recent[1]) { const alt = ids.find(id => T[id].code !== recent[1]); if (alt) return alt; }
    return ids[0];
  }
  function order(rects, dir) {
    if (root.BalloonLayoutCore && root.BalloonLayoutCore.readingOrder) return root.BalloonLayoutCore.readingOrder(rects, dir);
    const rtl = dir !== 'ltr';
    return rects.map((r, i) => i).sort((a, b) => { const A = rects[a], B = rects[b]; return Math.abs(A.y - B.y) > 1 ? A.y - B.y : (rtl ? B.x - A.x : A.x - B.x); });
  }
  function posName(r) {
    const cy = r.y + r.h / 2, cx = r.x + r.w / 2;
    if (r.w >= .99 && r.h >= .99) return 'full-page';
    const v = r.h >= .9 ? 'full-height' : cy < .34 ? 'top' : cy > .66 ? 'bottom' : 'middle';
    const h = r.w >= .9 ? 'wide' : (cx > .35 && cx < .65) ? 'center' : cx >= .5 ? 'right' : 'left';
    return v + ' ' + h;
  }
  /** cells(n, {width, height, margin, gap, dir, genre, code, id, recent}) → {id, code, cells:[{x,y,width,height,position,area}]} in reading order. */
  function cells(n, opts) {
    opts = opts || {};
    const id = pick(n, opts), t = T[id], W = Number(opts.width) || 1000, H = Number(opts.height) || 1400;
    const s = Math.min(W, H), m = opts.margin != null ? opts.margin : .04 * s, g = opts.gap != null ? opts.gap : .012 * s;
    const iw = W - 2 * m, ih = H - 2 * m;
    const px = t.r.map(c => ({ x: Math.round(m + c[0] * iw + g / 2), y: Math.round(m + c[1] * ih + g / 2), width: Math.round(c[2] * iw - g), height: Math.round(c[3] * ih - g), position: posName({ x: c[0], y: c[1], w: c[2], h: c[3] }), area: +(c[2] * c[3]).toFixed(3) }));
    const ord = order(px.map(c => ({ x: c.x, y: c.y, w: c.width, h: c.height })), opts.dir || 'rtl');
    return { id, code: t.code, cells: ord.map(i => px[i]) };
  }
  /** Legacy uniform grid (story → manga / ScenePlan before v2): kept bit-identical, table order. */
  function grid(n, W, H) {
    const count = Math.max(1, Number(n) || 1), width = Number(W) || 1000, height = Number(H) || 1400;
    const cols = count === 1 ? 1 : (count <= 4 ? 2 : 3), rows = Math.ceil(count / cols), margin = 36, gap = 18;
    const cellW = (width - margin * 2 - gap * (cols - 1)) / cols, cellH = Math.max(40, (height - margin * 2 - gap * (rows - 1)) / rows), out = [];
    for (let i = 0; i < count; i++) out.push({ x: margin + (i % cols) * (cellW + gap), y: margin + Math.floor(i / cols) * (cellH + gap), width: cellW, height: cellH });
    return { cols, rows, cells: out };
  }
  /** Varied, code-based layouts for story → manga / ScenePlan and layout rotation in 画一页漫画.
   * Default ON after the user's blind pick (new 5 / old 0 / same 1); opt out with localStorage mnai.layoutV2 = '0'. */
  function v2Enabled() { try { return !(root.localStorage && root.localStorage.getItem('mnai.layoutV2') === '0'); } catch (e) { return true; } }
  root.PageLayoutCore = Object.freeze({ TEMPLATES: T, BY_COUNT, options, pick, cells, posName, grid, v2Enabled });
})(typeof window !== 'undefined' ? window : globalThis);

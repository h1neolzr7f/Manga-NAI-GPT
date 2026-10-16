/* 2.0 #3 reading order + automatic speech-balloon placement (pure, unit-tested; CPU, no model needed).
 * Ideas: Kurlander et al. "Comic Chat" (SIGGRAPH 1996) balloon rules (above/near the speaker, reading order,
 * no occlusion), Chun et al. "Automatic speech balloon placement" (2006) cost search, manga right-to-left
 * order as in Magi (arXiv:2401.10224). Faces come from the local face detector when installed; otherwise only
 * artwork detail (gradient + ink energy) is avoided. */
(function (root) {
  'use strict';
  const area = r => Math.max(0, r.w) * Math.max(0, r.h);
  function inter(a, b) { const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); return w > 0 && h > 0 ? w * h : 0; }
  const R = r => Array.isArray(r) ? { x: r[0], y: r[1], w: r[2] - r[0], h: r[3] - r[1] } : r;

  /** Panel reading order: rows top->bottom; inside a row, columns right->left (rtl) or left->right, top->bottom in a column. */
  function readingOrder(rects, dir) {
    const rtl = dir !== 'ltr';
    const items = rects.map((r, i) => ({ i, r: R(r) })).sort((a, b) => a.r.y - b.r.y || (rtl ? b.r.x - a.r.x : a.r.x - b.r.x));
    const rows = [];
    for (const it of items) {
      const row = rows.find(rw => { const ov = Math.min(rw.y1, it.r.y + it.r.h) - Math.max(rw.y0, it.r.y); return ov >= 0.5 * Math.min(it.r.h, rw.minH); });
      if (row) { row.list.push(it); row.y0 = Math.min(row.y0, it.r.y); row.y1 = Math.max(row.y1, it.r.y + it.r.h); row.minH = Math.min(row.minH, it.r.h); }
      else rows.push({ y0: it.r.y, y1: it.r.y + it.r.h, minH: it.r.h, list: [it] });
    }
    rows.sort((a, b) => a.y0 - b.y0);
    const out = [];
    for (const row of rows) {
      const cols = [];
      for (const it of row.list) {
        const col = cols.find(c => { const ov = Math.min(c.x1, it.r.x + it.r.w) - Math.max(c.x0, it.r.x); return ov >= 0.5 * Math.min(it.r.w, c.minW); });
        if (col) { col.list.push(it); col.x0 = Math.min(col.x0, it.r.x); col.x1 = Math.max(col.x1, it.r.x + it.r.w); col.minW = Math.min(col.minW, it.r.w); }
        else cols.push({ x0: it.r.x, x1: it.r.x + it.r.w, minW: it.r.w, list: [it] });
      }
      cols.sort((a, b) => rtl ? b.x1 - a.x1 : a.x0 - b.x0);
      for (const c of cols) c.list.sort((a, b) => a.r.y - b.r.y).forEach(it => out.push(it.i));
    }
    return out;
  }

  /** Detail energy per cell (0..1): luminance gradient + ink darkness; integral image for O(1) rectangle means. */
  function energyMap(rgba, W, H, cell) {
    cell = cell || Math.max(4, Math.round(Math.max(W, H) / 200));
    const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
    const lum = (x, y) => { const i = (y * W + x) * 4; return (rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114) / 255; };
    const e = new Float32Array(cols * rows);
    for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
      let s = 0, n = 0;
      const x0 = cx * cell, y0 = cy * cell, x1 = Math.min(W - 1, x0 + cell), y1 = Math.min(H - 1, y0 + cell);
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
        const l = lum(x, y); s += Math.min(1, Math.abs(l - lum(Math.min(W - 1, x + 2), y)) * 3 + Math.abs(l - lum(x, Math.min(H - 1, y + 2))) * 3) * 0.7 + (1 - l) * 0.3; n++;
      }
      e[cy * cols + cx] = n ? Math.min(1, s / n) : 0;
    }
    const I = new Float64Array((cols + 1) * (rows + 1));
    for (let y = 0; y < rows; y++) { let run = 0; for (let x = 0; x < cols; x++) { run += e[y * cols + x]; I[(y + 1) * (cols + 1) + x + 1] = I[y * (cols + 1) + x + 1] + run; } }
    function mean(r) {
      const x0 = Math.max(0, Math.floor(r.x / cell)), y0 = Math.max(0, Math.floor(r.y / cell)), x1 = Math.min(cols, Math.ceil((r.x + r.w) / cell)), y1 = Math.min(rows, Math.ceil((r.y + r.h) / cell));
      if (x1 <= x0 || y1 <= y0) return 0;
      const s = I[y1 * (cols + 1) + x1] - I[y0 * (cols + 1) + x1] - I[y1 * (cols + 1) + x0] + I[y0 * (cols + 1) + x0];
      return s / ((x1 - x0) * (y1 - y0));
    }
    return { cell, cols, rows, mean };
  }

  /** Reading progress inside a panel: 0 at the start corner (top-right for rtl), 1 at the end. */
  function progress(c, p, rtl) { const fx = (c.x - p.x) / p.w, fy = (c.y - p.y) / p.h; return (rtl ? 1 - fx : fx) * 0.55 + fy * 0.45; }

  /** Place balloons (in reading order) inside one panel. items: [{w, h, speaker?: index into faces}]. */
  function place(panel, items, opts) {
    opts = opts || {};
    const p = R(panel), rtl = opts.dir !== 'ltr';
    const faces = (opts.faces || []).map(R).filter(f => inter(f, p) > 0.3 * area(f));
    const occ = (opts.occupied || []).map(R).slice();
    const m = Math.max(6, Math.min(p.w, p.h) * 0.03), step = Math.max(6, Math.min(p.w, p.h) / 28);
    const out = []; let prevProg = -1;
    items.forEach((it, k) => {
      const w = Math.min(it.w, p.w - 2 * m), h = Math.min(it.h, p.h - 2 * m);
      const target = items.length === 1 ? 0.05 : 0.05 + 0.75 * k / (items.length - 1);
      // it.speaker indexes the page-wide faces list (opts.faces), not the panel-filtered one (audit 51)
      const raw = it.speaker != null && opts.faces && opts.faces[it.speaker] ? R(opts.faces[it.speaker]) : null;
      const sp = raw && inter(raw, p) > 0.3 * area(raw) ? raw : null;
      let best = null;
      for (let y = p.y + m; y <= p.y + p.h - h - m + 0.01; y += step) for (let x = p.x + m; x <= p.x + p.w - w - m + 0.01; x += step) {
        const c = { x, y, w, h }, a = w * h, ctr = { x: x + w / 2, y: y + h / 2 };
        let face = 0, cover = 0;
        for (const f of faces) { const g = { x: f.x - f.w * 0.1, y: f.y - f.h * 0.1, w: f.w * 1.2, h: f.h * 1.2 }; const ov = inter(c, g); face += ov / a; cover = Math.max(cover, ov / area(g)); }
        let o = 0; for (const q of occ) o += inter(c, q) / a;
        const energy = opts.energy ? opts.energy.mean(c) : 0;
        const prog = progress(ctr, p, rtl);
        let cost = 10 * face + (cover > 0.3 ? 20 : 0) + 3 * energy + 40 * o + 1.5 * Math.abs(prog - target) + 0.3 * (y - p.y) / p.h;
        if (prevProg >= 0 && prog < prevProg + 0.04) cost += 3;   // keep the in-panel reading order
        if (sp) { const fc = { x: sp.x + sp.w / 2, y: sp.y + sp.h / 2 }; cost += 1.2 * Math.hypot(ctr.x - fc.x, ctr.y - fc.y) / Math.hypot(p.w, p.h) + (ctr.y > fc.y ? 0.4 : 0); }
        if (!best || cost < best.cost) best = { x, y, w, h, cost, face, energy, overlap: o, prog };
      }
      if (!best) best = { x: p.x + m, y: p.y + m, w, h, cost: Infinity, face: 0, energy: 0, overlap: 0, prog: 0 };
      best.tail = sp ? tail(best, sp) : null;
      out.push(best); occ.push(best); prevProg = best.prog;
    });
    return out;
  }
  /** Tail tip: from the balloon toward the speaker's face, stopping short of it. */
  function tail(b, f) {
    const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 }, t = { x: f.x + f.w / 2, y: f.y + f.h * 0.35 };
    const dx = t.x - c.x, dy = t.y - c.y, d = Math.hypot(dx, dy) || 1;
    const edge = 1 / Math.sqrt((dx / d / (b.w / 2)) ** 2 + (dy / d / (b.h / 2)) ** 2);   // ellipse radius toward t
    // where the ray enters the face box (slab method): the tip stops 6 px before it
    let enter = d;
    { let t0 = 0, t1 = d; const ux = dx / d, uy = dy / d;
      for (const [o, u, lo, hi] of [[c.x, ux, f.x, f.x + f.w], [c.y, uy, f.y, f.y + f.h]]) {
        if (Math.abs(u) < 1e-9) { if (o < lo || o > hi) { t0 = d; } continue; }
        let a = (lo - o) / u, z = (hi - o) / u; if (a > z) [a, z] = [z, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, z);
      }
      if (t0 <= t1) enter = t0; }
    const len = Math.max(0, Math.min(enter - edge - 6, Math.max(b.w, b.h) * 0.45));
    if (len < 8) return null;
    return { x: c.x + dx / d * (edge + len), y: c.y + dy / d * (edge + len), baseX: c.x + dx / d * edge * 0.8, baseY: c.y + dy / d * edge * 0.8 };
  }
  /** Quality numbers for a page: face overlap, balloon overlap, order violations, detail covered. */
  function metrics(placed, faces, energy, dir) {
    const fs = (faces || []).map(R); let faceHit = 0, faceArea = 0, overlap = 0, viol = 0, en = 0;
    placed.forEach((b, i) => {
      for (const f of fs) { const ov = inter(b, f); if (ov > 0.15 * area(f)) faceHit++; faceArea += ov; }
      for (let j = i + 1; j < placed.length; j++) overlap += inter(b, placed[j]);
      if (energy) en += energy.mean(b);
      const nx = placed[i + 1]; if (nx && nx.panel === b.panel && progress({ x: nx.x + nx.w / 2, y: nx.y + nx.h / 2 }, nx.panelRect, dir !== 'ltr') < progress({ x: b.x + b.w / 2, y: b.y + b.h / 2 }, b.panelRect, dir !== 'ltr')) viol++;
    });
    return { balloons: placed.length, facesCovered: faceHit, faceAreaCovered: Math.round(faceArea), balloonOverlap: Math.round(overlap), orderViolations: viol, meanDetail: placed.length ? +(en / placed.length).toFixed(3) : 0 };
  }
  /** Balloon kind from the line's own markup (never printed): 「…」speech, *…* thought, 【…】sound effect, {…} narration;
   * a leading （电话）/（画外）/（远处）/（众人） note picks a phone / off-screen / distant / crowd balloon. */
  function kindOf(raw) {
    let t = String(raw || '').trim(), kind = 'speech';
    const note = /^[（(](电话|手机|广播|画外|门外|远处|远方|众人|大家)[）)]\s*/.exec(t);
    if (note) { t = t.slice(note[0].length); kind = /电话|手机|广播/.test(note[1]) ? 'phone' : /画外|门外/.test(note[1]) ? 'offscreen' : /远/.test(note[1]) ? 'distant' : 'crowd'; }
    if (/^\*[^*]+\*$/.test(t)) { kind = 'thought'; t = t.slice(1, -1); }
    else if (/^【[^】]+】$/.test(t)) { kind = 'sfx'; t = t.slice(1, -1); }
    else if (/^\{[^}]+\}$/.test(t)) { kind = 'narration'; t = t.slice(1, -1); }
    else if (/^[「『][^」』]+[」』]$/.test(t)) t = t.slice(1, -1);
    return { kind, text: t.trim(), tail: !/^(thought|sfx|narration|crowd)$/.test(kind), shape: kind === 'narration' || kind === 'phone' ? 'rect' : kind === 'sfx' ? 'none' : 'ellipse', dashed: kind === 'distant' };
  }
  root.BalloonLayoutCore = Object.freeze({ readingOrder, energyMap, place, tail, metrics, progress, kindOf });
})(typeof window !== 'undefined' ? window : globalThis);

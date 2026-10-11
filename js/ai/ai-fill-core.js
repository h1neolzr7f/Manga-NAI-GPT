/* AI 填充 (2.0 #2) pure helpers: mask geometry, soft edges, prompt, layer metadata. No DOM. */
(function (root) {
  'use strict';
  const META_VERSION = 1, MAX_CANDIDATES = 4;

  /** Bounding box [x0,y0,x1,y1) of mask pixels >= 128, or null. */
  function maskBox(mask, W, H) {
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) { const r = y * W; for (let x = 0; x < W; x++) if (mask[r + x] >= 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
  }

  /** Crop sent to the model: mask box + context (the mask stays <= ~45% of it), min side, clamped to the page. */
  function contextBox(box, W, H, pad, minSide) {
    pad = pad == null ? 0.6 : pad; minSide = minSide || 256;
    const [x0, y0, x1, y1] = box, bw = x1 - x0, bh = y1 - y0;
    let w = Math.max(minSide, Math.round(bw * (1 + pad))), h = Math.max(minSide, Math.round(bh * (1 + pad)));
    w = Math.min(w, W); h = Math.min(h, H);
    let cx = Math.round(x0 + bw / 2 - w / 2), cy = Math.round(y0 + bh / 2 - h / 2);
    cx = Math.max(0, Math.min(W - w, cx)); cy = Math.max(0, Math.min(H - h, cy));
    return { x: cx, y: cy, w, h };
  }

  /** Separable box blur (radius r) of a Float32 w*h field, 2 passes ~ gaussian. */
  function blur(src, w, h, r) {
    if (r < 1) return src;
    let a = src, b = new Float32Array(w * h);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < h; y++) { let s = 0; const o = y * w; for (let x = -r; x <= r; x++) s += a[o + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) { b[o + x] = s / (2 * r + 1); s += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; } }
      const c = new Float32Array(w * h);
      for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += b[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) { c[y * w + x] = s / (2 * r + 1); s += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x]; } }
      a = c;
    }
    return a;
  }

  /** Hard mask (0/255, w*h) -> alpha 0..1: grown by `grow` px, feathered by `feather` px, 1 inside the original. */
  function softMask(mask, w, h, grow, feather) {
    const f = new Float32Array(w * h);
    for (let i = 0; i < f.length; i++) f[i] = mask[i] >= 128 ? 1 : 0;
    let g = f;
    if (grow > 0) { g = blur(f, w, h, Math.round(grow)); for (let i = 0; i < g.length; i++) g[i] = g[i] > 0.02 ? 1 : 0; }
    const s = feather > 0 ? blur(g, w, h, Math.max(1, Math.round(feather / 2))) : g;
    const out = new Float32Array(w * h);
    for (let i = 0; i < out.length; i++) out[i] = f[i] ? 1 : Math.min(1, s[i]);
    return out;
  }

  /** Default grow/feather for a mask box size: thin brush strokes still get a soft edge. */
  function edgeFor(box) { const s = Math.min(box[2] - box[0], box[3] - box[1]); return { grow: Math.max(3, Math.round(s * 0.04)), feather: Math.max(6, Math.round(s * 0.08)) }; }

  /** Panel interiors (frame lines excluded) relative to the crop; [] = no clipping (no panels found). */
  function panelClip(panels, crop, W) {
    const inset = Math.max(4, Math.round(W * 0.005));
    return (panels || []).map(p => [p.x + inset - crop.x, p.y + inset - crop.y, p.w - 2 * inset, p.h - 2 * inset])
      .filter(r => r[2] > 0 && r[3] > 0 && r[0] < crop.w && r[1] < crop.h && r[0] + r[2] > 0 && r[1] + r[3] > 0).slice(0, 24);
  }
  /** alpha *= inside any clip rect (with a 2 px soft edge). Mutates and returns alpha. */
  function applyClip(alpha, w, h, clip) {
    if (!clip || !clip.length) return alpha;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let best = 0;
      for (const [cx, cy, cw, ch] of clip) {
        const d = Math.min(x - cx, y - cy, cx + cw - 1 - x, cy + ch - 1 - y);
        if (d >= 0) { best = Math.max(best, Math.min(1, (d + 1) / 2)); if (best === 1) break; }
      }
      alpha[y * w + x] *= best;
    }
    return alpha;
  }

  function prompt(sentence, hasMaskRef) {
    const want = String(sentence || '').trim().slice(0, 800);
    return [
      want ? '只修改指定区域：' + want : '去掉指定区域里的东西，按周围画面自然补全背景。',
      hasMaskRef ? '第二张参考图是蒙版：白色部分就是要修改的区域，其余部分必须与原图完全一致。' : '',
      '保持原画的画风、线条粗细、网点/上色方式、光照和透视；不要改动区域外的人物、文字、气泡和分镜框；不要加文字或水印。'
    ].filter(Boolean).join('\n');
  }

  /** Validated layer metadata (stored on the fabric object as `aiFill`, saved with the project). */
  function normalizeMeta(m) {
    if (!m || typeof m !== 'object') return null;
    const box = Array.isArray(m.box) && m.box.length === 4 && m.box.every(Number.isFinite) ? m.box.map(Math.round) : null;
    const img = s => typeof s === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(s);
    if (!box || !img(m.mask) || !img(m.source)) return null;
    const cands = (Array.isArray(m.candidates) ? m.candidates : []).filter(img).slice(0, MAX_CANDIDATES);
    return { v: META_VERSION, engine: m.engine === 'lama' ? 'lama' : 'gpt', prompt: String(m.prompt || '').slice(0, 800),
      model: String(m.model || '').slice(0, 80), box, mask: m.mask, source: m.source, candidates: cands,
      chosen: Math.max(0, Math.min(cands.length - 1, m.chosen | 0)), edge: m.edge && Number.isFinite(m.edge.grow) && Number.isFinite(m.edge.feather) ? { grow: m.edge.grow, feather: m.edge.feather } : null,
      clip: (Array.isArray(m.clip) ? m.clip : []).filter(r => Array.isArray(r) && r.length === 4 && r.every(Number.isFinite)).slice(0, 24),
      created: String(m.created || '').slice(0, 40) };
  }

  root.AiFillCore = Object.freeze({ maskBox, contextBox, blur, softMask, edgeFor, prompt, normalizeMeta, panelClip, applyClip, MAX_CANDIDATES });
})(typeof window !== 'undefined' ? window : globalThis);

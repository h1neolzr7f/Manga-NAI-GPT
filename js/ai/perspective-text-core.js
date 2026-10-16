/* Perspective text maths (pure): homography from a w×h rectangle to a quad, point mapping, and a triangle mesh that
 * draws a flat text bitmap into the quad with plain 2D-canvas affine transforms (no WebGL). */
(function (root) {
  'use strict';
  /** 3×3 homography H (row-major, h33=1) with H·src[i] ~ dst[i]; src/dst: 4 points {x,y}. */
  function homography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const { x, y } = src[i], { x: u, y: v } = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = solve(A, b); if (!h) return null;
    return h.concat(1);
  }
  function solve(A, b) {
    const n = b.length, M = A.map((r, i) => r.concat(b[i]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  function map(H, x, y) { const w = H[6] * x + H[7] * y + H[8]; return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w }; }
  /** Affine matrix [a,b,c,d,e,f] (canvas setTransform order) taking triangle s to triangle d. */
  function affine(s, d) {
    const [s0, s1, s2] = s, [d0, d1, d2] = d;
    const den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y); if (Math.abs(den) < 1e-9) return null;
    const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den;
    const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den;
    const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den;
    const dd = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den;
    return [a, b, c, dd, d0.x - a * s0.x - c * s0.y, d0.y - b * s0.x - dd * s0.y];
  }
  /** Draw image (w×h) into quad [tl,tr,br,bl] on ctx through an n×n mesh of affine triangles. */
  function drawWarped(ctx, img, w, h, quad, n) {
    n = n || 8; const H = homography([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], quad); if (!H) return false;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x0 = w * i / n, x1 = w * (i + 1) / n, y0 = h * j / n, y1 = h * (j + 1) / n;
      const S = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], D = S.map(p => map(H, p.x, p.y));
      [[0, 1, 2], [0, 2, 3]].forEach(t => {
        const m = affine(t.map(k => S[k]), t.map(k => D[k])); if (!m) return;
        ctx.save(); ctx.beginPath();
        // grow the clip triangle by ~0.6px so mesh seams do not show
        const cx = (D[t[0]].x + D[t[1]].x + D[t[2]].x) / 3, cy = (D[t[0]].y + D[t[1]].y + D[t[2]].y) / 3;
        t.forEach((k, q) => { const p = D[k], dx = p.x - cx, dy = p.y - cy, L = Math.hypot(dx, dy) || 1, X = p.x + dx / L * 0.6, Y = p.y + dy / L * 0.6; if (q) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
        ctx.closePath(); ctx.clip(); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]); ctx.drawImage(img, 0, 0); ctx.restore();
      });
    }
    return true;
  }
  root.PerspectiveTextCore = Object.freeze({ homography, map, affine, drawWarped });
})(typeof window !== 'undefined' ? window : globalThis);

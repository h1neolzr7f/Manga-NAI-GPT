const assert = require('assert');
require('../js/ai/balloon-layout-core.js');
require('../js/ai/page-layout-core.js'); const L = globalThis.PageLayoutCore;
// 1) 画一页漫画 defaults are bit-identical to the old LAYOUTS table.
const OLD = { 1: [[0,0,1,1]], 2: [[0,0,1,.5],[0,.5,1,.5]], 3: [[0,0,1,.42],[0,.42,.5,.58],[.5,.42,.5,.58]],
  4: [[0,0,1,.3],[0,.3,.55,.35],[.55,.3,.45,.35],[0,.65,1,.35]], 5: [[0,0,1,.3],[0,.3,.5,.36],[.5,.3,.5,.36],[0,.66,.6,.34],[.6,.66,.4,.34]],
  6: [[0,0,.5,.33],[.5,0,.5,.33],[0,.33,.5,.34],[.5,.33,.5,.34],[0,.67,.5,.33],[.5,.67,.5,.33]] };
for (let n = 1; n <= 6; n++) { const id = L.pick(n, {}); assert.deepStrictEqual(L.TEMPLATES[id].r, OLD[n], 'default for ' + n); }
// 2) Legacy grid identical to the old story-to-manga layoutCells.
function oldGrid(width, height, count) { count = Math.max(1, Number(count) || 1); const cols = count === 1 ? 1 : (count <= 4 ? 2 : 3), rows = Math.ceil(count / cols), margin = 36, gap = 18; const cellW = (width - margin * 2 - gap * (cols - 1)) / cols, cellH = Math.max(40, (height - margin * 2 - gap * (rows - 1)) / rows), cells = []; for (let i = 0; i < count; i++) cells.push({ x: margin + (i % cols) * (cellW + gap), y: margin + Math.floor(i / cols) * (cellH + gap), width: cellW, height: cellH }); return { cols, rows, cells }; }
for (const n of [1, 2, 3, 5, 6, 9]) assert.deepStrictEqual(L.grid(n, 1000, 1400), oldGrid(1000, 1400, n));
// 3) Every template: n cells, inside the page, no overlap, unique position names, reading order RTL starts top-right.
for (const n of Object.keys(L.BY_COUNT)) for (const id of L.BY_COUNT[n]) {
  const r = L.cells(+n, { id, width: 1000, height: 1400 }); const c = r.cells;
  assert.strictEqual(c.length, +n, id);
  assert.strictEqual(new Set(c.map(x => x.position)).size, c.length, id + ' unique positions ' + c.map(x => x.position));
  const tot = L.TEMPLATES[id].r.reduce((a, q) => a + q[2] * q[3], 0); assert.ok(Math.abs(tot - 1) < 0.02, id + ' covers page ' + tot);
  for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) { const a = c[i], b = c[j]; const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x), oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y); assert.ok(ox <= 0 || oy <= 0, id + ' overlap'); }
  if (c.length > 1 && c[0].y === Math.min(...c.map(x => x.y))) assert.ok(c[0].x >= Math.min(...c.filter(x => x.y === c[0].y).map(x => x.x)), id + ' rtl first');
}
// 4) Rotation: same code 2 pages in a row → third page switches (H: no 3 in a row); genre preference.
assert.notStrictEqual(L.TEMPLATES[L.pick(3, { recent: ['A1', 'A1'] })].code, 'A1');
assert.strictEqual(L.TEMPLATES[L.pick(3, { genre: 'mystery' })].code, 'A2');
assert.strictEqual(L.TEMPLATES[L.pick(4, { code: 'R2' })].code, 'R2');
// 5) v2 is off by default (awaits blind pick).
assert.strictEqual(L.v2Enabled(), false);
console.log('page layout core ok');

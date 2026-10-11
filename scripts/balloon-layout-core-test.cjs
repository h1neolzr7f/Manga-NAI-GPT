'use strict';
const assert = require('assert');
require('../js/ai/balloon-layout-core.js');
const B = globalThis.BalloonLayoutCore;
// reading order: classic 2x2 grid; tall right panel + two stacked left panels; ltr variant
const grid = [{ x: 0, y: 0, w: 100, h: 100 }, { x: 110, y: 0, w: 100, h: 100 }, { x: 0, y: 110, w: 100, h: 100 }, { x: 110, y: 110, w: 100, h: 100 }];
assert.deepEqual(B.readingOrder(grid, 'rtl'), [1, 0, 3, 2]);
assert.deepEqual(B.readingOrder(grid, 'ltr'), [0, 1, 2, 3]);
const tall = [{ x: 0, y: 0, w: 100, h: 95 }, { x: 0, y: 105, w: 100, h: 95 }, { x: 110, y: 0, w: 100, h: 200 }, { x: 0, y: 210, w: 210, h: 80 }];
assert.deepEqual(B.readingOrder(tall, 'rtl'), [2, 0, 1, 3], 'tall right panel first, then its left column top->bottom, then the wide bottom');
assert.deepEqual(B.readingOrder([[0, 0, 300, 100], [0, 110, 300, 210]], 'rtl'), [0, 1], 'box arrays accepted');
// energy map: busy left half, empty right half
const W = 200, H = 100, px = new Uint8ClampedArray(W * H * 4).fill(255);
for (let y = 0; y < H; y++) for (let x = 0; x < 100; x++) { const v = (x + y) % 4 < 2 ? 0 : 255; px.set([v, v, v, 255], (y * W + x) * 4); }
const E = B.energyMap(px, W, H, 10);
assert(E.mean({ x: 0, y: 0, w: 100, h: 100 }) > 0.5 && E.mean({ x: 100, y: 0, w: 100, h: 100 }) < 0.02, 'detail measured');
// placement: avoids a face and the busy half; first balloon at the reading start (top-right for rtl)
const panel = { x: 0, y: 0, w: 400, h: 300 };
const face = [250, 40, 330, 120];
const one = B.place(panel, [{ w: 100, h: 60 }], { faces: [face], dir: 'rtl' })[0];
assert.equal(one.face, 0, 'does not cover the face');
assert(one.x + one.w / 2 > 200 || one.y < 60, 'near the start corner');
const two = B.place(panel, [{ w: 100, h: 60 }, { w: 100, h: 60 }], { faces: [face], dir: 'rtl' });
assert.equal(two[0].overlap + two[1].overlap, 0, 'balloons do not overlap');
assert(two[1].prog > two[0].prog, 'second balloon later in reading order');
const ltr = B.place(panel, [{ w: 100, h: 60 }], { dir: 'ltr' })[0];
assert(ltr.x < 100, 'ltr starts top-left');
// busy artwork avoided when there is room
const pg = { x: 0, y: 0, w: 200, h: 100 };
const calm = B.place(pg, [{ w: 60, h: 40 }], { energy: E, dir: 'ltr' })[0];
assert(calm.x >= 100, 'goes to the empty half even though ltr prefers the left: ' + calm.x);
// speaker: tail points toward the face, balloon near it, existing text respected
const sp = B.place(panel, [{ w: 100, h: 60, speaker: 0 }], { faces: [[40, 180, 110, 250]], occupied: [{ x: 280, y: 0, w: 120, h: 120 }], dir: 'rtl' })[0];
assert.equal(sp.overlap, 0, 'existing text kept clear');
assert(sp.tail && sp.tail.y > sp.y + sp.h / 2, 'tail points down toward the speaker');
assert(!(sp.tail.x > 40 && sp.tail.x < 110 && sp.tail.y > 180 && sp.tail.y < 250), 'tail tip outside the face box');
for (const [bx, by] of [[0, 300], [300, 0], [0, 0], [300, 300]]) { const t = B.tail({ x: bx, y: by, w: 100, h: 60 }, { x: 150, y: 150, w: 100, h: 100 }); if (t) assert(!(t.x > 150 && t.x < 250 && t.y > 150 && t.y < 250), 'tip outside face from ' + bx + ',' + by); }
assert(Math.hypot(sp.x + 50 - 75, sp.y + 30 - 215) < 260, 'balloon stays near its speaker');
// an old balloon (flat white, zero detail) passed as occupied is respected
const old = B.place(panel, [{ w: 100, h: 60 }], { occupied: [{ x: 250, y: 0, w: 150, h: 120 }], dir: 'rtl' })[0];
assert.equal(old.overlap, 0, 'old balloon kept clear');
// balloon bigger than the panel is clamped, never NaN
const big = B.place({ x: 0, y: 0, w: 80, h: 60 }, [{ w: 300, h: 200 }], {})[0];
assert(Number.isFinite(big.x) && big.w <= 80);
// metrics
const m = B.metrics(two.map(b => Object.assign(b, { panel: 0, panelRect: panel })), [face], null, 'rtl');
assert.deepEqual([m.facesCovered, m.balloonOverlap, m.orderViolations], [0, 0, 0]);
console.log('PASS balloon layout core: reading order (rtl/ltr/tall column), detail map, placement (faces, detail, order, speaker tail, clamp), metrics');

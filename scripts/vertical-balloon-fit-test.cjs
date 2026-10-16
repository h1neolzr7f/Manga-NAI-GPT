// Vertical balloons use a tighter safe-rect and shrink font to fit the panel.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js/ai/balloon-layout.js'), 'utf8');
assert.ok(src.includes('SAFE_W'), 'SAFE_W present');
assert.ok(src.includes('0.74') || src.includes('SAFE_W = 0.74'), 'tighter than 0.62');
assert.ok(!src.includes('/ 0.62'), 'old 0.62 fill removed');
assert.ok(src.includes('maxW') && src.includes('fontSize'), 'fits into panel');

// Core place still clamps item to panel
const c = { console, Math, JSON, Object, Array, Set, Map, Date, Infinity };
c.window = c; c.globalThis = c;
vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(root, 'js/ai/balloon-layout-core.js'), 'utf8'), c);
const B = c.BalloonLayoutCore;
const panel = { x: 0, y: 0, w: 200, h: 300 };
const spots = B.place(panel, [{ w: 180, h: 250 }], { faces: [], dir: 'rtl' });
assert.equal(spots.length, 1);
assert.ok(spots[0].w <= 200 - 12, 'placed width inside panel margins');
assert.ok(spots[0].h <= 300 - 12, 'placed height inside panel margins');
console.log('vertical balloon fit ok');

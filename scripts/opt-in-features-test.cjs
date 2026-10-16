// Opt-in features (all default OFF): sampling profile P, per-character auto negatives, scene-text erase, perspective text.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const c = { console, Math, JSON, Object, Array, Set, Map, Date }; c.window = c; c.globalThis = c; vm.createContext(c);
['js/ai/nai-engine-core.js', 'js/ai/perspective-text-core.js'].forEach(p => vm.runInContext(fs.readFileSync(path.join(root, p), 'utf8'), c));
const N = c.NaiEngineCore, P = c.PerspectiveTextCore;
// defaults unchanged
const d = N.payload({ prompt: 'a', characters: [{ prompt: '1girl, red hair' }, { prompt: '1boy, black hair' }] }).parameters;
assert.equal(d.scale, 5); assert.equal(d.sampler, 'k_euler_ancestral'); assert.equal(d.cfg_rescale, 0);
assert.equal(d.v4_negative_prompt.caption.char_captions[0].char_caption, '');
// profile P
const p = N.payload({ prompt: 'a', profile: 'P' }).parameters;
assert.equal(p.scale, 4.7); assert.equal(p.sampler, 'k_euler'); assert.equal(p.cfg_rescale, 0.25); assert.equal(p.ucPreset, 3); assert.equal(p.qualityToggle, false);
// per-character negatives: each gets the other's own tags, not the shared ones
const n = N.payload({ prompt: 'a', charAutoNegative: true, characters: [{ prompt: '1girl, red hair, smile' }, { prompt: '1boy, black hair, smile' }] }).parameters;
assert.equal(n.v4_negative_prompt.caption.char_captions[0].char_caption, 'black hair');
assert.equal(n.v4_negative_prompt.caption.char_captions[1].char_caption, 'red hair');
// settings: switches exist, start unchecked, engine reads the flags
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const k of ['mnai.naiProfileP', 'mnai.charAutoNeg', 'mnai.eraseSceneText', 'mnai.perspectiveText']) {
  const m = new RegExp('<input[^>]*data-optin="' + k.replace('.', '\\.') + '"[^>]*>').exec(html); assert.ok(m, k); assert.ok(!/checked/.test(m[0]), k + ' off by default');
}
assert.ok(fs.readFileSync(path.join(root, 'js/ai/nai-engine.js'), 'utf8').includes("on('mnai.naiProfileP')"));
assert.ok(fs.readFileSync(path.join(root, 'js/ai/manga-page-decompose-ui.js'), 'utf8').includes("MangaOptIn.get('mnai.eraseSceneText')"));
// perspective maths: homography maps the rectangle corners onto the quad, centre stays inside
const quad = [{ x: 10, y: 20 }, { x: 210, y: 5 }, { x: 230, y: 120 }, { x: 0, y: 100 }];
const H = P.homography([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 50 }], quad);
[[0, 0], [100, 0], [100, 50], [0, 50]].forEach(([x, y], i) => { const q = P.map(H, x, y); assert.ok(Math.abs(q.x - quad[i].x) < 1e-6 && Math.abs(q.y - quad[i].y) < 1e-6); });
const m = P.affine([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], [{ x: 5, y: 5 }, { x: 7, y: 5 }, { x: 5, y: 8 }]);
assert.equal(JSON.stringify(m), JSON.stringify([2, 0, 0, 3, 5, 5]));
assert.ok(fs.readFileSync(path.join(root, 'js/ai/perspective-text.js'), 'utf8').includes("when: () => on() && root.canvas"), 'tool hidden unless opted in');
console.log('opt-in features ok');

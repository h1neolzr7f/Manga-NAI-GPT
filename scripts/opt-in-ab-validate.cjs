// Lightweight A/B validation for the 3 experimental toggles (+ perspective wiring).
// Confirms each flag flips a documented code path; does not call NAI / spend Anlas.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const c = { console, Math, JSON, Object, Array, Set, Map, Date };
c.window = c; c.globalThis = c; vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(root, 'js/ai/nai-engine-core.js'), 'utf8'), c);
const N = c.NaiEngineCore;

// A) sampling profile P
const off = N.payload({ prompt: 'a girl' }).parameters;
const on = N.payload({ prompt: 'a girl', profile: 'P' }).parameters;
assert.notEqual(off.scale, on.scale, 'P changes scale');
assert.notEqual(off.sampler, on.sampler, 'P changes sampler');
assert.ok(on.cfg_rescale > 0, 'P enables cfg_rescale');

// B) char auto-neg
const a = N.payload({ prompt: 'a', characters: [{ prompt: '1girl, red hair' }, { prompt: '1boy, black hair' }] }).parameters;
const b = N.payload({ prompt: 'a', charAutoNegative: true, characters: [{ prompt: '1girl, red hair' }, { prompt: '1boy, black hair' }] }).parameters;
assert.equal(a.v4_negative_prompt.caption.char_captions[0].char_caption, '');
assert.ok(b.v4_negative_prompt.caption.char_captions[0].char_caption.includes('black hair'));

// C) erase scene text wired to decompose UI + opt-in key
const dec = fs.readFileSync(path.join(root, 'js/ai/manga-page-decompose-ui.js'), 'utf8');
assert.ok(dec.includes("MangaOptIn.get('mnai.eraseSceneText')"));
const opt = fs.readFileSync(path.join(root, 'js/ai/opt-in-settings.js'), 'utf8');
assert.ok(opt.includes('mnai.eraseSceneText'));
const py = fs.readFileSync(path.join(root, 'manga_page_decompose.py'), 'utf8');
assert.ok(py.includes('erase_scene_text'));

// D) perspective gated
const pt = fs.readFileSync(path.join(root, 'js/ai/perspective-text.js'), 'utf8');
assert.ok(pt.includes("get('mnai.perspectiveText')"));

console.log('opt-in A/B validate ok', {
  scaleOff: off.scale, scaleOn: on.scale,
  samplerOff: off.sampler, samplerOn: on.sampler,
  autoNeg: b.v4_negative_prompt.caption.char_captions[0].char_caption
});

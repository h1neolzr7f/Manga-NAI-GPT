// One picture per editor frame: no panel/border tags (they made the model draw its own frame or a whole page);
// an explicit request for a border is still honoured. A/B r7: self-drawn frame 9/10 → 1/10, multi-panel 0 → 0.
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const c = { console, Math, JSON, Date, Object, Array, Set, Map, Promise, RegExp, String, Number, parseInt, parseFloat, isNaN, setTimeout, clearTimeout };
c.window = c; c.globalThis = c; vm.createContext(c);
vm.runInContext(fs.readFileSync('js/ai/prompt/novelai-composition-director.js', 'utf8') + ';globalThis.D=NovelAICompositionDirector;', c);
const D = c.D, layer = { width: 600, height: 400, scaleX: 1, scaleY: 1, strokeWidth: 2, stroke: '#000' };
const p = D.createPlan(layer, { prompt: '1girl, classroom', negative_prompt: '', width: 832, height: 1216 }, 'T2I');
assert.ok(!p.border_tags.some(t => /panel|border/.test(t)), 'frame layer: ' + p.border_tags);
assert.strictEqual(JSON.stringify(p.border_tags), '["clean crop"]');
const q = D.createPlan(layer, { prompt: '1girl, 黑边 边框', negative_prompt: '', width: 832, height: 1216 }, 'T2I');
assert.ok(q.border_tags.indexOf('black border') >= 0, 'explicit border request kept');
const f = D.createPlan(layer, { prompt: '1girl, 出血', negative_prompt: '', width: 832, height: 1216 }, 'T2I');
assert.ok(f.border_tags.indexOf('full-bleed illustration') >= 0);
console.log('director border ok');

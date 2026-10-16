// 1.6.12 cast DNA: role-word gender wins, look-alike check, off-panel voice keeps ≤2 visible without a new page.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const c = { console, Math, JSON, Object, Array, Set, Map, RegExp, String }; c.window = c; c.globalThis = c; vm.createContext(c);
['js/ai/balloon-layout-core.js', 'js/ai/page-layout-core.js', 'js/ai/manga-page-plan-core.js', 'js/ai/story-mode-core.js', 'js/ai/director-craft-context.js'].forEach(p => vm.runInContext(fs.readFileSync(path.join(root, p), 'utf8'), c));
const S = c.StoryModeCore;
const d = S.castDna(['妈妈', '爸爸'], [{ name: '妈妈', tags: '1boy, short black hair' }, { name: '爸爸', tags: '1boy, short black hair' }]);
assert.match(d['妈妈'], /^1girl, mature female/); assert.match(d['爸爸'], /^1boy, mature male/);
assert.equal(S.dnaWarnings({ 妈妈: '1boy, short hair' }).length, 1);
assert.equal(S.dnaWarnings({ 哥哥: '1boy, short black hair', 弟弟: '1boy, short black hair' }).length, 1);
assert.equal(S.dnaWarnings(d).length, 0);
const p = S.buildPlan(S.parseStory('主唱：五分钟上台。\n鼓手：鼓棒呢？\n吉他手：在口袋里。\n主唱：好。'), { perPage: 4 });
assert.equal(p.pages.length, 1, 'short 3rd-person line is an off-panel voice'); assert.ok(p.pages[0].cast.length <= 2);
assert.ok(p.pages[0].panels.some(q => q.offscreen));
assert.ok(c.DirectorCraftContext.castRule.includes('cast_dna'));
console.log('cast dna 1612 ok');

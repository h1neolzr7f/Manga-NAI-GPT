// Director doc rules (AUDIT-v2 B2/B4/B5/D6): count tags first, mono → grey hues, batch rule text, cast-only requirement.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const c = { console, Date, Math, JSON, Object, Array, Set, Map, Promise, setTimeout, clearTimeout, localStorage: { getItem: () => null }, document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] }, location: { protocol: 'http:', origin: 'http://x' } };
c.window = c; c.globalThis = c; vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(root, 'js/ai/prompt/novelai-composition-director.js'), 'utf8'), c);
const D = c.NovelAICompositionDirector;
const j = a => JSON.stringify(D.docOrderParts(a));
assert.equal(j(['masterpiece', 'school', '2girls', 'sunset']), JSON.stringify(['2girls', 'masterpiece', 'school', 'sunset']));
assert.equal(j(['monochrome', 'red scarf', 'blonde hair', 'solo']), JSON.stringify(['solo', 'monochrome', 'dark grey scarf', 'light grey hair']));
assert.equal(j(['red scarf']), JSON.stringify(['red scarf']), 'colour pages keep hues');
const src = fs.readFileSync(path.join(root, 'js/ai/prompt/novelai-composition-director.js'), 'utf8');
assert.ok(src.includes('最后一格给“结果/反应”镜头') && src.includes('每格最多 2 个对白泡'));
assert.ok(fs.readFileSync(path.join(root, 'js/ai/prompt/auto/auto-prompt-util.js'), 'utf8').includes('Only characters actually visible in a panel'));
console.log('director doc rules ok');

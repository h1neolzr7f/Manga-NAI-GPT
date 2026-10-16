// AUDIT-v2 #7/#10/#11 wiring: ScenePlan heuristic spreads lines, Anlas guard stops the panel batch, character DNA.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const c = { console, Date, Math, JSON, Object, Array, Set, Map, Promise, Error, document: { getElementById: () => null, addEventListener() {} } }; c.window = c; c.globalThis = c; vm.createContext(c);
const load = p => vm.runInContext(fs.readFileSync(path.join(root, p), 'utf8'), c, { filename: p });
['js/simulator/story-engine.js', 'js/ai/director/scene-plan-controller.js', 'js/ai/manga-character-bible-core.js', 'js/ai/manga-page-decompose-core.js'].forEach(load);
// #7 one moment per panel: 4 lines over 3 panels, none lost, not all on the last panel
const plan = c.NaiScenePlanController.heuristic('3格\n小林：等一下！\n美咲：啊。\n小林：你的伞。\n美咲：谢谢。');
const panels = plan.pages[0].panels, per = panels.map(p => p.dialogue.length);
if (panels[0].mode === 'normal') { assert.ok(per.reduce((a, b) => a + b, 0) >= 4); assert.ok(per[per.length - 1] < per.reduce((a, b) => a + b, 0)); assert.ok(per[0] > 0, 'first panel gets a line: ' + per); }
// #10 the panel batch checks the balance after each free-tier panel and stops on a drop
const tl = fs.readFileSync(path.join(root, 'js/ui/task-launcher.js'), 'utf8');
assert.ok(tl.includes('MangaPageDecomposeCore.anlasGuard(anlasPrev'));
assert.equal(c.MangaPageDecomposeCore.anlasGuard(3513, 3500, true).stop, true);
assert.equal(c.MangaPageDecomposeCore.anlasGuard(3513, 3513, true).stop, false);
// #11 DNA is optional, normalized and turned into tags; cards without DNA are unchanged
const B = c.MangaCharacterBibleCore, ref = 'data:image/png;base64,' + 'A'.repeat(16);
const card = B.normalize({ id: 'a', name: 'A', references: [ref], dna: { appearance: 'short black hair, red eyes', outfit: 'school uniform', distinct: ['mole under eye', ''] } });
assert.equal(B.dnaTags(card), 'short black hair, red eyes, school uniform, mole under eye');
assert.equal('dna' in B.normalize({ id: 'b', name: 'B', references: [ref] }), false);
assert.ok(tl.includes('MangaCharacterBibleCore.dnaTags(c)'));
console.log('audit v2 wiring ok', per.join('+'));

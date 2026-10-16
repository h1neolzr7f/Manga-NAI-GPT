// story → manga v2 pacing (behind mnai.storyV2) and the shared layout table hook.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = { console, Date, Math, JSON, Object, Array, Set, Map, Promise }; context.globalThis = context; vm.createContext(context);
const load = p => vm.runInContext(fs.readFileSync(path.join(root, p), 'utf8'), context, { filename: p });
['js/simulator/story-engine.js', 'js/simulator/story-to-manga.js', 'js/ai/balloon-layout-core.js', 'js/ai/page-layout-core.js'].forEach(load);
const E = context.NaiComicStoryEngine, M = context.NaiComicStoryToManga;
const script = '标题：放学后\n小林：等一下！\n小林：你的伞忘了。\n美咲：啊，谢谢。\n独白：雨越下越大。\n美咲：要一起走吗？\n小林：好。\n小林：走吧。\n小林：我送你到车站。\n美咲：嗯。';
const story = E.parseScript(script, { title: '放学后' });
const lines = M.beatsFromStory(story).filter(b => b.content).length;
// old behaviour unchanged by default: one line per panel, everything on page 1
const old = M.storyToPlan(story);
assert.equal(old.pages.length, 1);
assert.equal(old.pages[0].panels.length, M.beatsFromStory(story).length);
// v2: same speaker consecutive lines share a panel (≤2), narration alone, 2–4 panels per page, no line lost or duplicated
const v2 = M.storyToPlan(story, { v2: true });
const panels = [].concat(...v2.pages.map(p => p.panels));
assert.ok(v2.pages.every(p => p.panels.length >= 2 && p.panels.length <= 4), 'pages hold 2–4 panels');
assert.ok(panels.every(p => p.dialogue.length <= 2), '≤2 bubbles per panel');
assert.ok(panels.every(p => new Set(p.dialogue.map(d => d.speaker)).size <= 1), 'one speaker per merged panel');
assert.equal(panels.reduce((a, p) => a + p.dialogue.length, 0), lines, 'every line kept once');
assert.ok(panels.length < old.pages[0].panels.length, 'fewer, fuller panels');
// layout hook: without v2 flag the legacy grid is returned bit-identically
const g = M.layoutCells(1000, 1400, 5); assert.equal(g.cols, 3); assert.equal(g.cells.length, 5);
console.log('story-to-manga v2 ok', v2.pages.map(p => p.panels.length).join('+'));

// 1.6.10 craft context: injected into batch prompt (default ON, opt-out mnai.craftContext='0'), beats merged, lint repair pass.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const store = {};
const ctx = { console, Date, Math, JSON, Object, Array, Set, Map, Promise, RegExp, localStorage: { getItem: k => store[k] ?? null } };
ctx.globalThis = ctx; ctx.window = ctx; vm.createContext(ctx);
const load = p => vm.runInContext(fs.readFileSync(path.join(root, p), 'utf8'), ctx, { filename: p });
['js/ai/director-craft-context.js', 'js/simulator/story-engine.js', 'js/simulator/story-to-manga.js', 'js/ai/balloon-layout-core.js', 'js/ai/page-layout-core.js', 'js/ai/manga-page-plan-core.js'].forEach(load);
const CC = ctx.DirectorCraftContext, E = ctx.NaiComicStoryEngine, M = ctx.NaiComicStoryToManga;
assert.ok(CC.enabled()); store['mnai.craftContext'] = '0'; assert.ok(!CC.enabled()); delete store['mnai.craftContext'];
assert.ok(CC.planContext().length < 900, 'token-cheap');
assert.match(CC.fixFor('第 1 页所有格景别相同，建议至少两种。'), /close-up/);
// prompt injection in the real director
const src = fs.readFileSync(path.join(root, 'js/ai/prompt/novelai-composition-director.js'), 'utf8');
assert.ok(src.includes('CC.planContext()') && src.includes('CC.fixTableText()'));
const story = E.parseScript('标题：放学后\n小林：等一下！\n美咲：啊，谢谢。\n独白：雨越下越大。\n美咲：要一起走吗？\n小林：好。', { title: '放学后' });
let calls = 0, seen = [];
const mk = (c, shot) => ({ series_positive_tags: ['manga'], pages: Array.from({ length: c.page_count }, (_, i) => ({ page: i + 1, purpose: 'p', continuity_in: 'x', continuity_out: 'x', beats: { enter: 'a', focus: 'b', leave: 'c' } })),
  panels: c.panels.map(p => ({ page: p.page, panel: p.panel, prompt: 'scene', shot: shot(p), cast: p.characters, must_show: ['umbrella'], must_not_show: [] })) });
ctx.NovelAICompositionDirector = { callBatchStoryboardApi: c => { calls++; seen.push(c); return Promise.resolve(calls === 1 ? mk(c, () => 'medium shot') : mk(c, p => p.panel === 1 ? 'wide shot' : 'close-up')); } };
(async () => {
  const plan = M.storyToPlan(story, { v2: true });
  const r = await M.enrichPlanWithDirector(plan);
  assert.equal(calls, 2, 'repair call made'); assert.ok(seen[1].repair_issues.length && seen[1].repair_issues[0].fix);
  assert.equal(r.repaired, true); assert.equal(r.plan, plan, 'in place');
  assert.ok(plan.pages.every(p => p.beats && p.beats.focus === 'b'));
  calls = 0; store['mnai.craftContext'] = '0';
  await M.enrichPlanWithDirector(M.storyToPlan(story, { v2: true })); assert.equal(calls, 1, 'no repair when off');
  console.log('craft-context-test ok');
})().catch(e => { console.error(e); process.exit(1); });

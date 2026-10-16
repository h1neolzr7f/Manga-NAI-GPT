// Batch director path in story→manga (behind mnai.batchDirector): on by default, opt-out '0', page fields merged, lint recheck, fallback.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const store = {};
const context = { console, Date, Math, JSON, Object, Array, Set, Map, Promise, localStorage: { getItem: k => store[k] ?? null } };
context.globalThis = context; vm.createContext(context);
const load = p => vm.runInContext(fs.readFileSync(path.join(root, p), 'utf8'), context, { filename: p });
['js/simulator/story-engine.js', 'js/simulator/story-to-manga.js', 'js/ai/balloon-layout-core.js', 'js/ai/page-layout-core.js'].forEach(load);
for (const p of ['js/ai/plan-core.js', 'js/ai/manga-page-plan-core.js']) if (fs.existsSync(path.join(root, p))) load(p);
const E = context.NaiComicStoryEngine, M = context.NaiComicStoryToManga;
const story = E.parseScript('标题：放学后\n小林：等一下！\n美咲：啊，谢谢。\n独白：雨越下越大。\n美咲：要一起走吗？\n小林：好。', { title: '放学后' });
let calls = { batch: 0, panel: 0 }, batchResult;
context.NovelAICompositionDirector = {
  callBatchStoryboardApi: ctx => { calls.batch++; assert.equal(ctx.page_fields, true); return Promise.resolve(batchResult(ctx)); },
  draftLayerPromptAsync: () => { calls.panel++; return Promise.resolve({ prompt: 'p', negative_prompt: 'n', apiResult: {} }); }
};
(async () => {
  // opt-out '0' → per-panel director
  store['mnai.batchDirector'] = '0';
  await M.enrichPlanWithDirector(M.storyToPlan(story, { v2: true }));
  assert.equal(calls.batch, 0); assert.ok(calls.panel > 0);
  // default (no flag) → one batch call, page + panel fields merged, lint run
  delete store['mnai.batchDirector']; calls = { batch: 0, panel: 0 };
  batchResult = ctx => ({ series_positive_tags: ['manga'], series_negative_tags: ['text'], continuity_notes: 'rain',
    pages: Array.from({ length: ctx.page_count }, (_, i) => ({ page: i + 1, purpose: 'beat' + i, continuity_in: 'x', continuity_out: 'x' })),
    panels: ctx.panels.map(p => ({ page: p.page, panel: p.panel, prompt: 'scene', negative_prompt: '', shot: 'medium shot', cast: p.characters.concat(['Ghost']), must_show: ['umbrella'], must_not_show: [] })) });
  const r = await M.enrichPlanWithDirector(M.storyToPlan(story, { v2: true }));
  assert.equal(calls.batch, 1); assert.equal(calls.panel, 0); assert.equal(r.source, 'api-batch');
  const panels = [].concat(...r.plan.pages.map(p => p.panels)).filter(p => p.mode !== 'simulator');
  assert.ok(panels.every(p => p.shot === 'medium shot' && JSON.stringify(p.mustShow) === '["umbrella"]' && p.prompt.startsWith('manga, ')));
  assert.ok(panels.every(p => !(p.cast || []).includes('Ghost')), 'unknown cast dropped');
  assert.ok(r.plan.pages.every(p => p.purpose));
  assert.ok('lint' in r);
  // batch failure → per-panel fallback
  calls = { batch: 0, panel: 0 }; batchResult = () => null;
  const f = await M.enrichPlanWithDirector(M.storyToPlan(story, { v2: true }));
  assert.equal(calls.batch, 1); assert.ok(calls.panel > 0); assert.notEqual(f.source, 'api-batch');
  // director unwraps Cline-style {data:{choices}} responses
  const src = fs.readFileSync(path.join(root, 'js/ai/prompt/novelai-composition-director.js'), 'utf8');
  assert.match(src, /json\.data/);
  console.log('batch director ok');
})().catch(e => { console.error(e); process.exit(1); });

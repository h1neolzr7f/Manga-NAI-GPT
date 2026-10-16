// End-to-end pipeline weaknesses (r11): title/opening monologue parsing, plan→full-page bridge, layer-based recheck.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const c = { console, Date, Math, JSON, Object, Array, Set, Map, Promise, localStorage: { getItem: () => null } }; c.window = c; c.globalThis = c; vm.createContext(c);
['js/simulator/story-engine.js', 'js/simulator/story-to-manga.js', 'js/ai/balloon-layout-core.js', 'js/ai/page-layout-core.js', 'js/ai/manga-page-plan-core.js', 'js/ai/manga-page-decompose-core.js']
  .forEach(p => vm.runInContext(fs.readFileSync(path.join(root, p), 'utf8'), c, { filename: p }));
const E = c.NaiComicStoryEngine, M = c.NaiComicStoryToManga, D = c.MangaPageDecomposeCore;
const story = E.parseScript('标题：雨天车站\n独白：傍晚，车站下着大雨。\n小雪：伞……又忘带了。', { title: '雨天车站' });
assert.ok(!story.characters.some(ch => ch.name === '角色A'), 'opening monologue does not invent 角色A');
const beats = M.beatsFromStory(story);
assert.ok(!beats.some(b => b.type === 'title'), 'the 标题 line is not a panel');
assert.equal(beats[0].type, 'narrator');
// plan page -> full-page spec: shared series tags once on the page, shot first, quality/frame tags dropped
const page = { panels: [
  { prompt: 'masterpiece, best quality, monochrome, rainy station, evening, heavy rain', shot: 'wide shot', mustShow: ['heavy rain'], dialogue: [{ speaker: '旁白', content: '{傍晚}' }] },
  { prompt: 'masterpiece, rainy station, evening, girl, umbrella, character_a', shot: 'close-up', dialogue: [{ speaker: '小雪', content: '伞……' }] }] };
const spec = D.specFromPlanPage(page, { rtl: true });
assert.equal(spec.page, 'rainy station, evening');
assert.equal(spec.panels[0].description, 'wide shot, heavy rain'); assert.equal(spec.panels[1].description, 'close-up, girl, umbrella');
assert.equal(spec.panels[0].text, '{傍晚}');
const built = D.buildPagePrompt(spec);
assert.ok(built.prompt.includes('2 panels exactly') && built.prompt.includes('rectangular narration box') && built.hints.length === 2);
// the full-page dialog offers the story plan; batch director publishes it
assert.ok(fs.readFileSync(path.join(root, 'js/ai/manga-page-decompose-ui.js'), 'utf8').includes('core.specFromPlanPage(SP.pages[k]'));
assert.ok(fs.readFileSync(path.join(root, 'js/simulator/story-to-manga.js'), 'utf8').includes('root.__mangaStoryPlan=plan'));
// recheck: layer check first; OCR language must be one the service accepts
const bl = fs.readFileSync(path.join(root, 'js/ai/balloon-layout.js'), 'utf8');
assert.ok(bl.includes("method: 'layers'") && bl.includes("language: 'auto'") && !bl.includes("'chi_sim+jpn'"));
const LANG = /LANGUAGES = frozenset\(\(([^)]*)\)\)/.exec(fs.readFileSync(path.join(root, 'manga_smart_ocr.py'), 'utf8'))[1];
assert.ok(LANG.includes('"auto"'));
console.log('pipeline fixes ok');
// Weakness 5: UI polls decompose progress while the page runs.
{
  const ui = fs.readFileSync(path.join(root, 'js/ai/manga-page-decompose-ui.js'), 'utf8');
  assert.ok(ui.includes('function pollDecomposeProgress'), 'progress poll helper');
  assert.ok(ui.includes('/manga-smart/decompose-progress'), 'progress route');
  assert.ok(ui.includes("job = 'dec-'") || ui.includes('job = "dec-"') || ui.includes("const job = 'dec-"), 'job id passed to decompose');
  console.log('decompose progress UI ok');
}

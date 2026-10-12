// Offline behavioural regressions: persisted character anchors, stable request state, cancellation and export cleanup.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const card = { id: 'snow', name: '小雪', traits: 'red hair, blue eyes, school uniform', identity: { tags: '' } };
const other = { id: 'blue', name: '小蓝', traits: 'blue hair', identity: { tags: 'girl' } };
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function harness() {
  const classes = { toggle() {}, remove() {}, add() {} };
  const node = value => ({ value, checked: false, hidden: false, disabled: false, dataset: {}, classList: classes, textContent: '', parentNode: { insertBefore() {}, querySelector() { return { textContent: '' }; } }, addEventListener() {}, querySelectorAll() { return []; }, querySelector() { return null; }, remove() {} });
  const nodes = Object.fromEntries(['taskPageStyle', 'taskPageGo', 'taskPageCancel', 'taskPageStatus', 'taskPageSeedLock', 'taskPagePanels', 'taskExportAll', 'mangaGptKey', 'mangaGptUrl', 'mangaGptModel', 'novelaiModel', 'novelaiUcPreset', 'novelaiQualityToggle'].map(id => [id, node('')]));
  nodes.taskPageStyle.value = 'manga, screentone'; nodes.mangaGptUrl.value = 'http://original'; nodes.mangaGptModel.value = 'original'; nodes.novelaiModel.value = 'nai-diffusion-4-5-full'; nodes.novelaiUcPreset.value = '2'; nodes.novelaiQualityToggle.checked = true;
  const scenes = [node('小雪在车站'), node('她登上列车'), node('车窗外的景色')], lines = scenes.map(() => node(''));
  let guid = 'page-a'; const objects = []; const calls = [], inserted = [], storage = new Map();
  const document = { readyState: 'loading', addEventListener() {}, body: { classList: classes, appendChild() {} }, getElementById: id => nodes[id] || null,
    querySelectorAll(selector) { if (selector.includes('[data-scene]')) return scenes; if (selector.includes('[data-line]')) return lines; return []; },
    createElement() { return Object.assign(node(''), { setAttribute() {}, click() {} }); } };
  const c = { console, document, AbortController, Uint8Array, TextDecoder, Number, Math, Promise, setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
    canvas: { getWidth: () => 1200, getHeight: () => 1700, getZoom: () => 1, getObjects: () => objects, add: p => objects.push(p), renderAll() {} },
    getCanvasGUID: () => guid, CharacterLibrary: { _state: { cards: [] }, async loadCards() { this._state.cards = [card, other]; return this._state.cards; } },
    NaiEngine: { configured: () => true, modelId: () => nodes.novelaiModel.value, safeMode: () => false, run: async opts => { calls.push(opts); return { image: 'image', seed: opts.seed }; }, isRefusal: () => false },
    ServiceSettings: { ready: async () => true, ensureReady: async () => true },
    ServiceRequest: { request: async (service, route, opts) => { calls.push(opts.body); return { image: 'image' }; } },
    fabric: { Polygon: function() {}, Image: { fromURL(url, cb) { cb({ width: 100 }); } } },
    putImageInFrame: img => inserted.push({ img, guid }), saveStateByManual() {}, updateLayerPanel() {},
    btmProjectsMap: new Map([['page-a', { blob: 'a' }], ['page-b', { blob: 'b' }]]), btmSaveProjectFile: async () => {},
    chengeCanvasByGuid: async id => { guid = id; }, removeGrid() { c.gridRemoved = true; }, restoreGridAfterExport() { c.gridRemoved = false; },
    ImageUtil: { getCropAndDownloadLink: async () => { throw Error('offline export failure'); } }, JSZip: function() { this.file = () => {}; },
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, atob: s => Buffer.from(s, 'base64').toString('binary') };
  c.window = c; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(root, 'js/ai/nai-engine-core.js'), 'utf8'), c);
  let src = fs.readFileSync(path.join(root, 'js/ui/task-launcher.js'), 'utf8');
  src = src.replace('return {exportAll:exportAll', 'return {_test:{newSeries:typeof newPageSeries===\'function\'?newPageSeries:null,libraryCharacters:libraryCharacters,runPage:runPage,setEngine:function(v){pageEngine=v;},startNowMarker:function(){startNow=function(id){window.started=id;};}},exportAll:exportAll');
  vm.runInContext(src, c);
  return { c, nodes, calls, inserted, scenes, lines, storage, objects, api: c.TaskLauncher._test, setGuid: id => { guid = id; }, getGuid: () => guid };
}
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
test('traits and tags anchor named/pronoun/name-free panels without forcing library-order positions', () => {
  const h = harness(), lib = [card, other]; h.c.CharacterLibrary._state.cards = lib;
  const first = h.api.libraryCharacters('小雪在左边，小蓝在右边', lib, []);
  assert.equal(first.length, 2); assert(first[0].prompt.includes('red hair')); assert(first[1].prompt.includes('blue hair')); assert(first.every(x => !x.center));
  assert.equal(h.api.libraryCharacters('她登上列车', lib, [card]).length, 1);
  assert.equal(h.api.libraryCharacters('推开车门', lib, [card]).length, 1);
  assert.equal(h.api.libraryCharacters('空无一人的车站，没有小雪', lib, [card]).length, 0);
  assert.equal(h.api.libraryCharacters('小雪不在，小蓝等待', lib, [card]).length, 1);
});
test('positive manga style does not collide with preset negatives, explicit user negatives retained', () => {
  const N = harness().c.NaiEngineCore;
  const p = N.payload({ prompt: 'manga, screentone, halftone', ucPreset: 2, preservePositiveStyle: true });
  assert(!/(?:^|, )screentone(?:,|$)/.test(p.parameters.negative_prompt)); assert(!/(?:^|, )halftone(?:,|$)/.test(p.parameters.negative_prompt));
  assert(N.payload({ prompt: 'screentone', negative: 'screentone', preservePositiveStyle: true }).parameters.negative_prompt.includes('screentone'));
});
test('first-run page opens engine choice before demanding GPT', async () => {
  const h = harness(); h.api.startNowMarker(); h.c.NaiEngine.configured = () => false; let gated = false;
  h.c.ServiceSettings.ensureReady = async () => { gated = true; return false; }; h.c.TaskLauncher.start('page'); await Promise.resolve();
  assert.equal(h.c.started, 'page'); assert.equal(gated, false);
});
test('first grid awaits persisted library; all panels snapshot anchors/settings and locked series seed survives next page', async () => {
  const h = harness(); h.api.setEngine('nai'); h.nodes.taskPageSeedLock.checked = true;
  h.c.NaiEngine.run = async opts => { h.calls.push(opts); h.c.CharacterLibrary._state.cards = []; h.nodes.novelaiModel.value = 'nai-diffusion-3'; h.nodes.taskPageStyle.value = 'changed'; h.api.setEngine('gpt'); return { image: 'image', seed: opts.seed }; };
  await h.api.runPage(); assert.equal(h.calls.length, 3); assert(h.calls.every(x => x.characters.length === 1 && x.characters[0].prompt.includes('red hair'))); assert(h.calls.every(x => x.model === 'nai-diffusion-4-5-full' && x.prompt.includes('manga, screentone')));
  const seed = h.calls[0].seed; assert(Number.isInteger(seed)); assert(h.calls.every(x => x.seed === seed));
  h.api.setEngine('nai'); await h.api.runPage(); assert.equal(h.calls[3].seed, seed);
});
test('duplicate readiness clicks launch one job', async () => {
  const h = harness(), ready = deferred(); h.c.ServiceSettings.ready = () => ready.promise;
  const a = h.api.runPage(), b = h.api.runPage(); ready.resolve(true); await Promise.all([a, b]); assert.equal(h.calls.length, 3);
});
test('fresh sessions reuse saved seed and previous-page cast', async () => {
  const h = harness(); h.api.setEngine('nai'); h.nodes.taskPageSeedLock.checked = true; h.storage.set('mnai.page.seriesSeed', '42'); h.storage.set('mnai.page.cast', '["snow"]'); h.scenes[0].value = '她拉开窗帘';
  await h.api.runPage(); assert(h.calls.every(x => x.seed === 42 && x.characters[0].prompt.includes('red hair')));
});
test('visible per-panel cast choice can clear establishing shots or choose only one actor', async () => {
  const h = harness(); h.api.setEngine('nai'); const original = h.c.document.querySelectorAll;
  const modes = [{ dataset: { castMode: '0' }, value: 'manual' }, { dataset: { castMode: '1' }, value: 'none' }, { dataset: { castMode: '2' }, value: 'manual' }];
  const roles = [{ dataset: { castPanel: '0', castRole: 'blue' }, checked: true }, { dataset: { castPanel: '2', castRole: 'snow' }, checked: true }];
  h.c.document.querySelectorAll = s => s.includes('[data-cast-mode]') ? modes : s.includes('[data-cast-role]') ? roles : original(s);
  h.scenes[1].value = '列车缓缓进站，车灯照亮站台'; await h.api.runPage(); assert(h.calls[0].characters[0].prompt.includes('blue hair')); assert.equal(h.calls[1].characters.length, 0); assert(h.calls[2].characters[0].prompt.includes('red hair'));
  assert.equal(h.api.libraryCharacters('空镜：列车进站', [card], [card]).length, 0);
});
test('new series resets only seed and inherited cast, retaining edited script/scenes', async () => {
  const h = harness(); h.api.setEngine('nai'); h.nodes.taskPageSeedLock.checked = true; h.storage.set('mnai.page.seriesSeed', '42'); h.storage.set('mnai.page.cast', '["snow"]'); h.scenes[0].value = '列车进站'; const before = h.scenes.map(x => x.value);
  assert.equal(typeof h.api.newSeries, 'function'); h.api.newSeries(); assert.deepEqual(h.scenes.map(x => x.value), before); await h.api.runPage(); assert(h.calls.every(x => x.characters.length === 0)); assert.notEqual(h.calls[0].seed, 42);
});
test('persisted card loading finishes before first request', async () => {
  const h = harness(), loaded = deferred(); h.api.setEngine('nai'); h.c.CharacterLibrary.loadCards = () => loaded.promise; const running = h.api.runPage(); await Promise.resolve(); assert.equal(h.calls.length, 0); loaded.resolve([card]); await running; assert.equal(h.calls.length, 3);
});
test('navigation while dialogue analysis awaits does not place old dialogue', async () => {
  const h = harness(), pending = deferred(); h.api.setEngine('nai'); h.lines[0].value = 'hello'; let layoutCalls = 0; h.c.BalloonLayout = { analyze: () => pending.promise, layoutPage: () => { layoutCalls++; } };
  const running = h.api.runPage(); for(let i=0;i<25;i++) await Promise.resolve(); h.setGuid('page-b'); pending.resolve({ faces: [], energy: [] }); await running; assert.equal(layoutCalls, 0);
});
test('GPT follow-up anchors and service settings survive async UI changes', async () => {
  const h = harness(); h.c.ServiceRequest.request = async (service, route, opts) => { h.calls.push(opts.body); h.nodes.mangaGptUrl.value = 'http://changed'; h.nodes.mangaGptModel.value = 'changed'; return { image: 'image' }; };
  await h.api.runPage(); assert.equal(h.calls.length, 3); assert(h.calls.every(x => x.baseUrl === 'http://original' && x.model === 'original')); assert(h.calls.every(x => x.prompt.includes('red hair')));
});
test('NAI V3 carries selected text anchors in its supported base prompt', async () => {
  const h = harness(); h.api.setEngine('nai'); h.nodes.novelaiModel.value = 'nai-diffusion-3'; await h.api.runPage(); assert(h.calls.every(x => x.prompt.includes('red hair')));
});
test('returning to a reloaded page cannot attach a result to obsolete panels', async () => {
  const h = harness(), pending = deferred(); h.api.setEngine('nai'); h.c.NaiEngine.run = () => pending.promise;
  const running = h.api.runPage(); for(let i=0;i<8;i++) await Promise.resolve(); h.setGuid('page-b'); h.objects.length = 0; h.setGuid('page-a'); pending.resolve({ image: 'image' }); await running; assert.equal(h.inserted.length, 0); assert(!h.nodes.taskPageStatus.textContent.includes('整页完成'));
});
test('aborted generation does not claim an empty page is complete', async () => {
  const h = harness(); h.api.setEngine('nai'); h.c.NaiEngine.run = async () => { throw Object.assign(Error('aborted'), { name: 'AbortError' }); }; await h.api.runPage(); assert(!h.nodes.taskPageStatus.textContent.includes('整页完成'));
});
test('overlapping library loads cannot overwrite newer persisted state', async () => {
  const h = harness(), loaded = deferred(); let reads = 0; h.c.MangaCharacterBibleUI = { all() { reads++; return loaded.promise; } };
  vm.runInContext(fs.readFileSync(path.join(root, 'js/ai/character-library.js'), 'utf8'), h.c);
  const a = h.c.CharacterLibrary.loadCards(), b = h.c.CharacterLibrary.loadCards(); await Promise.resolve(); assert.equal(reads, 1); loaded.resolve([card]); await Promise.all([a, b]); assert.equal(h.c.CharacterLibrary._state.cards[0].id, 'snow');
});
test('named character remains in a place that happens to use the word 无人', () => {
  const h = harness(); assert.equal(h.api.libraryCharacters('小雪走过无人看守的车站', [card], []).length, 1);
});
test('stop and page navigation discard late generated images', async () => {
  for (const stop of [false, true]) { const h = harness(), pending = deferred(); h.api.setEngine('nai'); h.c.NaiEngine.run = () => pending.promise;
    const running = h.api.runPage(); for(let i=0;i<8;i++) await Promise.resolve(); if(stop) h.c.TaskLauncher.stop(); else h.setGuid('page-b'); pending.resolve({ image: 'image' }); await running;
    assert.equal(h.inserted.length, 0, stop ? 'stop must cancel' : 'late result must not enter another page'); }
});
test('failed export restores grid and original page', async () => {
  const h = harness(); h.c.document.querySelectorAll = selector => selector.includes('btm-image') ? [{ dataset: { index: 'page-b' } }, { dataset: { index: 'page-a' } }] : [];
  await h.c.TaskLauncher.exportAll(); assert.equal(h.c.gridRemoved, false); assert.equal(h.getGuid(), 'page-a'); assert.equal(h.nodes.taskExportAll.disabled, false);
});
test('successful offline export includes pages in bar order and merged editable project', async () => {
  const h = harness(), files = []; h.c.document.querySelectorAll = selector => selector.includes('btm-image') ? [{ dataset: { index: 'page-b' } }, { dataset: { index: 'page-a' } }] : [];
  h.c.ImageUtil.getCropAndDownloadLink = async () => ({ href: 'data:image/png;base64,' + Buffer.from(h.getGuid()).toString('base64') });
  h.c.JSZip = function() { this.file = (name, bytes) => files.push([name, bytes]); this.generateAsync = async () => ({ size: 200 }); }; h.c.lz4Compressor = { mergeLz4Blobs: async values => { assert.deepEqual(Array.from(values), ['a', 'b']); return 'editable'; } };
  const result = await h.c.TaskLauncher.exportAll(); assert.equal(result.pages, 2); assert.equal(Buffer.from(files[0][1]).toString(), 'page-b'); assert.equal(files[2][0], '漫画项目.lz4'); assert.equal(files[2][1], 'editable'); assert.equal(h.getGuid(), 'page-a'); assert.equal(h.c.gridRemoved, false);
});
(async () => { let failed = 0; for (const [name, fn] of tests) { try { await fn(); console.log('PASS ' + name); } catch(e) { failed++; console.error('FAIL ' + name + ': ' + e.message); } } if(failed) process.exitCode = 1; })();

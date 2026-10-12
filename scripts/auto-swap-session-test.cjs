const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/ai/auto-swap.js'), 'utf8');
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function harness() {
  const job = deferred(), nodes = { autoSwapStatus: { classList: { toggle() {} } }, autoSwapKeep: { checked: true }, autoSwapExpr: { checked: true }, autoSwapChangeOnly: { checked: true }, autoSwapGo: {}, autoSwapApply: {}, autoSwapAll: {}, autoSwapPreview: {}, autoSwapCompare: {} };
  let previewCount = 0, applied = 0, requests = 0;
  const ctx = { document: { getElementById: id => nodes[id] || null, querySelectorAll: () => [] }, canvas: {}, getCanvasGUID: () => 'page-a', AbortController, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval() {}, swapFixture: () => { requests++; return job.promise; }, previewFixture: async () => { previewCount++; }, applyFixture: async () => { applied++; } };
  ctx.window = ctx; ctx.globalThis = ctx;
  const instrumented = source.replaceAll('await swapOne(', 'await root.swapFixture(').replaceAll('await showPreview(', 'await root.previewFixture(')
    .replaceAll('await applyResult(', 'await root.applyFixture(').replace('root.AutoSwap = Object.assign(api, {', 'root.AutoSwap = Object.assign(api, { _test: {setSession: s => { S = s; }, runTarget, applyTarget, applyAll, gptEdit},');
  vm.runInNewContext(instrumented, ctx);
  const a = { id: 'a', panel: 0 }, b = { id: 'b', panel: 1 };
  const session = { pageGuid: 'page-a', pg: {}, target: a, chars: [a, b], refs: ['ref'], busy: false, doneIds: new Set(), panels: [], matches: [] };
  return { ctx, job, nodes, api: ctx.AutoSwap._test, session, b, previewCount: () => previewCount, applied: () => applied, requests: () => requests };
}
(async () => {
  {
    const h = harness(); h.api.setSession(h.session);
    const pending = h.api.runTarget();
    const replacement = { ...h.session, busy: true, result: null };
    h.api.setSession(replacement); h.job.resolve({ before: 'a', layer: 'a' });
    await pending;
    assert.equal(replacement.busy, true, 'old request completion cannot unlock a new session');
    assert.equal(replacement.result, null, 'old result cannot enter a new session');
    assert.equal(h.previewCount(), 0, 'old result cannot replace the new session preview');
  }
  {
    const h = harness(); h.api.setSession(h.session);
    const pending = h.api.runTarget(); h.session.target = h.b;
    h.job.resolve({ before: 'a', layer: 'a' }); await pending;
    await h.api.applyTarget();
    assert.equal(h.session.doneIds.has('b'), false, 'result generated for A cannot mark newly selected B as replaced');
    assert.equal(h.session.doneIds.has('a'), true, 'result remains associated with its original target');
    assert.equal(h.applied(), 1);
  }
  {
    const h = harness(); h.api.setSession(h.session);
    const pending = h.api.runTarget(); await h.api.runTarget();
    assert.equal(h.requests(), 1, 'double generation click cannot send duplicate requests');
    h.job.resolve({ before: 'a', layer: 'a' }); await pending;
    await Promise.all([h.api.applyTarget(), h.api.applyTarget()]);
    assert.equal(h.applied(), 1, 'double apply click cannot insert duplicate layers');
  }
  {
    const h = harness(); h.api.setSession(h.session);
    h.ctx.document.querySelectorAll = () => [{ dataset: { id: 'b' }, querySelector: () => ({ checked: true }) }];
    let calls = 0;
    h.ctx.swapFixture = async () => { calls++; throw new Error('upstream unknown outcome'); };
    await h.api.applyAll();
    assert.equal(calls, 1, 'batch must stop after an unknown request outcome');
    assert.equal(h.applied(), 0);
    assert.equal(h.session.busy, false);
  }
  {
    const h = harness(); let callback, inserts = 0;
    h.ctx.canvas = { add() { inserts++; } };
    h.ctx.fabric = { Image: { fromURL: (_url, cb) => { callback = cb; } } };
    const pending = h.ctx.AutoSwap.applyResult({ layer: 'data:image/png;base64,AA==', crop: { x: 0, y: 0 }, pageGuid: 'page-a' }, '');
    h.ctx.getCanvasGUID = () => 'page-b'; callback({ set() {} });
    await assert.rejects(pending, /页面已经切换/);
    assert.equal(inserts, 0, 'image decoding across page navigation cannot modify the new page');
  }
  {
    const h = harness(); let callback, inserts = 0, active = true;
    h.ctx.canvas = { add() { inserts++; }, requestRenderAll() {} };
    h.ctx.MangaGPTRegionEditor = {};
    h.ctx.fabric = { Image: { fromURL: (_url, cb) => { callback = cb; } } };
    const pending = h.ctx.AutoSwap.applyResult({ layer: 'data:image/png;base64,AA==', crop: { x: 0, y: 0 }, pageGuid: 'page-a' }, '', () => active);
    active = false; callback({ set() {} });
    await assert.rejects(pending, /任务已经变化/);
    assert.equal(inserts, 0, 'closing the wizard during decoding must cancel the pending layer insertion');
  }
  {
    const h = harness(); let deadline, cleared = false, bodyStarted = false;
    h.ctx.location = { protocol: 'http:', origin: 'http://127.0.0.1:8016' };
    h.ctx.setTimeout = cb => { deadline = cb; return 1; };
    h.ctx.clearTimeout = () => { cleared = true; };
    h.ctx.fetch = async (_url, req) => ({ ok: true, status: 200, json: () => {
      bodyStarted = true;
      return new Promise((_resolve, reject) => req.signal.addEventListener('abort', () => { const e = new Error('body aborted'); e.name = 'AbortError'; reject(e); }));
    } });
    const pending = h.api.gptEdit('image', 'prompt', '1024x1024', [], null, { key: '', baseUrl: '', model: 'gpt-image-1' });
    await new Promise(setImmediate);
    assert.equal(bodyStarted, true);
    assert.equal(cleared, false, 'request deadline must cover image response body, not only headers');
    deadline(); await assert.rejects(pending, /结果未知/);
    assert.equal(cleared, true, 'deadline cleaned up after completion');
  }
  {
    const h = harness(); let finish, valid, inserts = 0;
    h.api.setSession(h.session); h.session.result = { before: 'a', layer: 'a' }; h.session.ctrl = new AbortController();
    h.ctx.applyFixture = (_res, _label, check) => { valid = check; return new Promise((resolve, reject) => { finish = () => { if (check()) { inserts++; resolve(); } else reject(new Error('cancelled')); }; }); };
    const pending = h.api.applyTarget(); h.session.ctrl.abort();
    assert.equal(valid(), false, 'cancel during single candidate decoding must invalidate application');
    finish(); await pending; assert.equal(inserts, 0);
    assert(h.session.result, 'cancel keeps candidate for a deliberate later application');
    const retry = h.api.applyTarget(); assert.equal(valid(), true, 'retry must use a fresh application controller');
    finish(); await retry; assert.equal(inserts, 1);
  }
  {
    const h = harness(); h.api.setSession(h.session); h.ctx.getCanvasGUID = () => 'page-b';
    const pending = h.api.runTarget(); h.job.resolve({ before: 'a', layer: 'a' }); await pending;
    assert.equal(h.requests(), 0, 'stale page wizard cannot send a paid generation request');
  }
  console.log('PASS auto-swap session: stale completion ignored and result target retained');
})().catch(e => { console.error(e); process.exitCode = 1; });

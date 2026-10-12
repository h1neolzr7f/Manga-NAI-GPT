const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ctx = { globalThis: null }; ctx.globalThis = ctx;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/ai/auto-swap.js'), 'utf8'), ctx);
const A = ctx.AutoSwap;
const w = 96, h = 96, own = new Uint8Array(w * h);
for (let y = 30; y < 50; y++) for (let x = 30; x < 50; x++) own[y * w + x] = 1;

const fallback = A.figureMask(null, own, null, w, h, 8);
assert.equal(fallback[0], 0, 'unusable change mask must not repaint distant background');
assert.equal(fallback[40 * w + 40], 255, 'unusable change mask must still replace the target silhouette');
assert.equal(fallback[40 * w + 55], 255, 'bounded hair expansion remains allowed');
assert.equal(fallback[40 * w + 80], 0, 'fallback expansion must be bounded');
const allChanged = A.figureMask(new Uint8ClampedArray(w * h).fill(255), own, null, w, h, 4);
assert.equal(allChanged[0], 0, 'valid widespread change also cannot repaint distant background');
assert.equal(A.figureMask(null, new Uint8Array(w * h), null, w, h, 8).some(Boolean), false, 'empty target mask must fail closed');
const neighbours = new Uint8Array(w * h); neighbours[40 * w + 53] = 1;
assert.equal(A.figureMask(null, own, neighbours, w, h, 8)[40 * w + 53], 0, 'nearby bystander remains protected');

const controls = { autoSwapKeep: { checked: true }, autoSwapExpr: { checked: true }, autoSwapChangeOnly: { checked: true }, autoSwapNote: { value: 'same outfit' } };
const refs = ['ref-a'];
const opts = A.readSwapSettings({ getElementById: id => controls[id] || null }, refs);
assert.equal(opts.keepOutfit, true);
assert.equal(opts.keepExpression, true);
assert.equal(opts.changeOnly, true);
controls.autoSwapKeep.checked = false; refs.push('ref-b');
assert.equal(opts.keepOutfit, true, 'in-flight configuration is immutable by later UI changes');
assert.deepEqual(Array.from(opts.references), ['ref-a'], 'in-flight references are copied');
assert.equal(A.readSwapSettings({ getElementById: id => controls[id] || null }, refs).keepOutfit, false, 'explicit outfit choice is honoured by the shared settings reader');

const session = { pageGuid: 'page-a' };
assert.equal(A.sessionMatches(session, session, 'page-a'), true);
assert.equal(A.sessionMatches(session, session, 'page-b'), false, 'results must not apply to another page');
assert.equal(A.sessionMatches(session, {}, 'page-a'), false, 'closed/reopened wizard cannot receive previous results');

const orig = new Uint8ClampedArray(w * h * 4).fill(255);
const masked = A.backgroundPixels(orig, own);
assert.equal(masked[(40 * w + 40) * 4 + 3], 0, 'intentionally changed figure excluded from tone estimation');
assert.equal(masked[3], 255, 'unchanged background remains available for tone estimation');
assert.equal(orig[(40 * w + 40) * 4 + 3], 255, 'tone estimator cannot alter original source pixels');
console.log('PASS swap drift: bounded masks, consistent immutable settings, stale-page guard, background-only tone estimate');
(async () => {
  class Reader { readAsDataURL(file) { if (file.broken) this.onerror(); else { this.result = 'data:image/png;base64,AA=='; this.onload(); } } }
  assert.deepEqual(Array.from(await A.readReferenceFiles([{ type: 'image/png', size: 100 }], Reader)), ['data:image/png;base64,AA==']);
  await assert.rejects(A.readReferenceFiles([{ type: 'image/png', size: 100, broken: true }], Reader), /读取/);
  await assert.rejects(A.readReferenceFiles([{ type: 'image/svg+xml', size: 100 }], Reader), /PNG/);
  await assert.rejects(A.readReferenceFiles([{ type: 'image/png', size: 13 * 1024 * 1024 }], Reader), /12MB/);
  await assert.rejects(A.readReferenceFiles(new Array(4).fill({ type: 'image/png', size: 100 }), Reader), /3/);
  console.log('PASS swap references: valid input, decode failure, type, size and count limits');
})().catch(e => { console.error(e); process.exitCode = 1; });

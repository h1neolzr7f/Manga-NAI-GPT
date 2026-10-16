const assert = require('assert');
require('../js/ai/manga-page-plan-core.js'); const C = globalThis.MangaPagePlanCore;
// parseLine markup
assert.deepStrictEqual(C.parseLine('「你好」'), { kind: 'speech', direction: 'vertical', shout: false, text: '你好' });
assert.strictEqual(C.parseLine('*糟了*').kind, 'thought');
assert.strictEqual(C.parseLine('【砰】').kind, 'sfx');
assert.strictEqual(C.parseLine('{第二天}').direction, 'horizontal');
assert.ok(C.parseLine('站住！！').shout);
// negatives
assert.strictEqual(C.deconflictNegative('text, speech bubble, english text, panels, watermark, lowres, monochrome', 'bw'), 'english text, watermark, lowres');
// lint
const page = (layout, extra) => Object.assign({ purpose: '她发现信被拆过', layout, cast: ['A', 'B'], panels: [{ description: 'a', shot: 'close' }, { description: 'b', shot: 'wide' }] }, extra);
let r = C.lintPlan([page('R2')]); assert.ok(r.ok, JSON.stringify(r));
r = C.lintPlan([page('R2', { purpose: '' })]); assert.ok(!r.ok);
r = C.lintPlan([page('S')]); assert.ok(!r.ok);
r = C.lintPlan([page('R2', { pageType: 'SOLO' })]); assert.ok(!r.ok);
r = C.lintPlan([page('R2', { panels: [{ description: '她拿起信然后撕开', cast: ['C'] }, { description: 'b' }] })]);
assert.ok(!r.ok && r.warnings.some(w => w.includes('多个时刻')));
r = C.lintPlan(['R2', 'R2', 'R2', 'A1', 'A1', 'R1'].map(x => page(x)));
assert.ok(r.warnings.some(w => w.includes('异形页')) && r.warnings.some(w => w.includes('连续 3 页')));
r = C.lintPlan(['R2', 'X1', 'A1', 'R1', 'X2', 'A3'].map(x => page(x)));
assert.ok(!r.warnings.some(w => /异形页|规整页|种版式|连续/.test(w)), JSON.stringify(r.warnings));
r = C.lintPlan([page('R2', { signature: { layout: 'R2', shot: 'close' } }), page('R2', { signature: { layout: 'R2', shot: 'wide' } })]);
assert.ok(r.warnings.some(w => w.includes('视觉签名')));
// QA
assert.ok(C.scoreQA({ story: 2, camera: 2, focus: 2, emotion: 1, flow: 1 }).pass);
assert.ok(!C.scoreQA({ story: 2, camera: 2, focus: 2, emotion: 2, flow: 0 }).pass);
assert.ok(!C.scoreQA({ story: 2, camera: 2, focus: 2, emotion: 2, flow: 2 }, { legible: true }).pass);
assert.ok(!C.scoreQA({ story: 1, camera: 1, focus: 2, emotion: 2, flow: 1 }).pass);
// record
const rec = C.panelRecord(4, 3, { layout: 'R1' }); assert.ok(!rec.match && rec.layout === 'R1');
for (const g of Object.values(C.GENRES)) assert.ok(g.layouts.every(l => C.LAYOUTS.includes(l)));
console.log('manga-page-plan-core ok');
require('../js/ai/director/scene-plan-schema.js');
{
  const S = globalThis.NaiScenePlanSchema;
  const v = S.validate({ title: 't', pages: [{ purpose: '', layout: 'R2', panels: [{ description: 'a然后b', characters: ['A'] }, { description: 'c', characters: ['A'] }] }] });
  assert.ok(v.warnings.some(w => w.includes('必须让读者')) && v.warnings.some(w => w.includes('多个时刻')));
  assert.strictEqual(S.validate({ title: 't', pages: [{ panels: [{ description: 'a' }] }] }).warnings.length, 0);
  console.log('scene-plan lint hook ok');
}

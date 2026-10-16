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
{
  const C = globalThis.MangaPagePlanCore;
  assert.strictEqual(C.applyCaptionEdits([{ prompt: 'girl, school uniform, smile' }], ['school uniform'], { smile: 'crying' })[0].prompt, 'girl, crying');
  assert.strictEqual(C.hueToGray('girl, blonde hair, red eyes, blue skirt'), 'girl, light grey hair, dark grey eyes, dark grey skirt');
  assert.deepStrictEqual(C.spreadSize('見開きページ, battle'), { width: 1216, height: 832, spread: true });
  assert.ok(!C.spreadSize('school').spread);
  assert.ok(/rectangular/.test(C.bubbleForSpeaker('电话里的妈妈')) && C.bubbleForSpeaker('她') === null && /tailless/.test(C.bubbleForSpeaker('众人')));
  assert.strictEqual(C.elementCount('girl, desk, window、cat；rain, lamp'), 6);
  const pw = C.propContinuity([{ panels: [{ props: { 信: { holder: 'A', hand: 'right' } } }, { props: { 信: { holder: 'B' } } }, { props: { 信: { holder: 'A', change: '还给她' } } }] }]);
  assert.strictEqual(pw.length, 1);
  const r = C.recheckText(['你又迟到了！', '对不起', '走吧'], ['你又迟到了', '对不超', '路人']);
  assert.ok(r.ok === 1 && r.mismatched.length === 1 && r.missing.length === 1 && r.unexpected.length === 1 && !r.pass);
  const L = C.lintPlan([{ purpose: 'x', layout: 'R2', cast: ['A'], continuityOut: '门开着', panels: [{ description: 'a, b, c, d, e, f', mustShow: ['信'], mustNotShow: ['信'] }, { description: 'b' }] }, { purpose: 'y', layout: 'X1', cast: ['A'], continuityIn: '门关着', panels: [{ description: 'a' }, { description: 'b' }] }]);
  assert.ok(!L.ok && L.warnings.some(w => w.includes('3–5 个')) && L.warnings.some(w => w.includes('continuity')));
  console.log('r6 plan helpers ok');
}
{
  const C = globalThis.MangaPagePlanCore;
  const r = C.recheckText(['早点回家，听到没有？', '奶奶……'], ['早点回家,', '听到没有？', '奶奶·', 'AiB']);
  assert.ok(r.pass && r.ok === 2 && r.unexpected.length === 1, JSON.stringify(r));
  console.log('recheck join/punct ok');
}

{
  // Regression: planned count comes from panel positions, not text hints (flashback page: 3 panels, 2 lines).
  const spec = { positions: ['top wide', 'middle wide', 'bottom wide'], hints: ['a', 'b'] };
  assert.strictEqual(C.plannedPanels(spec), 3);
  assert.strictEqual(C.plannedPanels(null), 0);
  assert.strictEqual(C.sheetLabel(C.panelRecord(3, 3, { layout: 'R1' }), 3), 'P4 R1 3/3格');
  assert.strictEqual(C.sheetLabel(C.panelRecord(0, 4, { layout: 'R1' }), 5), 'P6 R1 4/?格');
  console.log('contact sheet label ok');
}

{
  // Vertical Chinese OCR may return bottom→top; reverse match should accept without lowering thresholds.
  const C = globalThis.MangaPagePlanCore;
  const r = C.recheckText(['早上好'], ['上好早']); // reversed glyphs
  assert.ok(r.ok === 1 && r.pass, 'reverse CJK counts as match: ' + JSON.stringify(r));
  const miss = C.recheckText(['完全不同的句子'], ['另一个']);
  assert.ok(miss.missing.length === 1 && !miss.pass, 'unrelated still missing');
  console.log('recheck reverse CJK ok');
}

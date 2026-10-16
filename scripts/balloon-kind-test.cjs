// Balloon kind from line markup; the markup itself is never lettered (r7).
const assert = require('assert'), fs = require('fs');
require('../js/ai/balloon-layout-core.js'); const C = globalThis.BalloonLayoutCore;
const cases = { '「你好」': ['speech', '你好', true, 'ellipse'], '*好紧张*': ['thought', '好紧张', false, 'ellipse'], '【砰】': ['sfx', '砰', false, 'none'],
  '{第二天}': ['narration', '第二天', false, 'rect'], '（电话）喂？': ['phone', '喂？', true, 'rect'], '（众人）万岁！': ['crowd', '万岁！', false, 'ellipse'],
  '（远处）等等我——': ['distant', '等等我——', true, 'ellipse'], '（画外）开门！': ['offscreen', '开门！', true, 'ellipse'], '普通的一句': ['speech', '普通的一句', true, 'ellipse'] };
for (const [t, [kind, text, tail, shape]] of Object.entries(cases)) {
  const k = C.kindOf(t);
  assert.deepStrictEqual([k.kind, k.text, k.tail, k.shape], [kind, text, tail, shape], t);
  assert.ok(!/[「」『』【】{}*（）()]/.test(k.text), 'no markup left: ' + t);
}
assert.strictEqual(C.kindOf('（远处）喂').dashed, true);
// the layout measures and letters the stripped text, and shapes stay off by default (awaits blind pick)
const src = fs.readFileSync('js/ai/balloon-layout.js', 'utf8');
assert.ok(src.includes('measure(k.text'), 'stripped text is lettered');
assert.ok(src.includes("getItem('mnai.bubbleKinds') === '1'"), 'v2 shapes behind a flag');
console.log('balloon kind ok');

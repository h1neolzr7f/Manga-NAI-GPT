// Doc lettering rules: one font size per text kind per page (median), SFX bigger + outlined/tilted, narration left.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const c = { console, Math, JSON, Object, Array }; c.window = c; c.globalThis = c; vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ai/balloon-layout-core.js'), 'utf8'), c);
const C = c.BalloonLayoutCore;
const sizes = [44, 20, 31, 26, 44], kinds = ['speech', 'speech', 'speech', 'narration', 'sfx'];
const out = C.pageFontSizes(sizes, kinds);
const speech = out.filter((_, i) => kinds[i] === 'speech');
assert.equal(new Set(speech).size, 1, 'speech shares one size');
assert.equal(speech[0], 31); assert.equal(out[3], 22); assert.equal(out[4], 62);
assert.equal(C.textStyle('sfx').fontWeight, 900); assert.equal(C.textStyle('narration').textAlign, 'left');
const src = fs.readFileSync(path.join(__dirname, '../js/ai/balloon-layout.js'), 'utf8');
assert.ok(src.includes('C.pageFontSizes') && src.includes('C.textStyle'), 'auto-lettering uses page sizes and kind styles');
assert.equal(src.split('C.pageFontSizes(').length, 2, 'page sizes computed once, in layoutNow only (rearrange has no lines)');
console.log('lettering doc rules ok');
// #12 final OCR recheck (hint only): expected text strips markup; message only for hinted results
{
  const c2 = { console, Math, JSON, Object, Array, Set, Promise, localStorage: { getItem: () => null } }; c2.window = c2; c2.globalThis = c2; vm.createContext(c2);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ai/balloon-layout-core.js'), 'utf8'), c2);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ai/balloon-layout.js'), 'utf8'), c2);
  const BL = c2.BalloonLayout;
  assert.equal(JSON.stringify(BL.expectedText(['【砰】/ 「你好」', '*糟了*'])), JSON.stringify(['砰', '你好', '糟了']));
  assert.equal(BL.recheckMessage({ hint: false, missing: ['a'] }), '');
  assert.ok(BL.recheckMessage({ hint: true, missing: ['你好', '再见'] }).includes('「你好」'));
  assert.ok(fs.readFileSync(path.join(__dirname, '../js/ui/task-launcher.js'), 'utf8').includes('BalloonLayout.recheck(lines)'));
  console.log('lettering recheck ok');
}
// L6 direction rule: dialogue / thought vertical, narration / SFX horizontal; opt-out mnai.verticalBalloons='0'
assert.ok(['speech', 'thought', 'phone', 'crowd'].every(k => C.verticalKind(k)));
assert.ok(!C.verticalKind('narration') && !C.verticalKind('sfx'));
assert.ok(src.includes("getItem('mnai.verticalBalloons') === '0'") && src.includes('new root.fabric.VerticalTextbox('));
console.log('lettering direction ok');

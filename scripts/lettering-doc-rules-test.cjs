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
console.log('lettering doc rules ok');

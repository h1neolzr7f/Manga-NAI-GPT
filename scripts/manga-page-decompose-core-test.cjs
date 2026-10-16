const assert = require('assert');
require('../js/ai/manga-page-decompose-core.js'); const C = globalThis.MangaPageDecomposeCore;
const s = C.buildPagePrompt({ page: '1girl, school gate', panels: [{ description: 'girl waving', text: '「早上好！」' }, { description: 'boy', text: '' }], characters: [{ prompt: 'girl, short hair' }] });
assert.ok(s.prompt.includes('2 panels exactly'));
assert.ok(!/panel \d/i.test(s.prompt), 'no "panel N" tokens');
assert.strictEqual((s.prompt.match(/Text:/g) || []).length, 1, 'single final Text: block');
assert.ok(/Text: 早上好！$/.test(s.prompt), 'Text: is last, brackets stripped');
assert.ok(s.prompt.includes('top wide panel ONLY: girl waving, no text') && s.prompt.includes('bottom wide panel: wordless'));
assert.ok(s.prompt.includes('Do not print frame labels'));
assert.ok(!/\btext\b/.test(s.negative.replace(/english text|prompt text/g, '')), 'negative must not exclude text');
assert.deepStrictEqual(s.hints, ['早上好！']);
assert.ok(s.width % 64 === 0 && s.height % 64 === 0 && s.width * s.height <= 1048576 && s.steps <= 28);
assert.deepStrictEqual(C.positions(5), ['top right', 'top left', 'middle right', 'middle left', 'bottom wide']);
assert.deepStrictEqual(C.breakLines('你好，世界', 2), ['你好，', '世界']);
const f = C.fitInRect('你怎么在这里？', { x: 0, y: 0, width: 60, height: 120 }, true);
assert.ok(!f.overflow && f.lines.length * f.fontSize * 1.15 <= 60 && f.fontSize >= 20, JSON.stringify(f));
const plan = C.planLayers({ panels: [{ polygon: [[0, 0], [100, 0], [100, 50], [0, 50]], bbox: [0, 0, 100, 50] }],
  texts: [{ text: '你好', bubble: [10, 10, 50, 50], safe: [20, 20, 30, 30], bbox: [22, 22, 10, 10], isBubble: true, vertical: true, erase: 'bubble-paper', layer: true },
          { text: 'Panel2:close up', bubble: [60, 0, 30, 30], bbox: [65, 5, 5, 5], isBubble: true, erase: 'bubble-paper' },
          { text: '', bubble: [60, 0, 30, 30], bbox: [65, 5, 5, 5], isBubble: true, erase: 'bubble-paper' },
          { text: '跳过', bbox: [0, 0, 5, 5], bubble: [0, 0, 5, 5], erase: 'skipped' }] }, 2);
assert.strictEqual(plan.panels[0].points[2].x, 200);
assert.strictEqual(plan.texts.length, 1, 'garbled / empty / skipped never become layers');
assert.deepStrictEqual(plan.texts[0].box, { x: 40, y: 40, width: 60, height: 60 }, 'safe rect, not OCR box');
assert.strictEqual(plan.texts[0].angle, 0);
console.log('manga-page-decompose-core ok');

// lintPageSpec
{
  const C = globalThis.MangaPageDecomposeCore, assert = require('assert');
  assert.ok(C.lintPageSpec({ panels: [{ description: 'a', text: '你好' }] }).ok);
  assert.ok(!C.lintPageSpec({ panels: [] }).ok);
  assert.ok(!C.lintPageSpec({ panels: [{ description: 'x Text: hi' }] }).ok);
  assert.ok(!C.lintPageSpec({ panels: [{ description: 'a' }], width: 1024, height: 1088 }).ok);
  assert.ok(!C.lintPageSpec({ panels: [{ description: 'a' }], steps: 30 }).ok);
  assert.ok(!C.lintPageSpec({ panels: [{ description: 'a' }, { description: 'b' }], layout: { positions: ['top'] } }).ok);
  assert.ok(C.lintPageSpec({ panels: [{ description: 'a', text: '' }] }).warnings.length === 1);
  console.log('lintPageSpec ok');
}
{
  const C = globalThis.MangaPageDecomposeCore, assert = require('assert');
  assert.ok(!C.anlasGuard(3513, 3513, true).stop);
  assert.ok(C.anlasGuard(3513, 3500, true).stop);
  assert.ok(C.anlasGuard({ fixed: 0, purchased: 3513 }, { fixed: 0, purchased: 3512 }, true).stop);
  assert.ok(C.anlasGuard(null, 3513, true).stop);
  assert.ok(!C.anlasGuard(3513, 3000, false).stop);
  console.log('anlasGuard ok');
}
{
  const C = globalThis.MangaPageDecomposeCore, assert = require('assert');
  const s = { panels: [{ description: 'a', text: '*想*' }, { description: 'b', text: '【砰】' }, { description: 'c', text: '{次日}' }, { description: 'd', text: '「好」' }] };
  const p = C.buildPagePrompt(s).prompt;
  assert.ok(/thought bubble/.test(p) && /sound effect lettering without a bubble/.test(p) && /narration box/.test(p) && /white speech bubble/.test(p));
  assert.ok(!/[*【】{}「」]/.test(p.split('Text:')[1]));
  const c = C.buildPagePrompt(Object.assign({ color: true }, s));
  assert.ok(/full color/.test(c.prompt) && !/monochrome/.test(c.prompt) && /^monochrome/.test(c.negative));
  assert.ok(!/monochrome/.test(C.buildPagePrompt(s).negative));
  // balanced lines: no lone last char
  assert.deepStrictEqual(C.fitInRect('终于到了', { width: 90, height: 100 }, true, 30, 30).lines, ['终于', '到了']);
  console.log('bubble kinds / color / balance ok');
}

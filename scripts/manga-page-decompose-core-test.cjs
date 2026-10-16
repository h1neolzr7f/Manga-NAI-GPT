const assert = require('assert');
require('../js/ai/manga-page-decompose-core.js'); const C = globalThis.MangaPageDecomposeCore;
const s = C.buildPagePrompt({ page: 'school gate', panels: [{ description: 'girl waving', text: '早上好！' }, { description: 'boy', text: '' }], characters: [{ prompt: 'girl, short hair' }] });
assert.ok(s.prompt.includes('2 panels') && s.prompt.includes('"早上好！"'));
assert.deepStrictEqual(s.hints, ['早上好！']);
assert.ok(s.width % 64 === 0 && s.height % 64 === 0 && s.width * s.height <= 1048576 && s.steps <= 28);
const plan = C.planLayers({ panels: [{ polygon: [[0, 0], [100, 0], [100, 50], [0, 50]], bbox: [0, 0, 100, 50] }],
  texts: [{ text: '你好', bubble: [10, 10, 50, 50], bbox: [20, 20, 10, 10], isBubble: true, vertical: true, fontSize: 20, erase: 'bubble-paper' },
          { text: '', bubble: [60, 0, 30, 30], bbox: [65, 5, 5, 5], isBubble: true, erase: 'bubble-paper' },
          { text: 'x', bbox: [0, 0, 5, 5], bubble: [0, 0, 5, 5], erase: 'skipped' }] }, 2);
assert.strictEqual(plan.panels[0].points[2].x, 200);
assert.strictEqual(plan.texts.length, 2);
assert.ok(plan.texts[1].suspect && plan.texts[1].text === '（待填写）');
assert.ok(plan.texts[0].box.width > 20 * 2 && plan.texts[0].box.width < 50 * 2, 'bubble inset, not OCR box');
assert.strictEqual(plan.texts[0].angle, 0);
console.log('manga-page-decompose-core ok');

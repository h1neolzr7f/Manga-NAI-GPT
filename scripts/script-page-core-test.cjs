'use strict';
const assert = require('assert');
require('../js/ai/script-page-core.js');
const S = globalThis.ScriptPageCore;
// 1) explicit panel markers, speaker lines, quotes, narration, sfx
let r = S.parse(`第1格：清晨的车站，少女小雪在等车
小雪：今天也要加油！
（音效：叮咚）
第2格 列车进站
旁白：列车准时到了。
第3格
画面：小雪向朋友挥手
「再见啦，明天见！」
阿明（远处）：等等我！`);
assert.equal(r.stats.panels, 3); assert.equal(r.stats.pages, 1);
const [a, b, c] = r.pages[0].panels;
assert.equal(a.scene, '清晨的车站，少女小雪在等车；音效「叮咚」');
assert.deepEqual(a.lines, [{ speaker: '小雪', text: '今天也要加油！' }]);
assert.deepEqual(b.lines, [{ speaker: '旁白', text: '列车准时到了。' }]);
assert.equal(c.scene, '小雪向朋友挥手');
assert.deepEqual(c.lines.map(l => [l.speaker, l.text]), [['', '再见啦，明天见！'], ['阿明', '等等我！']]);
assert.deepEqual(S.toWizard(c), { scene: '小雪向朋友挥手（出场：阿明）', line: '再见啦，明天见！ / 等等我！' });
// 2) no markers: blank lines separate panels
r = S.parse('雨中的街道\n小雪：好冷……\n\n阿明撑着伞走来\n阿明: 一起走吧\n小雪:"嗯！"');
assert.equal(r.stats.panels, 2); assert.equal(r.stats.explicit, false);
assert.equal(r.pages[0].panels[1].lines[1].text, '嗯！', 'half-width colon + quotes');
// 3) numbered list "1." "2、" and 【3】, page markers, auto split beyond 6 panels
r = S.parse('1. 教室\n2、走廊\n【3】天台\n第2页\n1. 夜晚\n2. 星空');
assert.equal(r.stats.pages, 2); assert.deepEqual(r.pages.map(p => p.panels.length), [3, 2]);
r = S.parse(Array.from({ length: 8 }, (_, i) => `第${i + 1}格 场景${i + 1}`).join('\n'));
assert.deepEqual(r.pages.map(p => p.panels.length), [6, 2]); assert(r.warnings.some(w => /最多 6 格/.test(w)));
// 4) panel with dialogue only gets a guessed scene and a warning; long dialogue continues in an extra panel (audit 49: never merged across speakers)
r = S.parse('第1格\n小雪：一\n小雪：二\n阿明：三\n小雪：四\n阿明：五');
const p = r.pages[0].panels[0];
assert.equal(p.scene, '小雪和阿明在说话'); assert.equal(p.lines.length, 4); assert.equal(p.lines[3].text, '四');
const p2 = r.pages[0].panels[1]; assert.deepEqual(p2.lines.map(l => [l.speaker, l.text]), [['阿明', '五']]);
assert(r.warnings.some(w => /续格/.test(w)));
// 5) a colon inside a sentence is not a speaker; slashes in lines do not create extra balloons
r = S.parse('第1格\n时间：下午三点，教室里\n小雪：A/B 两个选项');
assert.equal(S.toWizard(r.pages[0].panels[0]).line, 'A・B 两个选项');
assert.equal(r.pages[0].panels[0].scene, '下午三点，教室里', '时间/地点 labels are scene info, not speakers');
r = S.parse('第1格\n他说：今天，我们去看海吧。然后笑了');
assert.equal(r.pages[0].panels[0].lines[0].speaker, '他说');
// 6) English + Japanese markers, CRLF, full-width digits, empty input
r = S.parse('Panel 1: A quiet room\r\nAmy: Hello?\r\nPanel 2\r\nBob: Hi!');
assert.equal(r.stats.panels, 2); assert.equal(r.pages[0].panels[0].lines[0].speaker, 'Amy');
r = S.parse('第１コマ 朝の駅\n第２コマ 電車');
assert.equal(r.stats.panels, 2);
assert.deepEqual(S.parse('').stats, { pages: 0, panels: 0, lines: 0, explicit: false });
// doc soft rules: ≤2 bubbles/panel, 3–5 elements/scene, 2–4 panels/page are warnings only (nothing is split)
r = S.parse('第1格\n教室，窗户，桌子，黑板，夕阳，书包\n小林：一\n小林：二\n小林：三');
assert.equal(r.stats.panels, 1); assert.equal(r.warnings.length, 2);
assert.ok(S.parse('第1格 a\n第2格 b\n第3格 c\n第4格 d\n第5格 e').warnings.some(w => w.includes('2–4 格')));
console.log('PASS script -> page parser: markers, speakers, quotes, narration, sfx, pages, 6-panel split, guessed scenes, merging');

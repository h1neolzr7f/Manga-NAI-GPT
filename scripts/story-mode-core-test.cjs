const assert = require('node:assert/strict');
require('../js/ai/story-mode-core.js'); const S = globalThis.StoryModeCore;
const txt = `# 雨天车站
傍晚的车站下着大雨。小雪抱着书包站在屋檐下。
小雪：怎么办，没带伞……
阿凯：一起走吧！
“谢谢你。”
雨渐渐停了。两人走过积水的街道。远处的天空出现了彩虹。
旁白：那是她第一次和他并肩回家。`;
const p = S.parseStory(txt);
assert.equal(p.title, '雨天车站');
assert.ok(p.beats.some(b => b.speaker === '阿凯'));
assert.equal(p.beats.find(b => b.content === '谢谢你。').speaker, '阿凯');
const plan = S.buildPlan(p, { perPage: 4 });
assert.ok(plan.pages.length >= 1);
plan.pages.forEach(pg => { assert.ok(pg.panels.length >= 1 && pg.panels.length <= 4); pg.panels.forEach(q => assert.ok(q.dialogue.length <= 2)); });
assert.deepEqual(S.castOf(plan).sort(), ['小雪', '阿凯'].sort());
S.applyPresets(plan, { 小雪: '1girl, long black hair, school uniform' });
const withXue = plan.pages.flatMap(pg => pg.panels).filter(q => q.characters.includes('小雪'));
assert.ok(withXue.length && withXue.every(q => q.prompt.startsWith('1girl, long black hair')));
const long = S.buildPlan(S.parseStory(Array.from({ length: 80 }, (_, i) => '第' + i + '句。').join('\n')), { maxPages: 5 });
assert.equal(long.pages.length, 5); assert.ok(long.truncated > 0);
const q = S.makeQueue(3); q.pages[0].status = 'done'; q.pages[1].status = 'failed';
assert.deepEqual(S.summary(q), { total: 3, done: 1, failed: 1, pending: 1 });
S.retryFailed(q); assert.equal(S.nextPending(q).index, 1);
console.log('story mode core ok');

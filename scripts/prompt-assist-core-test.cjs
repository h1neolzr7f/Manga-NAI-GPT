const assert = require('assert'); const fs = require('fs'); const path = require('path');
require('../js/ai/prompt-assist-core.js'); const P = globalThis.PromptAssistCore;
const ix = P.buildIndex(fs.readFileSync(path.join(__dirname, 'fixtures/danbooru-sample.csv'), 'utf8'));
assert.strictEqual(ix.size, 24);
// autocomplete: popularity-ranked prefix, alias resolves, character filter
assert.deepStrictEqual(P.complete(ix, 'sch', 3).map(r => r.name), ['school uniform']);
assert.strictEqual(P.complete(ix, 'sailor', 3)[0].name, 'serafuku');
assert.strictEqual(P.complete(ix, 'sailor', 3)[0].via, 'sailor fuku');
assert.deepStrictEqual(P.complete(ix, 'to', 5, 'character').map(r => r.name), ['togawa sakiko']);
// validation + alias fix keep weights
const v = P.validate(ix, '1girl, 1.2::sailor_fuku::, umbrella, raining, glowing tentacles, text: "早上好", hatsune miku');
assert.deepStrictEqual(v.aliases, [{ from: 'sailor fuku', to: 'serafuku' }, { from: 'raining', to: 'rain' }]);
assert.deepStrictEqual(v.unknown, ['glowing tentacles']); assert.deepStrictEqual(v.characters, ['hatsune miku']);
assert.strictEqual(P.fixAliases(ix, '1girl, 1.2::sailor_fuku::, raining'), '1girl, 1.2::serafuku::, rain');
// NAI5 ordering: count first, quality last
assert.strictEqual(P.order('smile, best quality, 1girl, rain, absurdres'), '1girl, smile, rain, best quality, absurdres');
// library name -> character tag
assert.strictEqual(P.characterTags(ix, 'Togawa Sakiko')[0].name, 'togawa sakiko');
assert.strictEqual(P.characterTags(ix, 'hm')[0], undefined);
// positions (ported convention)
assert.deepStrictEqual(P.posToCenter('A1'), { x: 0.1, y: 0.1 }); assert.deepStrictEqual(P.posToCenter('e5'), { x: 0.9, y: 0.9 }); assert.strictEqual(P.posToCenter('F2'), null);
// LLM template: content-neutral, minors rule present, no persona / default nsfw
const m = P.messages('1girl, rain', { mode: 'expand', characters: [{ name: '小雪', tags: 'black hair' }] });
assert.strictEqual(m[0].role, 'system'); assert(/Never sexualise minors/.test(m[0].content)); assert(!/mutsumi|nsfw/i.test(m[0].content)); assert(/EXPAND/.test(m[1].content) && /小雪 = black hair/.test(m[1].content));
// parse model output (blocks, positions, CHARACTERn:, fences)
const r = P.parse('```\nPROMPT:\n2girls, train station, morning\nCharacter 1 waving at Character 2\nbest quality\n\nCHARACTER:\n1|B3| togawa sakiko, girl, smile\n2| wakaba mutsumi, girl\n\nUC:\nlowres, bad hands\n```');
assert.strictEqual(r.prompt, '2girls, train station, morning, Character 1 waving at Character 2, best quality');
assert.strictEqual(r.characters.length, 2); assert.deepStrictEqual(r.characters[0].center, { x: 0.3, y: 0.5 }); assert.strictEqual(r.characters[1].center, null); assert.strictEqual(r.uc, 'lowres, bad hands');
assert.strictEqual(P.parse('CHARACTER1: hatsune miku, girl\nPROMPT:\n1girl').characters[0].prompt, 'hatsune miku, girl');
// diff
assert.deepStrictEqual(P.diff('1girl, rain, smile', '1girl, smile, umbrella'), [{ tag: 'rain', op: 'del' }, { tag: '1girl', op: 'same' }, { tag: 'smile', op: 'same' }, { tag: 'umbrella', op: 'add' }]);
assert(/^https:\/\/raw\.githubusercontent\.com\/DominikDoom\/.+\/[0-9a-f]{40}\/tags\/danbooru\.csv$/.test(P.SOURCE.url) && /^[0-9a-f]{64}$/.test(P.SOURCE.sha256));
console.log('PASS prompt-assist core: tag index/autocomplete/aliases/validation/order/characters/positions/LLM template/parse/diff');
assert.deepStrictEqual(P.searchNames(['togawa_sakiko', 'togawa_sakiko_(young)', 'wakaba_mutsumi'], 'togawa', 5), ['togawa sakiko', 'togawa sakiko (young)']);
assert(/NaiXueZhang-Studio-Upgrade\/[0-9a-f]{40}\/data\/char_tag_index\.json$/.test(P.CHAR_SOURCE.url));
console.log('PASS prompt-assist core: extended character names');

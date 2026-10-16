// D3 (apply one page per canvas) and D4 (dialogue <-> lines sync) for ScenePlan.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const c = { console, Date, Math, JSON, Object, Array, Set, Map, Promise, Error, document: { getElementById: () => null, addEventListener() {} } }; c.window = c; c.globalThis = c; vm.createContext(c);
const load = p => vm.runInContext(fs.readFileSync(path.join(root, p), 'utf8'), c, { filename: p });
['js/ai/balloon-layout-core.js', 'js/ai/director/scene-plan-schema.js'].forEach(load);
const S = c.NaiScenePlanSchema;
const plan = S.parse({ schemaVersion: 1, title: 't', pages: [{ page: 1, panels: [{ panel: 1, description: 'a', dialogue: [{ speaker: '小林', content: '*糟了*' }, { speaker: '旁白', content: '那天' }] }] },
  { page: 2, panels: [{ panel: 1, description: 'b', lines: [{ id: 'X1', speaker: '美咲', kind: 'speech', zh: '你好', renderText: '你好' }] }] }] });
const l = plan.pages[0].panels[0].lines;
assert.equal(l.length, 2); assert.equal(l[0].kind, 'thought'); assert.equal(l[1].kind, 'narration');
assert.equal(JSON.stringify(plan.pages[1].panels[0].dialogue), JSON.stringify([{ id: 'X1', speaker: '美咲', content: '你好' }]));
const svc = fs.readFileSync(path.join(root, 'js/ai/director/scene-plan-service.js'), 'utf8');
assert.ok(svc.includes('result.plan.pages[pageIndex].panels.slice()') && !svc.includes('page.panels.forEach(function(panel){flat.push(panel);})'), 'apply places one page only');
assert.ok(fs.readFileSync(path.join(root, 'js/ai/director/scene-plan-controller.js'), 'utf8').includes('nextPage'), 'next apply continues with the next page');
console.log('scene plan pages ok');

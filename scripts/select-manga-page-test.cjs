const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/ui/beginner-guide.js'), 'utf8');
function select(objects, factory) {
  let active = null;
  const canvas = { getObjects: () => objects, getActiveObject: () => active, discardActiveObject() { active = null; }, setActiveObject(o) { active = o; }, requestRenderAll() {} };
  const ctx = { canvas, NaiComicExtraRendererFactory: factory, document: { readyState: 'loading', addEventListener() {}, getElementById: () => null },
    fabric: { ActiveSelection: class { constructor(items, options) { this.items = items; this.canvas = options.canvas; } } } };
  ctx.window = ctx; vm.runInNewContext(source, ctx);
  return { result: ctx.NaiBeginnerGuide.selectWholePage(), active, canvas };
}
const image = { type: 'image' }, text = { type: 'textbox', text: '台词' };
const result = select([image, text, { excludeFromLayerPanel: true }, { visible: false }, { selectable: false }], {});
assert.equal(result.result, true, 'select whole page works for imported manga, not only simulator pages');
assert.deepEqual(Array.from(result.active.items), [image, text]);
assert.equal(result.active.canvas, result.canvas);
assert.equal(select([image], null).active, image, 'single imported image selects without simulator dependency');
assert.equal(select([], {}).result, false, 'empty page has nothing to select');
let simulatorSelected = '';
select([{ simulatorPageId: 'chat-1' }], { selectPage(_canvas, id) { simulatorSelected = id; } });
assert.equal(simulatorSelected, 'chat-1', 'existing grouped simulator selection remains supported');
console.log('PASS whole manga page selection: images/text, hidden/locked/helper exclusion, empty and simulator pages');

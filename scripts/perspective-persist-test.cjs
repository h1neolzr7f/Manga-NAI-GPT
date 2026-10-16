// Perspective text layers must survive canvas.toJSON / load: pt* in commonProperties + hydrateAll.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const settings = fs.readFileSync(path.join(root, 'js/core/settings.js'), 'utf8');
for (const k of ['ptQuad', 'ptText', 'ptFontSize', 'ptFill', 'ptFont']) {
  assert.ok(settings.includes('"' + k + '"') || settings.includes("'" + k + "'"), k + ' in commonProperties');
}
const hist = fs.readFileSync(path.join(root, 'js/layer/image-history-management.js'), 'utf8');
assert.ok(hist.includes('PerspectiveText.hydrateAll'), 'history hydrates perspective layers');
const ui = fs.readFileSync(path.join(root, 'js/ai/perspective-text.js'), 'utf8');
assert.ok(ui.includes('function hydrateAll'), 'hydrateAll exists');
assert.ok(ui.includes('hydrateAll'), 'exported');
console.log('perspective persist ok');

// 1.6.6 novice UI: sectioned home, new tasks, whats-new tour, clearer opt-in labels.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const tl = fs.readFileSync(path.join(root, 'js/ui/task-launcher.js'), 'utf8');
assert.ok(tl.includes("id:'decompose'"), 'decompose task');
assert.ok(tl.includes("id:'story'"), 'story task');
assert.ok(tl.includes('task-section'), 'sectioned home');
assert.ok(tl.includes('showWhatsNew'), 'whats-new tour');
assert.ok(tl.includes('WHATSNEW_KEY'), 'tour key');
assert.ok(tl.includes('startDecompose') && tl.includes('startStory'), 'wizards');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(html.includes('nai-optin-help'), 'opt-in help');
assert.ok(html.includes('换采样参数') || html.includes('减少角色串脸'), 'simpler labels');
const css = fs.readFileSync(path.join(root, 'css/task-launcher.css'), 'utf8');
assert.ok(css.includes('task-whatsnew'), 'tour css');
console.log('ui-166 novice ok');

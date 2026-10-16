const assert = require('assert');
const fs = require('fs');
require('../js/ai/provider-route.js'); const R = globalThis.ProviderRoute;
assert.strictEqual(R.routeOf('novelai'), 'own');
assert.strictEqual(R.routeOf('local'), 'own');
assert.strictEqual(R.routeOf('gpt'), 'third-party');
R._reset();
assert.strictEqual(R.notice('novelai'), '', 'NAI route: no notice');
const t = R.notice('gpt');
assert.ok(/遵守/.test(t) && /不会过滤或改写/.test(t), 'GPT route: reminder only');
assert.strictEqual(R.notice('gpt'), '', 'shown once per session');
// No tool-side filtering anywhere: every GPT image call site shows the notice and sends the prompt unchanged.
for (const f of ['js/ui/task-launcher.js', 'js/ai/gpt-region-editor.js', 'js/ai/ai-fill.js', 'js/ai/auto-swap.js']) {
  const s = fs.readFileSync(f, 'utf8');
  assert.ok(s.includes("ProviderRoute.notice('gpt')"), f + ' shows the provider notice');
}
assert.ok(!/ProviderRoute\.(filter|sanitize|rewrite)/.test(fs.readFileSync('js/ai/provider-route.js', 'utf8')));
// NAI director prompt clauses are kept as they are.
const d = fs.readFileSync('js/ai/prompt/novelai-composition-director.js', 'utf8');
assert.ok(d.includes('CREATIVE_TAG_POLICY') && d.includes('SHORT_DIRECTOR_JSON_RULES'));
console.log('provider route ok');

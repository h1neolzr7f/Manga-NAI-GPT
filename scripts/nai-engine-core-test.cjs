const assert = require('assert'); require('../js/ai/nai-engine-core.js'); const N = globalThis.NaiEngineCore;
// sizes: 64-multiples, within free pixels, aspect kept
for (const [w, h] of [[1000, 1000], [1600, 900], [600, 1700], [3000, 400]]) { const s = N.sizeFor(w, h); assert(s.width % 64 === 0 && s.height % 64 === 0); assert(s.width * s.height <= N.FREE.maxPixels, JSON.stringify(s)); assert(Math.abs(s.width / s.height - w / h) / (w / h) < 0.2 || w / h > 3, JSON.stringify([w, h, s])); }
assert.deepStrictEqual(N.sizeFor(1, 1), { width: 1024, height: 1024 });
// cost: Opus free inside limits; paid outside; extras always cost
assert.strictEqual(N.cost({ width: 1024, height: 1024, steps: 28 }, { tier: 3 }).anlas, 0);
assert(N.cost({ width: 1024, height: 1024, steps: 28 }, { tier: 1 }).anlas >= 17);
assert(N.cost({ width: 1024, height: 1088, steps: 28 }, { tier: 3 }).anlas > 0);
assert.strictEqual(N.cost({ width: 832, height: 1216, steps: 28, vibes: 1 }, { tier: 3 }).anlas, 2);
// payload: prompt passed through untouched (content-neutral), quality/UC opt-in, safe mode opt-in
const p = N.payload({ prompt: 'red umbrella, rain', ucPreset: 3, quality: false, seed: 42, width: 800, height: 600 });
assert.strictEqual(p.input, 'red umbrella, rain'); assert.strictEqual(p.parameters.negative_prompt, ''); assert.strictEqual(p.parameters.seed, 42);
assert(!/nsfw/.test(JSON.stringify(N.payload({ prompt: 'x' }))), 'no hidden filtering');
assert(/nsfw/.test(N.payload({ prompt: 'x', safeMode: true }).parameters.negative_prompt), 'safe mode is opt-in');
assert(/very aesthetic/.test(N.payload({ prompt: 'x' }).input));
assert.strictEqual(N.payload({ prompt: 'x', steps: 50 }).parameters.steps, 28);
// infill uses the inpainting model and strips data-URL prefixes
const inf = N.payload({ prompt: 'x', action: 'infill', image: 'data:image/png;base64,AAA', mask: 'data:image/png;base64,BBB' });
assert.strictEqual(inf.model, 'nai-diffusion-4-5-full-inpainting'); assert.strictEqual(inf.parameters.image, 'AAA'); assert.strictEqual(inf.parameters.mask, 'BBB'); assert(inf.parameters.add_original_image);
// V4 multi-character prompts with positions
const c = N.payload({ prompt: '2girls', characters: [{ prompt: 'girl, red hair', center: N.gridCenter(0.15, 0.4) }, { prompt: 'girl, black hair', center: N.gridCenter(0.85, 0.4) }] });
assert.strictEqual(c.parameters.v4_prompt.caption.char_captions.length, 2); assert(c.parameters.use_coords); assert.deepStrictEqual(c.parameters.characterPrompts[0].center, { x: 0.1, y: 0.5 });
assert.strictEqual(N.payload({ prompt: 'x', model: 'nai-diffusion-3' }).parameters.v4_prompt, undefined);
// refusal detection
assert(N.isRefusal('Your request was rejected as a result of our safety system')); assert(N.isRefusal('content_policy_violation')); assert(!N.isRefusal('timeout after 300s'));
assert(N.httpError(429).retry && !N.httpError(401).retry);
console.log('PASS nai-engine-core');

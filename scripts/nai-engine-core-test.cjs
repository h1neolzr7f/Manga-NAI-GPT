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
// PNG metadata (NovelAI writes tEXt Comment JSON); weight hotkeys; token estimate
{
  const zlib = require('zlib'); const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'latin1'), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 0;
  const comment = JSON.stringify({ prompt: 'old', uc: 'lowres', seed: 7, steps: 28, scale: 5, sampler: 'k_euler_ancestral', width: 832, height: 1216,
    v4_prompt: { caption: { base_caption: '1girl, rain, umbrella', char_captions: [{ char_caption: 'girl, smile', centers: [{ x: 0.5, y: 0.5 }] }] } }, v4_negative_prompt: { caption: { base_caption: 'lowres, bad hands' } } });
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('tEXt', Buffer.from('Software\0NovelAI', 'latin1')), chunk('tEXt', Buffer.from('Comment\0' + comment, 'utf8')), chunk('IDAT', zlib.deflateSync(Buffer.from([0, 0]))), chunk('IEND', Buffer.alloc(0))]);
  const m = N.readPngMeta(new Uint8Array(png));
  assert.strictEqual(m.prompt, '1girl, rain, umbrella'); assert.strictEqual(m.negative, 'lowres, bad hands'); assert.strictEqual(m.seed, 7); assert.strictEqual(m.characters[0].prompt, 'girl, smile'); assert.strictEqual(m.software, 'NovelAI');
  assert.strictEqual(N.readPngMeta(new Uint8Array([1, 2, 3])), null);
  assert.strictEqual(N.bumpWeight('rain', 1), '1.1::rain::'); assert.strictEqual(N.bumpWeight('1.1::rain::', -1), 'rain'); assert.strictEqual(N.bumpWeight('rain', -1), '0.9::rain::');
  assert(N.tokenEstimate('1girl, red umbrella, rain') > 4 && N.tokenEstimate('') === 0);
  console.log('PASS nai-engine-core: png metadata, weights, tokens');
}
assert.strictEqual(N.model('nai-diffusion-5-full').label, 'V5 Full'); assert.strictEqual(N.payload({ prompt: 'x', model: 'nai-diffusion-5-full', action: 'infill', image: 'a', mask: 'b' }).model, 'nai-diffusion-4-5-full-inpainting');
assert(!N.features('nai-diffusion-3').characters && N.features('nai-diffusion-5-full').characters && !N.features('nai-diffusion-5-full').inpaintNative);
console.log('PASS nai-engine-core: V5 + per-model features');

/* NovelAI engine core (1.6): pure helpers shared by 改一块 / 画一页 / AI 生图 NAI routes. Unit-tested in Node.
 * Content-neutral by design: prompts are passed through unchanged; nothing is added to or removed from them
 * except the user's own opt-in choices (quality tags, UC preset, optional safe mode). */
(function (root) {
  'use strict';
  const FREE = Object.freeze({ maxPixels: 1024 * 1024, maxSteps: 28, maxSamples: 1 });
  const MODELS = Object.freeze([
    { id: 'nai-diffusion-4-5-full', label: 'V4.5 Full', inpaint: 'nai-diffusion-4-5-full-inpainting', v4: true },
    { id: 'nai-diffusion-4-5-curated', label: 'V4.5 Curated', inpaint: 'nai-diffusion-4-5-curated-inpainting', v4: true },
    { id: 'nai-diffusion-4-full', label: 'V4 Full', inpaint: 'nai-diffusion-4-full-inpainting', v4: true },
    { id: 'nai-diffusion-4-curated-preview', label: 'V4 Curated', inpaint: 'nai-diffusion-4-curated-inpainting', v4: true },
    { id: 'nai-diffusion-3', label: 'V3 (anime)', inpaint: 'nai-diffusion-3-inpainting', v4: false },
  ]);
  // Negative-prompt presets (index = NovelAI ucPreset). Text is what we send, so the user sees exactly what is used.
  const UC_PRESETS = Object.freeze([
    { id: 0, label: '重度（Heavy）', text: 'lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page' },
    { id: 1, label: '轻度（Light）', text: 'lowres, artistic error, scan artifacts, worst quality, bad quality, jpeg artifacts, multiple views, very displeasing, too many watermarks, negative space, blank page' },
    { id: 2, label: '人物向（Human focus）', text: 'lowres, artistic error, film grain, scan artifacts, worst quality, bad quality, jpeg artifacts, very displeasing, chromatic aberration, dithering, halftone, screentone, multiple views, logo, too many watermarks, negative space, blank page, @_@, mismatched pupils, glowing eyes, bad anatomy' },
    { id: 3, label: '不加（None）', text: '' },
  ]);
  const QUALITY_TAGS = 'very aesthetic, masterpiece, no text';
  const MANGA_STYLE = 'monochrome, greyscale, manga, screentone';

  function model(id) { return MODELS.find(m => m.id === id) || MODELS[0]; }
  function r64(v) { return Math.max(64, Math.round(v / 64) * 64); }
  /** Largest 64-multiple size with the target aspect that stays within the free pixel budget. */
  function sizeFor(w, h, maxPixels) {
    maxPixels = maxPixels || FREE.maxPixels;
    const a = (w > 0 && h > 0) ? w / h : 1;
    let H = Math.sqrt(maxPixels / a), W = H * a;
    const maxEdge = 1600; if (W > maxEdge) { W = maxEdge; H = W / a; } if (H > maxEdge) { H = maxEdge; W = H * a; }
    W = r64(W); H = r64(H);
    while (W * H > maxPixels) { if (W / H > a && W > 64) W -= 64; else if (H > 64) H -= 64; else break; }
    return { width: W, height: H };
  }
  function joinTags() { return Array.from(arguments).map(s => String(s || '').trim().replace(/^,|,$/g, '').trim()).filter(Boolean).join(', '); }
  /** Approximate Anlas cost of one image (NovelAI's published per-pixel/step curve), 0 when it is Opus-free. */
  function cost(p, sub) {
    const px = (p.width || 1024) * (p.height || 1024), steps = p.steps || 28, n = p.n_samples || 1;
    const opus = !!(sub && (sub.tier === 3 || sub.opus));
    const freeEligible = px <= FREE.maxPixels && steps <= FREE.maxSteps && n <= FREE.maxSamples;
    let per = Math.ceil(2.951823174884865e-6 * px + 5.753298233447344e-7 * px * steps);
    if (p.strength != null && p.action === 'img2img') per = Math.max(2, Math.ceil(per * p.strength));
    const extras = (p.vibes || 0) * 2 + (p.preciseRefs || 0) * 5;   // vibe encode 2 Anlas each (uncached); precise reference 5
    const image = opus && freeEligible ? 0 : per * n;
    return { anlas: image + extras, imageAnlas: image, extras, free: image + extras === 0, freeEligible, opus };
  }
  /** Map a face/character centre (0..1 page coords) to NovelAI's 5x5 position grid centre values. */
  function gridCenter(cx, cy) { const q = v => Math.min(4, Math.max(0, Math.floor(v * 5))) * 0.2 + 0.1; return { x: +q(cx).toFixed(1), y: +q(cy).toFixed(1) }; }
  /**
   * Build a /ai/generate-image body.
   * opts: { prompt, negative, model, width, height, steps, scale, seed, sampler, ucPreset, quality, safeMode,
   *         characters: [{ prompt, negative, center:{x,y} }], action: 'generate'|'infill'|'img2img', image, mask, strength }
   */
  function payload(opts) {
    const m = model(opts.model);
    const action = opts.action || 'generate';
    const size = sizeFor(opts.width || 1024, opts.height || 1024);
    const uc = UC_PRESETS[opts.ucPreset == null ? 0 : opts.ucPreset] || UC_PRESETS[0];
    const prompt = opts.quality === false ? String(opts.prompt || '').trim() : joinTags(opts.prompt, QUALITY_TAGS);
    const negative = joinTags(uc.text, opts.negative, opts.safeMode ? 'nsfw' : '');
    const chars = (opts.characters || []).filter(c => c && String(c.prompt || '').trim()).slice(0, 6);
    const useCoords = chars.some(c => c.center);
    const seed = Number.isFinite(opts.seed) && opts.seed >= 0 ? Math.floor(opts.seed) : Math.floor(Math.random() * 4294967295);
    const steps = Math.max(1, Math.min(FREE.maxSteps, opts.steps || 28));
    const params = {
      params_version: 3, width: size.width, height: size.height, scale: opts.scale || 5, sampler: opts.sampler || 'k_euler_ancestral',
      steps, n_samples: 1, ucPreset: uc.id, qualityToggle: opts.quality !== false, seed, negative_prompt: negative,
      noise_schedule: m.v4 ? 'karras' : 'native', cfg_rescale: 0, sm: false, sm_dyn: false, dynamic_thresholding: false,
      legacy: false, legacy_v3_extend: false, prefer_brownian: true, deliberate_euler_ancestral_bug: false, add_original_image: action === 'infill',
      characterPrompts: chars.map(c => ({ prompt: c.prompt, uc: c.negative || '', center: c.center || { x: 0.5, y: 0.5 }, enabled: true })),
      use_coords: useCoords,
    };
    if (m.v4) {
      params.v4_prompt = { caption: { base_caption: prompt, char_captions: chars.map(c => ({ char_caption: c.prompt, centers: [c.center || { x: 0.5, y: 0.5 }] })) }, use_coords: useCoords, use_order: true };
      params.v4_negative_prompt = { caption: { base_caption: negative, char_captions: chars.map(c => ({ char_caption: c.negative || '', centers: [c.center || { x: 0.5, y: 0.5 }] })) }, legacy_uc: false };
    }
    if (action === 'infill') { params.image = strip(opts.image); params.mask = strip(opts.mask); params.strength = opts.strength == null ? 1 : opts.strength; params.noise = 0; }
    if (action === 'img2img') { params.image = strip(opts.image); params.strength = opts.strength == null ? 0.6 : opts.strength; params.noise = 0; }
    return { input: prompt, model: action === 'infill' ? m.inpaint : m.id, action, parameters: params };
  }
  function strip(d) { return String(d || '').replace(/^data:[^,]+,/, ''); }
  /** Does an error from an OpenAI-compatible image service look like a content-policy refusal? */
  function isRefusal(msg) {
    return /content[_ ]?policy|safety (?:system|policy)|moderation|policy[_ ]violation|not allowed by our|rejected as a result of our safety|request was rejected|sexual|inappropriate content|unsafe content|violat(?:e|es|ion) (?:our|the) (?:usage|content)/i.test(String(msg || ''));
  }
  /** Readable status for an NAI HTTP error, plus whether waiting and retrying makes sense. */
  function httpError(status, text) {
    const t = String(text || '');
    if (status === 429 || /concurrent generation is locked/i.test(t)) return { retry: true, wait: 4000, msg: 'NovelAI 正忙（同时只能生成一张），排队重试中…' };
    if (status >= 500) return { retry: true, wait: 5000, msg: 'NovelAI 服务暂时不可用（' + status + '），稍后自动重试…' };
    if (status === 401) return { retry: false, msg: 'NovelAI Token 无效或已过期（401）。请在「服务设置」重新填写。' };
    if (status === 402) return { retry: false, msg: 'NovelAI 需要有效订阅或 Anlas 不足（402）。' };
    if (status === 400) return { retry: false, msg: 'NovelAI 拒绝了参数（400）：' + t.slice(0, 160) };
    return { retry: false, msg: 'NovelAI 返回错误（' + status + '）：' + t.slice(0, 160) };
  }
  /** Read NovelAI generation info from PNG bytes (tEXt/iTXt "Comment" JSON + "Description"). null when absent. */
  function readPngMeta(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (b.length < 16 || b[0] !== 0x89 || b[1] !== 0x50) return null;
    const dec = new TextDecoder('utf-8'), latin = new TextDecoder('latin1'), text = {};
    let o = 8;
    while (o + 12 <= b.length) {
      const len = (b[o] << 24 | b[o + 1] << 16 | b[o + 2] << 8 | b[o + 3]) >>> 0, type = latin.decode(b.subarray(o + 4, o + 8)), d = b.subarray(o + 8, o + 8 + len);
      if (type === 'tEXt' || type === 'iTXt') {
        const z = d.indexOf(0); const key = latin.decode(d.subarray(0, z));
        let val = d.subarray(z + 1); if (type === 'iTXt') { let k = 2, n = 0; for (let i = 2; i < val.length && n < 2; i++) if (val[i] === 0) { n++; k = i + 1; } if (val[0] === 0) val = val.subarray(k); else val = null; }
        if (val) text[key] = dec.decode(val);
      }
      if (type === 'IEND') break; o += 12 + len;
    }
    if (!text.Comment && !text.Description) return null;
    let c = {}; try { c = JSON.parse(text.Comment || '{}'); } catch (_) { c = {}; }
    const v4 = c.v4_prompt && c.v4_prompt.caption, v4n = c.v4_negative_prompt && c.v4_negative_prompt.caption;
    return { prompt: (v4 && v4.base_caption) || c.prompt || text.Description || '', negative: (v4n && v4n.base_caption) || c.uc || c.negative_prompt || '',
      characters: v4 && v4.char_captions ? v4.char_captions.map(x => ({ prompt: x.char_caption, center: x.centers && x.centers[0] })) : [],
      seed: c.seed, steps: c.steps, scale: c.scale, sampler: c.sampler, width: c.width, height: c.height, source: text.Source || '', software: text.Software || '' };
  }
  /** Rough prompt length check (NovelAI V4/V4.5 read up to 512 T5 tokens). Approximation: no tokenizer is bundled. */
  function tokenEstimate(p) { const s = String(p || ''); const words = (s.match(/[A-Za-z0-9]+/g) || []).length, cjk = (s.match(/[\u3040-\u9fff]/g) || []).length, punct = (s.match(/[,.:{}[\]()"]/g) || []).length; return Math.round(words * 1.3 + cjk * 1.1 + punct * 0.5); }
  /** Ctrl+Up/Down weight edit for one tag: tag <-> 1.1::tag:: (V4 syntax), steps of 0.1, back to plain at 1.0. */
  function bumpWeight(tag, dir) {
    const m = /^\s*(-?\d+(?:\.\d+)?)::([\s\S]*?)::\s*$/.exec(tag); let w = m ? +m[1] : 1; const core = m ? m[2] : String(tag).trim();
    w = Math.round((w + (dir > 0 ? 0.1 : -0.1)) * 10) / 10; return Math.abs(w - 1) < 1e-9 ? core : w + '::' + core + '::';
  }
  /** Space consecutive queued generations (NovelAI dislikes back-to-back bursts). */
  const SPACING_MS = 1500;
  root.NaiEngineCore = Object.freeze({ FREE, MODELS, UC_PRESETS, QUALITY_TAGS, MANGA_STYLE, model, sizeFor, cost, gridCenter, payload, isRefusal, httpError, joinTags, readPngMeta, tokenEstimate, bumpWeight, SPACING_MS });
})(typeof window !== 'undefined' ? window : globalThis);

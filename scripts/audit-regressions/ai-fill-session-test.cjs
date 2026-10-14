const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const root = require('node:path').join(__dirname,'..','..');
const png = 'data:image/png;base64,AA==';
const source = name => fs.readFileSync(root + '/' + name, 'utf8');
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function fillHarness() {
  let guid = 'page-A', callback, requests = 0;
  const inserted = [], nodes = {};
  for (const name of ['aiFillPrompt', 'aiFillGenerate', 'aiFillResults', 'aiFillStatus', 'mangaGptUrl', 'mangaGptKey', 'mangaGptModel']) nodes[name] = { value: 'fixture', dataset: {}, innerHTML: '', disabled: false };
  const cv = () => ({ width: 64, height: 64, toDataURL: () => png, getContext: () => ({ drawImage() {}, fillRect() {}, putImageData() {}, getImageData(_x,_y,w,h) { const data = new Uint8ClampedArray(w*h*4); data[0] = 255; data[3] = 255; return { data }; } }) });
  class Image { set src(value) { this._src = value; queueMicrotask(() => this.onload && this.onload()); } }
  const c = { Image, queueMicrotask, Uint8Array, Uint8ClampedArray, Float32Array, AbortController, Date, performance: { now: () => 0 },
    setTimeout() {}, clearTimeout() {}, setInterval() {}, document: { readyState: 'loading', addEventListener() {}, removeEventListener() {}, querySelectorAll: () => [], getElementById: id => nodes[id] || null, createElement: () => cv() },
    addEventListener() {}, removeEventListener() {}, getCanvasGUID: () => guid,
    ServiceSettings: { ready: async () => true },
    MangaGPTRegionEditor: { letterboxPlan: () => ({ width: 64, height: 64, size: '1024x1024', inner: { x: 0, y: 0, w: 1, h: 1 } }) },
    fetch: async () => { requests++; return { ok: false, status: 500, json: async () => ({ error: 'fixture failure' }) }; },
    canvas: { add: obj => inserted.push({ guid, obj }), setActiveObject() {}, requestRenderAll() {} },
    fabric: { Image: { fromURL: (_url, cb) => { callback = cb; } } },
    _observeResults() {} };
  c.window = c; vm.createContext(c); vm.runInContext(source('js/ai/ai-fill-core.js'), c);
  // Only expose the closed-over session and replace presentation work with a recorder.
  let s = source('js/ai/ai-fill.js').replace('await showResults();', 'root._observeResults(S);');
  s = s.replace('root.AiFill = {', 'root.AiFill = { _setSession: s => { S = s; }, _getSession: () => S,');
  vm.runInContext(s, c);
  const session = () => ({ W:64,H:64,page:png,preset:'free',engine:'gpt',count:3,busy:false,mask:cv(),ov:{box:{remove(){}}},card:{remove(){}},layers:[png],meta:{box:[0,0,64,64]},layer:null,pageGuid:'page-A' });
  return { c, nodes, session, inserted, requests: () => requests, setGuid: v => guid = v, decode: () => callback({ set() {} }) };
}
(async () => {
  {
    const h = fillHarness(); h.c.AiFill._setSession(h.session());
    await Promise.all([h.c.AiFill.generate(), h.c.AiFill.generate()]);
    assert.equal(h.requests(), 3, '27: double click must send one round');
    console.log('PASS 27 AI Fill double Generate sends one round');
  }
  {
    const h = fillHarness(); h.c.AiFill._setSession(h.session());
    const applied = h.c.AiFill.apply(0); h.setGuid('page-B'); h.decode(); await applied;
    assert.equal(h.inserted.length, 0, '28: candidate must not be inserted into page B');
    const h2 = fillHarness(); h2.c.AiFill._setSession(h2.session()); h2.setGuid('page-B');
    await h2.c.AiFill.apply(0); assert.equal(h2.inserted.length, 0); assert.ok(h2.c.AiFill._getSession(), '28: session kept on wrong page');
    console.log('PASS 28 AI Fill candidate stays with its page');
  }
  {
    const h = fillHarness(), result = 'data:image/png;base64,DELAYED', decoders = [];
    Object.defineProperty(h.c.Image.prototype,'src',{set(value){ if(value === result) decoders.push(this); else queueMicrotask(() => this.onload && this.onload()); }});
    h.c.fetch = async () => ({ ok:true,status:200,json:async()=>({ok:true,image:result}) });
    const old = h.session();
    h.c.AiFill._setSession(old); const pending = h.c.AiFill.generate(); await flush();
    assert(old.busy); assert.equal(decoders.length,3); h.c.AiFill.close();
    const newer = h.session(); newer.busy = true; const ctl = new AbortController(); newer.ctrl = ctl;
    h.c.AiFill._setSession(newer); decoders.forEach(image => image.onload()); await pending;
    assert.equal(newer.meta.candidates, undefined, '29: old results must not enter the new session');
    assert.equal(newer.busy, true); assert.equal(newer.ctrl, ctl);
    console.log('PASS 29 stale AI Fill completion leaves the new session alone');
  }
})().catch(e => { console.error(e); process.exitCode = 1; });

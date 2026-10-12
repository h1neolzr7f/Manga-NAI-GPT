// Offline synthetic pixels and async lifecycle regression; no service or credentials.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(process.env.GPT_REGION_SOURCE || path.join(__dirname, '../js/ai/gpt-region-editor.js'), 'utf8');
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const W = 96, H = 96;
function pixels(fn, w = W, h = H) {
  const a = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = fn(x, y); a.set(Array.isArray(v) ? v : [v, v, v, 255], (y * w + x) * 4);
  }
  return a;
}
class Node {
  constructor() { this.handlers = {}; this.style = {}; this.dataset = {}; this.value = ''; this.children = []; this.attrs = {}; }
  addEventListener(k, cb) { this.handlers[k] = cb; }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  remove() { this.removed = true; }
  setPointerCapture() {}
}
function harness() {
  let bitmap;
  const nodes = Object.fromEntries(['Status','Apply','Preview','Select','Generate','Mode','Prompt','Key','Size','Url','Model',
    'AllowUpscale','Cancel','Context','MatchTone','Feather','KeepAlpha','KeepLines','ChangeOnly','Compare','ReviewOverride','ReviewChoice']
    .map(k => ['mangaGpt' + k, new Node()]));
  nodes.mangaGptMode.value = 'edit'; nodes.mangaGptPrompt.value = 'brighten face'; nodes.mangaGptSize.value = 'auto';
  for (const k of ['Context','MatchTone','Feather','KeepAlpha','KeepLines','ChangeOnly']) nodes['mangaGpt' + k].checked = false;
  const page = { rect: { left: 0, top: 0, width: 96, height: 96 }, added: [],
    upperCanvasEl: { getBoundingClientRect: () => ({ ...page.rect }) },
    getWidth: () => W, getHeight: () => H, toDataURL: () => 'data:image/png;base64,T1JJRw==',
    add(img) { this.added.push(img); }, getObjects: () => [], setActiveObject() {}, requestRenderAll() {} };
  class PixelCanvas extends Node {
    getContext() { return { fillRect: () => { this.data = pixels(() => 255, this.width, this.height); },
      drawImage: (img) => { this.data = new Uint8ClampedArray(img.data || pixels(() => 100, this.width, this.height)); },
      getImageData: () => ({ data: new Uint8ClampedArray(this.data || pixels(() => 100, this.width, this.height)) }),
      putImageData: d => { this.data = new Uint8ClampedArray(d.data); } }; }
    toDataURL() { bitmap = this.data; return 'data:image/png;base64,QkFLRQ=='; }
  }
  class ImageFixture { set src(v) { this.data = pixels(() => 100); this.width = W; this.height = H; queueMicrotask(() => this.onload()); } }
  const body = new Node();
  const sandbox = { document: { readyState: 'loading', addEventListener() {}, body,
    createElement: tag => tag === 'canvas' ? new PixelCanvas() : new Node(), getElementById: id => nodes[id] || null },
    window: { addEventListener() {}, removeEventListener() {} }, canvas: page, Image: ImageFixture,
    AbortController, setTimeout, clearTimeout, location: { origin: 'http://127.0.0.1:8000' },
    getCanvasGUID: () => sandbox.guid, guid: 'page-one',
    fetch: async () => ({ ok: true, json: async () => ({ ok: true, image: 'data:image/png;base64,UkVTVUxU' }) }),
    fabric: { Image: { fromURL: (_url, cb) => cb({ width: W, height: H, getElement: () => ({ data: pixels(() => 140) }),
      set(a, v) { if (typeof a === 'string') this[a] = v; else Object.assign(this, a); } }) } } };
  // Only the test VM exposes the existing private lifecycle, without adding test hooks to production.
  vm.runInNewContext(source.replace('window.MangaGPTRegionEditor = {', 'window.__flow = {state, generate, apply, setRegion}; window.MangaGPTRegionEditor = {'), sandbox);
  const editor = sandbox.window.MangaGPTRegionEditor, flow = sandbox.window.__flow;
  function select(region = { left: 0, top: 0, width: W, height: H }) { flow.setRegion(page, region, 'selected'); }
  return { editor, flow, sandbox, page, nodes, body, select, bitmap: () => bitmap };
}
test('tiny context tone drift cannot erase intentional large brightness edit', () => {
  const h = harness(), orig = pixels(() => 100), seam = { orig, sides: {left:true,right:true,top:true,bottom:true}, changeOnly: false };
  h.editor.bakePatch({ data: pixels(() => 140) }, { x: 0, y: 0, w: W, h: H }, 1, null, [-2,-2,-2], null, seam);
  assert.equal(h.bitmap()[(48 * W + 48) * 4], 138, 'only measured context offset should be deducted');
});
test('same-statistics fine line geometry survives change-only compositing', () => {
  const e = harness().editor;
  const m = e.changeMask(pixels((x,y) => y % 4 === 0 ? 0 : 255), pixels(x => x % 4 === 0 ? 0 : 255), W, H);
  assert(m === null || m[48 * W + 48] > 200, 'vertical-to-horizontal lines are an intended visible change');
});
test('one-pixel resampling of periodic screen tone does not blanket replace background', () => {
  const e = harness().editor;
  const m = e.changeMask(pixels(x => (x + 1) % 4 === 0 ? 0 : 255), pixels(x => x % 4 === 0 ? 0 : 255), W, H);
  assert(m && m.changedFraction < 0.1, 'same tone, contrast and orientation should tolerate texture phase');
});
test('silent canvas layout movement aborts stale pointer mapping', () => {
  const h = harness(); h.editor.startSelection();
  const overlay = h.body.children.at(-1);
  h.page.rect.top = 48;
  overlay.handlers.pointerdown({ button: 0, clientX: 12, clientY: 60, pointerId: 1, preventDefault() {} });
  overlay.handlers.pointerup({ clientX: 72, clientY: 108 });
  assert.equal(h.flow.state.region, null, 'layout changed without scroll/resize: never crop using cached rect');
  assert(overlay.removed);
});
test('canvas movement during a drag aborts the selection', () => {
  const h = harness(); h.editor.startSelection(); const overlay = h.body.children.at(-1);
  overlay.handlers.pointerdown({ button: 0, clientX: 12, clientY: 12, pointerId: 1, preventDefault() {} });
  h.page.rect.top = 48; overlay.handlers.pointerup({ clientX: 72, clientY: 108 });
  assert.equal(h.flow.state.region, null);
});
test('request completion cannot attach previous selection result to a new selection', async () => {
  const h = harness(); h.select(); let finish;
  h.sandbox.fetch = () => new Promise(resolve => { finish = resolve; });
  const pending = h.flow.generate(); await new Promise(resolve => setImmediate(resolve));
  h.select({ left: 20, top: 20, width: 32, height: 32 });
  finish({ ok: true, json: async () => ({ ok: true, image: 'data:image/png;base64,UkVTVUxU' }) });
  await pending;
  assert.equal(h.flow.state.result, '', 'old request result must remain detached from new selection');
  assert.equal(h.nodes.mangaGptApply.disabled, true);
});
test('page switch while decoding prevents insertion into the wrong page', async () => {
  const h = harness(); h.select(); h.flow.state.result = 'data:image/png;base64,UkVTVUxU'; let decode;
  const normalDecode = h.sandbox.fabric.Image.fromURL;
  h.sandbox.fabric.Image.fromURL = (_url, cb) => { h.sandbox.fabric.Image.fromURL = normalDecode; decode = cb; };
  const applying = h.flow.apply(); h.sandbox.guid = 'page-two';
  decode({ width: W, height: H, getElement: () => ({ data: pixels(() => 140) }), set() {} });
  await applying;
  assert.equal(h.page.added.length, 0, 'late decode must recheck page identity');
  assert(h.flow.state.result, 'retain candidate for original page');
});
test('double apply while decoding inserts only one layer', async () => {
  const h = harness(); h.nodes.mangaGptMode.value = 'generate'; h.flow.state.result = 'data:image/png;base64,UkVTVUxU';
  const callbacks = []; h.sandbox.fabric.Image.fromURL = (_url, cb) => { callbacks.push(cb); };
  const first = h.flow.apply(), second = h.flow.apply();
  for (const cb of callbacks) cb({ width: W, height: H, set() {} });
  await Promise.all([first, second]);
  assert.equal(h.page.added.length, 1);
});
test('cancel during image preparation prevents a later request even if fetch ignores abort', async () => {
  const h = harness(); h.select(); let imageLoad, calls = 0;
  h.sandbox.Image = class { set src(v) { imageLoad = () => this.onload(); this.width=W; this.height=H; } };
  h.sandbox.fetch = async () => { calls++; return { ok:true, json:async()=>({ok:true,image:'data:image/png;base64,UkVTVUxU'}) }; };
  const pending = h.flow.generate(); h.flow.state.controller.abort(); imageLoad(); await pending;
  assert.equal(calls, 0);
  assert.equal(h.flow.state.result, '');
});
test('text-to-image result retains origin page when user changes page before apply', async () => {
  const h = harness(); h.nodes.mangaGptMode.value='generate'; await h.flow.generate(); h.sandbox.guid='page-two';
  await h.flow.apply(); assert.equal(h.page.added.length, 0);
});
test('review flags mirrored protected context while allowing face/outfit edits', () => {
  const e = harness().editor;
  assert.equal(typeof e.geometryReview, 'function');
  const orig = pixels((x,y) => x < 35 ? 0 : 200), mirrored = pixels(x => x >= 61 ? 0 : 200);
  assert.equal(e.geometryReview(mirrored, orig, W, H).needsReview, true);
  const allowed = new Uint8Array(W * H); for (let y=20;y<76;y++) for(let x=20;x<76;x++) allowed[y*W+x]=255;
  const uniform = pixels(() => 100), face = pixels((x,y) => allowed[y*W+x] ? 240 : 100);
  assert.equal(e.geometryReview(face, uniform, W, H, allowed).needsReview, false);
  assert.equal(e.geometryReview(pixels(() => 140), uniform, W, H).needsReview, false, 'uniform tone shift is not recomposition');
  const unknown=e.geometryReview(face,uniform,W,H,new Uint8Array(W*H).fill(255));
  assert.equal(unknown.needsReview,false);
  assert.equal(unknown.reason,'insufficient-context');
  const noise=e.geometryReview(pixels(x => (x+1)%4===0?0:255),pixels(x=>x%4===0?0:255),W,H);
  assert.equal(noise.needsReview,false,'screen-tone phase noise is not enough recomposition evidence');
});
test('context review retains candidate and requires a visible deliberate override before inserting', async () => {
  const h=harness(); h.select({left:24,top:24,width:48,height:48});
  const orig=pixels(x=>x<35?0:200), mirrored=pixels(x=>x>=61?0:200);
  h.flow.state.region.plan={inner:{x:.25,y:.25,w:.5,h:.5}};
  h.flow.state.region.contextBox={x0:0,y0:0,x1:W,y1:H};
  h.flow.state.region.sentImage={width:W,height:H,getContext:()=>({getImageData:()=>({data:orig})})};
  const candidate='data:image/png;base64,UkVTVUxU'; h.flow.state.result=candidate; h.nodes.mangaGptPreview.src=candidate;
  h.sandbox.fabric.Image.fromURL=(_url,cb)=>cb({width:W,height:H,getElement:()=>({data:mirrored}),
    set(a,v){if(typeof a==='string')this[a]=v;else Object.assign(this,a);} });
  await h.flow.apply();
  assert.equal(h.page.added.length,0,'obvious context mirroring cannot be silently pasted');
  assert.equal(h.flow.state.result,candidate,'candidate remains reviewable');
  assert.equal(h.nodes.mangaGptPreview.src,candidate);
  assert.equal(h.nodes.mangaGptReviewChoice.hidden,false,'meaningful override choice must be visible');
  h.nodes.mangaGptReviewOverride.checked=true; await h.flow.apply();
  assert.equal(h.page.added.length,1,'explicit reviewed override still permits candidate');
});
test('confirmed small residual tone correction is persisted even with no seam sides', () => {
  const h=harness(), seam={orig:pixels(()=>100),sides:{},changeOnly:false};
  h.editor.bakePatch({data:pixels(()=>156)},{x:0,y:0,w:W,h:H},1,null,[-48,-48,-48],null,seam);
  assert.equal(h.bitmap()[(48*W+48)*4],100,'confirmed -8 residual must reach final bitmap');
});
test('changing wizard task during a request detaches the old instruction result', async () => {
  const h=harness(); h.select(); h.flow.state.task={id:'first',preset:'old'}; let finish;
  h.sandbox.fetch=()=>new Promise(resolve=>{finish=resolve;}); const pending=h.flow.generate();
  await new Promise(resolve=>setImmediate(resolve)); h.flow.state.task={id:'second',preset:'new'};
  finish({ok:true,json:async()=>({ok:true,image:'data:image/png;base64,UkVTVUxU'})}); await pending;
  assert.equal(h.flow.state.result,'');
});
test('apply options remain stable when changed during asynchronous mask loading', async () => {
  const h=harness(); h.select(); h.flow.state.result='data:image/png;base64,UkVTVUxU';
  h.nodes.mangaGptChangeOnly.checked=true; h.nodes.mangaGptKeepAlpha.checked=true;
  let firstLoad, count=0;
  h.sandbox.Image=class {
    set src(v) { this.data=pixels(()=>100); this.width=W; this.height=H;
      if(count++===0) firstLoad=()=>this.onload(); else queueMicrotask(()=>this.onload()); }
  };
  const patch=pixels((x,y)=>x>=40&&x<56&&y>=40&&y<56?160:100);
  h.sandbox.fabric.Image.fromURL=(_url,cb)=>cb({width:W,height:H,getElement:()=>({data:patch}),
    set(a,v){if(typeof a==='string')this[a]=v;else Object.assign(this,a);} });
  const applying=h.flow.apply(); await Promise.resolve(); assert.equal(typeof firstLoad,'function');
  h.nodes.mangaGptChangeOnly.checked=false; firstLoad(); await applying;
  assert.equal(h.page.added.length,1);
  assert.equal(h.bitmap()[3],0,'background remains transparent according to the options when apply began');
  assert(h.bitmap()[(48*W+48)*4+3]>200,'edited centre remains visible');
});
for(const scenario of ['close-task','close-with-null-task','same-id-new-task','mutate-task','change-operation']) {
  test('async decode cannot apply after '+scenario, async () => {
    const h=harness(); h.nodes.mangaGptMode.value='generate';
    h.flow.state.task=scenario==='close-with-null-task'?null:{id:'same',preset:'original'};
    h.flow.state.result='data:image/png;base64,UkVTVUxU'; let decode;
    h.sandbox.fabric.Image.fromURL=(_url,cb)=>{decode=cb;};
    const pending=h.flow.apply();
    if(scenario.startsWith('close')) h.editor.exitTask();
    else if(scenario==='same-id-new-task') h.flow.state.task={id:'same',preset:'original'};
    else if(scenario==='mutate-task') h.flow.state.task.preset='new instructions';
    else h.nodes.mangaGptMode.value='edit';
    h.nodes.mangaGptStatus.textContent='new task status';
    decode({width:W,height:H,set(){}}); await pending;
    assert.equal(h.page.added.length,0,'obsolete async apply must insert zero layers');
    assert.equal(h.nodes.mangaGptStatus.textContent,'new task status','old continuation cannot overwrite new status');
  });
}
for(const scenario of ['exit-null-task','mutate-task']) {
  test('late request cannot overwrite new preview after '+scenario, async () => {
    const h=harness(); h.nodes.mangaGptMode.value='generate';
    h.flow.state.task=scenario==='exit-null-task'?null:{id:'same',preset:'original'};
    let finish; h.sandbox.fetch=()=>new Promise(resolve=>{finish=resolve;});
    const pending=h.flow.generate();
    if(scenario==='exit-null-task') h.editor.exitTask(); else h.flow.state.task.preset='new instructions';
    h.nodes.mangaGptPreview.src='new-preview'; h.nodes.mangaGptStatus.textContent='new task status';
    finish({ok:true,json:async()=>({ok:true,image:'data:image/png;base64,UkVTVUxU'})}); await pending;
    assert.equal(h.flow.state.result,'');
    assert.equal(h.nodes.mangaGptPreview.src,'new-preview');
    assert.equal(h.nodes.mangaGptStatus.textContent,'new task status');
  });
}
(async () => {
  let failures = 0;
  for (const t of tests) {
    try { await t.fn(); console.log('PASS', t.name); }
    catch (error) { failures++; console.error('FAIL', t.name, error.message); }
  }
  if (failures) process.exitCode = 1;
})();

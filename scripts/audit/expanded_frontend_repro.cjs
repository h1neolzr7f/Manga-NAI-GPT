const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const root = (process.env.MANGA_AUDIT_ROOT||process.cwd());
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
  const session = () => ({ W:64,H:64,page:png,preset:'free',engine:'gpt',count:3,busy:false,mask:cv(),ov:{box:{remove(){}}},card:{remove(){}},layers:[png],meta:{box:[0,0,64,64]},layer:null });
  return { c, nodes, session, inserted, requests: () => requests, setGuid: v => guid = v, decode: () => callback({ set() {} }) };
}
async function fillTests() {
  {
    const h = fillHarness(); h.c.AiFill._setSession(h.session());
    await Promise.all([h.c.AiFill.generate(), h.c.AiFill.generate()]);
    assert.equal(h.requests(), 6);
    console.log('CONFIRMED AI-fill double Generate sends 6 requests instead of 3');
  }
  {
    const h = fillHarness(); h.c.AiFill._setSession(h.session());
    const applied = h.c.AiFill.apply(0); h.setGuid('page-B'); h.decode(); await applied;
    assert.equal(h.inserted[0].guid, 'page-B');
    console.log('CONFIRMED AI-fill candidate from page A inserted into page B after decode delay');
  }
  {
    const h = fillHarness(), result = 'data:image/png;base64,DELAYED', decoders = [];
    Object.defineProperty(h.c.Image.prototype,'src',{set(value){ if(value === result) decoders.push(this); else queueMicrotask(() => this.onload && this.onload()); }});
    h.c.fetch = async () => ({ ok:true,status:200,json:async()=>({ok:true,image:result}) });
    const old = h.session();
    h.c.AiFill._setSession(old); const pending = h.c.AiFill.generate(); await flush();
    assert(old.busy);assert.equal(decoders.length,3);h.c.AiFill.close();
    const newer = h.session(); newer.busy = true; newer.ctrl = new AbortController();
    h.c.AiFill._setSession(newer);decoders.forEach(image => image.onload());await pending;
    assert(newer.meta.candidates.length);assert.equal(newer.busy, false);assert.equal(newer.ctrl,null);
    console.log('CONFIRMED AI-fill stale completion writes candidate into replacement session and unlocks it');
  }
}
function characterHarness() {
  const store = new Map(), embed = deferred();
  const c = { document: { getElementById: () => null }, localStorage: { getItem: () => null }, setInterval() {},
    MangaModelRequest: { post: () => embed.promise }, MangaCharacterBibleUI: { put: async card => { store.set(card.id,card); }, all: async () => [...store.values()] },
    PanelAuto: { _cache: new Map([['page-A:key',{ image:png }]]) } };
  c.window = c; vm.createContext(c); vm.runInContext(source('js/ai/character-library.js'), c);
  return { c, store, embed };
}
async function characterTests() {
  {
    const h = characterHarness(), card = { id:'alice',name:'Alice',references:[png],identity:{ features:[[1]],tags:'old tags' } };
    const s = h.c.CharacterLibrary._state; s.cards = [card]; s.pageKey='page-A:key'; s.result={ faces:[{ status:'match',id:'alice',face:[0,0,10,10] }] };
    const got = h.c.CharacterLibrary.cardForRegion({ left:0,top:0,width:10,height:10,pageGuid:'page-B' });
    assert.equal(got.id,'alice');
    console.log('CONFIRMED character recognized on page A automatically offered for unrelated region on page B');
  }
  {
    const h = characterHarness(), card = { id:'alice',name:'Alice',references:[png],identity:{ features:[],tags:'old tags' } };
    h.store.set(card.id,card); const pending = h.c.CharacterLibrary.buildIdentity(card);
    h.store.set(card.id,{ ...card,name:'Alice edited',identity:{features:[],tags:'new tags'} });
    h.embed.resolve({ok:true,feature:[1,2],palette:[]}); await pending;
    assert.equal(h.store.get(card.id).name,'Alice'); assert.equal(h.store.get(card.id).identity.tags,'old tags');
    console.log('CONFIRMED background buildIdentity overwrites newer persisted character edits');
  }
  {
    const h = characterHarness(), card = { id:'alice',name:'Alice',references:[png],identity:{ features:[],tags:'' } };
    h.store.set(card.id,card); const pending = h.c.CharacterLibrary.buildIdentity(card); h.store.delete(card.id);
    h.embed.resolve({ok:true,feature:[1,2],palette:[]}); await pending; assert(h.store.has(card.id));
    console.log('CONFIRMED background buildIdentity recreates deleted character card');
  }
}
async function accountTest() {
  let token='account-A', health=0;
  const c = { document:{getElementById:id => id==='novelaiApiKey'?{value:token}:null},localStorage:{getItem:()=>null},Date,AbortController,
    fetch:async()=>{health++;return {ok:true,json:async()=>({ok:true,tier:3,anlas:1000,active:true})};} };
  c.window=c; vm.createContext(c);vm.runInContext(source('js/ai/nai-engine-core.js'),c);vm.runInContext(source('js/ai/nai-engine.js'),c);
  await c.NaiEngine.subscription();token='account-B';const cost=await c.NaiEngine.costText({width:1024,height:1024},3);
  assert.equal(health,1);assert.equal(cost.free,true);assert(cost.text.includes('1000'));
  console.log('CONFIRMED account-B cost preview reuses account-A Opus subscription and balance without lookup');
}
async function chatTest() {
  const rendered = deferred(); let guid='page-A', active=null; const removed=[], added=[];
  const c={document:{getElementById:()=>null,addEventListener(){}},
    NaiComicChatScene:{createDefaultScene:()=>({templateId:'t'}),validate:scene=>({ok:true,errors:[],warnings:[],scene})},
    NaiComicTemplateRegistry:{get:()=>({})},NaiComicChatRenderer:{renderScene:()=>rendered.promise,fitGroupToCanvas(){}},
    canvas:{getActiveObject:()=>active,remove:obj=>removed.push({guid,obj}),add:obj=>added.push({guid,obj}),setActiveObject(){},renderAll(){}},saveStateByManual(){},updateLayerPanel(){}};
  c.window=c;vm.createContext(c);vm.runInContext(source('js/simulator/chat-controller.js'),c);
  const pending=c.NaiComicChatController.insertOrUpdate();
  guid='page-B';const other={customType:'simulatorChat',name:'unrelated existing chat B',canvas:c.canvas};active=other;
  rendered.resolve({name:'generated for page A'});await pending;
  assert.equal(removed[0].obj,other);assert.equal(added[0].guid,'page-B');
  console.log('CONFIRMED late chat insertion deletes newly selected unrelated chat B and inserts A result into page B');
}
async function providerSeedTest(){
  const c={AIProvider:class{},document:{},isImage:()=>false,isPanel:()=>false,basePrompt:{text2img_seed:0,text2img_prompt:'base',text2img_negative:'',text2img_samplingSteps:28,text2img_cfg_scale:5},Math:Object.assign(Object.create(Math),{random:()=>0.5})};
  c.window=c;vm.createContext(c);vm.runInContext(source('js/ai/provider/novelai-provider.js')+'\nglobalThis.Provider=NovelAIProvider;',c);
  const p=new c.Provider();const payload=await p._cleanBaseRequest({text2img_seed:0,width:100,height:100,scaleX:1,scaleY:1},'T2I');
  assert.equal(payload.seed,2147483647);console.log('CONFIRMED advanced NovelAI chosen seed 0 becomes random seed 2147483647');
}
(async()=>{await fillTests();await characterTests();await accountTest();await chatTest();await providerSeedTest();})().catch(e=>{console.error(e);process.exitCode=1;});

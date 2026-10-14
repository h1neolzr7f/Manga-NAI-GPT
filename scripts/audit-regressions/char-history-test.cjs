// Audit 10 (swap history under lettering), 31 (page-bound auto-ref), 32 (buildIdentity merge).
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const repo=path.join(__dirname,'..','..');
const src=n=>fs.readFileSync(path.join(repo,n),'utf8');
const png='data:image/png;base64,AA==';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};

// --- 10 ---
(async()=>{
  const history=[]; let saving=true;
  const objects=[{type:'image',name:'底图'},{type:'textbox',name:'文字',text:'hi'}];
  const c={objects,getObjects(){return this.objects;},add(o){this.objects.push(o);if(saving)history.push(this.objects.map(x=>x.name).join(','));},
    moveTo(o,idx){const i=this.objects.indexOf(o);if(i<0)return;this.objects.splice(i,1);this.objects.splice(idx,0,o);},requestRenderAll(){}};
  let code=src('js/ai/auto-swap.js');
  if(!/applyResult\s*:/.test(code)) code=code.replace(/root\.AutoSwap\s*=\s*\{/,'root.AutoSwap = { applyResult: applyResult, ');
  const x={console,Promise,queueMicrotask,document:{getElementById:()=>null,createElement:()=>({style:{},appendChild(){},remove(){}}),body:{appendChild(){}}},
    changeDoNotSaveHistory(){saving=false;},changeDoSaveHistory(){saving=true;},saveStateByManual(){history.push(c.objects.map(x=>x.name).join(','));},
    updateLayerPanel(){},getCanvasGUID:()=>'page-A',canvas:c,fc:()=>c,
    fabric:{Image:{fromURL(url,cb){queueMicrotask(()=>cb({set(p){Object.assign(this,p);return this;},moveTo(idx){const i=c.objects.indexOf(this);if(i<0)return;c.objects.splice(i,1);c.objects.splice(idx,0,this);}}));}}},
    MangaGPTRegionEditor:{letteringInsertIndex(objs,ins){let index=objs.length-1;for(let i=objs.length-1;i>=0;i--){const o=objs[i];if(o===ins)continue;if(!/textbox|i-text|^text$|vertical-textbox/.test(o.type||''))break;index=i;}return index;}},
    PanelAuto:{get:async()=>({image:png,W:100,H:100})},MangaModelRequest:{post:async()=>({ok:true})},
    localStorage:{getItem:()=>null,setItem(){}},setInterval:()=>0,clearInterval(){},Image:class{set src(v){queueMicrotask(()=>this.onload&&this.onload());}},URL:{createObjectURL:()=>'blob:x',revokeObjectURL(){}},Blob:class{}};
  x.window=x;x.gpt=()=>x.MangaGPTRegionEditor;vm.createContext(x);vm.runInContext(code,x);
  await x.AutoSwap.applyResult({layer:png,crop:{x:1,y:2},pageGuid:'page-A'},'测');
  assert.deepEqual(c.objects.map(o=>o.name),['底图','换角色测','文字']);
  assert.equal(history.length,1);assert.equal(history[0],'底图,换角色测,文字');
  console.log('PASS 10 swap add+reorder is one history step under lettering');
})().catch(e=>{console.error(e);process.exitCode=1;});

// --- 31 / 32 ---
(async()=>{
  const store=new Map(),embed=deferred();
  const c={document:{getElementById:()=>null},localStorage:{getItem:()=>null},setInterval(){},
    MangaModelRequest:{post:()=>embed.promise},MangaCharacterBibleUI:{put:async card=>{store.set(card.id,card);},all:async()=>[...store.values()]},
    PanelAuto:{_cache:new Map([['page-A:key',{image:png}]])},getCanvasGUID:()=>'page-B'};
  c.window=c;vm.createContext(c);vm.runInContext(src('js/ai/character-library.js'),c);
  {
    const s=c.CharacterLibrary._state;s.cards=[{id:'alice',name:'Alice'}];s.pageKey='page-A:key';
    s.result={faces:[{status:'match',id:'alice',face:[0,0,10,10]}]};s.autoRef=true;
    assert.equal(c.CharacterLibrary.cardForRegion({left:0,top:0,width:10,height:10,pageGuid:'page-B'}),null);
    assert.equal(c.CharacterLibrary.cardForRegion({left:0,top:0,width:10,height:10,pageGuid:'page-A'}).id,'alice');
    console.log('PASS 31 auto-reference rejects faces from another page');
  }
  {
    const card={id:'alice',name:'Alice',references:[png],identity:{features:[],tags:'old tags'}};
    store.set(card.id,card);
    const pending=c.CharacterLibrary.buildIdentity(card);
    store.set(card.id,{...card,name:'Alice edited',identity:{features:[],tags:'new tags'}});
    embed.resolve({ok:true,feature:[1,2],palette:[]});await pending;
    assert.equal(store.get(card.id).name,'Alice edited');
    assert.equal(store.get(card.id).identity.tags,'new tags');
    assert.equal(JSON.stringify(store.get(card.id).identity.features),JSON.stringify([[1,2]]));;
    console.log('PASS 32 buildIdentity keeps live edits and only merges identity');
  }
  {
    const embed2=deferred();
    const c2={document:{getElementById:()=>null},localStorage:{getItem:()=>null},setInterval(){},
      MangaModelRequest:{post:()=>embed2.promise},MangaCharacterBibleUI:{put:async card=>{store.set(card.id,card);},all:async()=>[...store.values()]},
      PanelAuto:{_cache:new Map()}};
    c2.window=c2;vm.createContext(c2);vm.runInContext(src('js/ai/character-library.js'),c2);
    store.clear();
    const card={id:'bob',name:'Bob',references:[png],identity:{features:[],tags:''}};
    store.set(card.id,card);
    const pending=c2.CharacterLibrary.buildIdentity(card);
    store.delete(card.id);
    embed2.resolve({ok:true,feature:[9],palette:[]});await pending;
    assert.equal(store.has(card.id),false);
    console.log('PASS 32 buildIdentity does not resurrect a deleted card');
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

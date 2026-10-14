// Audit 74/75 (LaMa cancel + mask invalidation) and 76 (SAM full hash).
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const repo=path.join(__dirname,'..','..');

{
  const src=fs.readFileSync(path.join(repo,'js/ai/sam-click-select.js'),'utf8');
  const c={window:{removeEventListener(){},MangaGPTRegionEditor:{}},document:{createElement:()=>({getContext:()=>({}),style:{}})},console};
  vm.createContext(c);vm.runInContext(src.replace('window.SamClickSelect = {','window.SamClickSelect = { auditHash:hashString, '),c);
  const hash=c.window.SamClickSelect.auditHash;
  assert.notEqual(hash('x'.repeat(200)+'A'),hash('x'.repeat(200)+'B'));
  const raw=fs.readFileSync(path.join(repo,'scripts/audit/round5-sam-audit-repro.cjs'),'utf8');
  const pngs=[...raw.matchAll(/"png":\s*"(data:image\/png;base64,[^"]+)"/g)].map(m=>m[1]);
  assert(pngs.length>=2);assert.equal(pngs[0].length,pngs[1].length);assert.notEqual(pngs[0],pngs[1]);
  assert.notEqual(hash(pngs[0]),hash(pngs[1]));
  console.log('PASS 76 SAM imageId hashes every character of the page');
}

function node(){return{style:{},dataset:{},children:[],hidden:false,disabled:false,checked:false,value:'',src:'',
  append(){},appendChild(x){return x;},replaceChildren(){},setAttribute(){},removeAttribute(n){if(n==='src')this.src='';},
  addEventListener(){},remove(){},querySelectorAll:()=>[],classList:{add(){},remove(){},toggle(){}},
  getContext(){return{fillStyle:'',clearRect(){},drawImage(){},fillRect(){},beginPath(){},arc(){},fill(){},
    getImageData:()=>({data:new Uint8ClampedArray(16)}),putImageData(){},filter:'',createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})};}};}
function cv(w=40,h=40){const c=node();c.width=w;c.height=h;c.toDataURL=()=>'data:image/png;base64,AA==';return c;}

(async()=>{
  function load(){
    const nodes={};for(const id of ['mangaLamaPreviewPanel','mangaLamaStatus','mangaLamaConfirm','mangaLamaPreviewImg','mangaLamaGenerate','mangaLamaUseDetector','mangaLamaKeepSfx','mangaLamaMaskCanvas','mangaLamaResetMask','mangaLamaAutoInk','mangaLamaBrushSize'])nodes[id]=node();
    nodes.mangaLamaMaskCanvas=cv();nodes.mangaLamaBrushSize.value='12';
    const added=[];let hold=null;let applied=0;
    class Img{set src(v){queueMicrotask(()=>{this.width=40;this.height=40;this.onload&&this.onload();});}}
    const canvas={add(o){added.push(o);},setActiveObject(){},requestRenderAll(){}};
    const x={console,AbortController,Image:Img,Promise,queueMicrotask,Uint8ClampedArray,
      document:{readyState:'loading',body:node(),createTextNode:()=>node(),addEventListener(){},getElementById:id=>nodes[id]||null,createElement:t=>t==='canvas'?cv():node()},
      window:{},localStorage:{getItem:()=>null,setItem(){}},
      fabric:{Image:{fromURL(url,cb){const go=()=>cb({set(a,b){typeof a==='string'?this[a]=b:Object.assign(this,a);return this;}});if(hold)hold(go);else go();}}},
      changeDoNotSaveHistory(){},changeDoSaveHistory(){},saveStateByManual(){},updateLayerPanel(){}};
    x.window=x;vm.createContext(x);
    const code=fs.readFileSync(path.join(repo,'js/ai/manga-lama-inpaint-ui.js'),'utf8')
      .replace('window.MangaLamaInpaintUI={','window.__a={refreshMask,generatePreview,apply,setPrepared(p){prepared=p;},getApproved(){return approved;},setApproved(v){approved=v;}};window.MangaLamaInpaintUI={');
    vm.runInContext(code,x);
    return{x,nodes,added,get applied(){return applied;},hold:f=>hold=f,canvas,bumpApplied(){applied++;}};
  }
  // 75: refreshMask clears confirm + preview
  {
    const h=load();
    const crop={x:0,y:0,width:40,height:40,maskCanvas:cv(),maskRect:{x:0,y:0,width:10,height:10},modelInput:'data:image/png;base64,AA==',maskSource:'rule'};
    const input={validate:()=>true,canvas:h.canvas,draft:{},sourceImage:'data:image/png;base64,AA==',onApplied(){h.bumpApplied();}};
    h.x.window.__a.setPrepared({input,crop,source:cv()});
    h.x.window.__a.setApproved({input,crop,result:'data:image/png;base64,OLD',ticket:1});
    h.nodes.mangaLamaConfirm.disabled=false;h.nodes.mangaLamaPreviewImg.src='data:image/png;base64,OLD';h.nodes.mangaLamaPreviewImg.hidden=false;
    h.nodes.mangaLamaUseDetector.checked=false;
    await h.x.window.__a.refreshMask();
    assert.equal(h.nodes.mangaLamaConfirm.disabled,true,'75: confirm disabled after mask refresh');
    assert.equal(h.nodes.mangaLamaPreviewImg.src,'','75: preview cleared');
    assert.equal(h.x.window.__a.getApproved(),null);
    console.log('PASS 75 LaMa mask change invalidates the approved preview');
  }
  // 74: cancel during fabric decode drops the layer
  {
    const h=load();
    const crop={x:1,y:2,width:40,height:40,maskCanvas:cv(),maskRect:{x:0,y:0,width:10,height:10},modelInput:'data:image/png;base64,AA=='};
    const input={validate:()=>true,canvas:h.canvas,draft:{},sourceImage:'data:image/png;base64,AA==',onApplied(){h.bumpApplied();}};
    h.x.window.__a.setApproved({input,crop,result:'data:image/png;base64,RES',ticket:0});
    h.nodes.mangaLamaConfirm.disabled=false;h.nodes.mangaLamaPreviewPanel.hidden=false;
    let release;h.hold(go=>release=go);
    const pending=h.x.window.__a.apply();
    await new Promise(r=>setTimeout(r,5));
    h.x.window.MangaLamaInpaintUI.cancel();
    release();await pending;
    assert.equal(h.added.length,0,'74: no layer after cancel');assert.equal(h.applied,0);
    console.log('PASS 74 LaMa cancel during decode does not commit a layer');
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

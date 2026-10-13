// Scratch-only read-only audit. VM exports references to unchanged production functions.
// Usage: node text_ui_repro.cjs /absolute/repository/root
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const repo=path.resolve(process.argv[2]||process.env.MANGA_AUDIT_ROOT||process.cwd());
const {createCanvas,Image,loadImage}=require(require.resolve('@napi-rs/canvas',process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}:undefined));
function node(){return {style:{},dataset:{},children:[],handlers:{},hidden:false,disabled:false,checked:false,value:'',append(...x){this.children.push(...x);},appendChild(x){this.children.push(x);return x;},replaceChildren(...x){this.children=x;},setAttribute(){},removeAttribute(){},addEventListener(k,f){this.handlers[k]=f;},remove(){}};}
function bitmap(w=200,h=120){const c=createCanvas(w,h);c.getContext('2d').fillStyle='white';c.getContext('2d').fillRect(0,0,w,h);return c;}
function imgLayer(el){return {type:'image',width:el.width,height:el.height,el,set(a,b){typeof a==='string'?this[a]=b:Object.assign(this,a);return this;},getElement(){return this.el;}};}
function env(){
 const nodes={};for(const id of ['mangaSmartTextPanel','mangaSmartStatus','mangaSmartDetect','mangaSmartApply','mangaSmartRegions','mangaSmartCancel','mangaSmartLanguage','mangaLamaPreviewPanel','mangaLamaStatus','mangaLamaConfirm','mangaLamaPreviewImg','mangaLamaGenerate','mangaLamaUseDetector','mangaLamaKeepSfx'])nodes[id]=node();
 nodes.mangaSmartLanguage.value='auto';nodes.mangaLamaKeepSfx.checked=true;
 nodes.mangaLamaMaskCanvas=createCanvas(1,1);
 const c={bitmap:bitmap(),objects:[{type:'image'}],added:[],getWidth(){return this.bitmap.width;},getHeight(){return this.bitmap.height;},getObjects(){return this.objects;},toDataURL(){return this.bitmap.toDataURL();},add(o){this.added.push(o);this.objects.push(o);},setActiveObject(){},requestRenderAll(){}};
 class Textbox {constructor(text,opts){Object.assign(this,opts,{text,type:'textbox'});}set(a,b){typeof a==='string'?this[a]=b:Object.assign(this,a);return this;}}
 let deferredFabric=null;
 const x={console,AbortController,Image,Promise,Uint8ClampedArray,requestAnimationFrame:f=>f(),getCanvasGUID:()=>x.guid,guid:'A',canvas:c,
 document:{readyState:'loading',body:node(),createTextNode:()=>node(),addEventListener(){},getElementById:id=>nodes[id]||null,createElement:tag=>tag==='canvas'?createCanvas(1,1):node()},window:{},fabric:{Textbox,VerticalTextbox:Textbox,Image:{fromURL(url,cb){const go=()=>loadImage(url).then(el=>cb(imgLayer(el)));if(deferredFabric)deferredFabric(go);else go();}}},localStorage:{getItem:()=>null,setItem(){}}};
 x.window.MangaModelRequest={post:async()=>{throw Error('mock handler missing');}};
 vm.createContext(x);vm.runInContext(fs.readFileSync(path.join(repo,'js/ai/manga-smart-text-core.js'),'utf8'),x);
 return {x,c,nodes,defer(f){deferredFabric=f;},eval(file){vm.runInContext(fs.readFileSync(path.join(repo,file),'utf8'),x,{filename:file});},evalLama(){vm.runInContext(fs.readFileSync(path.join(repo,'js/ai/manga-lama-inpaint-ui.js'),'utf8').replace('window.MangaLamaInpaintUI={','window.__audit={refreshMask,generatePreview,apply}; window.MangaLamaInpaintUI={'),x,{filename:'production-manga-lama-inpaint-ui.js'});}};
}
const at=(can,x,y)=>Array.from(can.getContext('2d').getImageData(x,y,1,1).data);
async function smartReady(h){h.eval('js/ai/manga-smart-text-editor.js');h.x.window.MangaModelRequest.post=async()=>({ok:true,width:200,height:120,regions:[{text:'新字幕',x:60,y:40,width:80,height:20,confidence:95}]});await h.x.window.MangaSmartTextEditor.detect();assert.equal(h.x.window.MangaSmartTextEditor.getDrafts().length,1);}
async function lamaReady(h){
 const source=h.c.bitmap,g=source.getContext('2d');g.fillStyle='black';g.fillRect(60,45,3,15);g.fillRect(85,45,3,15);
 const detector=bitmap(200,120),dg=detector.getContext('2d');dg.fillStyle='black';dg.fillRect(0,0,200,120);dg.fillStyle='white';dg.fillRect(60,45,3,15);
 h.evalLama();
 h.x.window.MangaModelRequest.post=async(url,body)=>{
  if(url.endsWith('text-mask'))return {ok:true,mask:detector.toDataURL()};
  assert(url.endsWith('lama-inpaint'));
  const src=await loadImage(body.image),mask=await loadImage(body.mask),out=createCanvas(src.width,src.height);out.getContext('2d').drawImage(src,0,0);const pixels=out.getContext('2d').getImageData(0,0,out.width,out.height),mc=createCanvas(src.width,src.height);mc.getContext('2d').drawImage(mask,0,0);const md=mc.getContext('2d').getImageData(0,0,mc.width,mc.height).data;
  for(let i=0;i<md.length;i+=4)if(md[i]>=128)pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255;
  out.getContext('2d').putImageData(pixels,0,0);return {ok:true,width:out.width,height:out.height,image:out.toDataURL()};
 };
 const input={canvas:h.c,sourceImage:source.toDataURL(),draft:{x:60,y:40,width:40,height:20},validate:()=>true,onApplied:()=>{h.applied=(h.applied||0)+1;}};
 await h.x.window.MangaLamaInpaintUI.preview(input);await h.x.window.__audit.generatePreview();assert.equal(h.nodes.mangaLamaConfirm.disabled,false);
}
(async()=>{
 // Actual source PNG, unchanged production apply; black bubble border is 2px above OCR bbox.
 let h=env(),g=h.c.bitmap.getContext('2d');g.fillStyle='black';g.fillRect(56,38,89,1);g.fillRect(56,62,89,1);g.fillRect(56,38,1,25);g.fillRect(144,38,1,25);g.fillRect(80,43,3,13);
 await smartReady(h);await h.x.window.MangaSmartTextEditor.apply();assert.equal(h.c.added.length,2);
 const eraser=h.c.added.find(o=>o.mangaSmartText==='erase-patch'),composite=bitmap();composite.getContext('2d').drawImage(h.c.bitmap,0,0);composite.getContext('2d').drawImage(eraser.el,eraser.left,eraser.top);
 assert.deepEqual(at(h.c.bitmap,100,38),[0,0,0,255]);assert.deepEqual(at(composite,100,38),[255,255,255,255]);
 console.log('CONFIRMED SAFE_ERASER_REMOVES_BUBBLE_BORDER: source border pixel(100,38)=[0,0,0,255], after smart apply eraser=[255,255,255,255]; uniform outer ring approved safe, opaque pad covered outline 2px above tight text box');
 // Original per-glyph size is 20px, but the tight OCR box spans three vertical columns.
 h=env();h.c.bitmap=bitmap(200,300);g=h.c.bitmap.getContext('2d');g.fillStyle='black';for(const xx of [60,85,110])for(const yy of [40,80,120,180])g.fillRect(xx,yy,20,20);
 h.eval('js/ai/manga-smart-text-editor.js');h.x.window.MangaModelRequest.post=async()=>({ok:true,width:200,height:300,regions:[{text:'新字',x:60,y:40,width:70,height:160,vertical:true,confidence:95,bubble:{x:40,y:20,width:140,height:220}}]});
 await h.x.window.MangaSmartTextEditor.detect();await h.x.window.MangaSmartTextEditor.apply();const caption=h.c.added.find(o=>o.mangaSmartText==='editable-subtitle');assert.equal(caption.fontSize,77);
 console.log('CONFIRMED MULTICOLUMN_FONT_CAP: original glyph width20 in 3-column OCR bbox width70; two-character replacement fontSize='+caption.fontSize+' (3.85x glyph), cap computed from full column stack instead of one glyph');
 // Hold the actual Fabric decoding await; switch the reused canvas/page while pending.
 h=env();await smartReady(h);let release,entered;const wait=new Promise(r=>entered=r);h.defer(go=>{release=go;entered();});const applying=h.x.window.MangaSmartTextEditor.apply();await wait;
 h.x.guid='B';h.c.bitmap=bitmap();h.c.bitmap.getContext('2d').fillStyle='pink';h.c.bitmap.getContext('2d').fillRect(0,0,200,120);h.c.objects=[{type:'image',guid:'B-original'}];h.x.window.MangaSmartTextEditor.syncPage();await release();await applying;
 assert.equal(h.c.added.length,2);assert.equal(h.x.guid,'B');console.log('CONFIRMED SMART_TEXT_ASYNC_CROSS_PAGE: apply begun on A, Fabric eraser decode delayed, page changed and syncPage called; 2 old-A layers added to current B, B drafts cleared');
 // Cancel is publicly exported and runs while the actual application decode is suspended.
 h=env();await lamaReady(h);release=null;entered=null;const waiting=new Promise(r=>entered=r);h.defer(go=>{release=go;entered();});const pending=h.x.window.__audit.apply();await waiting;h.x.window.MangaLamaInpaintUI.cancel();assert.equal(h.nodes.mangaLamaPreviewPanel.hidden,true);await release();await pending;
 assert.equal(h.c.added.length,1);assert.equal(h.applied,1);console.log('CONFIRMED LAMA_CANCEL_LATE_APPLY: after public cancel hides panel and clears approved/prepared, delayed Fabric decode inserts one lama-erase-patch and calls onApplied');
 // A change of mask settings after approval replaces mask, retaining old preview and enabled confirm.
 h=env();await lamaReady(h);const beforePreview=h.nodes.mangaLamaPreviewImg.src;
 h.nodes.mangaLamaUseDetector.checked=true;await h.x.window.__audit.refreshMask();assert.equal(h.nodes.mangaLamaConfirm.disabled,false);assert.equal(h.nodes.mangaLamaPreviewImg.src,beforePreview);assert.equal(h.x.window.MangaLamaInpaintUI.maskSource(),'detector');
 await h.x.window.__audit.apply();assert.equal(h.c.added.length,1);
 const layer=h.c.added[0],output=bitmap();output.getContext('2d').drawImage(h.c.bitmap,0,0);output.getContext('2d').drawImage(layer.el,layer.left,layer.top);
 assert.deepEqual(at(output,86,50),[0,0,0,255]);
 const preview=await loadImage(beforePreview),pc=createCanvas(preview.width,preview.height);pc.getContext('2d').drawImage(preview,0,0);assert.deepEqual(at(pc,86-layer.left,50-layer.top),[255,255,255,255]);
 console.log('CONFIRMED LAMA_STALE_APPROVAL_AFTER_MASK_CHANGE: rule preview erased both strokes, changing detector keeps confirm enabled and preview src identical; actual confirmed output restores black second stroke(86,50), while shown preview pixel is white');
})().catch(e=>{console.error(e);process.exitCode=1;});

// Audit 71 (cover stops at the balloon outline) and 73 (apply pinned to its page).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const repo=path.join(__dirname,'..','..');
// tiny RGBA "canvas": white page with a black horizontal border at y=38 from x=56..144
function pixmap(w,h,border){const d=new Uint8ClampedArray(w*h*4).fill(255);if(border)for(let x=56;x<=144;x++){const i=(38*w+x)*4;d[i]=d[i+1]=d[i+2]=0;}
 return {width:w,height:h,data:d,getContext(){const self=this;return {measureText:t=>({width:String(t).length*10}),drawImage(){},fillRect(){},putImageData(){},createImageData:(W,H)=>({data:new Uint8ClampedArray(W*H*4)}),
  getImageData(x,y,W,H){const o=new Uint8ClampedArray(W*H*4);for(let yy=0;yy<H;yy++)for(let xx=0;xx<W;xx++){const si=((y+yy)*self.width+(x+xx))*4,di=(yy*W+xx)*4;for(let k=0;k<4;k++)o[di+k]=self.data[si+k]??255;}return {data:o};}};},toDataURL:()=>'data:image/png;base64,AA=='};}
function node(){return {style:{},dataset:{},children:[],classList:{add(){},remove(){},toggle(){}},hidden:false,disabled:false,checked:false,value:'',append(...x){this.children.push(...x);},appendChild(x){this.children.push(x);return x;},replaceChildren(...x){this.children=x;},setAttribute(){},removeAttribute(){},addEventListener(){},remove(){},querySelectorAll:()=>[]};}
function env(border){
 const nodes={};for(const id of ['mangaSmartTextPanel','mangaSmartStatus','mangaSmartDetect','mangaSmartApply','mangaSmartRegions','mangaSmartCancel','mangaSmartLanguage'])nodes[id]=node();nodes.mangaSmartLanguage.value='auto';
 const page=pixmap(200,120,border);let snap='page-A';
 const c={objects:[{type:'image'}],added:[],getWidth:()=>200,getHeight:()=>120,getObjects(){return this.objects;},toDataURL:()=>snap,add(o){this.added.push(o);},setActiveObject(){},requestRenderAll(){}};
 class Textbox{constructor(t,o){Object.assign(this,o,{text:t,type:'textbox'});}set(a,b){typeof a==='string'?this[a]=b:Object.assign(this,a);return this;}setCoords(){}}
 let hold=null;class Image{set src(v){queueMicrotask(()=>this.onload&&this.onload());}}
 const x={console,AbortController,Image,Promise,Uint8ClampedArray,queueMicrotask,requestAnimationFrame:f=>f(),guid:'A',canvas:c,
  document:{readyState:'loading',body:node(),createTextNode:()=>node(),addEventListener(){},getElementById:id=>nodes[id]||null,createElement:t=>t==='canvas'?pixmap(200,120,border):node()},
  window:{},fabric:{Textbox,VerticalTextbox:Textbox,Image:{fromURL(url,cb){const go=()=>cb({width:10,height:10,set(a,b){typeof a==='string'?this[a]=b:Object.assign(this,a);return this;},url});if(hold)hold(go);else go();}}},localStorage:{getItem:()=>null,setItem(){}}};
 x.getCanvasGUID=()=>x.guid;x.window.MangaModelRequest={post:async()=>({ok:true,width:200,height:120,regions:[{text:'新字幕',x:60,y:40,width:80,height:20,confidence:95}]})};
 vm.createContext(x);
 // pixel source for apply = the page pixmap
 x.document.createElement=t=>t==='canvas'?Object.assign(pixmap(200,120,border),{}):node();
 vm.runInContext(fs.readFileSync(path.join(repo,'js/ai/manga-smart-text-core.js'),'utf8'),x);
 vm.runInContext(fs.readFileSync(path.join(repo,'js/ai/manga-smart-text-editor.js'),'utf8').replace(/function makeErasure\(source, box, color\) \{/,'function makeErasure(source, box, color) { window.__lastErase={box:box};'),x);
 return {x,c,nodes,setSnap:v=>snap=v,hold:f=>hold=f};
}
(async()=>{
 {
  const h=env(true);await h.x.window.MangaSmartTextEditor.detect();await h.x.window.MangaSmartTextEditor.apply();
  const patch=h.c.added.find(o=>o.mangaSmartText==='erase-patch');assert(patch,'erase patch created: '+h.nodes.mangaSmartStatus.textContent+JSON.stringify(h.c.added.map(o=>o.mangaSmartText)));
  assert(patch.top>38,'71: cover starts below the balloon outline at y=38, got top='+patch.top);
  const free=env(false);await free.x.window.MangaSmartTextEditor.detect();await free.x.window.MangaSmartTextEditor.apply();
  assert(free.c.added.find(o=>o.mangaSmartText==='erase-patch').top<=35,'normal padding without an outline');
  console.log('PASS 71 smart-text cover never extends over the balloon outline');
 }
 {
  const h=env(false);await h.x.window.MangaSmartTextEditor.detect();let release;h.hold(go=>release=go);
  const applying=h.x.window.MangaSmartTextEditor.apply();await new Promise(r=>setTimeout(r,5));
  h.x.guid='B';h.setSnap('page-B');if(h.x.window.MangaSmartTextEditor.syncPage)h.x.window.MangaSmartTextEditor.syncPage();release();await applying;
  assert.equal(h.c.added.length,0,'73: nothing from page A lands on page B');
  console.log('PASS 73 smart-text apply is cancelled when the page changes mid-decode');
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

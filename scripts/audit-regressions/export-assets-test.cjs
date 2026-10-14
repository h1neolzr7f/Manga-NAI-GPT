// Audit 64 (orphan blob race), 65 (excludeFromExport on raster), 66 (export restore).
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const repo=path.join(__dirname,'..','..');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6s9kAAAAASUVORK5CYII=';
class Reader{readAsDataURL(b){b.arrayBuffer().then(x=>{this.result='data:'+b.type+';base64,'+Buffer.from(x).toString('base64');this.onload&&this.onload({target:this});});}}
function fakeIdb(records){return{open(){const req={};queueMicrotask(()=>{req.result={objectStoreNames:{contains:()=>true},transaction(){const tx={objectStore(){return{
 put(e,id){queueMicrotask(()=>{records.set(id,e);tx.oncomplete&&tx.oncomplete();});},
 delete(id){queueMicrotask(()=>{records.delete(id);tx.oncomplete&&tx.oncomplete();});},
 get(id){const r={};queueMicrotask(()=>{r.result=records.get(id);r.onsuccess&&r.onsuccess();});return r;},
 getAll(){const r={};queueMicrotask(()=>{r.result=[...records.values()];r.onsuccess&&r.onsuccess();});return r;}};}};return tx;}};req.onsuccess&&req.onsuccess();});return req;}};}
function setup({storage=new Map(),records=new Map()}={}){
 const c={console,Date,Math,JSON,Object,Array,Promise,Set,Map,Blob,Uint8Array,ArrayBuffer,atob,queueMicrotask,FileReader:Reader,indexedDB:fakeIdb(records),
  localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){storage.set(k,v);}}};
 c.globalThis=c;vm.createContext(c);
 for(const f of ['asset-manifest','asset-blob-store','asset-scanner','asset-store','asset-pack','image2-job-store','image2-client'])
  vm.runInContext(fs.readFileSync(path.join(repo,'js/assets/'+f+'.js'),'utf8'),c,{filename:f});
 return {c,storage,records,store:c.NaiComicAssetStoreDefault};
}
(async()=>{
 const s=setup();const file=new Blob([Buffer.from(PNG.split(',')[1],'base64')],{type:'image/png'});
 const {asset}=s.store.register({id:'remove-inflight',name:'remove.png'},file);
 const saving=s.store.persistGenerated(asset,file);
 s.store.remove(asset.id);
 await saving.catch(()=>{});await new Promise(r=>setTimeout(r,20));
 assert.equal(s.store.list().length,0);assert.equal(s.records.size,0,'64: late put must not leave an orphan blob');
 console.log('PASS 64 remove during persist leaves no orphan blob');
})().catch(e=>{console.error(e);process.exitCode=1;});

{
 const hidden=[];
 const objs=[{name:'art',visible:true},{name:'crop',visible:true,excludeFromExport:true,naiCropFrame:true}];
 const canvas={width:100,height:100,viewportTransform:[1,0,0,1,0,0],interactive:true,enableRetinaScaling:true,contextTop:{ok:1},
  getObjects:()=>objs,toDataURL(){objs.forEach(o=>{if(!o.visible)hidden.push(o.name);});
   this.width=200;this.height=200;this.interactive=false;this.enableRetinaScaling=false;this.contextTop=null;this.viewportTransform=[2,0,0,2,0,0];
   throw new Error('fixture render failure');}};
 let drawCount=0,errors=0;
 const x={console,canvas,document:{createElement:()=>({})},$:()=>null,isGridVisible:true,drawGrid(){drawCount++;},removeGrid(){},
  createToast(){},createToastError(){errors++;},Image:class{},Promise,fetch};
 x.window=x;vm.createContext(x);vm.runInContext(fs.readFileSync(path.join(repo,'js/core/util/image-util.js'),'utf8'),x);
 assert.throws(()=>x.ImageUtil.exportCanvasDataURL(2,'png'),/render failure/);
 assert.deepEqual(hidden,['crop'],'65: helper hidden during export');
 assert.equal(objs[1].visible,true,'65: helper restored after export');
 assert.equal(canvas.width,100);assert.equal(canvas.height,100);assert.equal(canvas.interactive,true);
 assert.equal(canvas.enableRetinaScaling,true);assert.equal(canvas.contextTop.ok,1);
 assert.deepEqual(Array.from(canvas.viewportTransform),[1,0,0,1,0,0]);
 console.log('PASS 65/66 export hides helpers and restores the live canvas after failure');

 drawCount=0;errors=0;
 canvas.toDataURL=()=>{throw new Error('fixture synchronous codec failure');};
 canvas.backgroundImage={};x.removeGrid=()=>{canvas.backgroundImage=null;};
 assert.throws(()=>x.ImageUtil.cropAndDownload(),/codec failure/);
 assert.equal(drawCount,1,'66: grid restored after sync throw');assert.equal(errors,1);
 console.log('PASS 66 cropAndDownload restores grid after a synchronous export error');
}

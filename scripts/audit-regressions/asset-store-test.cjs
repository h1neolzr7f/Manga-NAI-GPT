// Audit 18 (asset add pinned to its page) and 19 (failed persistence is reported, not hidden).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const repo=path.join(__dirname,'..','..');
class Reader{readAsDataURL(){queueMicrotask(()=>{this.result='data:image/png;base64,AA==';this.onload&&this.onload();});}}
let guid='page-A',decode=null;const added=[];
const cv={add:o=>added.push({guid,o}),getObjects:()=>[],getActiveObject:()=>null};
const c={console,Date,Math,JSON,Object,Array,Promise,Set,Map,Blob,Uint8Array,ArrayBuffer,atob,queueMicrotask,FileReader:Reader,
 localStorage:{getItem:()=>null,setItem(){}},fetch:()=>Promise.reject(new Error('offline')),
 NaiComicAssetBlobStore:{put:()=>Promise.reject(new Error('QuotaExceededError'))},
 canvas:cv,getCanvasGUID:()=>guid,fabric:{Image:{fromURL:(u,cb)=>{decode=cb;}}}};
c.globalThis=c;vm.createContext(c);
for(const f of ['asset-manifest','asset-store'])vm.runInContext(fs.readFileSync(path.join(repo,'js/assets/'+f+'.js'),'utf8'),c,{filename:f});
c.NaiComicAssetBlobStore={put:()=>Promise.reject(new Error('QuotaExceededError'))};
(async()=>{
 const store=c.NaiComicAssetStoreDefault;
 store.register({id:'a1',name:'a.png',mime:'image/png'});
 const saved=await store.persistImported(store.get('a1'),new Blob(['x'],{type:'image/png'}));
 assert.equal(saved.memoryOnly,true,'19: memory-only asset is flagged');
 const ctl=fs.readFileSync(path.join(repo,'js/assets/asset-library-controller.js'),'utf8');
 assert(/persisted===false/.test(ctl)&&/刷新后会丢失/.test(ctl),'19: UI reports memory-only imports');
 console.log('PASS 19 failed asset persistence is flagged and reported');
 store.getDataUrl=()=>Promise.resolve('data:image/png;base64,AA==');
 const p=store.addToCanvas('a1');await new Promise(r=>setTimeout(r,0));
 guid='page-B';decode({set(){},width:1,height:1});
 await assert.rejects(p,/切换了页面/);assert.equal(added.length,0,'18: nothing added to page B');
 guid='page-A';const p2=store.addToCanvas('a1');await new Promise(r=>setTimeout(r,0));decode({set(){},width:1,height:1});await p2;assert.equal(added.length,1);
 console.log('PASS 18 asset added during a page switch is not dropped onto the new page');
})().catch(e=>{console.error(e);process.exitCode=1;});

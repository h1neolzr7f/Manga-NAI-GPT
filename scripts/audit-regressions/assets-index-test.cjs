// Audit 61 (generated asset needs its index committed) and 62 (atomic asset-pack import).
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const repo=path.join(__dirname,'..','..');const MANIFEST='nai_comic_asset_manifest_v1';
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6s9kAAAAASUVORK5CYII=';
class Reader{readAsDataURL(b){b.arrayBuffer().then(x=>{this.result='data:'+b.type+';base64,'+Buffer.from(x).toString('base64');this.onload&&this.onload({target:this});});}}
function fakeIdb(records){return {open(){const req={};queueMicrotask(()=>{req.result={objectStoreNames:{contains:()=>true},transaction(){const tx={objectStore(){return {
 put(e,id){queueMicrotask(()=>{records.set(id,e);tx.oncomplete&&tx.oncomplete();});},delete(id){queueMicrotask(()=>{records.delete(id);tx.oncomplete&&tx.oncomplete();});},
 get(id){const r={};queueMicrotask(()=>{r.result=records.get(id);r.onsuccess&&r.onsuccess();});return r;},getAll(){const r={};queueMicrotask(()=>{r.result=[...records.values()];r.onsuccess&&r.onsuccess();});return r;}};}};return tx;}};req.onsuccess&&req.onsuccess();});return req;}};}
function setup({storage=new Map(),records=new Map(),failManifest=false}={}){
 const c={console,Date,Math,JSON,Object,Array,Promise,Set,Map,Blob,Uint8Array,ArrayBuffer,atob,queueMicrotask,FileReader:Reader,indexedDB:fakeIdb(records),
  localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){if(failManifest&&k===MANIFEST)throw new Error('QuotaExceededError');storage.set(k,v);}}};
 c.globalThis=c;vm.createContext(c);
 for(const f of ['asset-manifest','asset-blob-store','asset-scanner','asset-store','asset-pack','image2-job-store','image2-client'])vm.runInContext(fs.readFileSync(path.join(repo,'js/assets/'+f+'.js'),'utf8'),c,{filename:f});
 return {c,storage,records,store:c.NaiComicAssetStoreDefault,client:new c.NaiImage2Client()};
}
(async()=>{
 {
  const s=setup({failManifest:true});let calls=0;
  s.c.NaiImage2ProviderRegistry.register({id:'fx',generate:async()=>{calls++;return {image:PNG};}});
  let err='';try{await s.client.submit({providerId:'fx',assetName:'portrait'});}catch(e){err=e.message;}
  assert(err,'61: index write failure must not report success');
  const job=s.c.NaiImage2JobStoreDefault.list()[0];assert.equal(job.status,'failed');assert.equal(job.failureStage,'persistence');
  s.storage.clear();s.c.localStorage.setItem=(k,v)=>s.storage.set(k,v); // storage freed up
  const ok=await s.client.retry(job.id);assert.equal(ok.job.status,'succeeded');assert.equal(calls,1,'retry does not regenerate');
  const r=setup({storage:s.storage,records:s.records});await r.store.hydrateBlobs();assert(r.store.get(ok.asset.id),'asset visible after reopen');
  console.log('PASS 61 generated asset only succeeds once its index is saved; retry keeps the bytes');
 }
 {
  const s=setup();s.store.register({id:'original',name:'original.png',path:'user_data/asset_packs/imported/original.png'});
  let err='';try{s.c.NaiComicAssetPack.importText(s.store,JSON.stringify({type:'nai-comic-asset-pack',assets:[
   {id:'original',name:'original.png',path:'user_data/asset_packs/imported/missing-backup.png'},{id:'new-before-error',name:'good.png'},{id:'invalid',name:'bad.png',size:-1}]}));}catch(e){err=e.message;}
  assert.equal(err,'asset size cannot be negative');
  for(const st of [s.store,setup({storage:s.storage}).store]){assert.equal(st.get('original').path,'user_data/asset_packs/imported/original.png');assert.equal(st.get('new-before-error'),null);}
  console.log('PASS 62 failed pack import leaves the library unchanged');
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

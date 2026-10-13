/* Offline production-function audit. Exit 0 means defects reproduced, not fixed.
 * node round5-assets-audit-repro.cjs /absolute/path/to/Manga-NAI-GPT
 * Only temporary fixture files are written. No network, credentials or models. */
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const assert = require('node:assert/strict'), os = require('node:os');
const {spawnSync} = require('node:child_process'), zlib = require('node:zlib');
const repo = path.resolve(process.argv[2] || process.env.MANGA_AUDIT_ROOT || process.cwd());
const MANIFEST = 'nai_comic_asset_manifest_v1';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6s9kAAAAASUVORK5CYII=';
class Reader {
  readAsDataURL(blob) { blob.arrayBuffer().then(b => { this.result='data:'+blob.type+';base64,'+Buffer.from(b).toString('base64'); this.onload?.({target:this}); }); }
}
// Minimal IDB dependency: production blob-store APIs run unchanged; request/tx
// events are controllable. All persistent records are fixture-only memory.
function fakeIdb(records) {
  const pendingOpen=[];
  const api={holdOpen:false,pendingOpen,open(){
    const req={result:null};
    const release=()=>queueMicrotask(()=>{
      req.result={objectStoreNames:{contains:()=>true},transaction(){
        const tx={objectStore(){return {
          put(entry,id){queueMicrotask(()=>{records.set(id,entry);tx.oncomplete?.();});},
          delete(id){queueMicrotask(()=>{records.delete(id);tx.oncomplete?.();});},
          get(id){const r={};queueMicrotask(()=>{r.result=records.get(id);r.onsuccess?.();});return r;},
          getAll(){const r={};queueMicrotask(()=>{r.result=[...records.values()];r.onsuccess?.();});return r;}
        };}};return tx;
      }};req.onsuccess?.();
    });
    if(api.holdOpen)pendingOpen.push(release);else release();
    return req;
  }};return api;
}
function setup({storage=new Map(),records=new Map(),failManifest=false}={}) {
  const indexedDB=fakeIdb(records);
  const context={console,Date,Math,JSON,Object,Array,Promise,Set,Map,Blob,Uint8Array,ArrayBuffer,atob,FileReader:Reader,indexedDB,
    localStorage:{getItem:k=>storage.get(k)||null,setItem(k,v){if(failManifest&&k===MANIFEST)throw new Error('QuotaExceededError');storage.set(k,v);}}};
  context.globalThis=context;vm.createContext(context);
  for(const file of ['asset-manifest','asset-blob-store','asset-scanner','asset-store','asset-pack','image2-job-store','image2-client'])
    vm.runInContext(fs.readFileSync(path.join(repo,'js/assets/'+file+'.js'),'utf8'),context,{filename:file+'.js'});
  return {context,storage,records,indexedDB,store:context.NaiComicAssetStoreDefault,client:new context.NaiImage2Client()};
}
function output(label,value){console.log(label+' '+JSON.stringify(value));}
function pngPixel(r,g,b){
  function crc(bytes){let n=0xffffffff;for(const v of bytes){n^=v;for(let i=0;i<8;i++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
  function chunk(type,data){const label=Buffer.from(type),size=Buffer.alloc(4),checksum=Buffer.alloc(4);size.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(Buffer.concat([label,data])));return Buffer.concat([size,label,data,checksum]);}
  const header=Buffer.alloc(13);header.writeUInt32BE(1,0);header.writeUInt32BE(1,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(Buffer.from([0,r,g,b,255]))),chunk('IEND',Buffer.alloc(0))]);
}
async function main(){
  {
    const s=setup({failManifest:true});let calls=0;
    s.context.NaiImage2ProviderRegistry.register({id:'fixture',generate:async()=>{calls++;return {image:PNG};}});
    const result=await s.client.submit({providerId:'fixture',assetName:'portrait'});
    const restored=setup({storage:s.storage,records:s.records});await restored.store.hydrateBlobs();
    assert.equal(result.job.status,'succeeded');assert.equal(restored.store.list().length,0);assert.equal(restored.store.files.size,1);
    output('DEFECT generated-success-lost-index',{calls,status:result.job.status,durableBlobs:s.records.size,manifestWritten:s.storage.has(MANIFEST),reloadedAssetCount:restored.store.list().length,hydratedFiles:restored.store.files.size,jobAssetResolves:!!restored.store.get(result.asset.id)});
  }
  {
    const s=setup();s.store.register({id:'original',name:'original.png',path:'user_data/asset_packs/imported/original.png'});
    const before=s.store.get('original').path;
    s.context.document={};s.context.fetch=async url=>({ok:url===before,blob:async()=>new Blob([Buffer.from(PNG.split(',')[1],'base64')],{type:'image/png'})});
    assert.equal(await s.store.getDataUrl('original'),PNG);
    let error='';try{s.context.NaiComicAssetPack.importText(s.store,JSON.stringify({type:'nai-comic-asset-pack',assets:[
      {id:'original',name:'original.png',path:'user_data/asset_packs/imported/missing-backup.png'},
      {id:'new-before-error',name:'good.png'}, {id:'invalid',name:'bad.png',size:-1}
    ]}));}catch(e){error=e.message;}
    const restored=setup({storage:s.storage});
    restored.context.document={};restored.context.fetch=s.context.fetch;
    const afterSource=await restored.store.getDataUrl('original');
    assert.equal(error,'asset size cannot be negative');assert.equal(restored.store.get('original').path,'user_data/asset_packs/imported/missing-backup.png');assert.ok(restored.store.get('new-before-error'));
    assert.equal(afterSource,'user_data/asset_packs/imported/missing-backup.png');
    output('DEFECT failed-index-import-mutates-library',{error,before,after:restored.store.get('original').path,originalPreviouslyReadable:true,afterSource,persistedIds:restored.store.list().map(a=>a.id)});
  }
  {
    const s=setup();s.context.NaiImage2ProviderRegistry.register({id:'fixture',generate:async()=>({image:PNG})});
    const {asset}=await s.client.submit({providerId:'fixture'});const pack=s.store.exportPack({includeThumbnails:true});
    const same=setup({records:s.records});same.store.importPack(pack);await same.store.hydrateBlobs();
    assert.equal(await same.store.getDataUrl(asset.id),PNG);
    const fresh=setup();fresh.store.importPack(pack);fresh.store.detectMissing();let error='';try{await fresh.store.getDataUrl(asset.id);}catch(e){error=e.message;}
    assert.ok(error);assert.equal(fresh.store.get(asset.id).missing,true);
    output('LIMITATION index-is-not-byte-backup',{sameBlobStoreRestores:true,freshBlobStoreRestores:false,missing:fresh.store.get(asset.id).missing,error});
  }
  {
    const s=setup();const file=new Blob([Buffer.from(PNG.split(',')[1],'base64')],{type:'image/png'});
    const {asset}=s.store.register({id:'remove-inflight',name:'remove.png'},file);
    const saving=s.store.persistGenerated(asset,file);
    s.store.remove(asset.id);
    // persistFile defers put into a Promise.then; remove opens IDB immediately.
    await saving;
    assert.equal(s.store.list().length,0);assert.equal(s.records.size,1);
    output('RACE removed-inflight-file-becomes-orphan',{libraryAssets:s.store.list().length,durableBlobs:s.records.size,metadataResurrected:false});
  }
  {
    const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'asset-collision-'));
    try{
      const s=setup();delete s.context.indexedDB;
      s.context.fetch=async(url,options)=>{
        assert.equal(url,'/user-assets');
        const py='import importlib.util,json,sys,os\nspec=importlib.util.spec_from_file_location("audit_server",sys.argv[1]);server=importlib.util.module_from_spec(spec);spec.loader.exec_module(server)\nos.chdir(sys.argv[2]);rel,error=server.save_imported_asset(json.loads(sys.stdin.read()));print(json.dumps({"path":rel,"error":error}))';
        const result=spawnSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['-B','-c',py,path.join(repo,'99_server.py'),scratch],{input:options.body,encoding:'utf8'});
        if(result.status!==0)throw new Error(result.stderr);
        const payload=JSON.parse(result.stdout);return {ok:!payload.error,json:async()=>payload};
      };
      const name='a_very_long_original_character_portrait.png';
      const red=pngPixel(255,0,0),blue=pngPixel(0,0,255);
      const fileA=new Blob([red],{type:'image/png'});fileA.name=name;
      const fileB=new Blob([blue],{type:'image/png'});fileB.name=name;
      const a=await s.store.addFile(fileA,{sourceType:'imported'}),b=await s.store.addFile(fileB,{sourceType:'imported'});
      const currentA=s.store.get(a.asset.id),currentB=s.store.get(b.asset.id);
      const disk=fs.readFileSync(path.join(scratch,currentA.path));
      assert.notEqual(currentA.id,currentB.id);assert.notEqual(currentA.hash,currentB.hash);assert.equal(currentA.path,currentB.path);assert.ok(disk.equals(blue));assert.ok(!disk.equals(red));
      const restored=setup({storage:s.storage});delete restored.context.indexedDB;await restored.store.hydrateBlobs();
      const sourceA=await restored.store.getDataUrl(currentA.id),sourceB=await restored.store.getDataUrl(currentB.id);
      const bothBlue=fs.readFileSync(path.join(scratch,sourceA)).equals(blue)&&fs.readFileSync(path.join(scratch,sourceB)).equals(blue);
      assert.ok(bothBlue);
      output('DEFECT server-path-collision-overwrites-original',{distinctIds:currentA.id!==currentB.id,distinctHashes:currentA.hash!==currentB.hash,assetCount:s.store.list().length,pathA:currentA.path,pathB:currentB.path,firstFileReplacedBySecond:disk.equals(blue),reloadedBothBlue:bothBlue});
    }finally{fs.rmSync(scratch,{recursive:true,force:true});}
  }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});

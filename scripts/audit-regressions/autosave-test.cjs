const fs=require('fs'),vm=require('vm'),assert=require('assert');
const repo=(process.env.MANGA_AUDIT_ROOT||process.cwd());
const log={info(){},error(){},debug(){},warn(){}};
function ctx(){
 const c={objects:[],canvasGuid:'A',width:100,height:100,renderAll(){},getObjects(){return this.objects;},toJSON(){return JSON.parse(JSON.stringify({objects:this.objects,canvasGuid:this.canvasGuid}));},loadFromJSON(s,cb){this.objects=s.objects;this.canvasGuid=s.canvasGuid;cb();}};
 const enc=new TextEncoder(),dec=new TextDecoder();
 const x={console,Blob,Uint8Array,ArrayBuffer,TextDecoder,TextEncoder,Map,Promise,URL,atob,btoa,canvas:c,commonProperties:[],document:{addEventListener(){},querySelector(){return null;}},$:()=>({addEventListener(){}}),fabric:{Object:function(){}},uiLogger:log,compressionLogger:log,layerLogger:log,autoSaveLogger:log,
 getCanvasGUID:()=>c.canvasGuid,setCanvasGUID:g=>c.canvasGuid=g||'new',generateGUID:()=> 'B',getObjectCount:()=>c.objects.length,updateLayerPanel(){},clearJSTSGeometry(){},customSpeechBubbleAllRelocation(){},resetEventHandlers(){},isSpeechBubbleSVG:()=>false,isFreehandBubblePath:()=>false,basePrompt:{},resizeCanvasByNum(w,h){c.width=w;c.height=h;},removeGrid(){},isGridVisible:false,getCropAndDownloadLinkByMultiplier:async()=>({href:'data:image/jpeg;base64,AQ=='}),ArrayBufferUtils:{toArrayBuffer:async v=>enc.encode(v).buffer,fromArrayBufferToString:v=>v?dec.decode(v):''},
 getDataByName:(files,name)=>files.find(f=>f.name===name)?.data,
 FileReader:class{readAsText(){}readAsArrayBuffer(){}},
 localStorage:{getItem:()=>null},setTimeout,clearTimeout,setInterval,clearInterval};
 x.fabric.Object.prototype.toObject=function(){};x.window=x;
 x.lz4Compressor={putDataListByArrayBuffer(list,name,b){list.push({name,data:new Uint8Array(b)});},async buffersToLz4Blob(files){return new Blob([JSON.stringify(files.map(f=>({name:f.name,data:Array.from(f.data)})))]);},async unLz4Files(blob){return this.unLz4FilesByBuffer(await blob.arrayBuffer());},async unLz4FilesByBuffer(buf){return JSON.parse(dec.decode(buf)).map(f=>({name:f.name,data:new Uint8Array(f.data)}));}};
 vm.createContext(x);
 const pm=fs.readFileSync(repo+'/js/project-management.js','utf8'); vm.runInContext(pm.slice(pm.indexOf('function findCanvasGuid(obj)'),pm.indexOf('var localSettingsData=null;')),x);
 for(const f of ['js/layer/image-history-management.js','js/core/compression/project-compression.js','js/ui/bottom-bar.js'])vm.runInContext(fs.readFileSync(repo+'/'+f,'utf8'),x,{filename:f});
 vm.runInContext('btmAddImage=function(imageLink,blob,guid){btmProjectsMap.set(guid,{imageLink,blob});};updateAllPageNumbers=function(){};btmUpdateScrollButtons=function(){};btmUpdateHandleText=function(){};',x);
 return x;
}
function map(x){return vm.runInContext('btmProjectsMap',x);}
function setState(x,n){x.canvas.objects=[{type:'rect',left:n}];x.saveState();}
(async()=>{
 let stored=new Map(),writes=0,fail=false;
 const mk=()=>{const x=ctx();x.localforage={createInstance:()=>({async setItem(k,v){writes++;if(fail)throw Error('quota');stored.set(k,v);},async removeItem(k){stored.delete(k);}})};
  vm.runInContext(fs.readFileSync(repo+'/js/core/auto-save.js','utf8'),x);return x;};
 let x=mk();setState(x,0);setState(x,1);await x.btmSaveProjectFile(null,false);map(x).set('B',{blob:new Blob(['B'])});await x.AutoSaveManager.save();
 // 07: deleting a non-current page is saved
 let w=writes;map(x).delete('B');await x.AutoSaveManager.save();
 assert.ok(writes>w,'07: delete must trigger write');assert.equal(stored.get('pages').length,1);
 // 07: reorder is saved
 map(x).set('B',{blob:new Blob(['B'])});await x.AutoSaveManager.save();
 const a=map(x).get('A');map(x).delete('A');map(x).set('A',a);w=writes;await x.AutoSaveManager.save();
 assert.ok(writes>w,'07: reorder must trigger write');assert.deepEqual(stored.get('metadata').pageOrder,['B','A']);
 // unchanged project: no write
 w=writes;await x.AutoSaveManager.save();assert.equal(writes,w,'unchanged project must not write');
 console.log('PASS 07 autosave sees page delete and reorder');
 // 08: clear resets the marker; next save writes recovery data again
 await x.AutoSaveManager.clearAutoSave();await x.AutoSaveManager.save();assert.ok(stored.size>0,'08: save after clear must write');
 // 08: a failed write is retried
 setState(x,2);fail=true;await x.AutoSaveManager.save();fail=false;stored.clear();w=writes;await x.AutoSaveManager.save();
 assert.ok(writes>w&&stored.size>0,'08: retry after failure must write');
 console.log('PASS 08 autosave retries after failure and after clear');
 // 04: edit while compressing stays dirty
 stored=new Map();writes=0;x=mk();setState(x,0);setState(x,1);
 let release,startedResolve;const started=new Promise(r=>startedResolve=r),encode=x.lz4Compressor.buffersToLz4Blob;
 x.lz4Compressor.buffersToLz4Blob=async function(files){startedResolve();await new Promise(r=>release=r);return encode.call(this,files);};
 const saving=x.AutoSaveManager.save();await started;setState(x,2);release();await saving;
 x.lz4Compressor.buffersToLz4Blob=encode;
 w=writes;await x.AutoSaveManager.save();assert.ok(writes>w,'04: edit during compression must stay dirty');
 const savedFiles=await x.lz4Compressor.unLz4Files(stored.get('pages')[0].blob);
 const last=JSON.parse(JSON.parse(new TextDecoder().decode(savedFiles.filter(f=>f.name.startsWith('state_')).at(-1).data)));
 assert.equal(last.objects[0].left,2);
 console.log('PASS 04 edit during autosave compression is saved next round');
})().catch(e=>{console.error(e);process.exitCode=1;});

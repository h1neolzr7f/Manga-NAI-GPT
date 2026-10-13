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
 let x=ctx();setState(x,0);setState(x,1);await x.btmSaveProjectFile(null,false);setState(x,2);
 await x.chengeCanvasByGuid('A',true);
 assert.equal(x.canvas.objects[0].left,1);assert.equal(x.stateStack.length,2);
 console.log('CONFIRMED current thumbnail: edited left=2 -> left='+x.canvas.objects[0].left+', undo history length='+x.stateStack.length);
 // duplication uses source blob, keeps old GUID in original states even when saving copy
 x=ctx();setState(x,0);setState(x,1);await x.btmSaveProjectFile(null,false);await x.btmDuplicatePage('A');setState(x,8);await x.btmSaveProjectFile(null,false);
 const before=[...map(x).keys()];const files=await Promise.all([...map(x).values()].map(async d=>({data:new Uint8Array(await d.blob.arrayBuffer())})));
 map(x).clear();const loaded=await x.multiLoadLz4(files);
 assert.deepEqual(before,['A','B']);assert.deepEqual([...map(x).keys()],['A']);
 console.log('CONFIRMED duplicate round-trip: pages '+before+' -> '+[...map(x).keys()]+'; loader reports '+loaded);
 // Restore button's call is a no-save switch, so edited current page is lost.
 x=ctx();setState(x,0);setState(x,1);await x.btmSaveProjectFile(null,false);x.canvas.canvasGuid='B';x.stateStack=[];x.currentStateIndex=-1;setState(x,3);setState(x,4);await x.btmSaveProjectFile(null,false);setState(x,5);await x.chengeCanvasByGuid('A');await x.chengeCanvasByGuid('B',true);
 assert.equal(x.canvas.objects[0].left,4);console.log('CONFIRMED restore-page no-save switch: current B edit left=5 -> reopened B left=4');
 // Actual autosave function with controllable IndexedDB substitute.
 let stored=new Map(),writes=0,fail=false;
 x=ctx();x.localforage={createInstance:()=>({async setItem(k,v){writes++;if(fail)throw Error('quota');stored.set(k,v);},async removeItem(k){stored.delete(k);}})};
 vm.runInContext(fs.readFileSync(repo+'/js/core/auto-save.js','utf8'),x);setState(x,0);setState(x,1);await x.btmSaveProjectFile(null,false);map(x).set('B',{blob:'B'});await x.AutoSaveManager.save();
 let oldWrites=writes;map(x).delete('B');await x.AutoSaveManager.save();assert.equal(writes,oldWrites);assert.equal(stored.get('pages').length,2);
 console.log('CONFIRMED autosave deletion: current map='+[...map(x).keys()]+'; recovery pages='+stored.get('pages').map(p=>p.guid)+'; writes after deletion=0');
 // reorder also invisible
 map(x).set('B',{blob:'B'});const a=map(x).get('A');map(x).delete('A');map(x).set('A',a);await x.AutoSaveManager.save();assert.equal(writes,oldWrites);
 console.log('CONFIRMED autosave order: current='+[...map(x).keys()]+'; stored order='+stored.get('metadata').pageOrder+'; writes after reorder=0');
 await x.AutoSaveManager.clearAutoSave();await x.AutoSaveManager.save();assert.equal(stored.size,0);console.log('CONFIRMED clear autosave: same document still has no recovery data after subsequent save()');
 setState(x,2);fail=true;await x.AutoSaveManager.save();fail=false;oldWrites=writes;await x.AutoSaveManager.save();assert.equal(writes,oldWrites);assert.equal(stored.size,0);
 console.log('CONFIRMED autosave failure: retry after storage recovery performs 0 writes and has no recovery data');
 // Edit while the serialization/compression awaits: save hashes the later state although the blob is older.
 stored=new Map();writes=0;fail=false;x=ctx();x.localforage={createInstance:()=>({async setItem(k,v){writes++;stored.set(k,v);},async removeItem(k){stored.delete(k);}})};
 vm.runInContext(fs.readFileSync(repo+'/js/core/auto-save.js','utf8'),x);setState(x,0);setState(x,1);
 let release, startedResolve;const started=new Promise(r=>startedResolve=r), encode=x.lz4Compressor.buffersToLz4Blob;
 x.lz4Compressor.buffersToLz4Blob=async function(files){startedResolve();await new Promise(r=>release=r);return encode.call(this,files);};
 const saving=x.AutoSaveManager.save();await started;setState(x,2);release();await saving;
 const savedFiles=await x.lz4Compressor.unLz4Files(stored.get('pages')[0].blob);
 const savedStateFiles=savedFiles.filter(f=>f.name.startsWith('state_'));
 const savedLast=JSON.parse(JSON.parse(new TextDecoder().decode(savedStateFiles.at(-1).data)));
 oldWrites=writes;await x.AutoSaveManager.save();assert.equal(savedLast.objects[0].left,1);assert.equal(writes,oldWrites);
 console.log('CONFIRMED autosave concurrent edit: live left=2, saved left=1, next save() writes=0');

})().catch(e=>{console.error(e);process.exitCode=1;});

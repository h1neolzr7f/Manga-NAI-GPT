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
let guidSeq=0;
(async()=>{
 // 01: clicking the current page's own thumbnail keeps the live edit and history
 let x=ctx();setState(x,0);setState(x,1);await x.btmSaveProjectFile(null,false);setState(x,2);
 assert.equal(await x.chengeCanvasByGuid('A',true),true);
 assert.equal(x.canvas.objects[0].left,2,'01: live edit must survive same-page click');assert.equal(x.stateStack.length,3);
 console.log('PASS 01 same-page thumbnail keeps live edit');
 // 02: duplicate gets its own GUID inside saved states; reopen keeps both pages
 x=ctx();setState(x,0);setState(x,1);await x.btmSaveProjectFile(null,false);await x.btmDuplicatePage('A');setState(x,8);await x.btmSaveProjectFile(null,false);
 const before=[...map(x).keys()];const files=await Promise.all([...map(x).values()].map(async d=>({data:new Uint8Array(await d.blob.arrayBuffer())})));
 map(x).clear();await x.multiLoadLz4(files);
 assert.deepEqual(before,['A','B']);assert.deepEqual([...map(x).keys()],['A','B'],'02: copy must not merge with original');
 console.log('PASS 02 duplicate round-trip keeps A and B');
 // 03: restoring a deleted page saves the page being edited first
 x=ctx();setState(x,0);setState(x,1);await x.btmSaveProjectFile(null,false);x.canvas.canvasGuid='B';x.stateStack=[];x.currentStateIndex=-1;setState(x,3);setState(x,4);await x.btmSaveProjectFile(null,false);setState(x,5);
 const removedA={guid:'A',index:0,data:map(x).get('A')};map(x).delete('A');
 let clickHandler;const el=()=>({style:{},setAttribute(){},appendChild(){},remove(){},addEventListener(t,f){if(t==='click')clickHandler=f;}});
 x.document.createElement=el;x.document.getElementById=()=>null;x.document.body={appendChild(){}};
 vm.runInContext('reorderImages=function(){};',x);
 x.btmOfferPageRestore(removedA);await clickHandler();
 assert.equal(x.getCanvasGUID(),'A');await x.chengeCanvasByGuid('B',true);
 assert.equal(x.canvas.objects[0].left,5,'03: B edit must survive undo-delete');
 console.log('PASS 03 undo-delete keeps other page edit');
})().catch(e=>{console.error(e);process.exitCode=1;});

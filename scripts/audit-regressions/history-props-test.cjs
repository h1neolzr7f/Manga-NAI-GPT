const path=require('path');
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
const root=path.join(__dirname,'..','..');
(async()=>{
 // 25: text size/colour and sidebar flips record history and make autosave write
 const x=ctx();let writes=0;x.localforage={createInstance:()=>({async setItem(){writes++;},async removeItem(){}})};
 x.isText=o=>o&&o.type==='textbox';x.isVerticalText=()=>false;x.isSpeechBubbleText=()=>false;x.isImage=o=>o&&o.type==='image';x.canvas.getActiveObject=()=>x.canvas.objects[0];
 const o={type:'textbox',fontSize:32,fill:'#000000',left:0,set(v,n){if(typeof v==='string')this[v]=n;else Object.assign(this,v);},setCoords(){}};x.canvas.objects=[o];x.saveState();o.left=1;x.saveState();
 for(const f of ['js/sidebar/text/text-effect.js','js/core/util/image-util.js','js/core/auto-save.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),x);
 x.getCropAndDownloadLinkByMultiplier=async()=>({href:'data:image/jpeg;base64,AQ=='});
 await x.AutoSaveManager.save();const w=writes;
 x.changeFontSize(64);x.changeTextColor('#ff0000');await new Promise(r=>setTimeout(r,400));
 assert.equal(JSON.parse(x.stateStack.at(-1)).objects[0].fontSize,64,'25: font size in history');
 assert.equal(JSON.parse(x.stateStack.at(-1)).objects[0].fill,'#ff0000','25: colour in history');
 await x.AutoSaveManager.save();assert.ok(writes>w,'25: autosave writes after text props');
 o.type='image';o.flipX=false;o.flipY=false;x.saveState();x.flipHorizontally();x.flipVertically();
 const top=JSON.parse(x.stateStack.at(-1)).objects[0];assert.equal(top.flipX,true);assert.equal(top.flipY,true);
 console.log('PASS 25 text props and image flips are recorded');
 // 52: an event on a target with saveHistory=true saves; only explicit false suppresses
 assert.equal(x.isSaveObject({target:{saveHistory:true}}),true);
 assert.equal(x.isSaveObject({target:{}}),true);
 assert.equal(x.isSaveObject({target:{saveHistory:false}}),false);
 const pm=fs.readFileSync(path.join(root,'js/sidebar/panel/panel-manager.js'),'utf8');
 const body=pm.slice(pm.indexOf('function initialPutImage'),pm.indexOf('saveInitialState(img);',pm.indexOf('function initialPutImage')));
 assert.match(body,/delete img\.saveHistory/,'52: initial put image clears its temporary suppression');
 console.log('PASS 52 history filter honours saveHistory semantics; imported image edits are recorded');
 // 26: duplicating a layer gives the copy its own GUID
 const c={console,Promise,Map,Set,Math,JSON,Object,Array,Date,setTimeout,clearTimeout,clearInterval(){}};let domReady,interval;
 c.document={readyState:'loading',addEventListener:(e,cb)=>{if(e==='DOMContentLoaded')domReady=cb;},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],body:{contains:()=>true}};
 c.setInterval=cb=>{interval=cb;return 1;};c.localStorage={getItem:()=>null,setItem(){}};c.commonProperties=['guid','guids'];
 let n=0;c.generateGUID=()=>'new-'+(++n);
 const original={guid:'layer-A',guids:['child1'],left:0,top:0,name:'Panel',set(v){Object.assign(this,v);},clone(cb,props){const copy={left:this.left,top:this.top,name:this.name,set:this.set};props.forEach(k=>copy[k]=this[k]);cb(copy);}};
 const objects=[original];let active=original;
 c.canvas={getActiveObject:()=>active,add:o=>objects.push(o),setActiveObject:o=>active=o,requestRenderAll(){},getObjects:()=>objects};
 c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'js/core/command-history.js'),'utf8'),c);domReady&&domReady();for(let i=0;i<41;i++)interval&&interval();
 await c.Commands.run('sel.duplicate');
 assert.equal(objects.length,2);assert.notEqual(objects[1].guid,'layer-A','26: copy must get its own GUID');assert.deepEqual(objects[1].guids,[]);
 assert.deepEqual(original.guids,['child1']);
 console.log('PASS 26 duplicated layer has a unique GUID');
})().catch(e=>{console.error(e);process.exitCode=1;});

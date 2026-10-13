// Read-only fixture for failed project import transactionality. No user files used.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const repo=process.env.MANGA_AUDIT_ROOT||process.cwd();
const helper=fs.readFileSync(path.join(repo,'scripts/audit/editor-audit-repro.cjs'),'utf8').split('(async()=>{')[0];
const {ctx}=new Function('require',helper+';return {ctx};')(require);
function read(x,code){return vm.runInContext(code,x);}
async function fixture(x,state){
 const files=await x.generateProjectFileBufferListCore([JSON.stringify(state)],new Map([['new-image','new-pixels']]),{width:320,height:480,historyIndex:0},{prompt:'incoming'},'preview');
 return x.lz4Compressor.buffersToLz4Blob(files);
}
function original(){const x=ctx();x.canvas.objects=[{type:'rect',left:17}];x.saveState();x.canvas.objects=[{type:'rect',left:23}];x.saveState();read(x,"imageMap.set('old-image','old-pixels');basePrompt.prompt='original';");return x;}
(async()=>{
 // Control: syntax-invalid inner history is rejected before replacement.
 let x=original(),before=JSON.stringify(x.stateStack);
 let blob=await fixture(x,{objects:[],canvasGuid:'B'}),files=await x.lz4Compressor.unLz4Files(blob);
 files.find(f=>f.name.startsWith('state_')).data=new TextEncoder().encode(JSON.stringify('{'));
 blob=await x.lz4Compressor.buffersToLz4Blob(files);
 await assert.rejects(()=>x.loadLz4BlobProjectFile(blob));
 assert.equal(JSON.stringify(x.stateStack),before);assert(read(x,"imageMap.has('old-image')"));assert.equal(x.canvas.width,100);
 console.log('CONTROL syntax-invalid history: rejected with original history/image map/dimensions intact');
 // Syntactically valid but structurally invalid history passes the only preflight.
 x=original();blob=await fixture(x,{objects:null,canvasGuid:'B'});
 await assert.rejects(()=>x.loadLz4BlobProjectFile(blob),/map/);
 assert.equal(x.canvas.objects[0].left,23);assert.equal(x.canvas.canvasGuid,'A');
 assert.equal(x.stateStack.length,1);assert.equal(JSON.parse(x.stateStack[0]).objects,null);
 assert(!read(x,"imageMap.has('old-image')"));assert(read(x,"imageMap.has('new-image')"));
 assert.equal(x.basePrompt.prompt,'incoming');assert.equal(x.canvas.width,320);assert.equal(x.canvas.height,480);
 assert.equal(x.NaiPageLoading,false);assert.equal(x.isSaveHistory,true);
 assert.throws(()=>x.jumpToHistoryIndex(0),/map/);
 x.saveState();assert.equal(x.stateStack.length,2);assert.throws(()=>x.undo(),/map/);
 console.log('CONFIRMED FAILED_LOAD_NO_ROLLBACK: old page A still shows left=23, but history replaced by objects=null, old image map cleared, incoming prompt/dimensions applied; history jump and undo after next save throw');
})().catch(e=>{console.error(e);process.exitCode=1;});

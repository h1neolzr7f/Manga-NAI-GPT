// Read-only fixture for failed project import transactionality. No user files used.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const repo=path.join(__dirname,'..','..');
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
 // 58: structurally invalid history is rejected and nothing is replaced
 x=original();before=JSON.stringify(x.stateStack);blob=await fixture(x,{objects:null,canvasGuid:'B'});
 await assert.rejects(()=>x.loadLz4BlobProjectFile(blob));
 assert.equal(JSON.stringify(x.stateStack),before,'58: history kept');assert(read(x,"imageMap.has('old-image')"),'58: image map kept');
 assert.equal(x.basePrompt.prompt,'original');assert.equal(x.canvas.width,100);assert.equal(x.NaiPageLoading,false);
 // a failure during restore also rolls back
 x=original();before=JSON.stringify(x.stateStack);blob=await fixture(x,{objects:[],canvasGuid:'B'});
 const rh=x.restoreHistoryState;vm.runInContext("restoreHistoryState=async function(){throw new Error('restore failed');}",x);
 await assert.rejects(()=>x.loadLz4BlobProjectFile(blob),/restore failed/);
 assert.equal(JSON.stringify(x.stateStack),before);assert(read(x,"imageMap.has('old-image')"));assert.equal(x.basePrompt.prompt,'original');assert.equal(x.canvas.width,100);
 console.log('PASS 58 failed project load leaves history, images, prompt and size intact');
 // 86: legacy character card edits reach memory, project and storage
 {
  const r5=fs.readFileSync(path.join(repo,'scripts/audit/round5-prompt-plan-audit-repro.cjs'),'utf8');
  const NodeSrc=r5.slice(r5.indexOf('class Node'),r5.indexOf('(async()=>{'));
  const {Node,walk}=new Function(NodeSrc+';return {Node,walk};')();
  const nodes={},events={},saved={};nodes.naiCharacterCardList=new Node('div',nodes);
  const orig={id:'hero',name:'主角',description:'原始设定',positive:['blue hair'],negative:[]};
  const c={console,setTimeout,basePrompt:{naiCharacterCards:[orig]},base:{},novelai_materials:{},localStorage:{getItem:k=>saved[k]||null,setItem:(k,v)=>saved[k]=v},$:id=>nodes[id]||null,
   document:{readyState:'loading',getElementById:id=>nodes[id]||null,createElement:tag=>new Node(tag,nodes),addEventListener:(k,cb)=>(events[k]||=[]).push(cb)}};
  c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(repo,'js/ai/prompt/auto/character-card-manager.js'),'utf8'),c);
  for(const cb of events.DOMContentLoaded)cb();
  const ta=walk(nodes.naiCharacterCardList).find(n=>n.tag==='textarea'&&n.placeholder.startsWith('写外貌'));
  for(const v of ['新','新设定']){ta.value=v;ta.emit('input');
   assert.equal(c.NaiCharacterCards.getCards()[0].description,v,'86: memory');
   assert.equal(c.basePrompt.naiCharacterCards[0].description,v,'86: project');
   assert.equal(JSON.parse(saved.naiCharacterCards)[0].description,v,'86: storage');}
  console.log('PASS 86 legacy character card edits are saved');
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

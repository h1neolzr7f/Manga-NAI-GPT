const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..','..');
const source=name=>fs.readFileSync(root+'/'+name,'utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function chatTest() {
  const rendered = deferred(); let guid='page-A', active=null; const removed=[], added=[];
  const c={document:{getElementById:()=>null,addEventListener(){}},
    NaiComicChatScene:{createDefaultScene:()=>({templateId:'t'}),validate:scene=>({ok:true,errors:[],warnings:[],scene})},
    NaiComicTemplateRegistry:{get:()=>({})},NaiComicChatRenderer:{renderScene:()=>rendered.promise,fitGroupToCanvas(){}},
    getCanvasGUID:()=>guid,canvas:{getActiveObject:()=>active,remove:obj=>removed.push({guid,obj}),add:obj=>added.push({guid,obj}),setActiveObject(){},renderAll(){}},saveStateByManual(){},updateLayerPanel(){}};
  c.window=c;vm.createContext(c);vm.runInContext(source('js/simulator/chat-controller.js'),c);
  const pending=c.NaiComicChatController.insertOrUpdate();
  guid='page-B';const other={customType:'simulatorChat',name:'unrelated existing chat B',canvas:c.canvas};active=other;
  rendered.resolve({name:'generated for page A'});await pending;
  assert.equal(removed.length,0,'30: chat B on the new page must not be deleted');assert.equal(added.length,0,'30: page-A result must not land on page B');
  // Same page, previously selected chat A is replaced; a chat selected later is not.
  const rendered2=deferred();guid='page-A';const chatA={customType:'simulatorChat',name:'A',canvas:c.canvas};active=chatA;
  c.NaiComicChatRenderer.renderScene=()=>rendered2.promise;const p2=c.NaiComicChatController.insertOrUpdate();
  active={customType:'simulatorChat',name:'later',canvas:c.canvas};rendered2.resolve({name:'new A'});await p2;
  assert.equal(removed.length,1);assert.equal(removed[0].obj,chatA);assert.equal(added[0].obj.name,'new A');
  console.log('PASS 30 chat render pinned to its source page and replacement target');
}
chatTest().catch(e=>{console.error(e);process.exitCode=1;});

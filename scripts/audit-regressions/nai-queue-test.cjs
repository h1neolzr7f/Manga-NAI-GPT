/* Audit 59/60 regression: production queue, provider, spinner and NaiEngine with controlled fetch.
 * manager, spinner and NaiEngine functions. Network/DOM/Fabric dependencies
 * are controlled fixtures; no actual request is made. exit 0 means reproduced. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const repo = path.join(__dirname,'..','..');
function read(file) { return fs.readFileSync(path.join(repo,file),'utf8'); }
function deferred() { let resolve,reject; const promise=new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; }
async function flush() { for(let i=0;i<30;i++) await Promise.resolve(); }
function harness() {
  const requests=[], objects=[], applied=[], errors=[];
  let inFlight=0,maxInFlight=0;
  const silent={debug(){},trace(){},info(){},error(){}};
  const nodes={novelaiApiKey:{value:'OFFLINE_FIXTURE_ONLY'},novelaiUseLocalProxy:{checked:true},novelaiModel:{value:'nai-diffusion-4-5-full'},novelaiUcPreset:{value:0}};
  const context={console,Map,Promise,Date,Math,Number,JSON,Error,DOMException,AbortController,setTimeout,clearTimeout,localStorage:{getItem(){return null;},setItem(){}},logger:silent,spinnerLogger:silent,generationTaskLogger:silent,SimpleLogger:class{constructor(){return silent;}},LogLevel:{DEBUG:1},
    document:{addEventListener(){},getElementById(id){return nodes[id]||null;},querySelector(){return null;}},$:id=>nodes[id]||null,
    getCanvasGUID:()=> 'page-A',getGUID:o=>o.guid,isPanel:()=>false,calculateCenter:()=>({centerX:50,centerY:50}),updateLayerPanel(){},btmProjectsMap:new Map([['page-A',{blob:'fixture'}]]),
    canvas:{getObjects:()=>objects,remove(o){const i=objects.indexOf(o);if(i>=0)objects.splice(i,1);}},
    replaceImageObject(layer,img,type,index){objects.splice(index,0,img);applied.push({old:layer.guid,replacement:img.guid});},
    DashboardUI:{recordGeneration(){},recordFailure(){}},createToastError(...args){errors.push(args);},createToast(){},
    fetch(url,options){const gate=deferred();inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);const request={url,options,gate};requests.push(request);return gate.promise.finally(()=>inFlight--);}
  };
  context.window=context;context.location={protocol:'http:',origin:'http://offline.invalid'};
  vm.createContext(context);
  for(const file of ['js/ai/queue/task-queue.js','js/ai/queue/generation-task-manager.js','js/ai/queue/spinner.js','js/ai/provider/ai-provider.js','js/ai/provider/novelai-provider.js','js/ai/ai-management.js','js/ai/nai-engine-core.js','js/ai/nai-engine.js'])vm.runInContext(read(file),context,{filename:file});
  vm.runInContext('globalThis.provider = new NovelAIProvider(); globalThis.legacyQueue=novelaiQueue;',context);
  // Parameter composition and browser image decoding are not the subject of this
  // fixture. Scheduling, request, result placement and cancellation stay original.
  context.provider._buildPayload=async()=>({input:'offline prompt',model:'nai-diffusion-4-5-full',action:'generate',parameters:{seed:1,negative_prompt:''}});
  context.provider._dataUrlToFabricImage=async()=>({guid:'generated-result'});
  function respond(index,status=200){requests[index].gate.resolve({ok:status===200,status,headers:{get:()=> 'application/json'},json:async()=>({image:'FIXTURE'}),text:async()=> 'fixture rejection'});}
  function addLayer(guid='source-A'){const layer={guid,type:'image'};objects.push(layer);return layer;}
  return {c:context,objects,requests,applied,errors,respond,addLayer,max:()=>maxInFlight};
}
(async()=>{
  {
    const h=harness(), layer=h.addLayer();
    const spinner=h.c.createSpinner(layer.guid,'I2I');
    const work=h.c.provider.executeI2I(layer,spinner.id);await flush();
    h.c.cancelAiTask(spinner.id);h.respond(0);await work;await flush();
    assert.equal(h.applied.length,0,'59: cancelled result is not pasted');assert.equal(h.objects.includes(layer),true,'59: source kept');
    console.log('PASS 59 cancelling a running NovelAI task keeps the source layer');
  }
  {
    const h=harness(), layer=h.addLayer();
    const spinner=h.c.createSpinner(layer.guid,'I2I');
    const legacy=h.c.provider.executeI2I(layer,spinner.id);await flush();
    const modern=h.c.NaiEngine.run({prompt:'offline modern',width:512,height:512});await flush();
    assert.equal(h.requests.length,1,'60: modern request waits for the legacy one');
    h.respond(0);await legacy;await flush();
    assert.equal(h.c.existsWaitQueue(),true,'60: queue reports the pending modern request');
    for(let i=0;i<200&&h.requests.length<2;i++)await new Promise(r=>setTimeout(r,25));
    assert.equal(h.requests.length,2);assert.equal(h.max(),1,'60: never two requests at once');
    h.respond(1);await modern;await flush();
    console.log('PASS 60 legacy and modern NovelAI generation share one queue');
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

// Audit 09: deadline and cancel must cover the response body, not only the headers.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const repo=path.join(__dirname,'..','..');const read=f=>fs.readFileSync(path.join(repo,f),'utf8');
const stalled=(type)=>({ok:true,status:200,headers:{get:()=>type},text:()=>new Promise(()=>{}),json:()=>new Promise(()=>{}),blob:()=>new Promise(()=>{})});
const within=(p,ms)=>Promise.race([p.then(v=>({v}),e=>({e})),new Promise(r=>setTimeout(()=>r({hung:true}),ms))]);
(async()=>{
  const c={console,Promise,AbortController,DOMException,setTimeout,clearTimeout,Blob,FormData,JSON,fetch:async()=>stalled('application/json')};
  vm.createContext(c);vm.runInContext(read('js/core/service/service-request.js'),c);
  let r=await within(c.ServiceRequest.request('local','/x',{timeoutMs:20}),500);
  assert.ok(!r.hung,'09: stalled body must time out');assert.match(r.e.message,/超时/);
  const ac=new AbortController();const p=c.ServiceRequest.request('local','/x',{timeoutMs:5000,signal:ac.signal});
  setTimeout(()=>ac.abort(),20);r=await within(p,500);
  assert.ok(!r.hung,'09: cancel must stop a stalled body');assert.match(r.e.message,/取消/);
  console.log('PASS 09 ServiceRequest deadline/cancel cover the body');
  // NaiEngine: user cancel while the body is stalled
  const nodes={novelaiApiKey:{value:'OFFLINE_FIXTURE_ONLY'}};
  const n={console,Promise,AbortController,DOMException,setTimeout,clearTimeout,JSON,Date,Math,Object,Number,localStorage:{getItem:()=>null,setItem(){}},document:{getElementById:id=>nodes[id]||null},fetch:async()=>stalled('application/zip')};
  n.window=n;vm.createContext(n);vm.runInContext(read('js/ai/nai-engine-core.js'),n);vm.runInContext(read('js/ai/nai-engine.js'),n);
  const ac2=new AbortController();const run=n.NaiEngine.run({prompt:'offline',width:512,height:512},ac2.signal);
  setTimeout(()=>ac2.abort(),30);r=await within(run,1000);
  assert.ok(!r.hung,'09: NaiEngine cancel must stop a stalled body');assert.equal(r.e.name,'AbortError');
  console.log('PASS 09 NaiEngine cancel covers the body');
})().catch(e=>{console.error(e);process.exitCode=1;});

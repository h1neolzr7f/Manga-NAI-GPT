// Audit 36 (subscription cache per token), 50 (explicit multi-line fit), 23 (start.sh app identity).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{execFileSync,spawn}=require('child_process');
const repo=path.join(__dirname,'..','..');const source=f=>fs.readFileSync(path.join(repo,f),'utf8');
(async()=>{
 {
  let token='account-A',health=0;
  const c={document:{getElementById:id=>id==='novelaiApiKey'?{value:token}:null},localStorage:{getItem:()=>null},Date,AbortController,
   fetch:async(u,o)=>{health++;const b=o.headers.Authorization.includes('account-A');return {ok:true,json:async()=>(b?{ok:true,tier:3,anlas:1000,active:true}:{ok:true,tier:1,anlas:5,active:true})};}};
  c.window=c;vm.createContext(c);vm.runInContext(source('js/ai/nai-engine-core.js'),c);vm.runInContext(source('js/ai/nai-engine.js'),c);
  await c.NaiEngine.subscription();token='account-B';const cost=await c.NaiEngine.costText({width:1024,height:1024},3);
  assert.equal(health,2,'36: account B is looked up');assert(!cost.text.includes('1000'));assert(cost.text.includes('5 Anlas'));
  console.log('PASS 36 subscription cache is bound to the token');
 }
 {
  const c={};c.window=c;vm.createContext(c);vm.runInContext(source('js/ai/manga-smart-text-core.js'),c);
  const r=c.MangaSmartTextCore.fitText('一\n二\n三\n四\n五',{width:100,height:20},false,(t,s)=>Array.from(t).length*s);
  assert(r.lines*r.fontSize*1.16<=20||r.overflow,'50: five explicit lines must fit the height or report overflow');
  console.log('PASS 50 explicit multi-line text checks height');
 }
 if(process.platform!=='win32'){
  const http=require('http');const srv=http.createServer((q,s)=>s.end('<html><title>Unrelated dashboard</title></html>'));
  await new Promise(r=>srv.listen(0,'127.0.0.1',r));const port=srv.address().port;
  const out=await new Promise(r=>{const p=spawn('bash',[path.join(repo,'start.sh')],{env:{...process.env,MNAI_PORT:String(port),PATH:process.env.PATH}});let o='';p.stdout.on('data',d=>o+=d);p.on('exit',code=>r({code,o}));});
  srv.close();
  assert.notEqual(out.code,0,'23: unrelated site is not treated as the editor');assert(!/已经在运行/.test(out.o));
  console.log('PASS 23 start.sh checks the app identity');
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

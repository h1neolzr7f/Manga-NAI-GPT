// Audit 22: offline navigation to "/" is served from the cached index.html.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const store=new Map();const key=r=>typeof r==='string'?r:r.url;
const cache={add:async u=>{store.set(new URL(u,'http://127.0.0.1:8000/').href,'SHELL:'+u);},put:async(r,v)=>{store.set(key(r),v);},match:async r=>store.get(key(r))};
const listeners={};let online=true;
const c={URL,Promise,console,caches:{open:async()=>cache,match:async r=>store.get(key(r)),keys:async()=>[],delete:async()=>true},
 fetch:async(r)=>{if(!online)throw new Error('offline');return {status:200,type:'basic',clone(){return 'ONLINE:'+key(r);}};},
 self:null,location:{href:'http://127.0.0.1:8000/service-worker.js'}};
c.self={addEventListener:(t,f)=>listeners[t]=f,skipWaiting(){},registration:{scope:'http://127.0.0.1:8000/'},location:c.location,clients:{claim(){}}};
vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','..','service-worker.js'),'utf8').replace(/\bself\./g,'self.'),c);
(async()=>{
 let wait;listeners.install({waitUntil:p=>wait=p});await wait;
 assert(store.has('http://127.0.0.1:8000/index.html'),'22: shell precached on install');
 online=false;let resp;listeners.fetch({request:{url:'http://127.0.0.1:8000/',method:'GET',mode:'navigate'},respondWith:p=>resp=p});
 assert.ok(await resp,'22: offline "/" served');
 console.log('PASS 22 installed app opens offline from the cached index.html');
})().catch(e=>{console.error(e);process.exitCode=1;});

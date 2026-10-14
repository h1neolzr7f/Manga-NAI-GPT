// Audit 99 (script retry), 100 (parallel record), 102 (longest streak from history).
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const repo=path.join(__dirname,'..','..');
const read=p=>fs.readFileSync(path.join(repo,p),'utf8');
const log={error(){},debug(){},warn(){}};

function context(now){
  const maps=new Map(); const clone=x=>x==null?x:structuredClone(x);
  const RealDate=Date;class ClockDate extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return new RealDate(now).getTime();}}
  const c={console,setTimeout,clearTimeout,queueMicrotask,Blob,TextEncoder,TextDecoder,ArrayBuffer,Uint8Array,Date:ClockDate,
    dashboardLogger:log,dashboardPerfLogger:log,dashboardTagLogger:log,
    document:{getElementById(){return null;},querySelector(){return null;},createElement(){return{};},head:{appendChild(){}}},
    localforage:{createInstance(opts){let key=opts.name+'/'+opts.storeName;if(!maps.has(key))maps.set(key,new Map());const m=maps.get(key);return{async getItem(k){return clone(m.get(k)??null)},async setItem(k,v){m.set(k,clone(v));return v},async removeItem(k){m.delete(k)}}}},
    addEventListener(){}};
  c.window=c;vm.createContext(c);c.maps=maps;return c;
}
async function storage(c){
  vm.runInContext(read('js/dashboard/performance-storage.js'),c);
  vm.runInContext(read('js/dashboard/prompt-frequency-storage.js'),c);
  await new Promise(setImmediate);
}

(async()=>{
  {
    const c=context('2026-10-11T12:00:00Z');await storage(c);
    const time=c.maps.get('MangaEditor_Performance/timeBasedStats');
    const oldDaily={};for(let d=1;d<=7;d++)oldDaily['2026-10-'+String(d).padStart(2,'0')]=1;
    time.set('dailyStats',oldDaily);
    const streak=await c.PerformanceStorage.getStreak();
    assert.equal(streak.currentStreak,0);
    assert.equal(streak.longestStreak,7);
    console.log('PASS 102 longest streak computed from retained daily stats');
  }

  {
    const c=context('2026-10-13T12:00:00Z');await storage(c);
    vm.runInContext(read('js/dashboard/dashboard-ui.js'),c);
    await Promise.all([
      c.DashboardUI.recordGeneration('T2I',100,'cat, blue','test-model'),
      c.DashboardUI.recordGeneration('T2I',200,'cat, blue','test-model')
    ]);
    const stats=await c.PerformanceStorage.getStats('T2I');
    const tags=await c.PromptFrequencyStorage.getAllFrequencies();
    const models=await c.PerformanceStorage.getModelStats();
    const session=await c.PerformanceStorage.getSessionStats();
    assert.equal(stats.count,2);
    assert.equal(tags.cat.count,2);
    assert.equal(models[0].count,2);
    assert.equal(session.currentGenCount,2);
    console.log('PASS 100 parallel recordGeneration preserves both increments');
  }

  {
    const src=read('js/dashboard/dashboard-ui.js');
    assert(src.includes('dashboardFailed'),'99 marks failed script nodes');
    assert(src.includes('removeChild(existing)'),'99 removes failed node before retry');
    const nodes=[];
    let chartLoads=0;
    const c=context('2026-10-13T12:00:00Z');
    c.document={
      getElementById(){return null;},
      querySelector(sel){
        const lib=(sel.match(/data-dashboard-lib="([^"]+)"/)||[])[1];
        return nodes.find(n=>n.dataset&&n.dataset.dashboardLib===lib)||null;
      },
      createElement(){return{dataset:{},async:false,defer:false,src:'',onload:null,onerror:null};},
      head:{appendChild(n){
        nodes.push(n);
        queueMicrotask(()=>{
          if(String(n.src).endsWith('chart.js')){
            chartLoads++;
            if(chartLoads===1){ if(n.onerror) n.onerror(); }
            else{ c.Chart=function(){}; if(n.onload) n.onload(); }
          }else{
            c.WordCloud=function(){}; if(n.onload) n.onload();
          }
        });
      }}
    };
    const start=src.indexOf('function loadScriptOnce');
    const end=src.indexOf('function open(){');
    const loader='var dashboardLibraryLoadPromise=null;var dashboardLogger={error(){},debug(){}};\n'
      +src.slice(start,end)
      +'\nthis.loadScriptOnce=loadScriptOnce;this.ensureDashboardLibraries=ensureDashboardLibraries;';
    vm.runInContext(loader,c);
    await assert.rejects(c.ensureDashboardLibraries(),/Failed to load/);
    const afterFail=nodes.length;
    assert.equal(nodes.filter(n=>n.dataset&&n.dataset.dashboardFailed==='true').length,1);
    await c.ensureDashboardLibraries();
    assert.ok(c.Chart);
    assert.ok(nodes.length>afterFail);
    console.log('PASS 99 dashboard library retry replaces failed script node');
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

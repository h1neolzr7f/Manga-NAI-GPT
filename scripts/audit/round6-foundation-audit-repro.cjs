const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root=process.argv[2]||process.env.MANGA_AUDIT_ROOT||process.cwd();
const read=p=>fs.readFileSync(root+'/'+p,'utf8');
const log={error(){},debug(){},info(){}};
function context(now){
 const maps=new Map(); const clone=x=>x==null?x:structuredClone(x);
 const RealDate=Date;class ClockDate extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return new RealDate(now).getTime();}}
 const c={console,setTimeout,clearTimeout,Blob,TextEncoder,TextDecoder,ArrayBuffer,Uint8Array,Date:ClockDate,dashboardLogger:log,dashboardPerfLogger:log,dashboardTagLogger:log,
 document:{getElementById(){return null;}},localforage:{createInstance(opts){let key=opts.name+'/'+opts.storeName;if(!maps.has(key))maps.set(key,new Map());const m=maps.get(key);return{async getItem(k){return clone(m.get(k)??null)},async setItem(k,v){m.set(k,clone(v));return v},async removeItem(k){m.delete(k)}}}},addEventListener(){}};
 c.window=c;vm.createContext(c);c.maps=maps;return c;
}
async function storage(c){vm.runInContext(read('js/dashboard/performance-storage.js'),c);vm.runInContext(read('js/dashboard/prompt-frequency-storage.js'),c);await new Promise(setImmediate);}
(async()=>{
 process.env.TZ='America/Los_Angeles';
 const c=context('2026-10-11T12:00:00-07:00');await storage(c);
 const time=c.maps.get('MangaEditor_Performance/timeBasedStats');time.set('dailyStats',{'2026-10-12':1});
 const week=await c.PerformanceStorage.getWeeklyStats();assert.deepEqual({...week},{'2026-10-05':1});
 console.log('CONFIRMED weekly UTC/local mismatch: Monday 2026-10-12 ->',week);
 time.set('dailyStats',{'2026-10-11':1});await c.PerformanceStorage.setGoal('weekly',2);
 const progress=await c.PerformanceStorage.getGoalProgress();assert.equal(progress.daily.current,1);assert.equal(progress.weekly.current,0);
 console.log('CONFIRMED weekly goal omits this Sunday generation: daily=',progress.daily.current,'weekly=',progress.weekly.current);
 const oldDaily={};for(let d=1;d<=7;d++)oldDaily['2026-10-'+String(d).padStart(2,'0')]=1;
 time.set('dailyStats',oldDaily);const streak=await c.PerformanceStorage.getStreak();assert.equal(streak.longestStreak,0);
 console.log('CONFIRMED longest streak: seven retained consecutive daily entries, first dashboard check after gap ->',streak);
 const race=context('2026-10-13T12:00:00Z');await storage(race);vm.runInContext(read('js/dashboard/dashboard-ui.js'),race);
 await Promise.all([race.DashboardUI.recordGeneration('T2I',100,'cat, blue','test-model'),race.DashboardUI.recordGeneration('T2I',200,'cat, blue','test-model')]);
 const stats=await race.PerformanceStorage.getStats('T2I'),tags=await race.PromptFrequencyStorage.getAllFrequencies(),models=await race.PerformanceStorage.getModelStats(),session=await race.PerformanceStorage.getSessionStats();
 assert.equal(stats.count,1);assert.equal(tags.cat.count,1);assert.equal(models[0].count,1);assert.equal(session.currentGenCount,1);
 console.log('CONFIRMED two completed recordGeneration calls lost increments:',JSON.stringify({stats,tags,models,currentGenCount:session.currentGenCount}));
 // First local script request fails; network recovery does not replay an event on that failed DOM node.
 const retry=context('2026-10-13T12:00:00Z'),nodes=[];
 retry.document={getElementById(){return null},querySelector(sel){const src=sel.match(/data-dashboard-lib="([^"]+)"/)[1];return nodes.find(n=>n.dataset.dashboardLib===src)||null},createElement(){return{dataset:{},listeners:{},addEventListener(t,cb){this.listeners[t]=cb}}},head:{appendChild(n){nodes.push(n);queueMicrotask(()=>{if(n.src.endsWith('chart.js'))n.onerror();else{retry.WordCloud=function(){};n.onload()}})}}};
 vm.runInContext(read('js/dashboard/dashboard-ui.js'),retry);
 await assert.rejects(retry.DashboardUI.init(),/Failed to load cdn-local\/chart.js/);
 let settled=false;retry.DashboardUI.init().then(()=>settled=true,()=>settled=true);await new Promise(r=>setTimeout(r,40));
 assert.equal(settled,false);assert.equal(nodes.length,2);
 console.log('CONFIRMED dashboard retry: second init pending, script nodes=',nodes.length,'no new request after recovery');
 // Typed-array view helper's documented input contract; current production imageMap normally stores strings.
 const buf=context('2026-10-13T12:00:00Z');vm.runInContext(read('js/core/util/array-buffer-utils.js')+'\nthis.BufferAPI=ArrayBufferUtils;',buf);
 const view=new Uint8Array([9,1,2,8]).subarray(1,3),result=await buf.BufferAPI.toArrayBuffer(view);assert.deepEqual([...new Uint8Array(result)],[9,1,2,8]);
 console.log('HELPER CONTRACT: subarray [1,2] becomes whole backing buffer', [...new Uint8Array(result)]);
 const {createCanvas}=require(require.resolve('@napi-rs/canvas',process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}:undefined));const png=createCanvas(1,1).toBuffer('image/png');
 const pngContext={console,require,Uint8Array};pngContext.window=pngContext;vm.createContext(pngContext);vm.runInContext(read('js/core/util/png-bit-depth.js'),pngContext);
 const pngArray=png.buffer.slice(png.byteOffset,png.byteOffset+png.byteLength);await assert.rejects(pngContext.NaiPngBitDepth.encodePngBytes(pngArray),/PNG シグネチャ/);
 assert((await pngContext.NaiPngBitDepth.encodePngBytes(new Uint8Array(pngArray))).byteLength>0);
 console.log('HELPER CONTRACT: valid PNG ArrayBuffer rejected by public encoder; identical Uint8Array accepted');
 console.log('All evidence checks passed; this confirms defects, not fixes.');
})().catch(e=>{console.error(e);process.exitCode=1});

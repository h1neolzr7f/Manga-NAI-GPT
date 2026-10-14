// Audit 101
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
process.env.TZ='America/Los_Angeles';
const root=require('path').join(__dirname,'..','..');
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
 const c=context('2026-10-11T12:00:00-07:00');await storage(c);
 const time=c.maps.get('MangaEditor_Performance/timeBasedStats');time.set('dailyStats',{'2026-10-12':1});
 const week=await c.PerformanceStorage.getWeeklyStats();assert.deepEqual({...week},{'2026-10-12':1},'101: Monday stays in its own week');
 time.set('dailyStats',{'2026-10-11':1});await c.PerformanceStorage.setGoal('weekly',2);
 const progress=await c.PerformanceStorage.getGoalProgress();assert.equal(progress.daily.current,1);assert.equal(progress.weekly.current,1,'101: today counts toward this week');
 console.log('PASS 101 local date keys and Monday weeks in a western timezone');
})().catch(e=>{console.error(e);process.exitCode=1;});

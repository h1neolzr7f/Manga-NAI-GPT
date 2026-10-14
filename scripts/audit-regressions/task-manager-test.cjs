// Audit 05/06: generation task records and AI task IDs (js/ai/queue/generation-task-manager.js).
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const repo=path.join(__dirname,'..','..');
const silent={debug(){},error(){},info(){}};
const c={console,Map,Promise,generationTaskLogger:silent,updateLayerPanel(){},document:{querySelector:()=>null},
  getCanvasGUID:()=>'page-A',btmProjectsMap:new Map([['page-A',{blob:'A'}]]),btmSaveProjectFile:async()=>{}};
vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(repo,'js/ai/queue/generation-task-manager.js'),'utf8'),c);
(async()=>{
  // 05: two tasks on the same page keep separate targets; removing one keeps the other
  const a=c.registerGenerationTask('page-A',{layerGuid:'L1',targetLayerGuid:'panel-1'});
  const b=c.registerGenerationTask('page-A',{layerGuid:'L2',targetLayerGuid:'panel-2'});
  assert.notEqual(a.taskKey,b.taskKey);
  assert.equal(c.generationTaskMap.size,2,'05: both tasks recorded');
  assert.equal(c.generationTaskMap.get(a.taskKey).targetLayerGuid,'panel-1');
  c.removeGenerationTask(a);
  assert.equal(c.generationTaskMap.get(b.taskKey).targetLayerGuid,'panel-2','05: B survives A cleanup');
  // registration is visible synchronously (before the page snapshot save resolves)
  let release;c.btmProjectsMap=new Map();c.btmSaveProjectFile=()=>new Promise(r=>release=r);
  const d=c.registerGenerationTask('page-B',{});assert.ok(c.generationTaskMap.has(d.taskKey));release();await d.ready;
  console.log('PASS 05 per-request generation task records');
  // 06: IDs never reuse a live task's ID
  const t1=c.registerAiTask('x','I2I').id,t2=c.registerAiTask('y','I2I').id;
  c.removeAiTask(t1);
  const t3=c.registerAiTask('z','I2I').id;
  assert.notEqual(t3,t2,'06: new task must not reuse live ID');
  assert.equal(c.getAiTask(t2).layerGuid,'y');assert.equal(c.aiTaskMap.size,2);
  assert.deepEqual([c.getAiTask(t2).order,c.getAiTask(t3).order],[1,2]);
  console.log('PASS 06 unique AI task IDs, display order renumbered');
})().catch(e=>{console.error(e);process.exitCode=1;});

// Audit 34: the legacy batch tool never re-sends a paid request after an unknown result or a
// failed local save; only clear rejections (429/5xx gateway) are retried.
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','novelai-batch-tools.mjs'),'utf8');
const body=src.slice(0,src.lastIndexOf('main().catch'))+'\nexport { generateImageWithRetry };\n';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'batch-'));const mod=path.join(tmp,'tool.mjs');fs.writeFileSync(mod,body);
const png=Buffer.from('89504e470d0a1a0a0000000d49484452','hex');
(async()=>{
  const {generateImageWithRetry}=await import(require('url').pathToFileURL(mod).href);
  const opts=o=>Object.assign({token:'OFFLINE_FIXTURE_ONLY',prompt:'x',width:512,height:512,seed:1,steps:28,scale:5,model:'nai-diffusion-4-5-full',endpoint:'http://offline.invalid/ai/generate-image'},o);
  let calls=0;
  // image generated, save fails every time -> 1 request
  const dir=path.join(tmp,'isdir.png');fs.mkdirSync(dir);
  globalThis.fetch=async()=>{calls++;return {ok:true,status:200,headers:{get:()=> 'image/png'},arrayBuffer:async()=>png,blob:async()=>new Blob([png],{type:'image/png'})};};
  await assert.rejects(()=>generateImageWithRetry(opts({outputPath:dir}),3));
  assert.equal(calls,1,'34: save failure must not re-send the request');
  // response lost -> 1 request
  calls=0;globalThis.fetch=async()=>{calls++;throw new Error('socket hang up');};
  await assert.rejects(()=>generateImageWithRetry(opts({outputPath:path.join(tmp,'a.png')}),3));
  assert.equal(calls,1,'34: unknown result must not be re-sent');
  // 429 is retried
  calls=0;globalThis.fetch=async()=>{calls++;return calls<2?{ok:false,status:429,text:async()=> 'busy'}:{ok:true,status:200,headers:{get:()=> 'image/png'},arrayBuffer:async()=>png,blob:async()=>new Blob([png],{type:'image/png'})};};
  await generateImageWithRetry(opts({outputPath:path.join(tmp,'b.png')}),3);
  assert.equal(calls,2);
  console.log('PASS 34 batch tool retries only clear rejections; unknown results and save failures are not re-sent');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(tmp,{recursive:true,force:true}));

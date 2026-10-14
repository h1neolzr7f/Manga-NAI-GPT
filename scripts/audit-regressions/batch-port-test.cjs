// Audit 35: batch tool talks to the server port it was started from.
const assert=require('assert/strict'),path=require('path'),fs=require('fs');
(async()=>{
 const mod=require('url').pathToFileURL(path.join(__dirname,'..','novelai-batch-tools.mjs')).href;
 process.env.MNAI_PORT='17333';delete process.env.MNAI_BASE_URL;
 const {serverBase}=await import(mod);
 assert.equal(serverBase(),'http://127.0.0.1:17333');
 process.env.MNAI_BASE_URL='http://127.0.0.1:18000';assert.equal(serverBase(),'http://127.0.0.1:18000');
 process.env.MNAI_BASE_URL='http://evil.example';assert.equal(serverBase(),'http://127.0.0.1:17333','only loopback base URLs');
 const src=fs.readFileSync(path.join(__dirname,'..','novelai-batch-tools.mjs'),'utf8');assert(!/127\.0\.0\.1:8000/.test(src));
 const py=fs.readFileSync(path.join(__dirname,'..','..','99_server.py'),'utf8');assert(/env\['MNAI_BASE_URL'\]/.test(py));
 console.log('PASS 35 batch tool uses the launching server port');
})().catch(e=>{console.error(e);process.exitCode=1;});

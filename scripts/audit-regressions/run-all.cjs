// Runs every audit regression (fixed findings from docs/dev/audit/2026-10-13-full-audit.md).
const {execFileSync}=require('child_process'),fs=require('fs'),path=require('path');
const dir=__dirname;let failed=0;
for(const f of fs.readdirSync(dir).sort()){
  if(f==='run-all.cjs')continue;
  const cmd=f.endsWith('.py')?(process.platform==='win32'?'python':'python3'):f.endsWith('.cjs')?process.execPath:null;
  if(!cmd)continue;
  try{process.stdout.write(execFileSync(cmd,[path.join(dir,f)],{encoding:'utf8',stdio:['ignore','pipe','inherit']}));}
  catch(e){failed++;console.error('FAIL '+f);if(e.stdout)process.stdout.write(e.stdout);}
}
if(failed){console.error(failed+' audit regression file(s) failed');process.exit(1);}

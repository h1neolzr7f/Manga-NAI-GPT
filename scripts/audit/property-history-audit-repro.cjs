const fs=require('fs'),vm=require('vm'),assert=require('assert');
const base=fs.readFileSync(require('node:path').join(process.env.MANGA_AUDIT_ROOT||process.cwd(),'scripts/audit/editor-audit-repro.cjs'),'utf8');
const {ctx:auditCtx,map:auditMap}=new Function('require',base.slice(0,base.indexOf('(async()=>{'))+'\nreturn {ctx,map};')(require);
(async()=>{
 const x=auditCtx();let writes=0;x.localforage={createInstance:()=>({async setItem(){writes++;},async removeItem(){}})};
 x.isText=o=>o&&o.type==='textbox';x.isVerticalText=()=>false;x.isSpeechBubbleText=()=>false;x.isImage=o=>o&&o.type==='image';x.canvas.getActiveObject=()=>x.canvas.objects[0];
 const o={type:'textbox',fontSize:32,fill:'#000000',left:0,set(v,n){if(typeof v==='string')this[v]=n;else Object.assign(this,v);},setCoords(){}};x.canvas.objects=[o];x.saveState();o.left=1;x.saveState();
 for(const f of ['js/sidebar/text/text-effect.js','js/core/util/image-util.js','js/core/auto-save.js'])vm.runInContext(fs.readFileSync((process.env.MANGA_AUDIT_ROOT||process.cwd())+'/'+f,'utf8'),x);
 x.getCropAndDownloadLinkByMultiplier=async()=>({href:'data:image/jpeg;base64,AQ=='});
 await x.AutoSaveManager.save();assert.equal(writes,2);const n=x.stateStack.length,w=writes;x.changeFontSize(64);x.changeTextColor('#ff0000');assert.equal(o.fontSize,64);assert.equal(o.fill,'#ff0000');assert.equal(x.stateStack.length,n);assert.equal(JSON.parse(x.stateStack.at(-1)).objects[0].fontSize,32);await x.AutoSaveManager.save();assert.equal(writes,w);
 console.log('CONFIRMED text size/color: live 64/red, history 32/black; autosave writes=0');
 o.type='image';o.flipX=false;o.flipY=false;x.saveState();await x.AutoSaveManager.save();const w2=writes,n2=x.stateStack.length;x.flipHorizontally();x.flipVertically();await x.AutoSaveManager.save();assert.equal(o.flipX,true);assert.equal(o.flipY,true);assert.equal(x.stateStack.length,n2);assert.equal(JSON.parse(x.stateStack.at(-1)).objects[0].flipX,false);assert.equal(writes,w2);
 console.log('CONFIRMED sidebar image flips: live X/Y=true, history X/Y=false; autosave writes=0');
})().catch(e=>{console.error(e);process.exitCode=1;});

const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=(process.env.MANGA_AUDIT_ROOT||process.cwd())+'/';
function load(p,c={console}){vm.createContext(c);vm.runInContext(fs.readFileSync(root+p,'utf8'),c);return c;}
const t=load('js/ai/manga-smart-text-core.js');
const fit=t.MangaSmartTextCore.fitText('一\n二\n三\n四\n五',{width:100,height:20},false,(str,size)=>str.length*size);
assert.equal(fit.lines,5);assert.ok(fit.fontSize*fit.lines*1.16>20);assert.notEqual(fit.overflow,true);
console.log('CONFIRMED explicit multiline text reports fit despite height',fit.fontSize*fit.lines*1.16,'>20:',JSON.stringify(fit));
const b=load('js/ai/balloon-layout-core.js');
const faces=[[10,20,30,40],[210,20,230,40]], panel={x:200,y:0,w:100,h:100};
const old=b.BalloonLayoutCore.place(panel,[{w:35,h:25,speaker:1}],{faces});
const local=b.BalloonLayoutCore.place(panel,[{w:35,h:25,speaker:0}],{faces});
assert.equal(old[0].tail,null);assert.ok(local[0].tail);
console.log('CONFIRMED whole-page speaker index1 becomes no tail after filtering panel faces; local index0 gets tail');
const s=load('js/ai/script-page-core.js');
const parsed=s.ScriptPageCore.parse('第1格：两人对话\n甲：第一句\n乙：第二句\n甲：第三句\n乙：第四句\n甲：第五句');
const lines=parsed.pages[0].panels[0].lines;assert.equal(lines.length,4);assert.equal(lines[3].speaker,'乙');assert.equal(lines[3].text,'第四句第五句');
console.log('CONFIRMED fifth dialogue from甲 merged into乙 balloon:',JSON.stringify(lines[3]));
const out=s.ScriptPageCore.toWizard(parsed.pages[0].panels[0]);assert.ok(!out.line.includes('甲')&&!out.line.includes('乙'));console.log('CONFIRMED script-to-wizard removes every speaker label:',out.line);
const hx={};vm.createContext(hx);const hist=fs.readFileSync(root+'js/layer/image-history-management.js','utf8');vm.runInContext(hist.slice(hist.indexOf('function isSaveObject('),hist.indexOf('function isNotSaveObject(')),hx);
assert.equal(hx.isSaveObject({target:{saveHistory:false}}),false);assert.equal(hx.isSaveObject({target:{saveHistory:true}}),false);
console.log('CONFIRMED modified event ignored for both imported saveHistory=false and explicitly true target');
const made=[];class El{constructor(){this.style={};this.children=[];this.events={};this.isConnected=true;made.push(this);}appendChild(x){this.children.push(x);}setAttribute(k,v){this[k]=v;}addEventListener(k,f){this.events[k]=f;}remove(){this.isConnected=false;}focus(){}}
const records=new Map([['localSettingsData','{}'],['nai_comic_asset_manifest_v1',JSON.stringify({assets:[{id:'user-art',name:'import.png'}]})],['nai_comic_image2_jobs_v1','[{"id":"job1"}]']]);
const z={document:{createElement:()=>new El(),body:new El(),addEventListener(){},removeEventListener(){}},getText:()=>'',localStorage:{clear:()=>records.clear()},sessionStorage:{clear(){}},window:{},MutationObserver:class{observe(){}},createToast(){},setTimeout(){},location:{reload(){}}};vm.createContext(z);
const management=fs.readFileSync(root+'js/project-management.js','utf8');const begin=management.indexOf('function resetAllSettings(){'),end=management.indexOf("document.addEventListener('DOMContentLoaded'",begin);
vm.runInContext(management.slice(begin,end),z);z.resetAllSettings();const okButton=made.find(e=>e.id==='settingsResetOk');assert.ok(okButton);okButton.events.click();assert.equal(records.size,0);
console.log('CONFIRMED reset settings removes imported asset manifest and image2 jobs as well as preferences');

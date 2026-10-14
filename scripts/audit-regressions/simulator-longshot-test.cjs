// Audit 41 (uniform scale), 42 (moved page paginates the same), 67 (capture only the target).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const read=f=>fs.readFileSync(path.join(__dirname,'..','..',f),'utf8');
const box=(t,h)=>({left:0,top:t,width:1000,height:h});
function obj(t,h,extra){return Object.assign({top:t,height:h,visible:true,getBoundingRect(){return box(this.top,this.height);}},extra);}
const c={console,Math,JSON,isGridVisible:true,gridCalls:[]};c.window=c;vm.createContext(c);
vm.runInContext('function removeGrid(){gridCalls.push("rm");}function drawGrid(){gridCalls.push("draw");}',c);
vm.runInContext(read('js/simulator/extra-renderer-factory.js'),c);vm.runInContext(read('js/simulator/longshot-exporter.js'),c);
const F=c.NaiComicExtraRendererFactory,L=c.NaiComicLongShot;
function page(top){return [obj(top,3600,{simulatorPageId:'p',simulatorRole:'page'}),obj(top+1700,200,{simulatorPageId:'p'}),obj(top+3400,200,{simulatorPageId:'p'})];}
const counts=[0,2000].map(t=>{const objs=page(t);const cv={getObjects:()=>objs};return L.paginateGroup(F.pageView(cv,'p'),1800).length;});
assert.equal(counts[0],counts[1],'42: page count independent of position '+counts);
console.log('PASS 42 moving a simulator page does not change its pagination');
const objs=page(2000),other=obj(0,100,{name:'unrelated'});const all=objs.concat([other]);const seen=[];
const cv={getObjects:()=>all,toDataURL(o){seen.push({visible:other.visible,top:o.top,height:o.height});return 'data:';},requestRenderAll(){}};
const out=L.capturePages(cv,F.pageView(cv,'p'),1800,'x',false);
assert(seen.every(s=>s.visible===false),'67: unrelated layer hidden during capture');assert.equal(other.visible,true,'restored');
assert.equal(c.gridCalls.join(),'rm,draw','67: grid hidden then restored');
assert(seen.every(s=>s.top>=2000&&s.top+s.height<=5600),'42: crops stay inside the page');
console.log('PASS 67 page capture renders only the target simulator');
// 41
const src=read('js/simulator/playback-controller.js');const m=/var fit=Math\.min\(1,availableWidth\/\(image\.width\|\|1\),180\/\(image\.height\|\|1\)\);[^\n]*\nimage\.set\(\{[^}]*scaleX:fit,scaleY:fit/.test(src);
assert(m,'41: one scale for both axes');
console.log('PASS 41 inserted page images keep their aspect ratio');

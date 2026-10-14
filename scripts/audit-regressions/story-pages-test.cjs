// Audit 21: long story -> at most one page of panels per canvas, never negative heights.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const added=[];const c={canvas:{width:1000,height:1400,add:o=>added.push(o),renderAll(){}},fabric:{Rect:function(o){Object.assign(this,o);this.set=function(k,v){if(typeof k==='object')Object.assign(this,k);else this[k]=v;};}}};
c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','..','js/simulator/story-to-manga.js'),'utf8'),c);
const M=c.NaiComicStoryToManga;
let cellH=M.layoutCells(1000,1400,240).cells.map(x=>x.height);assert(Math.min(...cellH)>0,'21: no negative heights');
const realMake=null;
(async()=>{
 const plan={pages:[{panels:Array.from({length:20},(_,i)=>({mode:'manga',id:'p'+i}))},{panels:[{mode:'manga',id:'q'}]}]};
 const r=await M.createPanelsFromPlan(plan);
 assert.equal(r.objects.length,6);assert.equal(r.remainingPanels,15);assert.equal(r.remainingPages,4);
 assert(r.objects.every(o=>o.height>100));
 console.log('PASS 21 long stories are split by page with a 6-panel cap');
})().catch(e=>{console.error(e);process.exitCode=1;});

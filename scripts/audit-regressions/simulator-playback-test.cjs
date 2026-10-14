// Audit 20: stepping playback must not overwrite the stored scene with the truncated view.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const repo=path.join(__dirname,'..','..');
function obj(props){return Object.assign({set(k,v){if(typeof k==='object')Object.assign(this,k);else this[k]=v;}},props);}
const cv={objs:[],add(o){this.objs.push(o);o.canvas=this;},remove(o){this.objs=this.objs.filter(v=>v!==o);o.canvas=null;},
 getObjects(){return this.objs;},active:null,getActiveObject(){return this.active;},setActiveObject(o){this.active=o;},renderAll(){}};
const rendered=[];
const x={canvas:cv,JSON,Math,Promise,
 NaiComicTimeline:{fromScene(s){const n=s.events.length;return{index:-1,seek(i){this.index=i;return{index:i,total:n};},snapshot(){return{index:this.index,total:n};},hasNext(){return this.index<n-1;}};}},
 NaiComicExtraRendererRegistry:{get(){return{render(scene){rendered.push(scene.events.length);return obj({customType:'other',simulatorScene:JSON.stringify(scene)});}};}}};
x.globalThis=x;vm.createContext(x);
vm.runInContext(fs.readFileSync(path.join(repo,'js/simulator/playback-controller.js'),'utf8'),x);
const full={templateId:'forum-generic',events:[{t:'a'},{t:'b'},{t:'c'}]};
const g=obj({customType:'simulatorExtra',simulatorTemplateId:'forum-generic',simulatorScene:JSON.stringify(full),guid:'g'});
cv.add(g);cv.active=g;
(async()=>{
 const P=x.NaiComicPlaybackController;
 await P.next();await P.next();await P.next();
 assert.deepEqual(rendered,[1,2,3],'each step renders a growing view');
 assert.equal(JSON.parse(cv.getActiveObject().simulatorScene).events.length,3,'20: stored scene keeps all events');
 console.log('PASS 20 simulator playback keeps the full scene as the persisted source');
})().catch(e=>{console.error(e);process.exitCode=1;});

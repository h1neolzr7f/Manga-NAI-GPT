// Audit 116: a direct canvas text edit must be read back and survive re-apply.
const assert=require('assert');const {makeContext}=require('./_fabric-stub.cjs');
const x=makeContext();
for(const f of ['template-registry','scene-serializer','extra-renderer-factory','site-ui-parts'])x.load('js/simulator/'+f+'.js');
function cv(){return {_objects:[],width:1000,height:1800,active:null,add(o){this._objects.push(o);o.canvas=this;},remove(o){this._objects=this._objects.filter(v=>v!==o);o.canvas=null;},getObjects(){return this._objects;},getActiveObject(){return this.active;},setActiveObject(o){this.active=o;},renderAll(){},requestRenderAll(){}};}
(async()=>{
 x.canvas=cv();
 const part=x.NaiComicSiteUiParts.render('asset_site_tube_stats',{views:'OLD VIEWS'});
 x.NaiComicExtraRendererFactory.placeOnCanvas(part,x.canvas,{fit:false});
 const view=x.canvas.getObjects().find(o=>o.text==='OLD VIEWS');assert(view,'label placed');
 view.set({text:'NEW VIEWS'});x.canvas.active=view;
 const restored=x.NaiComicSiteUiParts.readSelected();
 assert.equal(restored.values.views,'NEW VIEWS','116: readSelected returns the live text');
 assert.equal(JSON.parse(view.simulatorScene).fields.views,'NEW VIEWS','116: stored scene synced');
 await x.NaiComicSiteUiParts.place(restored.id,restored.values);
 assert(x.canvas.getObjects().some(o=>o.text==='NEW VIEWS'),'116: re-apply keeps NEW VIEWS');
 assert(!x.canvas.getObjects().some(o=>o.text==='OLD VIEWS'));
 console.log('PASS 116 direct canvas text edits are read back and survive re-apply');
})().catch(e=>{console.error(e);process.exitCode=1;});

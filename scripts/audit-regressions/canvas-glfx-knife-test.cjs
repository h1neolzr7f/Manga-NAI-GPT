// Read-only audit. Run: node round5-canvas-audit-repro.cjs [repository-root]
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const repo=path.join(__dirname,'..','..');
const createCanvas=(w=1,h=1)=>({width:w,height:h,getContext:()=>({})});
const read=f=>fs.readFileSync(path.join(repo,f),'utf8');
function image(el,props={}){return Object.assign({type:'image',width:el.width,height:el.height,left:0,top:0,scaleX:1,scaleY:1,angle:0,opacity:1,strokeWidth:0,_element:el,set(p){Object.assign(this,p);return this;},getElement(){return this._element;},setElement(el){this._element=el;},scaleToWidth(w){this.scaleX=this.scaleY=w/this.width;},on(){},off(){}},props);}
function page(w=100,h=100){const top=createCanvas(w,h);return {width:w,height:h,objects:[],contextTop:top.getContext('2d'),add(o){this.objects.push(o);},remove(o){this.objects=this.objects.filter(x=>x!==o);},getObjects(){return this.objects;},item(i){return this.objects[i];},setActiveObject(o){this.active=o;},getActiveObject(){return this.active;},renderAll(){},requestRenderAll(){},contains(o){return this.objects.includes(o);},getWidth(){return this.width;},getHeight(){return this.height;}};}
function base(){let x={console,Promise,setTimeout,clearTimeout,document:{addEventListener(){},createElement(tag){assert.equal(tag,'canvas');return createCanvas(1,1);}},window:{addEventListener(){}},canvas:page(),imageLogger:{warn(){}},canvasLogger:{debug(){}},eventLogger:{trace(){},traceWithStack(){}},panelLogger:{debug(){}},updateLayerPanel(){},saveStateByManual(){},changeDoNotSaveHistory(){},changeDoSaveHistory(){},setNotSave(o){return o;},saveInitialState(){}};vm.createContext(x);return x;}
function run(x,file){vm.runInContext(read(file),x,{filename:file});}
function fn(x,file,start,end){vm.runInContext(read(file).split(start)[1].split(end)[0].replace(/^/,'function '+start),x,{filename:file+' [production function]'});}
function classFactory(parent,defs){function C(...args){defs.initialize.apply(this,args);}C.prototype=Object.assign(Object.create(parent.prototype),defs);return C;}
function glfx(){const x=base(),queue=[];x.Image=class{set src(v){this._src=v;queue.push(this);}get src(){return this._src;}};x.fabric={Image:function(el){return image(el);}};
 // Use exact production copy function; simple Image decoder fixture controls onload order.
 fn(x,'js/core/util/fabric-util.js','copy(srcObject,object) {','\n\n\nfunction setCanvasGUID');run(x,'js/ui/control/glfx-control.js');x.glfxResetFilterValues=()=>{};
 const eventHandlers={};x.canvas.on=(name,handler)=>eventHandlers[name]=handler;x.setInterval=()=>1;
 vm.runInContext(read('js/fabric/fabric-management.js').split("canvas.on('selection:cleared'")[0],x,{filename:'js/fabric/fabric-management.js [production selection listeners]'});
 const A=image({width:10,height:10,src:'pixels-A'},{guid:'A',left:10}),B=image({width:10,height:10,src:'pixels-B'},{guid:'B',left:60});x.canvas.objects=[A,B];x.canvas.insertAt=(o,i)=>x.canvas.objects.splice(i,0,o);x.canvas.moveTo=()=>{};x.canvas.active=A;x.lastActiveObjectState=A;x.glfxOriginalImage={src:'pixels-A'};
 x.canvas.active=B;eventHandlers['selection:updated']({});
 queue[0].width=10;queue[0].height=10;queue[0].onload();
 assert(x.canvas.objects.includes(B),'80: B must stay');assert.equal(B.getElement().src,'pixels-B');
 const restored=x.canvas.objects[0];assert.equal(restored.guid,'A');assert.equal(restored.getElement().src,'pixels-A');assert.equal(x.canvas.objects.length,2);
 console.log('PASS 80 filter restore stays on its own layer after a selection change');
}
function knife(){const x=base();
 class Polygon{constructor(points,options={}){this.type='polygon';this.points=points;const xs=points.map(p=>p.x),ys=points.map(p=>p.y);this.width=Math.max(...xs)-Math.min(...xs);this.height=Math.max(...ys)-Math.min(...ys);this.pathOffset={x:(Math.max(...xs)+Math.min(...xs))/2,y:(Math.max(...ys)+Math.min(...ys))/2};Object.assign(this,{left:Math.min(...xs),top:Math.min(...ys),scaleX:1,scaleY:1,strokeWidth:0},options);}set(p){Object.assign(this,p);return this;}on(){}off(){}getBoundingRect(){return {left:this.left,top:this.top,width:this.width*this.scaleX,height:this.height*this.scaleY};}calcTransformMatrix(){return [this.scaleX,0,0,this.scaleY,this.left+this.width*this.scaleX/2,this.top+this.height*this.scaleY/2];}}
 x.fabric={Polygon,Line:class{constructor(p,options){Object.assign(this,{x1:p[0],y1:p[1],x2:p[2],y2:p[3]},options);}set(){}},Shadow:class{},util:{transformPoint(p,m){return {x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]};}}};
 x.$=id=>({value:id==='knifePanelSpaceSize'?0:0});x.requestAnimationFrame=()=>1;x.cancelAnimationFrame=()=>{};x.currentKnifeLine=null;x.currentKnifeObject=null;x.knifeLineAnimationId=null;x.knifeLineDashOffset=0;
 run(x,'third/jsts/jsts.min.js');run(x,'js/sidebar/panel/knife/knife-constants.js');run(x,'js/sidebar/panel/knife/knife-geometry.js');run(x,'js/sidebar/panel/knife/knife-line-renderer.js');run(x,'js/sidebar/panel/knife/knife-split-engine.js');
 fn(x,'js/core/util/fabric-util.js','getCenterXByFabricObject(obj) {','\n\nfunction getLastObject');
 fn(x,'js/fabric/fabric-management.js','moveSettings(img,poly) {','\n\ncanvas.on("object:added"');
 fn(x,'js/sidebar/panel/panel-manager.js','putImageInFrame(imgOrSvg,x,y,isNotActive=false,notReplace=false,isFit=true,targetLayer=null) {','\n\nfunction findTargetFrame');
 let seq=0;x.getGUID=o=>o.guid||(o.guid='new-'+(++seq));x.setGUID=(p,c)=>{(p.guids||(p.guids=[])).push(x.getGUID(c));};x.setText2ImageInitPrompt=p=>{p.name='new panel';};
 x.currentKnifeLine=null;x.currentKnifeObject=null;
 const panel=new Polygon([{x:0,y:0},{x:100,y:0},{x:100,y:90},{x:0,y:100}],{guid:'parent',guids:['child'],name:'original'});const child=image(createCanvas(100,100),{guid:'child',clipPath:panel,relatedPoly:panel,name:'original In Image'});x.canvas.objects=[panel,child];
 x.canvas.insertAt=(o,i)=>x.canvas.objects.splice(i,0,o);x.canvas.moveTo=(o,i)=>{const arr=x.canvas.objects;arr.splice(arr.indexOf(o),1);arr.splice(i,0,o);};
 const before={left:child.left,scaleX:child.scaleX,clip:child.clipPath,rel:child.relatedPoly};
 const result=x.guidedSplitPanel(panel,true,.12);assert.equal(result.isSplit,false);
 assert.deepEqual(x.canvas.objects,[panel,child],'82: original panel and order restored');
 assert.equal(child.relatedPoly,before.rel,'82: child still bound to original panel');assert.equal(child.clipPath,before.clip);
 assert.equal(child.scaleX,before.scaleX);assert.equal(child.left,before.left);assert.deepEqual(panel.guids,['child']);
 console.log('PASS 82 rejected knife split rolls back child transform, clip and binding');
}
try{glfx();knife();}catch(e){console.error(e);process.exitCode=1;}

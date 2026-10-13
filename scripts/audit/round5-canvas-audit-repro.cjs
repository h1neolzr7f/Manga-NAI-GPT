// Read-only audit. Run: node round5-canvas-audit-repro.cjs [repository-root]
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const repo=path.resolve(process.argv[2]||process.env.MANGA_AUDIT_ROOT||process.cwd());
const native=require(require.resolve('@napi-rs/canvas',process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}:undefined));
const {createCanvas,loadImage}=native;
const read=f=>fs.readFileSync(path.join(repo,f),'utf8');
function image(el,props={}){return Object.assign({type:'image',width:el.width,height:el.height,left:0,top:0,scaleX:1,scaleY:1,angle:0,opacity:1,strokeWidth:0,_element:el,set(p){Object.assign(this,p);return this;},getElement(){return this._element;},setElement(el){this._element=el;},scaleToWidth(w){this.scaleX=this.scaleY=w/this.width;},on(){},off(){}},props);}
function page(w=100,h=100){const top=createCanvas(w,h);return {width:w,height:h,objects:[],contextTop:top.getContext('2d'),add(o){this.objects.push(o);},remove(o){this.objects=this.objects.filter(x=>x!==o);},getObjects(){return this.objects;},item(i){return this.objects[i];},setActiveObject(o){this.active=o;},getActiveObject(){return this.active;},renderAll(){},requestRenderAll(){},contains(o){return this.objects.includes(o);},getWidth(){return this.width;},getHeight(){return this.height;}};}
function base(){let x={console,Promise,setTimeout,clearTimeout,document:{addEventListener(){},createElement(tag){assert.equal(tag,'canvas');return createCanvas(1,1);}},window:{addEventListener(){}},canvas:page(),imageLogger:{warn(){}},canvasLogger:{debug(){}},eventLogger:{trace(){},traceWithStack(){}},panelLogger:{debug(){}},updateLayerPanel(){},saveStateByManual(){},changeDoNotSaveHistory(){},changeDoSaveHistory(){},setNotSave(o){return o;},saveInitialState(){}};vm.createContext(x);return x;}
function run(x,file){vm.runInContext(read(file),x,{filename:file});}
function fn(x,file,start,end){vm.runInContext(read(file).split(start)[1].split(end)[0].replace(/^/,'function '+start),x,{filename:file+' [production function]'});}
function classFactory(parent,defs){function C(...args){defs.initialize.apply(this,args);}C.prototype=Object.assign(Object.create(parent.prototype),defs);return C;}
async function blend(){const x=base();let pending;
 x.fabric={Image:{fromURL(url,cb){pending=loadImage(url).then(el=>cb(image(el)));}}};
 run(x,'js/core/util/html-canvas-util.js');run(x,'js/core/util/image-util.js');
 const c=createCanvas(100,100),g=c.getContext('2d');g.fillStyle='red';g.fillRect(30,40,10,10);g.fillStyle='blue';g.fillRect(40,40,10,10);
 x.sendHtmlCanvas2FabricCanvas(c);await pending;const out=x.canvas.objects[0];
 assert.equal(out.width,20);assert.equal(out.height,10);assert.equal(out.left,0);assert.equal(out.top,0);assert.equal(out.scaleX,5);
 console.log('CONFIRMED BLEND_APPLY_GEOMETRY: 100x100 composite nontransparent box [30,40,49,49] becomes 20x10 layer left/top=0/0 scale=5; displayed box [0,0,100,50], expected [30,40,20,10]. Real canvas bounds/cropping plus production sendHtmlCanvas2FabricCanvas.');
}
async function brush(){const x=base();x.window=x;x.addEventListener=()=>{};x.fabric={BaseBrush:function(){},util:{createClass:classFactory}};
 run(x,'js/sidebar/pen/custom-brush.js');
 const b=new x.fabric.TaperBrush(x.canvas,{size:10,color:'red',opacity:1,taperStart:0,taperEnd:0});
 b.onMouseDown({x:50,y:50});b.onMouseUp();assert.equal(b._offscreenCtx.getImageData(50,50,1,1).data[3],255);
 x.$=()=>null;x.canvas.setDimensions=function(p){Object.assign(this,p);this.contextTop=createCanvas(this.width,this.height).getContext('2d');};
 run(x,'js/canvas-manager.js');x.scheduleExportSizeEstimate=()=>{};x.resizeCanvasToObject(200,200);
 b.onMouseDown({x:150,y:150});b.onMouseUp();const alpha=x.canvas.contextTop.getImageData(150,150,1,1).data[3];assert.equal(alpha,0);assert.equal(b._offscreenCanvas.width,100);
 const fresh=new x.fabric.TaperBrush(x.canvas,{size:10,color:'red',opacity:1});fresh.onMouseDown({x:150,y:150});fresh.onMouseUp();assert.equal(x.canvas.contextTop.getImageData(150,150,1,1).data[3],255);
 console.log('CONFIRMED BRUSH_RESIZED_BUFFER: production TaperBrush paints alpha=255 at (50,50) on 100px page; production resizeCanvasToObject(200,200) keeps brush 100px buffer and clips stroke at (150,150), alpha=0; fresh brush on same 200px page alpha=255. CustomStamp/DoubleOutline/Mosaic share allocation pattern (only Taper executed).');
}
function glfx(){const x=base(),queue=[];x.Image=class{set src(v){this._src=v;queue.push(this);}get src(){return this._src;}};x.fabric={Image:function(el){return image(el);}};
 // Use exact production copy function; simple Image decoder fixture controls onload order.
 fn(x,'js/core/util/fabric-util.js','copy(srcObject,object) {','\n\n\nfunction setCanvasGUID');run(x,'js/ui/control/glfx-control.js');x.glfxResetFilterValues=()=>{};
 const eventHandlers={};x.canvas.on=(name,handler)=>eventHandlers[name]=handler;x.setInterval=()=>1;
 vm.runInContext(read('js/fabric/fabric-management.js').split("canvas.on('selection:cleared'")[0],x,{filename:'js/fabric/fabric-management.js [production selection listeners]'});
 const A=image({width:10,height:10,src:'pixels-A'},{guid:'A',left:10}),B=image({width:10,height:10,src:'pixels-B'},{guid:'B',left:60});x.canvas.objects=[A,B];x.canvas.active=A;x.lastActiveObjectState=A;x.glfxOriginalImage={src:'pixels-A'};
 x.canvas.active=B;eventHandlers['selection:updated']({});
 queue[0].width=10;queue[0].height=10;queue[0].onload();
 const replaced=x.canvas.objects.find(o=>o!==A);assert(!x.canvas.objects.includes(B));assert.equal(replaced.guid,'B');assert.equal(replaced.getElement().src,'pixels-A');assert.equal(replaced.left,60);
 console.log('CONFIRMED GLFX_SELECTION_RACE: production selection:updated starts reset with lastActive=A then sets lastActive=B; delayed production onload removes B and inserts pixels-A with guid=B,left=60; A remains. Decoder order fixture, production selection listener+glfxReset+copy.');
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
 const square=new Polygon([{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}]);x.canvas.objects=[square];
 const squareResult=x.guidedSplitPanel(square,true,.5);assert.equal(squareResult.isSplit,false);assert.equal(x.currentKnifeLine.y1,0);assert.equal(x.currentKnifeLine.y2,0);
 x.GUIDED_SPLIT_RATIO_CANDIDATES=[.5,.45,.55,.4,.6,.35,.65,.33,.67];fn(x,'js/panel/layout-templates.js','guidedSplitPanelWithRetry(panel,isVertical,preferredRatio){','\n\nfunction applyPanelLayoutTemplate');
 assert.equal(x.guidedSplitPanelWithRetry(square,true,.5).isSplit,false);assert.equal(x.guidedSplitPanelWithRetry(square,false,.5).isSplit,false);assert.equal(x.currentKnifeLine.x1,x.currentKnifeLine.x2);assert.equal(x.currentKnifeLine.y1,x.currentKnifeLine.y2);
 console.log('CONFIRMED KNIFE_EQUAL_DISTANCE: 100x100 rectangle centered split returns false with knife endpoints both (50,0); all nine production retry ratios fail vertically AND horizontally because both closest/farthest pick first equidistant intersection. Production template retry+geometry/line/JSTS/engine, Fabric geometry shell.');
 x.currentKnifeLine=null;x.currentKnifeObject=null;
 const panel=new Polygon([{x:0,y:0},{x:100,y:0},{x:100,y:90},{x:0,y:100}],{guid:'parent',guids:['child'],name:'original'});const child=image(createCanvas(100,100),{guid:'child',clipPath:panel,relatedPoly:panel,name:'original In Image'});x.canvas.objects=[panel,child];
 const result=x.guidedSplitPanel(panel,true,.12);assert.equal(result.isSplit,false);assert(x.canvas.objects.includes(panel));assert.equal(x.canvas.objects.length,2);assert.notEqual(child.relatedPoly,panel);assert(!x.canvas.objects.includes(child.relatedPoly));assert.equal(child.relatedPoly.width,88);assert.notEqual(child.scaleX,1);
 console.log('CONFIRMED KNIFE_REJECT_ROLLBACK: guided 12% split of trapezoid rejected by aspect min=.27; original panel restored, child scale='+child.scaleX+',left='+child.left+', binds to removed '+child.relatedPoly.width+'x'+child.relatedPoly.height+' temporary panel; original clip/geometry not restored. Production JSTS+knife+putImageInFrame+moveSettings/updateClipPath; Fabric geometry shell.');
}
(async()=>{await blend();await brush();glfx();knife();})().catch(e=>{console.error(e);process.exitCode=1;});

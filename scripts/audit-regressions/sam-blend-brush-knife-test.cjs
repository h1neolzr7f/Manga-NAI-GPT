// Audit 77 (SAM raster mask), 78 (blend place), 79 (brush buffer), 81 (knife equal distance).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const repo=path.join(__dirname,'..','..');
const napiPaths=['/opt/sand/sand-host/node_modules',process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES].filter(Boolean);
let createCanvas,loadImage;
try{
  ({createCanvas,loadImage}=require(require.resolve('@napi-rs/canvas',{paths:napiPaths})));
}catch(e){createCanvas=null;}

// --- 77 ---
{
  const src=fs.readFileSync(path.join(repo,'js/ai/sam-click-select.js'),'utf8');
  let got=null;
  const c={window:{removeEventListener(){},MangaGPTRegionEditor:{selectPolygon(poly,msg,mask){got={poly,mask};return true;}}},
    document:{createElement:()=>({getContext:()=>({}),style:{},width:0,height:0})},console};
  vm.createContext(c);vm.runInContext(src.replace('window.SamClickSelect = {','window.SamClickSelect = { auditFinish:finish, auditSession:s=>{cur=s;}, '),c);
  c.window.SamClickSelect.auditSession({target:'gpt',box:{remove(){}},view:{getContext:()=>({clearRect(){},drawImage(){},save(){},restore(){},globalCompositeOperation:'',fillStyle:'',fillRect(){}})},cands:[{polygon:[[0,0],[10,0],[10,10]],mask:'data:image/png;base64,MASK',box:[0,0,10,10]}],pick:0,onDone(){}});
  c.window.SamClickSelect.auditFinish();
  assert.equal(got.mask,'data:image/png;base64,MASK');
  // GPT stores smartMask and prefers it over lasso refill
  const gsrc=fs.readFileSync(path.join(repo,'js/ai/gpt-region-editor.js'),'utf8');
  assert(gsrc.includes('smartMask')&&gsrc.includes('region.smartMask'),'77: GPT apply prefers smartMask');
  console.log('PASS 77 SAM finish passes raster mask; GPT keeps smartMask for apply');
}

(async()=>{
  if(!createCanvas){console.log('SKIP 78/79 (no @napi-rs/canvas)');return;}
  const read=f=>fs.readFileSync(path.join(repo,f),'utf8');
  function image(el,props={}){return Object.assign({type:'image',width:el.width,height:el.height,left:0,top:0,scaleX:1,scaleY:1,angle:0,opacity:1,strokeWidth:0,_element:el,set(p){Object.assign(this,p);return this;},getElement(){return this._element;},setElement(el){this._element=el;},scaleToWidth(w){this.scaleX=this.scaleY=w/this.width;},on(){},off(){}},props);}
  function page(w=100,h=100){const top=createCanvas(w,h);return {width:w,height:h,objects:[],contextTop:top.getContext('2d'),add(o){this.objects.push(o);},remove(o){this.objects=this.objects.filter(x=>x!==o);},getObjects(){return this.objects;},setActiveObject(o){this.active=o;},getActiveObject(){return this.active;},renderAll(){},requestRenderAll(){},setDimensions(p){Object.assign(this,p);this.contextTop=createCanvas(this.width,this.height).getContext('2d');}};}
  function base(){const x={console,Promise,setTimeout,clearTimeout,document:{addEventListener(){},createElement(tag){assert.equal(tag,'canvas');return createCanvas(1,1);}},window:{addEventListener(){}},canvas:page(),imageLogger:{warn(){}},canvasLogger:{debug(){}},eventLogger:{trace(){},traceWithStack(){}},panelLogger:{debug(){}},updateLayerPanel(){},saveStateByManual(){},changeDoNotSaveHistory(){},changeDoSaveHistory(){},$(){return null;},getText:k=>k,createToast(){},createToastError(){},NaiMangaPageSize:{EXPORT_MAX_EDGE:8192,EXPORT_MAX_PIXELS:4e7},isGridVisible:false,drawGrid(){},removeGrid(){}};x.window=x;vm.createContext(x);return x;}
  function run(x,file){vm.runInContext(read(file),x,{filename:file});}
  function classFactory(parent,defs){function C(...args){defs.initialize.apply(this,args);}C.prototype=Object.assign(Object.create(parent.prototype),defs);return C;}

  // 78
  {
    const x=base();let pending;
    x.fabric={Image:{fromURL(url,cb){pending=loadImage(url).then(el=>cb(image(el)));}}};
    run(x,'js/core/util/html-canvas-util.js');run(x,'js/core/util/image-util.js');
    const c=createCanvas(100,100),g=c.getContext('2d');g.fillStyle='red';g.fillRect(30,40,10,10);g.fillStyle='blue';g.fillRect(40,40,10,10);
    x.sendHtmlCanvas2FabricCanvas(c);await pending;const out=x.canvas.objects[0];
    assert.equal(out.width,20);assert.equal(out.height,10);
    assert.equal(out.left,30);assert.equal(out.top,40);assert.equal(out.scaleX,1);assert.equal(out.scaleY,1);
    console.log('PASS 78 blend apply keeps crop offset and page pixel scale');
  }
  // 79
  {
    const x=base();x.window=x;x.addEventListener=()=>{};x.fabric={BaseBrush:function(){},util:{createClass:classFactory}};
    run(x,'js/sidebar/pen/custom-brush.js');
    const b=new x.fabric.TaperBrush(x.canvas,{size:10,color:'red',opacity:1,taperStart:0,taperEnd:0});
    b.onMouseDown({x:50,y:50});b.onMouseUp();assert.equal(b._offscreenCtx.getImageData(50,50,1,1).data[3],255);
    x.$=()=>null;run(x,'js/canvas-manager.js');x.scheduleExportSizeEstimate=()=>{};x.viewUserScale=1;x.fitCanvasViewToContainer=()=>{};x.syncExportPagePlan=()=>{};x.resolvePagePixels=(w,h)=>({width:w,height:h});
    x.resizeCanvasToObject(200,200);
    b.onMouseDown({x:150,y:150});b.onMouseUp();
    assert.equal(b._offscreenCanvas.width,200);assert.equal(b._offscreenCanvas.height,200);
    assert.equal(x.canvas.contextTop.getImageData(150,150,1,1).data[3],255);
    console.log('PASS 79 TaperBrush offscreen buffer grows with the page');
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

// --- 81 ---
{
  const read=f=>fs.readFileSync(path.join(repo,f),'utf8');
  function page(){return{width:100,height:100,objects:[],add(o){this.objects.push(o);},remove(o){this.objects=this.objects.filter(x=>x!==o);},getObjects(){return this.objects;},renderAll(){},requestRenderAll(){},contains(o){return this.objects.includes(o);}};}
  const x={console,Promise,document:{addEventListener(){},createElement:()=>({getContext:()=>({})})},window:{},canvas:page(),
    imageLogger:{warn(){}},panelLogger:{debug(){}},eventLogger:{trace(){},traceWithStack(){}},updateLayerPanel(){},saveStateByManual(){},
    changeDoNotSaveHistory(){},changeDoSaveHistory(){},setNotSave(o){return o;},isSave:()=>true,createToast(){},createToastError(){},
    $:id=>({value:id==='knifePanelSpaceSize'?0:0}),requestAnimationFrame:()=>1,cancelAnimationFrame(){},
    currentKnifeLine:null,currentKnifeObject:null,knifeLineAnimationId:null,knifeLineDashOffset:0};
  x.window=x;vm.createContext(x);
  class Polygon{constructor(points,options={}){this.type='polygon';this.points=points;const xs=points.map(p=>p.x),ys=points.map(p=>p.y);this.width=Math.max(...xs)-Math.min(...xs);this.height=Math.max(...ys)-Math.min(...ys);this.pathOffset={x:(Math.max(...xs)+Math.min(...xs))/2,y:(Math.max(...ys)+Math.min(...ys))/2};Object.assign(this,{left:Math.min(...xs),top:Math.min(...ys),scaleX:1,scaleY:1,strokeWidth:0,absolute:true},options);}set(){}get(k){return this[k];}getBoundingRect(){return{left:this.left,top:this.top,width:this.width,height:this.height};}getCenterPoint(){return{x:this.left+this.width/2,y:this.top+this.height/2};}}
  x.fabric={Polygon,Line:class{constructor(p,options){Object.assign(this,{x1:p[0],y1:p[1],x2:p[2],y2:p[3]},options);}set(){}},Shadow:class{},util:{transformPoint(p,m){return{x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]};}}};
  for(const f of ['third/jsts/jsts.min.js','js/sidebar/panel/knife/knife-constants.js','js/sidebar/panel/knife/knife-geometry.js','js/sidebar/panel/knife/knife-line-renderer.js','js/sidebar/panel/knife/knife-split-engine.js'])vm.runInContext(read(f),x,{filename:f});
  // pull guidedSplitPanel
  const eng=read('js/sidebar/panel/knife/knife-split-engine.js');
  // already loaded. Also need helpers used by guidedSplitPanel
  const helpers=['getCenterXByFabricObject(obj) {','moveSettings(img,poly) {','putImageInFrame(imgOrSvg,x,y,isNotActive=false,notReplace=false,isFit=true,targetLayer=null) {'];
  function fn(file,start,end){const t=read(file);const a=t.indexOf(start),b=t.indexOf(end,a);vm.runInContext('function '+t.slice(a,b),x,{filename:file});}
  try{fn('js/core/util/fabric-util.js','getCenterXByFabricObject(obj) {','\n\nfunction getLastObject');}catch(_){}
  try{fn('js/fabric/fabric-management.js','moveSettings(img,poly) {','\n\ncanvas.on("object:added"');}catch(_){}
  try{fn('js/sidebar/panel/panel-manager.js','putImageInFrame(imgOrSvg,x,y,isNotActive=false,notReplace=false,isFit=true,targetLayer=null) {','\n\nfunction findTargetFrame');}catch(_){}
  let seq=0;x.getGUID=o=>o.guid||(o.guid='new-'+(++seq));x.setGUID=(p,c)=>{(p.guids||(p.guids=[])).push(x.getGUID(c));};x.setText2ImageInitPrompt=p=>{p.name='new panel';};
  x.stopKnifeLineAnimation=()=>{};x.startKnifeLineAnimation=()=>{};
  const square=new Polygon([{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}]);x.canvas.objects=[square];
  assert(typeof x.guidedSplitPanel==='function','guidedSplitPanel present');
  // Probe drawLine alone for distinct endpoints (the audited failure mode).
  const probe=x.drawLine(50,50,50,50+80,square);
  assert(probe);assert.notEqual(probe.y1,probe.y2,'81: knife endpoints must differ on a center vertical cut');
  x.canvas.remove(probe);x.currentKnifeLine=null;
  const squareResult=x.guidedSplitPanel(square,true,.5);
  assert.equal(squareResult.isSplit,true,'81: center vertical split of a square succeeds');
  x.GUIDED_SPLIT_RATIO_CANDIDATES=[.5,.45,.55,.4,.6,.35,.65,.33,.67];
  fn('js/panel/layout-templates.js','guidedSplitPanelWithRetry(panel,isVertical,preferredRatio){','\n\nfunction applyPanelLayoutTemplate');
  const sq2=new Polygon([{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}]);x.canvas.objects=[sq2];x.currentKnifeLine=null;
  assert.equal(x.guidedSplitPanelWithRetry(sq2,true,.5).isSplit,true);
  console.log('PASS 81 rectangle center split uses two distinct knife endpoints');
}

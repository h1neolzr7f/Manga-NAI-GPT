// Audit 87 (long page plans), 89 (tone/speedline logical size), 90 (focusline single add).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const repo=path.join(__dirname,'..','..');
const napiPaths=['/opt/sand/sand-host/node_modules',process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES].filter(Boolean);
let createCanvas;try{({createCanvas}=require(require.resolve('@napi-rs/canvas',{paths:napiPaths})));}catch(e){createCanvas=null;}

{
  const x={console,btmGetGuidsSize:()=>40};vm.createContext(x);
  vm.runInContext(fs.readFileSync(path.join(repo,'js/ai/prompt/auto/auto-prompt-util.js'),'utf8'),x);
  for(const pages of [6,39,40,153]){
    x.btmGetGuidsSize=()=>pages;
    const list=x.generatePageList();
    assert.equal(list.length,pages,'87: plan length for '+pages);
  }
  console.log('PASS 87 generatePageList covers 39/40/153 pages deterministically');
}

if(createCanvas){
  const x={console,document:{addEventListener(){},createElement:()=>createCanvas(1,1)},canvas:{width:100,height:100,getActiveObject(){return this.active;},objects:[]},window:{},isPanel:o=>o&&o.type==='polygon',effectLogger:{debug(){}},$(){},updatecanvas(){}};
  vm.createContext(x);
  const fields={'Tone-dot-size':8,'Tone-dot-spacing':2,'Tone-dot-style':'square','Tone-color':'#000000','Tone-grad-style':'top-bottom','Tone-grad-start':0,'Tone-grad-end':100};
  x.$=id=>id==='Tone-grad-check'?{checked:true}:{value:fields[id]};
  vm.runInContext(fs.readFileSync(path.join(repo,'js/sidebar/tone/tone-manager.js'),'utf8'),x);
  vm.runInContext(fs.readFileSync(path.join(repo,'js/sidebar/tone/tone.js'),'utf8'),x);
  x.canvas.active={type:'polygon',width:100,height:100,scaleX:1,scaleY:1};
  x.updatecanvas=()=>{};assert.equal(x.toneStart(),true);x.generateTone();
  const a=x.tmpCtxTone.getImageData(150,270,1,1).data[3];
  assert(a>=200,'89: gradient at logical bottom should be strong, got '+a);
  const speedFields={'SpeedLine-density':12,'speed-line-style':'horizontal','SpeedLine-grad-check':false,'SpeedLine-color':'#000000','SpeedLine-grad-start':0,'SpeedLine-grad-end':100};
  x.$=id=>id==='SpeedLine-grad-check'?{checked:false}:{value:speedFields[id]};
  vm.runInContext(fs.readFileSync(path.join(repo,'js/sidebar/tone/speedline.js'),'utf8'),x);
  x.getLastObject=()=>x.canvas.active;x.updateSpeedLineCanvas=()=>{};
  // speedLineStart also pulls fabric via update; allocate buffer like production start
  x.tempCanvasSpeedLine=createCanvas(300,300);x.tempCtxSpeedLine=x.tempCanvasSpeedLine.getContext('2d');x.tempCtxSpeedLine.scale(3,3);x.isDrawingSpeedLine=false;x.drawTempCanvasSpeedlines();
  const px=x.tempCtxSpeedLine.getImageData(150,0,1,300).data;let runs=0,inLine=false;
  for(let i=3;i<px.length;i+=4){if(px[i]>0&&!inLine)runs++;inLine=px[i]>0;}
  assert.equal(runs,12,'89: density 12 => 12 visible lines, got '+runs);
  console.log('PASS 89 tone gradient and speedline density use logical coordinates');
}else console.log('SKIP 89 (no canvas)');

{
  const min=fs.readFileSync(path.join(repo,'third/Fabric.js/fabric.min_PlusEraser.js'),'utf8');
  const collection=min.slice(min.indexOf('fabric.Collection='),min.indexOf(';fabric.CommonMethods='));
  const x={console,fabric:{},document:{addEventListener(){},createElement:()=>({getContext:()=>({})})},effectLogger:{debug(){}},$(){},window:{}};
  vm.createContext(x);vm.runInContext(collection,x);
  const c={_objects:[],renderAll(){},setActiveObject(){}};
  c.getObjects=x.fabric.Collection.getObjects;c.add=x.fabric.Collection.add;c.remove=x.fabric.Collection.remove;c.item=x.fabric.Collection.item;c.contains=function(o){return this._objects.includes(o);};
  x.canvas=c;
  const panel={type:'polygon',width:100,height:100,left:0,top:0,scaleX:1,scaleY:1,name:'P',getBoundingRect(){return{left:0,top:0,width:100,height:100};}};
  c.add(panel);x.getLastObject=()=>panel;x.setNotSave=o=>o;x.moveSettings=()=>{};x.setGUID=()=>{};x.saveInitialState=()=>{};x.updateLayerPanel=()=>{};x.saveStateByManual=()=>{};x.panelLogger={debug(){}};x.isPanel=()=>true;x.isNotActive=true;
  x.fabric.util={groupSVGElements(){return{type:'group',width:100,height:100,name:'F',set(p){Object.assign(this,p);}};}};
  x.fabric.loadSVGFromString=(s,cb)=>cb([],{});
  const pm=fs.readFileSync(path.join(repo,'js/sidebar/panel/panel-manager.js'),'utf8');
  const start=pm.indexOf('function putImageInFrame'),end=pm.indexOf('\n\nfunction findTargetFrame');
  vm.runInContext(pm.slice(start,end),x);
  vm.runInContext(fs.readFileSync(path.join(repo,'js/sidebar/tone/focusline.js'),'utf8'),x);
  x.tmpCanvasFL={width:300,height:300};x.convertToSVG=()=>'<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L100 0L50 50Z"/></svg>';
  x.isPanel=o=>o&&o.type==='polygon';
  x.updateFCFabricCanvas();
  assert.equal(c._objects.length,2,'90: panel + one focus line');
  assert.notStrictEqual(c._objects[1],c._objects[0]);
  const first=c._objects[1];
  x.updateFCFabricCanvas();
  assert.equal(c._objects.length,2,'90: still one focus line after update');
  assert.notStrictEqual(c._objects[1],first,'90: previous focus line replaced');
  console.log('PASS 90 focus line updates without duplicate canvas.add');
}

/* Offline, read-only product audit. Exit 0 means defects reproduced.
 * node round6-ui-audit-repro.cjs /absolute/path/to/repo
 * Uses @napi-rs/canvas for actual pixels; all service responses are fixtures. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const repo=path.resolve(process.argv[2]||process.env.MANGA_AUDIT_ROOT||process.cwd());
const native=require(require.resolve('@napi-rs/canvas',process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}:undefined));
const {createCanvas}=native;
const read=f=>fs.readFileSync(path.join(repo,f),'utf8');
function run(c,f){vm.runInContext(read(f),c,{filename:f});}
function emit(label,value){console.log(label+' '+JSON.stringify(value));}
function node(){return {style:{},children:[],value:'',options:[],checked:false,classList:{add(){},remove(){},contains(){return false;},toggle(){}},setAttribute(){},getAttribute(){return null;},addEventListener(){},dispatchEvent(){},appendChild(o){this.children.push(o);if(this.tagName==='SELECT')this.options.push(o);return o;},querySelector(){return null;},querySelectorAll(){return []},remove(){}};}
function env(fields={}){
 const c={console,Promise,Map,Set,Math,JSON,Object,Array,Date,btoa,setTimeout:()=>0,clearTimeout(){},Event:class{},document:{readyState:'loading',documentElement:node(),body:node(),addEventListener(){},createElement(tag){const n=node();n.tagName=tag.toUpperCase();return n;},getElementById:id=>fields[id]||null,querySelector(){return null;},querySelectorAll(){return []}},$:id=>fields[id]||null,createToastError(...a){c.errors.push(a);},createToast(){},errors:[],updateLayerPanel(){},changeDoNotSaveHistory(){},changeDoSaveHistory(){},saveStateByManual(){c.savedPages.push(c.canvas.guid);},savedPages:[]};
 c.window=c;c.globalThis=c;vm.createContext(c);return c;
}
function canvas(){return {guid:'A',width:100,height:100,objects:[],wrapperEl:{addEventListener(){},contains(){return false;}},getObjects(){return this.objects;},forEachObject(fn){this.objects.forEach(fn);},add(o){this.objects.push(o);},remove(o){this.objects=this.objects.filter(x=>x!==o);},sendToBack(o){this.remove(o);this.objects.unshift(o);},bringToFront(o){this.remove(o);this.objects.push(o);},getActiveObject(){return this.active;},setActiveObject(o){this.active=o;},discardActiveObject(){this.active=null;},renderAll(){},requestRenderAll(){}};}
// Extract a bundled Fabric method unchanged, as earlier audit fixtures do.
function fabricMethod(name){const src=read('third/Fabric.js/fabric.min_PlusEraser.js'),at=src.indexOf(name+':function');assert.ok(at>=0);const start=at+name.length+1;let i=src.indexOf('{',start),depth=1,quote=null,escape=false;for(i++;i<src.length;i++){const ch=src[i];if(quote){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch===quote)quote=null;}else if(ch==='"'||ch==="'")quote=ch;else if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return vm.runInNewContext('('+src.slice(start,i+1)+')');}throw Error(name);}
const drawObject=fabricMethod('drawObject');
class Rect{constructor(props){Object.assign(this,{type:'rect'},props);}set(k,v){typeof k==='object'?Object.assign(this,k):this[k]=v;return this;}_render(){}_renderBackground(){}_drawClipPath(){}render(ctx){ctx.save();ctx.translate(this.left+this.width/2,this.top+this.height/2);drawObject.call(this,ctx);ctx.restore();}}
function render(objects){const c=createCanvas(100,100),g=c.getContext('2d');for(const o of objects)o.render(g);return c;}
function pixel(c,x=80,y=80){return Array.from(c.getContext('2d').getImageData(x,y,1,1).data);}
async function main(){
 {
  const c=env();c.canvas=canvas();c.fabric={Rect};run(c,'js/sidebar/page/page-studio.js');
  const underlying={render(g){g.fillStyle='red';g.fillRect(0,0,100,100);}};c.canvas.objects=[underlying];
  const before=pixel(render(c.canvas.objects));await c.NaiPageStudio.applyEffect({id:'rain',density:1,length:2,opacity:0.5});
  const after=pixel(render(c.canvas.objects));assert.deepEqual(before,[255,0,0,255]);assert.deepEqual(after,[0,0,0,0]);
  c.canvas.objects=[];await c.NaiPageStudio.applyPaper('white');const paperBefore=pixel(render(c.canvas.objects),15,15);c.NaiPageStudio.syncGridOverlay(true);const paperAfter=pixel(render(c.canvas.objects),15,15);
  assert.equal(paperBefore[3],255);assert.equal(paperAfter[3],0);
  emit('CONFIRMED PAGE_PROCEDURAL_CLEAR_ERASES_LOWER_LAYERS',{effectBefore:before,effectAfter:after,paperBefore,paperAfter,objectCaching:c.canvas.objects.map(o=>o.objectCaching),pipeline:'bundled Fabric.drawObject -> production _render on shared native Canvas2D'});
 }
 {
  const c=env();c.canvas=canvas();let decode;
  c.fabric={Rect,Image:{fromURL(url,cb){decode=cb;}}};run(c,'js/sidebar/page/page-studio.js');
  const oldA={customType:'pageBackground',name:'A-old'};c.canvas.objects=[oldA];const pageA=c.canvas.objects;
  const pending=c.NaiPageStudio.applyPaperImage('data:image/png;base64,fixture');
  const oldB={customType:'pageBackground',name:'B-old'};c.canvas.guid='B';c.canvas.width=200;c.canvas.height=300;c.canvas.objects=[oldB];
  const image=new Rect({width:100,height:100});decode(image);await pending;
  assert.ok(!c.canvas.objects.includes(oldB));assert.ok(c.canvas.objects.includes(image));assert.equal(image.scaleX,3);assert.equal(c.savedPages[0],'B');
  emit('CONFIRMED CUSTOM_PAPER_ASYNC_REPLACES_OTHER_PAGE',{originPage:'A',completionPage:c.canvas.guid,pageAStillOriginal:pageA.includes(oldA),pageBOriginalRemoved:!c.canvas.objects.includes(oldB),pageBNames:c.canvas.objects.map(o=>o.name),scaleX:image.scaleX,savedPages:c.savedPages});
 }
 {
  const fields={novelaiApiKey:{value:'fixture-token'}};const c=env(fields);c.canvas=canvas();c.canvas.active={type:'image',guid:'imported-image'};
  c.getPanelObjectList=()=>[];c.btmGetGuidsSize=()=>1;c.isPanel=o=>!!o.isPanel;c.isImage=o=>o.type==='image';let paidCalls=0,confirmCalls=0;
  c.I2I=()=>paidCalls++;c.T2I=()=>paidCalls++;c.confirm=()=>{confirmCalls++;return true;};c.createSpinner=()=>({});c.getGUID=o=>o.guid;
  run(c,'js/ui/beginner-guide.js');run(c,'js/ui/canvas-object-menu.js');
  c.handleMenuClick({target:{closest:()=>({id:'fabricjs-generate-btn'})}});
  assert.equal(paidCalls,0);assert.equal(confirmCalls,0);assert.match(c.errors[0][0],/还没有分镜格/);
  // Control: adding one panel makes the same production click reach I2I.
  c.getPanelObjectList=()=>[{isPanel:true}];c.handleMenuClick({target:{closest:()=>({id:'fabricjs-generate-btn'})}});assert.equal(paidCalls,1);
  emit('CONFIRMED IMAGE_ONLY_I2I_BLOCKED_BY_PANEL_PREFLIGHT',{imageOnlyCalls:0,imageOnlyConfirmCalls:0,warning:c.errors[0][0],controlWithOnePanelCalls:paidCalls});
 }
 {
  const c=env();c.canvas=canvas();c.uiLogger={debug(){}};Object.assign(c,{cropFrame:null,cropActiveObject:null,isKnifeMode:false,nowPencil:'',currentMode:'select',hideCanvasHelpText(){},getObjectList:()=>c.canvas.objects,getText:s=>s});
  run(c,'js/layer/layer-button.js');run(c,'js/ui/util/mode-manager.js');
  const locked=new Rect({selectable:true,evented:true}),panel=new Rect({selectable:true,evented:true});c.canvas.objects=[locked,panel];
  c.moveLockChange(locked);assert.equal(locked.selectable,false);c.ModeManager.knife.enable();c.ModeManager.knife.toggle();assert.equal(locked.selectable,true);
  emit('CONFIRMED KNIFE_MODE_CLEAR_REMOVES_USER_MOVEMENT_LOCK',{afterUserLock:false,afterKnifeExit:locked.selectable});
 }
 {
  const fields={mangaGptUrl:{...node(),value:'https://service-a.invalid/v1'},mangaGptModel:{...node(),value:'gpt-image-1'},mangaGptKey:{...node(),value:''},mangaGptModelPreset:{...node(),tagName:'SELECT'},svcGptRemember:{checked:true},svcGptStatus:node()};
  const c=env(fields),storage=new Map();c.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};c.sessionStorage={removeItem(){},setItem(){},getItem(){return null;}};
  let respond,requestBody;c.ServiceRequest={request(kind,url,opt){requestBody=opt.body;return new Promise(r=>respond=r);}};run(c,'js/ui/service-settings.js');
  const testing=c.ServiceSettings.testGpt();fields.mangaGptUrl.value='https://service-b.invalid/v1';fields.mangaGptModel.value='gpt-image-2';respond({imageModels:['gpt-image-1']});await testing;
  const saved=JSON.parse(storage.get('mnai.services.gpt'));assert.equal(saved.baseUrl,'https://service-b.invalid/v1');assert.equal(saved.model,'gpt-image-1');
  emit('CONFIRMED OLD_GPT_MODEL_TEST_OVERWRITES_NEW_SERVICE',{requestBaseUrl:requestBody.baseUrl,userSelectedModelB:'gpt-image-2',actualModel:fields.mangaGptModel.value,persisted:saved,status:fields.svcGptStatus.textContent});
 }
 {
  const ids=['svg-container-template','panel-manager-area','auto-generate-area','prompt-manager-area','simulator-chat-area','asset-library-area','speech-bubble-area','text-area','text-area2','tool-area','cutout-area','manga-tone-area','manga-effect-area','shape-area','control-area','ps-tools-area'];
  const fields=Object.fromEntries(ids.map(id=>[id,{style:{display:'none'}}]));const c=env(fields);c.canvas=canvas();c.lazyLoadSvgData=()=>{};c.adjustCanvasSize=()=>{};run(c,'js/sidebar/sidebar.js');
  c.toggleVisibility('ps-tools-area');c.toggleVisibility('text-area');const open=ids.filter(id=>fields[id].style.display==='block');assert.deepEqual(open,['text-area','ps-tools-area']);
  emit('CONFIRMED SIDEBAR_DRAW_TOOLS_NOT_CLOSED_BY_OTHER_PANEL',{openPanels:open});
 }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});

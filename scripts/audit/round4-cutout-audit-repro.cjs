// Read-only production cutout audit. Uses @napi-rs/canvas for real PNG/pixel processing.
// Run from repo root: node scripts/audit/round4-cutout-audit-repro.cjs [repository-root]
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path'),cp=require('child_process');
const repo=path.resolve(process.argv[2]||process.env.MANGA_AUDIT_ROOT||process.cwd());
const native=require(require.resolve('@napi-rs/canvas',process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}:undefined));
const {createCanvas,Image,loadImage}=native;
const sourceCode=fs.readFileSync(path.join(repo,'js/local-tools/background-removal-client.js'),'utf8');
function art(w=100,h=100){const c=createCanvas(w,h),g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,w,h);g.fillStyle='red';g.fillRect(60,20,10,10);return c;}
function fabricImage(el,props={}){return Object.assign({type:'image',width:el.width,height:el.height,scaleX:1,scaleY:1,left:0,top:0,angle:0,originX:'left',originY:'top',opacity:1,flipX:false,flipY:false,guid:'source-A',getElement(){return el;},getScaledWidth(){return this.width*this.scaleX;},getScaledHeight(){return this.height*this.scaleY;},set(p){Object.assign(this,p);return this;}},props);}
function canvasPage(objects=[]){return {objects,getActiveObject(){return this.active;},add(o){this.objects.push(o);},remove(o){this.objects=this.objects.filter(x=>x!==o);},setActiveObject(o){this.active=o;},renderAll(){}};}
function env(props={}){
  const fields={backgroundRemovalEngine:{value:'color-key'},backgroundRemovalModel:{value:'isnet-anime'},backgroundRemovalAction:{value:'new'},backgroundRemovalKeyColor:{value:'#ffffff'},backgroundRemovalKeyTolerance:{value:'28'},...props};
  const x={console,fetch,Blob,Image,Promise,canvas:canvasPage(),document:{getElementById:id=>fields[id]||null,addEventListener(){},createElement(tag){assert.equal(tag,'canvas');return createCanvas(1,1);}},fabric:{Image:{fromURL(url,cb){loadImage(url).then(el=>cb(fabricImage(el,{guid:undefined})));}}},NaiLocalToolsClient:class{removeBackground(...a){return x.server(...a);}}};
  x.window=x;vm.createContext(x);vm.runInContext(sourceCode,x,{filename:'production-background-removal-client.js'});return x;
}
async function pixels(o){const i=o.getElement(),c=createCanvas(i.width,i.height);c.getContext('2d').drawImage(i,0,0);return c.getContext('2d').getImageData(0,0,c.width,c.height).data;}
const checkbox=checked=>({type:'checkbox',checked});
(async()=>{
  // Actual postprocess_rgba, identical to the end of successful rembg model processing.
  const py=String.raw`import sys,json,base64
from PIL import Image
sys.path.insert(0,sys.argv[1])
from cutout import postprocess_rgba, image_to_png_bytes, bytes_to_image
from model_manager import ModelManager
im=Image.new('RGBA',(100,100),(255,255,255,0))
for y in range(20,30):
 for x in range(60,70): im.putpixel((x,y),(255,0,0,255))
out=postprocess_rgba(im,{'crop':True,'feather':0})
transparent=Image.new('RGBA',(2,1),(255,0,0,0))
transparent.putpixel((1,0),(0,0,255,128))
_,removed=ModelManager().remove_background(image_to_png_bytes(transparent),'color-key',{'engine':'color-key','key_color':'#ffffff','crop':False,'feather':0})
result=bytes_to_image(removed)
alpha_after=[result.getpixel((i,0))[3] for i in range(2)]
assert alpha_after==[255,255]
print(json.dumps({'size':list(out.size),'image':'data:image/png;base64,'+base64.b64encode(image_to_png_bytes(out)).decode(),'alpha_after':alpha_after}))`;
  const cropped=JSON.parse(cp.execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['-c',py,path.join(repo,'local_tools')],{encoding:'utf8'}));
  assert.deepEqual(cropped.size,[14,14]);
  console.log('CONFIRMED SIDECAR_COLOR_ALPHA: documented ModelManager color-key path changes source alpha [0,128] to '+JSON.stringify(cropped.alpha_after)+' (transparent red revived, partial blue becomes opaque); frontend color-key bypasses this server path');
  let x=env({backgroundRemovalEngine:{value:'rembg'},backgroundRemovalCrop:checkbox(true)}),src=fabricImage(art(),{left:100,top:50,scaleX:2,scaleY:2});x.canvas.objects=[src];x.server=async()=>({ok:true,image:cropped.image,model:'fixture-rembg'});
  let out=await x.NaiBackgroundRemovalClient.processSelected(null,'replace',src);
  assert.equal(out.width,14);assert.equal(out.left,100);assert.equal(out.top,50);assert.equal(out.getScaledWidth(),200);
  const expectedRedX=100+60*2,actualRedX=out.left+2*out.scaleX;
  assert(Math.abs(actualRedX-expectedRedX)>90);
  console.log('CONFIRMED CROP_GEOMETRY: trimmed 14x14 PNG is stretched back to 200x200; red x expected='+expectedRedX+', actual='+actualRedX.toFixed(3)+'; replacement left/top=100/50, expected cropped placement=216/86');

  // Public browser branch ignores all three common controls.
  x=env({backgroundRemovalCrop:checkbox(true),backgroundRemovalOnlyMask:checkbox(true),backgroundRemovalFeather:{value:'4'}});src=fabricImage(art());x.canvas.objects=[src];
  out=await x.NaiBackgroundRemovalClient.processSelected(null,'new',src);
  let px=await pixels(out),alphas=new Set();for(let i=3;i<px.length;i+=4)alphas.add(px[i]);
  assert.equal(out.width,100);assert.equal(out.height,100);assert.equal(px[(20*100+60)*4],255);assert.equal(px[(20*100+60)*4+1],0);assert.deepEqual([...alphas].sort((a,b)=>a-b),[0,255]);
  console.log('CONFIRMED IGNORED_BROWSER_OPTIONS: crop=true, only_mask=true, feather=4 => full 100x100 red RGBA image, alpha values only 0/255');

  // Delay only server completion. Source page content is replaced while request is pending.
  x=env({backgroundRemovalEngine:{value:'rembg'}});src=fabricImage(art());const page=x.canvas;page.objects=[src];let resolveServer,started;
  const entered=new Promise(r=>started=r);x.server=()=>{started();return new Promise(r=>resolveServer=r);};
  const pending=x.NaiBackgroundRemovalClient.processSelected(null,'replace',src);await entered;
  const other=fabricImage(art(),{guid:'page-B-object'});page.objects=[other];resolveServer({ok:true,image:art().toDataURL(),model:'fixture-rembg'});
  out=await pending;assert.equal(page.objects.length,2);assert(page.objects.includes(other));assert(page.objects.includes(out));assert.equal(out.backgroundRemovalSourceGuid,'source-A');
  console.log('CONFIRMED ASYNC_CROSS_PAGE: request started on page A; same global canvas loaded page B; replace action adds A result onto B and marks B history');

  // Real asymmetric pixels through public region extraction and application.
  const stripes=createCanvas(12,6),g=stripes.getContext('2d');g.fillStyle='red';g.fillRect(0,0,6,6);g.fillStyle='blue';g.fillRect(6,0,6,6);
  x=env();src=fabricImage(stripes,{flipX:true});x.canvas.objects=[src];out=await x.NaiBackgroundRemovalClient.processRegion(src,{left:0,top:0,width:12,height:6},'new');px=await pixels(out);
  assert.equal(px[0],255);assert.equal(px[2],0);assert.equal(out.flipX,false);
  console.log('CONFIRMED REGION_FLIP extension39: selected display blue-left/red-right, output red-left/blue-right; extraction adjusts source range but application drops flipX');
  // Extension26: newly added full-layer cutout inherits original GUID.
  x=env();src=fabricImage(art());x.canvas.objects=[src];out=await x.NaiBackgroundRemovalClient.processSelected(null,'new',src);assert.equal(out.guid,src.guid);
  console.log('CONFIRMED DUPLICATE_GUID extension26: original and new cutout both source-A');
  const near=createCanvas(2,2);near.getContext('2d').fillStyle='#e6e6e6';near.getContext('2d').fillRect(0,0,2,2);
  const keyed=await x.NaiBackgroundRemovalClient.localColorKeyDataUrl(near.toDataURL(),'#ffffff',0,false);
  const decoded=await loadImage(keyed),check=createCanvas(2,2);check.getContext('2d').drawImage(decoded,0,0);
  assert.equal(check.getContext('2d').getImageData(0,0,1,1).data[3],0);
  console.log('CONFIRMED TOLERANCE_ZERO extension17: white key with tolerance=0 incorrectly removes #e6e6e6 via default tolerance28');
})().catch(e=>{console.error(e);process.exitCode=1;});

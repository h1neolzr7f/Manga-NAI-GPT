// Audit 40 (flat/DEFLATE ZIP), 43 (privacy CSS), 47 (AI Fill PSD live place).
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const {Blob}=require('buffer');
const repo=path.join(__dirname,'..','..');

{
  const css=fs.readFileSync(path.join(repo,'css/task-launcher.css'),'utf8');
  const one=css.replace(/\s+/g,' ');
  assert(one.includes('body.privacy-blur')&&one.includes('.layer-preview')&&/privacy-blur[^\{]*layer-preview[^\{]*\{[^\}]*blur/.test(one),'43 layer-preview');
  assert(/privacy-blur[^\{]*asset-library-card img[^\{]*\{[^\}]*blur/.test(one),'43 asset card');
  console.log('PASS 43 privacy mode blurs layer-preview and asset-library-card thumbnails');
}

(async()=>{
  const zctx={module:{exports:{}},exports:{},require,Buffer,Blob,console,setImmediate,setTimeout,clearTimeout,Uint8Array,ArrayBuffer,Promise,TextEncoder,TextDecoder};
  vm.runInNewContext(fs.readFileSync(path.join(repo,'third/jszip/jszip.min.js'),'utf8'),zctx);
  const JSZip=zctx.module.exports;
  const state=JSON.stringify({objects:[],canvasGuid:'legacy-page'});
  const z=new JSZip();z.file('state_000000.json',state);z.file('preview-image.jpeg',Uint8Array.from([0xff,0xd8,0xff,0xd9]));
  const zip=await JSZip.loadAsync(await z.generateAsync({type:'uint8array',compression:'DEFLATE'}));

  const lzSrc=fs.readFileSync(path.join(repo,'js/core/compression/lz4.js'),'utf8');
  const lc={console,compressionLogger:{error(){}},atob,TextEncoder,TextDecoder,Uint8Array,Blob};
  vm.createContext(lc);vm.runInContext(lzSrc.slice(0,lzSrc.indexOf('const lz4Compressor='))+';globalThis.C=FileCompressor;',lc);
  const comp=new lc.C();comp.buffersToLz4Blob=async files=>files;
  const files=await comp.zipFileListToLz4Blob(zip.files);
  assert.equal(new TextDecoder().decode(files.find(f=>f.name.startsWith('state_')).data),state);
  console.log('PASS 40 DEFLATE ZIP entries are decompressed for lz4 convert');

  const added=[];
  const x={console,Promise,JSZip,URL:{createObjectURL:()=>'blob:preview',revokeObjectURL(){}},Blob,
    compressionLogger:{error(){}},generateGUID:()=>'new-guid',findCanvasGuid:s=>s&&s.canvasGuid||null,
    btmAddImage(preview,payload,guid){added.push({guid,payload});},
    lz4Compressor:{zipFileListToLz4Blob:async f=>comp.zipFileListToLz4Blob(f)},
    Uint8Array,TextDecoder,TextEncoder};
  x.window=x;vm.createContext(x);
  vm.runInContext(fs.readFileSync(path.join(repo,'js/core/compression/project-compression.js'),'utf8')+'\nthis.multiLoadZip=multiLoadZip;',x);
  const guids=await x.multiLoadZip(zip);
  assert.equal(guids.length,1);assert.equal(guids[0],'legacy-page');
  console.log('PASS 40 flat single-page ZIP loads as one page');

  const pixels=new Map();let next=0;
  class PixelCanvas{constructor(w=1,h=1){this.width=w;this.height=h;this.ctx=null;}getContext(){return this.ctx||(this.ctx=new PixelContext(this));}toDataURL(){const u='data:image/png;base64,s'+(++next);pixels.set(u,this);return u;}}
  class PixelContext{constructor(cv){this.canvas=cv;this.fillStyle='#000';}ensure(){const n=this.canvas.width*this.canvas.height*4;if(!this.data||this.data.length!==n)this.data=new Uint8ClampedArray(n);}
    createImageData(w,h){return{width:w,height:h,data:new Uint8ClampedArray(w*h*4)};}
    getImageData(x,y,w,h){this.ensure();const d=this.createImageData(w,h);for(let j=0;j<h;j++)for(let i=0;i<w;i++)d.data.set(this.data.subarray(((j+y)*this.canvas.width+i+x)*4,((j+y)*this.canvas.width+i+x)*4+4),(j*w+i)*4);return d;}
    putImageData(d,x,y){this.ensure();for(let j=0;j<d.height;j++)for(let i=0;i<d.width;i++)this.data.set(d.data.subarray((j*d.width+i)*4,(j*d.width+i)*4+4),((j+y)*this.canvas.width+i+x)*4);}
    fillRect(x,y,w,h){this.ensure();for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)this.data.set([255,0,0,255],(j*this.canvas.width+i)*4);}
    drawImage(src,dx,dy,dw,dh){this.ensure();src=pixels.get(src)||src;dw=dw||src.width;dh=dh||src.height;for(let j=0;j<dh;j++)for(let i=0;i<dw;i++){const di=((j+dy)*this.canvas.width+i+dx)*4;if(di>=0&&di<this.data.length)this.data.set([255,0,0,200],di);}}}
  function solid(w,h){const c=new PixelCanvas(w,h);c.getContext('2d').fillRect(0,0,w,h);return c;}
  let captured=null;const fill=solid(4,4).toDataURL();
  const y={console,Promise,queueMicrotask,Uint8Array,Uint8ClampedArray,Blob,Map,
    Image:class{set src(u){this._canvas=pixels.get(u)||solid(4,4);this.width=this._canvas.width;this.height=this._canvas.height;queueMicrotask(()=>this.onload&&this.onload());}},
    document:{readyState:'loading',addEventListener(){},createElement:()=>new PixelCanvas()},
    agPsd:{writePsdUint8Array(doc){captured=doc;return new Uint8Array([1]);}},
    canvas:{objects:[],backgroundColor:'#ffffff',getWidth:()=>12,getHeight:()=>12,getObjects(){return this.objects;}},
    createToast(){},createToastError(){},getCanvasGUID:()=>'A'};
  y.window=y;
  const obj={type:'image',left:8,top:8,width:4,height:4,scaleX:2,scaleY:2,opacity:1,visible:true,name:'ai-fill',
    getSrc:()=>fill,aiFill:{box:[0,0,4,4],candidates:[],chosen:0},
    getBoundingRect(){return{left:this.left,top:this.top,width:this.width*this.scaleX,height:this.height*this.scaleY};},
    toCanvasElement(){return solid(Math.round(this.width*this.scaleX),Math.round(this.height*this.scaleY));},set(){return this;},setCoords(){return this;}};
  y.canvas.objects=[obj];vm.createContext(y);vm.runInContext(fs.readFileSync(path.join(repo,'js/ui/psd-io.js'),'utf8'),y);
  await y.PsdIO.exportPage();
  const layer=(captured.children||[]).find(c=>c.name==='ai-fill')||captured.children.filter(c=>c.name!=='背景').pop();
  assert.equal(layer.left,8);assert.equal(layer.top,8);assert.equal(layer.canvas.width,8);assert.equal(layer.canvas.height,8);
  console.log('PASS 47 AI Fill PSD export uses live position and size');
})().catch(e=>{console.error(e);process.exitCode=1;});

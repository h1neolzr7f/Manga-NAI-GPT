// Audit 54/55/56 (browser cutout client) — pixel-free harness with stub canvases.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const repo=path.join(__dirname,'..','..');
const src=fs.readFileSync(path.join(repo,'js/local-tools/background-removal-client.js'),'utf8');
// stub canvas: 2D RGBA buffer; toDataURL encodes its contents so the harness can inspect results.
function canvas(w=1,h=1){const c={_w:w,_h:h,data:null,get width(){return this._w;},set width(v){this._w=v;this.data=null;},get height(){return this._h;},set height(v){this._h=v;this.data=null;},
 buf(){if(!this.data)this.data=new Uint8ClampedArray(this._w*this._h*4);return this.data;},
 getContext(){const s=c;return {drawImage(img,sx,sy,sw,sh){const from=img.pixels?img:img;const W=s._w,H=s._h,d=s.buf();if(sw===undefined){sx=0;sy=0;}
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){const fx=x+(sw===undefined?0:sx),fy=y+(sw===undefined?0:sy);const fw=from.width;const fd=from.pixels||from.buf();const si=(fy*fw+fx)*4,di=(y*W+x)*4;for(let k=0;k<4;k++)d[di+k]=fd[si+k];}},
  getImageData(){return {data:s.buf()};},putImageData(){} ,fillRect(){}};},
 toDataURL(){return 'stub:'+JSON.stringify({w:this._w,h:this._h,px:Array.from(this.buf())});}};return c;}
function decode(u){return JSON.parse(u.slice(5));}
class Img{set src(u){const d=decode(u);this.width=d.w;this.height=d.h;this.pixels=Uint8ClampedArray.from(d.px);queueMicrotask(()=>this.onload());}}
function art(w,h){const c=canvas(w,h),d=c.buf();d.fill(255);for(let y=20;y<30;y++)for(let x=60;x<70;x++){const i=(y*w+x)*4;d[i]=255;d[i+1]=0;d[i+2]=0;}return c;}
function fimg(el,props={}){return Object.assign({type:'image',width:el.width,height:el.height,scaleX:1,scaleY:1,left:0,top:0,angle:0,originX:'left',originY:'top',opacity:1,flipX:false,flipY:false,guid:'source-A',getElement(){return el;},getScaledWidth(){return this.width*this.scaleX;},getScaledHeight(){return this.height*this.scaleY;},set(p){Object.assign(this,p);return this;}},props);}
function page(objects){return {objects,getObjects(){return this.objects;},getActiveObject(){return this.active;},add(o){this.objects.push(o);},remove(o){this.objects=this.objects.filter(x=>x!==o);},setActiveObject(o){this.active=o;},renderAll(){}};}
function env(fields){
 const f={backgroundRemovalEngine:{value:'color-key'},backgroundRemovalModel:{value:'isnet-anime'},backgroundRemovalAction:{value:'new'},backgroundRemovalKeyColor:{value:'#ffffff'},backgroundRemovalKeyTolerance:{value:'28'},...fields};
 const x={console,Blob,Promise,fetch:async()=>({blob:async()=>new Blob(['x'])}),queueMicrotask,Image:Img,guid:'A',canvas:page([]),document:{getElementById:id=>f[id]||null,addEventListener(){},createElement:()=>canvas()},
  fabric:{Image:{fromURL(u,cb){const d=u.startsWith('stub:')?decode(u):{w:14,h:14};const el={width:d.w,height:d.h};cb(fimg(el,{guid:undefined}));}}},
  NaiLocalToolsClient:class{removeBackground(...a){return x.server(...a);}}};
 x.getCanvasGUID=()=>x.guid;x.window=x;vm.createContext(x);vm.runInContext(src,x);return x;
}
const cb=v=>({type:'checkbox',checked:v});
(async()=>{
 // 54: server crop returns crop box; placement must keep source pixel scale and offset.
 let x=env({backgroundRemovalEngine:{value:'rembg'},backgroundRemovalCrop:cb(true)});
 let s=fimg(art(100,100),{left:100,top:50,scaleX:2,scaleY:2});x.canvas.objects=[s];
 const crop14=canvas(14,14);
 x.server=async()=>({ok:true,image:crop14.toDataURL(),model:'fixture',crop:{x:58,y:18,width:14,height:14},source_width:100,source_height:100});
 let out=await x.NaiBackgroundRemovalClient.processSelected(null,'replace',s);
 const left=out.left-out.width*out.scaleX/2,top=out.top-out.height*out.scaleY/2;
 assert.equal(Math.round(left),216);assert.equal(Math.round(top),86);assert.equal(out.scaleX,2);
 console.log('PASS 54 cropped cutout keeps source pixel scale and position');
 // 55: browser colour key honours crop/feather/mask
 x=env({backgroundRemovalCrop:cb(true),backgroundRemovalOnlyMask:cb(true),backgroundRemovalFeather:{value:'2'}});
 s=fimg(art(100,100));x.canvas.objects=[s];
 let got;const origFrom=x.fabric.Image.fromURL;x.fabric.Image.fromURL=(u,c)=>{got=decode(u);origFrom(u,c);};
 out=await x.NaiBackgroundRemovalClient.processSelected(null,'new',s);
 assert(got.w<100&&got.h<100,'55: cropped, got '+got.w+'x'+got.h);
 const px=got.px,alphas=new Set(),greys=[];for(let i=0;i<px.length;i+=4){alphas.add(px[i+3]);greys.push(px[i]===px[i+1]&&px[i+1]===px[i+2]);}
 assert.deepEqual([...alphas],[255],'55: mask output is opaque greyscale');assert(greys.every(Boolean));
 assert(new Set(px.filter((_,i)=>i%4===0)).size>2,'55: feather gives soft grey levels');
 console.log('PASS 55 browser colour key applies crop, feather and mask-only');
 // 56: page switches while waiting -> result is not pasted on page B
 x=env({backgroundRemovalEngine:{value:'rembg'}});s=fimg(art(100,100));x.canvas.objects=[s];
 let release;x.server=()=>new Promise(r=>release=()=>r({ok:true,image:canvas(100,100).toDataURL(),model:'f'}));
 const p=x.NaiBackgroundRemovalClient.processSelected(null,'replace',s);await new Promise(r=>setTimeout(r,5));
 const bObj={type:'image',guid:'B'};x.guid='B';x.canvas.objects=[bObj];release();
 await assert.rejects(p,e=>e.stale===true);
 assert.deepEqual(x.canvas.objects.map(o=>o.guid).join(),'B','56: page B untouched');
 console.log('PASS 56 cutout result is not pasted after a page switch');
})().catch(e=>{console.error(e);process.exitCode=1;});

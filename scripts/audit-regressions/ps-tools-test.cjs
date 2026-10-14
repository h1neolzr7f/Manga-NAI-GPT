// Audit 38/39: bucket/clone replace pixels in place; canvas->pixel mapping uses the full inverse transform.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
let s=fs.readFileSync(path.join(__dirname,'..','..','js/ui/visual-ps-tools.js'),'utf8');
s=s.replace('root.NaiPsTools={','root.__t={replaceImageFromCanvas,localToImage};\nroot.NaiPsTools={');
const text={type:'textbox',name:'dialogue'};let saved=0;
const objects=[];const cv={getObjects:()=>objects,renderAll(){},remove(o){objects.splice(objects.indexOf(o),1);},add(o){objects.push(o);},setActiveObject(){}};
class Img{set src(v){this._src=v;queueMicrotask(()=>this.onload&&this.onload());}}
const x={console,Math,JSON,Image:Img,queueMicrotask,setTimeout,clearTimeout,canvas:cv,saveStateByManual(){saved++;},updateLayerPanel(){},
  document:{readyState:'loading',addEventListener(){},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({getContext:()=>({})})},addEventListener(){},fabric:{}};
x.window=x;vm.createContext(x);vm.runInContext(s,x);
(async()=>{
  const image={type:'image',left:0,top:0,width:4,height:4,scaleX:2,scaleY:2,name:'panel art',guid:'art',clipPath:{isPanel:true},globalCompositeOperation:'multiply',aiFill:{box:[0,0,4,4]},
    setElement(el){this._element=el;},set(v){Object.assign(this,v);},setCoords(){}};
  objects.push(image,text);
  x.__t.replaceImageFromCanvas(image,{width:8,height:8,toDataURL:()=> 'data:image/png;base64,AA=='});
  await new Promise(r=>setTimeout(r,10));
  assert.deepEqual(objects,[image,text],'38: same object, same order');
  assert.equal(image.clipPath.isPanel,true);assert.equal(image.globalCompositeOperation,'multiply');assert.equal(image.name,'panel art');assert.ok(image.aiFill);
  assert.equal(image.width*image.scaleX,8,'38: displayed size kept');assert.equal(saved,1);
  console.log('PASS 38 bucket/clone keep layer order, clip, blend and metadata');
  const rot={left:100,top:100,width:10,height:10,scaleX:1,scaleY:1,angle:90,getElement:()=>({width:10,height:10})};
  let p=x.__t.localToImage(rot,{x:95,y:105});assert.ok(Math.abs(p.x-5)<1e-9&&Math.abs(p.y-5)<1e-9,'39: rotated '+JSON.stringify(p));
  const flip={left:0,top:0,width:10,height:10,scaleX:1,scaleY:1,flipX:true,getElement:()=>({width:10,height:10})};
  p=x.__t.localToImage(flip,{x:2,y:3});assert.equal(p.x,8);assert.equal(p.y,3);
  const centered={left:50,top:50,width:10,height:10,scaleX:2,scaleY:2,originX:'center',originY:'center',getElement:()=>({width:20,height:20})};
  p=x.__t.localToImage(centered,{x:50,y:50});assert.equal(p.x,10);assert.equal(p.y,10);
  console.log('PASS 39 bucket/clone mapping handles rotation, flip, origin and scale');
})().catch(e=>{console.error(e);process.exitCode=1;});

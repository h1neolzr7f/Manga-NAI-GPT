// Loads the vendored Fabric with a stub 2D context (no native canvas needed). Text metrics are
// approximate (width = 0.6 * fontSize per char); enough for layout / coordinate assertions.
const fs=require('fs'),vm=require('vm'),path=require('path');
const repo=path.join(__dirname,'..','..');
function ctx(){return new Proxy({measureText:t=>({width:String(t).length*8}),getImageData:(a,b,w,h)=>({data:new Uint8ClampedArray(Math.max(1,w*h*4))}),
 createLinearGradient:()=>({addColorStop(){}}),createPattern:()=>({}),isPointInPath:()=>false},{get(o,k){return k in o?o[k]:(()=>{});},set(o,k,v){o[k]=v;return true;}});}
function canvasEl(){return{width:1,height:1,style:{},getContext:()=>ctx(),setAttribute(){},getAttribute:()=>null,toDataURL:()=>'data:,',addEventListener(){}};}
function makeContext(){
 class Document{};const document=new Document();document.documentElement={style:{}};
 document.createElement=n=>n==='canvas'?canvasEl():{style:{},appendChild(){},getContext(){return null;},setAttribute(){}};
 document.addEventListener=()=>{};document.getElementById=()=>null;
 class Image{set src(v){this._s=v;setTimeout(()=>this.onerror&&this.onerror(new Error('no image in stub')),0);}get src(){return this._s;}}
 const x={Element:class{},console,Document,HTMLDocument:Document,document,navigator:{maxTouchPoints:0},setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:()=>0,cancelAnimationFrame(){},Image};
 x.window=x;vm.createContext(x);
 x.load=(file,hook)=>{let s=fs.readFileSync(path.join(repo,file),'utf8');if(hook)s=hook(s);vm.runInContext(s,x,{filename:file});};
 x.load('third/Fabric.js/fabric.min_PlusEraser.js');
 return x;
}
module.exports={makeContext,repo};

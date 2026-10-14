// Audit 48: canvas background colour is exported as a PSD layer and used for the composite.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
function cnv(){const fills=[];return{width:1,height:1,fills,getContext(){const g={set fillStyle(v){g._f=v;},get fillStyle(){return g._f;},fillRect(){fills.push(g._f);},drawImage(){},getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray([255,192,203,255])})};return g;}};}
let doc=null;
const c={document:{createElement:()=>cnv(),getElementById:()=>null,readyState:'complete',addEventListener(){}},Image:class{},agPsd:{writePsdUint8Array:d=>{doc=d;return new Uint8Array(1);}},
 canvas:{backgroundColor:'#ffc0cb',getWidth:()=>10,getHeight:()=>10,getObjects:()=>[]}};
c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','..','js/ui/psd-io.js'),'utf8'),c);
(async()=>{
 await c.PsdIO.exportPage();
 assert.equal(doc.children.length,1,'48: background layer present');assert.equal(doc.children[0].canvas.fills[0],'#ffc0cb');
 assert.equal(doc.canvas.fills[0],'#ffc0cb','48: composite uses the background colour');
 c.canvas.backgroundColor='';await c.PsdIO.exportPage();assert.equal(doc.children.length,0);assert.equal(doc.canvas.fills[0],'#fff');
 console.log('PASS 48 PSD export keeps the canvas background colour');
})().catch(e=>{console.error(e);process.exitCode=1;});

// Offline production SAM selection/cache audit. No model download or paid request.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),cp=require('child_process');
const repo=process.env.MANGA_AUDIT_ROOT||process.cwd();
const {createCanvas,loadImage}=require(require.resolve('@napi-rs/canvas',process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}:undefined));
const collision={"hash": "1he8qgc-aa", "first": {"x": 3, "y": 0, "png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABHNCSVQICAgIfAhkiAAAAAFzUkdCAK7OHOkAAACuSURBVHic7dWxCoAgAEXRjP7/l21pcKrxgN2zCQ6Xh+CYc87jMcY43ixXt3HqAK0BdIDWADpAawAdoF3rYcd//svvX0AD6ACtAXSA1gA6QGsAHaA1gA7QGkAHaA2gA7QG0AFaA+gArQF0gNYAOkBrAB2gNYAO0BpAB2gNoAO0BtABWgPoAK0BdIDWADpAawAdoDWADtAaQAdoDaADtAbQAVoD6ACtAXSA1gA6QLsB5qQKew8GgC0AAAAASUVORK5CYII="}, "second": {"x": 24, "y": 0, "png": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABHNCSVQICAgIfAhkiAAAAAFzUkdCAK7OHOkAAACuSURBVHic7dVBCoAwEMVQK97/yuMNdFWeYLKdxQ+h0DUzc2xkrfV43zz/yknXP0ABtICmAFpAUwAtoLl2D+h//o3fv4ACaAFNAbSApgBaQFMALaApgBbQFEALaAqgBTQF0AKaAmgBTQG0gKYAWkBTAC2gKYAW0BRAC2gKoAU0BdACmgJoAU0BtICmAFpAUwAtoCmAFtAUQAtoCqAFNAXQApoCaAFNAbSApgBaQHMD74IKe68y//IAAAAASUVORK5CYII="}, "length": 370};

const read=f=>fs.readFileSync(path.join(repo,f),'utf8');
const samSource=read('js/ai/sam-click-select.js');
let selected;
const context={window:{removeEventListener(){},MangaGPTRegionEditor:{selectPolygon(points){selected=points;return true;}}},document:{}};
vm.createContext(context);
// Expose lexical production helpers only in this isolated diagnostic context.
vm.runInContext(samSource.replace('window.SamClickSelect = {','window.SamClickSelect = { auditHash:hashString, auditFinish:finish, auditSession:s=>{cur=s;},'),context);
const sam=context.window.SamClickSelect;
const gptSource=read('js/ai/gpt-region-editor.js');
const maskCode=gptSource.slice(gptSource.indexOf('  function lassoAlphaMask('),gptSource.indexOf('\n  // Dock:'));
const maskContext={Uint8ClampedArray,document:{createElement(){return createCanvas(1,1);}}};
vm.createContext(maskContext);vm.runInContext(maskCode,maskContext);
(async()=>{
 assert.equal(collision.first.png.length,collision.second.png.length);
 assert.notEqual(collision.first.png,collision.second.png);
 const id=sam.auditHash(collision.first.png);assert.equal(id,sam.auditHash(collision.second.png));
 for(const which of ['first','second']){
  const f=collision[which],img=await loadImage(f.png),c=createCanvas(64,64),g=c.getContext('2d');g.drawImage(img,0,0);
  assert.equal(g.getImageData(f.x,f.y,1,1).data[0],0);
  const other=collision[which==='first'?'second':'first'];assert.equal(g.getImageData(other.x,other.y,1,1).data[0],255);
 }
 const py=String.raw`import sys,json,base64,io
import numpy as np
from PIL import Image
sys.path.insert(0,sys.argv[1])
import manga_sam_select as S
class Predictor:
 def __init__(self): self.sets=0
 def set_image(self,rgb):
  self.sets+=1;self._features={'mask':(rgb[:,:,0]<128).astype(np.uint8)};self._orig_hw=[rgb.shape[:2]]
 def predict(self,**kwargs):
  m=self._features['mask'];return np.stack([m,m,m]),np.array([.9,.8,.7]),None
p=Predictor();S._get_predictor=lambda allow:p
# Contour encoding is outside this cache case; use a rectangular outline for rectangular masks.
def outline(m):
 y,x=np.nonzero(m);return [[int(x.min()),int(y.min())],[int(x.max()),int(y.min())],[int(x.max()),int(y.max())],[int(x.min()),int(y.max())]]
S.outline=outline
f=json.load(sys.stdin)
a=S.select({'imageId':f['id'],'image':f['first']['png'],'points':[[f['first']['x'],f['first']['y'],1]]})
b=S.select({'imageId':f['id'],'image':f['second']['png'],'points':[[f['second']['x'],f['second']['y'],1]]})
assert p.sets==1 and a['candidates'][0]['box']==b['candidates'][0]['box']
assert b['candidates'][0]['box'][0]==f['first']['x'] and b['candidates'][0]['box'][0]!=f['second']['x']
print(json.dumps({'setImageCount':p.sets,'firstMaskBox':a['candidates'][0]['box'],'secondMaskBox':b['candidates'][0]['box'],'expectedSecondX':f['second']['x']}))`;
 const cache=JSON.parse(cp.execFileSync(process.env.CODEX_PRIMARY_RUNTIME_PYTHON||'python3',['-c',py,repo],{encoding:'utf8',input:JSON.stringify({...collision,id})}));
 console.log('CONFIRMED SAMPLED_HASH_COLLISION: different valid PNGs with black objects at x='+collision.first.x+'/'+collision.second.x+' share imageId='+id+'; '+JSON.stringify(cache));
 // SAM's exact candidate mask has a hole and a detached component. The outline
 // matches the documented largest external contour, not the whole raster mask.
 const cand={polygon:[[4,4],[29,4],[29,29],[4,29]],box:[4,4,52,52],mask:'fixture-exact-mask'};
 sam.auditSession({target:'gpt',cands:[cand],pick:0,box:{remove(){}},onKey(){},onResize(){}});
 sam.auditFinish();assert.deepEqual(selected,cand.polygon);
 const exact=createCanvas(64,64),g=exact.getContext('2d');g.fillStyle='white';g.fillRect(4,4,26,26);g.clearRect(12,12,10,10);g.fillRect(44,44,8,8);
 const raster=g.getImageData(0,0,64,64).data;
 const reconstructed=maskContext.lassoAlphaMask(selected,64,64,64,64);
 assert.equal(raster[(16*64+16)*4+3],0);assert.equal(reconstructed[16*64+16],255);
 assert.equal(raster[(47*64+47)*4+3],255);assert.equal(reconstructed[47*64+47],0);
 console.log('CONFIRMED GPT_SMART_MASK_LOST: production finish forwards only polygon; raster hole alpha0 becomes alpha255, detached selected area alpha255 becomes alpha0 in production GPT lasso mask');
})().catch(e=>{console.error(e);process.exitCode=1;});

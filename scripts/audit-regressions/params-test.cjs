// Audit 37 (seed 0), 91 (glow radix), 103/104 (prompt replace routing + literal).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const repo=path.join(__dirname,'..','..');const read=f=>fs.readFileSync(path.join(repo,f),'utf8');
function replacementHarness(layer,positive=[],negative=[]){
  const nodes={};for(let n=1;n<=3;n++){nodes[`old-prompt${n}-old`]={value:(positive[n-1]||[])[0]||''};nodes[`new-prompt${n}-new`]={value:(positive[n-1]||[])[1]||''};nodes[`old-negative-prompt${n}-old`]={value:(negative[n-1]||[])[0]||''};nodes[`new-negative-prompt${n}-new`]={value:(negative[n-1]||[])[1]||''};}
  const c={console,$:id=>nodes[id],canvas:{getObjects:()=>[layer]},uiLogger:{debug(){}},saveState(){}};c.window=c;vm.createContext(c);vm.runInContext(read('js/ui/prompt-manager.js'),c);return c;
}
(async()=>{
 let layer={text2img_prompt:'blue hair',text2img_negative:'blue hair, lowres'};
 replacementHarness(layer,[['blue','red']]).applyChanges();
 assert.equal(layer.text2img_prompt,'red hair');assert.equal(layer.text2img_negative,'blue hair, lowres','103: positive rule must not touch negative');
 layer={text2img_prompt:'a',text2img_negative:'bad hands'};replacementHarness(layer,[],[['bad','worst']]).applyChanges();
 assert.equal(layer.text2img_negative,'worst hands');
 layer={text2img_prompt:'smile, [smile], simple',text2img_negative:''};replacementHarness(layer,[['[smile]','grin']]).applyChanges();
 assert.equal(layer.text2img_prompt,'smile, grin, simple','104: literal replacement');
 console.log('PASS 103/104 prompt replace rules are routed per field and literal');
 // 37
 const c={AIProvider:class{},document:{},isImage:()=>false,isPanel:()=>false,basePrompt:{text2img_seed:0,text2img_prompt:'base',text2img_negative:'',text2img_samplingSteps:28,text2img_cfg_scale:5},Math:Object.assign(Object.create(Math),{random:()=>0.5})};
 c.window=c;vm.createContext(c);vm.runInContext(read('js/ai/provider/novelai-provider.js')+'\nglobalThis.Provider=NovelAIProvider;',c);
 const p=new c.Provider();const payload=await p._cleanBaseRequest({text2img_seed:0,width:100,height:100,scaleX:1,scaleY:1},'T2I');
 assert.equal(payload.seed,0,'37: seed 0 stays fixed');
 const rnd=await p._cleanBaseRequest({text2img_seed:-1,width:100,height:100,scaleX:1,scaleY:1},'T2I');assert.notEqual(rnd.seed,-1);
 console.log('PASS 37 fixed seed 0 is kept; -1 still means random');
 // 91
 const x={console,setTimeout,clearTimeout,document:{addEventListener(){},createElement(){return{getContext(){return{};}};}},canvas:{width:100,height:100,getActiveObject(){return this.active;},getObjects(){return this.objects;},objects:[],renderAll(){}},window:{},isPanel:o=>o&&o.type==='polygon',effectLogger:{debug(){}},$(){}};vm.createContext(x);
 vm.runInContext(read('js/sidebar/effect/effect-manager.js'),x);const listeners=[];
 x.effectCheck={checked:true,addEventListener(type,h){if(type==='change')listeners.push(h);}};x.effectSize1={value:'20',addEventListener(){}};x.effectColor={value:'#fff',addEventListener(){}};x.saveEffectValueMap=()=>{};
 vm.runInContext('nowEffect=MODE_EFFECT_GLOW',x);const target={set(p){Object.assign(this,p);}};x.canvas.active=target;x.addEffectEventListener();
 listeners[1]();assert.equal(target.shadow.blur,20,'91');x.effectSize1.value='250';listeners[1]();assert.equal(target.shadow.blur,250);x.effectSize1.value='0';listeners[1]();assert.equal(target.shadow.blur,0);
 console.log('PASS 91 glow size parsed as decimal');
})().catch(e=>{console.error(e);process.exitCode=1;});

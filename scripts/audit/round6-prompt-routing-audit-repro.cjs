/* Production prompt replace/UI/writer audit. All dependencies are offline. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const repo=process.argv[2]||process.env.MANGA_AUDIT_ROOT||process.cwd();
const read=f=>fs.readFileSync(path.join(repo,f),'utf8');
function replacementHarness(layer,positive=[],negative=[]){
  const nodes={};for(let n=1;n<=3;n++){nodes[`old-prompt${n}-old`]={value:(positive[n-1]||[])[0]||''};nodes[`new-prompt${n}-new`]={value:(positive[n-1]||[])[1]||''};nodes[`old-negative-prompt${n}-old`]={value:(negative[n-1]||[])[0]||''};nodes[`new-negative-prompt${n}-new`]={value:(negative[n-1]||[])[1]||''};}
  let historySaves=0;const c={console,$:id=>nodes[id],canvas:{getObjects:()=>[layer]},uiLogger:{debug(){}},saveState(){historySaves++;}};c.window=c;vm.createContext(c);vm.runInContext(read('js/ui/prompt-manager.js'),c);return {c,layer,saves:()=>historySaves};
}
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function uiHarness(){
  const nodes={};class Node{constructor(){this.listeners={};this.value='';this.classList={add(){},remove(){}};}addEventListener(k,cb){(this.listeners[k]||=[]).push(cb);}emit(k){for(const cb of this.listeners[k]||[])cb.call(this);}set innerHTML(html){this._html=html;for(const match of html.matchAll(/id="([^"]+)"/g)){nodes[match[1]]=new Node();}for(const match of html.matchAll(/<textarea id="([^"]+)"[^>]*>([^<]*)<\/textarea>/g)){nodes[match[1]].value=match[2];}}get innerHTML(){return this._html;}}
  nodes['other-controls-mini']=new Node();const gate=deferred();
  const c={console,Date,$:id=>nodes[id]||null,uiLogger:{error(){}},createToast(){},createToastError(){},setAutoSizeingControlMini(){},textOf:v=>String(v||''),draftLayerPromptAsync:()=>gate.promise};
  c.window=c;vm.createContext(c);
  // Extract the exact production writer function, keeping its mutations intact.
  const director=read('js/ai/prompt/novelai-composition-director.js');
  const start=director.indexOf('async function writeLayerPromptAsync('),end=director.indexOf('\nasync function testDirectorApi()',start);
  assert(start>=0&&end>start);vm.runInContext(director.slice(start,end),c);
  c.NovelAICompositionDirector={writeLayerPromptAsync:c.writeLayerPromptAsync};vm.runInContext(read('js/ui/ai/auto-prompt-ui.js'),c);
  return {c,nodes,gate};
}
(async()=>{
  {
    const h=replacementHarness({text2img_prompt:'blue hair, smile',text2img_negative:'blue hair, bad hands'},[['blue hair','red hair']]);h.c.applyChanges();
    assert.equal(h.layer.text2img_prompt,'red hair, smile');assert.equal(h.layer.text2img_negative,'red hair, bad hands');
    console.log('REPRO PROMPT_REPLACE_CROSSES_FIELDS',JSON.stringify({positive:h.layer.text2img_prompt,negative:h.layer.text2img_negative,expectedNegative:'blue hair, bad hands',historySaves:h.saves()}));
  }
  {
    const before='smile, [smile], simple';const h=replacementHarness({text2img_prompt:before,text2img_negative:'bad hands'},[['[smile]','grin']]);h.c.applyChanges();
    assert.notEqual(h.layer.text2img_prompt,'smile, grin, simple');assert(h.layer.text2img_prompt.startsWith('gringrin'));
    console.log('REPRO PROMPT_REPLACE_REGEX',JSON.stringify({before,actual:h.layer.text2img_prompt,expected:'smile, grin, simple'}));
  }
  {
    const h=uiHarness(),layer={guid:'A',text2img_prompt:'old instructions',text2img_negative:'old negative'};
    h.c.showT2IPrompts(layer);const work=h.c.buildDirectorDraft(layer,'T2I');
    h.nodes.text2img_prompt.value='new instructions entered while waiting';h.nodes.text2img_prompt.emit('input');assert.equal(layer.text2img_prompt,'new instructions entered while waiting');
    h.gate.resolve({prompt:'result based on old instructions',negative_prompt:'generated negative',plan:{api_director:true}});await work;
    assert.equal(layer.text2img_prompt,'result based on old instructions');
    console.log('REPRO DIRECTOR_OVERWRITES_EDIT',JSON.stringify({typed:'new instructions entered while waiting',layerPrompt:layer.text2img_prompt,visiblePrompt:h.nodes.text2img_prompt.value}));
  }
  {
    const h=uiHarness(),A={guid:'A',text2img_prompt:'A original',text2img_negative:'A negative'},B={guid:'B',text2img_prompt:'B original',text2img_negative:'B negative'};
    h.c.showT2IPrompts(A);const work=h.c.buildDirectorDraft(A,'T2I');h.c.showT2IPrompts(B);
    h.gate.resolve({prompt:'A director result',negative_prompt:'A director negative',plan:{api_director:true}});await work;
    assert.equal(B.text2img_prompt,'B original');assert.equal(h.nodes.text2img_prompt.value,'A director result');
    const beforeInput={actualB:B.text2img_prompt,visibleB:h.nodes.text2img_prompt.value};h.nodes.text2img_prompt.value+=' edited';h.nodes.text2img_prompt.emit('input');
    assert.equal(B.text2img_prompt,'A director result edited');
    console.log('REPRO DIRECTOR_SELECTION_UI',JSON.stringify({beforeInput,afterUserInputActualB:B.text2img_prompt}));
  }
  {
    const h=uiHarness(),layer={guid:'A',text2img_prompt:'original instructions',text2img_negative:''};
    h.nodes.naiDirectorStoreDrafts={checked:false};h.c.showT2IPrompts(layer);const work=h.c.buildDirectorDraft(layer,'T2I');
    h.gate.resolve({prompt:'director result',negative_prompt:'negative',plan:{api_director:true}});await work;
    assert(layer.naiDirectorDraft);assert.equal(layer.naiDirectorDraft.source_prompt,'original instructions');
    console.log('REPRO DIRECTOR_STORE_TOGGLE',JSON.stringify({storeDraftsChecked:false,draftPresent:!!layer.naiDirectorDraft,sourcePrompt:layer.naiDirectorDraft.source_prompt}));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

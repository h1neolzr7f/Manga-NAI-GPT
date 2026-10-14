// Audit 105 (late director overwrite / wrong UI target) and 106 (store-drafts toggle).
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const repo=path.join(__dirname,'..','..');
const read=f=>fs.readFileSync(path.join(repo,f),'utf8');
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};}
function uiHarness(){
  const nodes={};class Node{constructor(){this.listeners={};this.value='';this.classList={add(){},remove(){}};}addEventListener(k,cb){(this.listeners[k]||=[]).push(cb);}emit(k){for(const cb of this.listeners[k]||[])cb.call(this);}set innerHTML(html){this._html=html;for(const match of html.matchAll(/id="([^"]+)"/g)){nodes[match[1]]=new Node();}for(const match of html.matchAll(/<textarea id="([^"]+)"[^>]*>([^<]*)<\/textarea>/g)){nodes[match[1]].value=match[2];}}get innerHTML(){return this._html;}}
  nodes['other-controls-mini']=new Node();const gate=deferred();
  const c={console,Date,$:id=>nodes[id]||null,uiLogger:{error(){}},createToast(){},createToastError(){},setAutoSizeingControlMini(){},textOf:v=>String(v||''),draftLayerPromptAsync:()=>gate.promise};
  c.window=c;vm.createContext(c);
  const director=read('js/ai/prompt/novelai-composition-director.js');
  const start=director.indexOf('async function writeLayerPromptAsync('),end=director.indexOf('\nasync function testDirectorApi()',start);
  assert(start>=0&&end>start);vm.runInContext(director.slice(start,end),c);
  c.NovelAICompositionDirector={writeLayerPromptAsync:c.writeLayerPromptAsync};vm.runInContext(read('js/ui/ai/auto-prompt-ui.js'),c);
  return{c,nodes,gate};
}

(async()=>{
  {
    const h=uiHarness(),layer={guid:'A',text2img_prompt:'old instructions',text2img_negative:'old negative'};
    h.c.showT2IPrompts(layer);const work=h.c.buildDirectorDraft(layer,'T2I');
    h.nodes.text2img_prompt.value='new instructions entered while waiting';h.nodes.text2img_prompt.emit('input');
    assert.equal(layer.text2img_prompt,'new instructions entered while waiting');
    h.gate.resolve({prompt:'result based on old instructions',negative_prompt:'generated negative',plan:{api_director:true}});
    await work;
    assert.equal(layer.text2img_prompt,'new instructions entered while waiting');
    assert.equal(h.nodes.text2img_prompt.value,'new instructions entered while waiting');
    console.log('PASS 105 late director does not overwrite in-flight user edits');
  }
  {
    const h=uiHarness(),A={guid:'A',text2img_prompt:'A original',text2img_negative:'A negative'},B={guid:'B',text2img_prompt:'B original',text2img_negative:'B negative'};
    h.c.showT2IPrompts(A);const work=h.c.buildDirectorDraft(A,'T2I');h.c.showT2IPrompts(B);
    h.gate.resolve({prompt:'A director result',negative_prompt:'A director negative',plan:{api_director:true}});
    await work;
    assert.equal(A.text2img_prompt,'A director result');
    assert.equal(B.text2img_prompt,'B original');
    assert.equal(h.nodes.text2img_prompt.value,'B original');
    h.nodes.text2img_prompt.value+=' edited';h.nodes.text2img_prompt.emit('input');
    assert.equal(B.text2img_prompt,'B original edited');
    console.log('PASS 105 director result for A does not echo into B UI');
  }
  {
    const h=uiHarness(),layer={guid:'A',text2img_prompt:'original instructions',text2img_negative:''};
    h.nodes.naiDirectorStoreDrafts={checked:false};h.c.showT2IPrompts(layer);const work=h.c.buildDirectorDraft(layer,'T2I');
    h.gate.resolve({prompt:'director result',negative_prompt:'negative',plan:{api_director:true}});
    await work;
    assert.equal(layer.naiDirectorDraft,undefined);
    console.log('PASS 106 store-drafts off leaves naiDirectorDraft unset');
  }
  {
    const h=uiHarness(),layer={guid:'A',text2img_prompt:'original instructions',text2img_negative:''};
    h.c.showT2IPrompts(layer);
    h.nodes.naiDirectorStoreDrafts={checked:true};
    const work=h.c.buildDirectorDraft(layer,'T2I');
    h.gate.resolve({prompt:'director result',negative_prompt:'negative',plan:{api_director:true}});
    await work;
    assert(layer.naiDirectorDraft);
    assert.equal(layer.naiDirectorDraft.source_prompt,'original instructions');
    console.log('PASS 106 store-drafts on persists draft');
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

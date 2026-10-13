/* Production code audit. Offline DOM/storage fixtures; no external requests. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const repo=process.argv[2]||process.env.MANGA_AUDIT_ROOT||process.cwd();
const read=f=>fs.readFileSync(path.join(repo,f),'utf8');
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
class Node {
  constructor(tag='div',registry={}){this.tag=tag;this.registry=registry;this.children=[];this.dataset={};this.listeners={};this.style={};this.value='';this.hidden=false;this.classList={toggle(){},add(){},remove(){}};}
  setAttribute(k,v){this[k]=v;if(k==='id')this.registry[v]=this;}
  getAttribute(k){return this[k]||null;}
  appendChild(n){this.children.push(n);n.parentNode=this;return n;}
  addEventListener(k,cb){(this.listeners[k]||=[]).push(cb);}
  emit(k,extra={}){const e=Object.assign({type:k,isTrusted:true,preventDefault(){},stopPropagation(){}},extra);for(const cb of this.listeners[k]||[])cb(e);}
  dispatchEvent(e){for(const cb of this.listeners[e.type]||[])cb(e);}
  insertAdjacentElement(){}
  getBoundingClientRect(){return {left:0,bottom:20,width:200};}
  setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;}
  focus(){}
  querySelectorAll(){return [];}
  remove(){}
  set innerHTML(v){this._html=v;this.children=[];}
  get innerHTML(){return this._html||'';}
}
function walk(n){return [n].concat(n.children.flatMap(walk));}
(async()=>{
  {
    const nodes={},events={},saved={};nodes.naiCharacterCardList=new Node('div',nodes);
    const original={id:'hero',name:'主角',description:'原始设定',positive:['blue hair'],negative:[]};
    const c={console,setTimeout,basePrompt:{naiCharacterCards:[original]},base:{},novelai_materials:{},localStorage:{getItem:k=>saved[k]||null,setItem:(k,v)=>saved[k]=v},$:id=>nodes[id]||null,
      document:{readyState:'loading',getElementById:id=>nodes[id]||null,createElement:tag=>new Node(tag,nodes),addEventListener:(k,cb)=>(events[k]||=[]).push(cb)}};
    c.window=c;vm.createContext(c);vm.runInContext(read('js/ai/prompt/auto/character-card-manager.js'),c);
    for(const cb of events.DOMContentLoaded)cb();
    const textarea=walk(nodes.naiCharacterCardList).find(n=>n.tag==='textarea'&&n.placeholder.startsWith('写外貌'));
    assert(textarea);
    const observed=[];
    for(const value of ['新','新设定']){textarea.value=value;textarea.emit('input');observed.push({typed:value,inMemory:c.NaiCharacterCards.getCards()[0].description,project:c.basePrompt.naiCharacterCards[0].description,persisted:JSON.parse(saved.naiCharacterCards)[0].description});}
    assert(observed.every(x=>x.inMemory==='原始设定'&&x.project==='原始设定'&&x.persisted==='原始设定'));
    console.log('REPRO LEGACY_CARD_STALE_CALLBACK',JSON.stringify(observed));
  }
  {
    const c={console,Math,btmGetGuidsSize:()=>40};c.window=c;vm.createContext(c);vm.runInContext(read('js/ai/prompt/auto/auto-prompt-util.js'),c);
    const results=[];
    for(const pages of [40,153]){c.btmGetGuidsSize=()=>pages;let message='';try{c.generatePageList();}catch(e){message=e.message;}assert.equal(message,'unknwn page generate.');results.push({pages,error:message});}
    // Deterministic upper-bound witness: choose the maximum for every random range.
    c.Math=Object.create(Math);c.Math.random=()=>0.999999;
    const structure=c.generateInitialStructure(153),maximum=structure.reduce((n,x)=>n+x.pages,0);
    assert.equal(maximum,39);
    console.log('REPRO LONG_BATCH_PLAN',JSON.stringify({results,maximumStructurePages:maximum,maxCycles:3}));
  }
  {
    const nodes={},prompt=new Node('textarea',nodes),body=new Node('body',nodes);
    prompt.dataset.naiPrompt='manga panel';body.appendChild(prompt);
    const csv='blue_hair,0,100,\nsmile,0,50,\n';
    const db={transaction(){return {objectStore(){return {get(){const q={};queueMicrotask(()=>{q.result=csv;q.onsuccess();});return q;}};}};}};
    const c={console,Map,Set,Promise,Event:class{constructor(type){this.type=type;}},innerHeight:800,setInterval(){return 0;},setTimeout,Commands:{register(){}},localStorage:{getItem:k=>k==='mnai.promptAssist'?'1':null,setItem(){}},
      indexedDB:{open(){const r={};queueMicrotask(()=>{r.result=db;r.onsuccess();});return r;}},document:{body,activeElement:prompt,getElementById:id=>nodes[id]||null,createElement:tag=>new Node(tag,nodes),querySelectorAll:selector=>selector==='[data-nai-prompt]'?[prompt]:[],addEventListener(){}}};
    c.window=c;vm.createContext(c);vm.runInContext(read('js/ai/prompt-assist-core.js'),c);vm.runInContext(read('js/ai/prompt-assist.js'),c);c.PromptAssist.scan();
    const results=[];
    for(const [before,cursor,expected] of [['blu, smile',3,'blue hair, smile'],['1.2::blu::, smile',8,'1.2::blue hair::, smile'],['{blu}, smile',4,'{blue hair}, smile']]){
      prompt.value=before;prompt.setSelectionRange(cursor,cursor);prompt.emit('input');await flush();assert.equal(nodes.paMenu.hidden,false);prompt.emit('keydown',{key:'Tab'});
      results.push({before,actual:prompt.value,expected});
    }
    assert.equal(results[0].actual,results[0].expected);
    assert.equal(results[1].actual,'1.2::blue hair, smile');assert.equal(results[2].actual,'{blue hair, smile');
    console.log('REPRO AUTOCOMPLETE_WEIGHT_SUFFIX',JSON.stringify(results));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

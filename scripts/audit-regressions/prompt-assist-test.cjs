// Audit 88
/* Production code audit. Offline DOM/storage fixtures; no external requests. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const repo=path.join(__dirname,'..','..');
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
(async()=>{
  {
    const nodes={},prompt=new Node('textarea',nodes),body=new Node('body',nodes);
    prompt.dataset.naiPrompt='manga panel';body.appendChild(prompt);
    const csv='blue_hair,0,100,\nsmile,0,50,\n';
    const db={transaction(){return {objectStore(){return {get(){const q={};queueMicrotask(()=>{q.result=csv;q.onsuccess();});return q;}};}};}};
    const c={console,Map,Set,Promise,Event:class{constructor(type){this.type=type;}},innerHeight:800,setInterval(){return 0;},setTimeout,Commands:{register(){}},localStorage:{getItem:k=>k==='mnai.promptAssist'?'1':null,setItem(){}},
      indexedDB:{open(){const r={};queueMicrotask(()=>{r.result=db;r.onsuccess();});return r;}},document:{body,activeElement:prompt,getElementById:id=>nodes[id]||null,createElement:tag=>new Node(tag,nodes),querySelectorAll:selector=>selector==='[data-nai-prompt]'?[prompt]:[],addEventListener(){}}};
    c.window=c;vm.createContext(c);vm.runInContext(read('js/ai/prompt-assist-core.js'),c);vm.runInContext(read('js/ai/prompt-assist.js'),c);c.PromptAssist.scan();
    const results=[];
    for(const [before,cursor,expected] of [['blu, smile',3,'blue hair, smile'],['1.2::blu::, smile',8,'1.2::blue hair::, smile'],['{blu}, smile',4,'{blue hair}, smile'],['[blu], smile',4,'[blue hair], smile']]){
      prompt.value=before;prompt.setSelectionRange(cursor,cursor);prompt.emit('input');await flush();assert.equal(nodes.paMenu.hidden,false);prompt.emit('keydown',{key:'Tab'});
      results.push({before,actual:prompt.value,expected});
    }
    for(const r of results)assert.equal(r.actual,r.expected,'88: '+r.before);
    console.log('PASS 88 tag completion keeps closing weight markers');
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

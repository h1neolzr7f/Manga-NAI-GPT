// Audit 112 (draw-tools panel closed by other panels) and 53 (reset keeps creative-data indexes).
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const read=f=>fs.readFileSync(path.join(__dirname,'..','..',f),'utf8');
{
 const ids=['svg-container-template','panel-manager-area','auto-generate-area','prompt-manager-area','simulator-chat-area','asset-library-area','speech-bubble-area','text-area','text-area2','tool-area','cutout-area','manga-tone-area','manga-effect-area','shape-area','control-area','ps-tools-area'];
 const fields=Object.fromEntries(ids.map(id=>[id,{style:{display:'none'}}]));
 const toggles=ids.map(id=>({dataset:{target:id}}));
 const c={console,$:id=>fields[id]||null,document:{addEventListener(){},querySelectorAll:sel=>sel.includes('toggleVisibility')?toggles:[],getElementById:id=>fields[id]||null},lazyLoadSvgData(){},adjustCanvasSize(){}};
 c.window=c;vm.createContext(c);vm.runInContext(read('js/sidebar/sidebar.js'),c);
 c.toggleVisibility('ps-tools-area');c.toggleVisibility('text-area');
 assert.deepEqual(ids.filter(id=>fields[id].style.display==='block'),['text-area'],'112');
 console.log('PASS 112 opening a panel closes the draw-tools panel');
}
{
 const store=new Map([['nai_comic_asset_manifest_v1','[1]'],['nai_comic_image2_jobs_v1','[2]'],['mangaGptKey','secret'],['theme','dark']]);
 const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),clear:()=>store.clear()};
 let ok=null;const el=()=>({style:{},appendChild(){},setAttribute(){},addEventListener(t,f){if(this.id==='settingsResetOk'&&t==='click')ok=f;},focus(){},remove(){},isConnected:false});
 const btns=[];const c={console,localStorage,sessionStorage:{clear(){}},getText:()=>null,createToast(){},setTimeout(){},location:{reload(){}},MutationObserver:class{observe(){}},
  document:{createElement:()=>{const e=el();btns.push(e);return e;},body:{appendChild(){}},addEventListener(){},removeEventListener(){}},$:()=>null};
 c.window=c;vm.createContext(c);
 const src=read('js/project-management.js');const a=src.indexOf('var RESET_PRESERVED_KEYS');const m='location.reload();},1500);\n});\n}';const b=src.indexOf(m,a)+m.length;
 vm.runInContext(src.slice(a,b),c);c.resetAllSettings();
 const okBtn=btns.find(e=>e.id==='settingsResetOk');assert(okBtn&&ok);ok();
 assert.equal(store.get('nai_comic_asset_manifest_v1'),'[1]','53: asset index kept');assert.equal(store.get('nai_comic_image2_jobs_v1'),'[2]');
 assert(!store.has('mangaGptKey')&&!store.has('theme'),'settings still reset');
 console.log('PASS 53 reset settings keeps asset index and generation job records');
}

// Audit 97: font register/unregister only mutates UI after durable store succeeds.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const repo=path.join(__dirname,'..','..');
const source=f=>fs.readFileSync(path.join(repo,f),'utf8');

function env(){
  const durable=new Map(),faces=new Set();
  const nodes={'fm-userFontGroup':{appendChild(){}},'fm-localFontInput':{value:'Fixture Local'},'fm-webFontUrlInput':{value:''}};
  let failWrite=false,failDelete=false,uiUpdates=0,toastErrors=0;
  const store={
    async setItem(k,v){if(failWrite)throw Error('fixture QuotaExceeded');durable.set(k,v);},
    async removeItem(k){if(failDelete)throw Error('fixture disk failure');durable.delete(k);},
    async getItem(k){return durable.get(k);},
    async iterate(f){durable.forEach(f);}
  };
  const fonts={
    add(face){faces.add(face);},
    delete(face){faces.delete(face);},
    forEach(fn){faces.forEach(fn);}
  };
  class FontFace{
    constructor(family){this.family=family;}
    async load(){return this;}
  }
  const x={
    console,localforage:{createInstance:()=>store},
    dbLogger:{error(){}},fontLogger:{error(){}},
    $:id=>nodes[id]||null,getText:s=>s,
    createToastError(){toastErrors++;},
    FontSelectorManager:{reloadAll(){}},
    fmUserFontManager:{async updateFontList(){uiUpdates++;}},
    FontFace,document:{fonts,head:{appendChild(el){queueMicrotask(()=>el.onload&&el.onload());}},createElement:()=>({onload:null,onerror:null,set href(v){},set rel(v){}})},
    queueMicrotask,
    i18next:{t:s=>s}
  };
  x.window=x;
  vm.createContext(x);
  vm.runInContext(source('js/db/user-font-repository.js')+'\nthis.repo=fmFontRepository;',x);
  vm.runInContext(source('js/core/font/font-manager-core.js')+'\nthis.manager=fontManager;this.data=()=>fmFontData;',x);
  x.repo.init();
  return{
    x,durable,faces,nodes,
    failWrite(v=true){failWrite=v;},
    failDelete(v=true){failDelete=v;},
    stats:()=>({toastErrors,uiUpdates,faces:faces.size,durable:durable.size})
  };
}

(async()=>{
  let h=env();
  h.failWrite(true);
  await h.x.manager.registerFontFromBuffer(new ArrayBuffer(4),'Fixture Upload');
  await Promise.resolve();
  assert.equal(h.stats().faces,0,'upload face rolled back');
  assert.equal(h.durable.size,0);
  assert.equal(h.x.data().UserFont.fonts.length,0);
  assert.ok(h.stats().toastErrors>=1,'upload toast');
  console.log('PASS 97 upload save failure rolls back face and toasts');

  h=env();
  await h.x.manager.registerFontFromBuffer(new ArrayBuffer(4),'Fixture Upload');
  assert.equal(h.durable.size,1);
  assert.equal(h.x.data().UserFont.fonts.length,1);
  h.failDelete(true);
  const before=h.x.data().UserFont.fonts.length;
  await h.x.manager.unregisterFont({value:'Fixture Upload'});
  assert.equal(h.durable.size,1);
  assert.equal(h.x.data().UserFont.fonts.length,before);
  assert.ok(h.stats().toastErrors>=1,'delete toast');
  console.log('PASS 97 delete failure keeps list and durable record');

  h=env();
  h.failWrite(true);
  await h.x.manager.registerLocalFont();
  assert.equal(h.stats().faces,0);
  assert.equal(h.durable.size,0);
  assert.equal(h.nodes['fm-localFontInput'].value,'Fixture Local','input kept');
  assert.ok(h.stats().toastErrors>=1);
  console.log('PASS 97 local save failure keeps input and toasts');

  h=env();
  h.failWrite(true);
  await h.x.manager.registerWebFont('https://fixture.invalid/font?family=FixtureWeb');
  assert.equal(h.durable.size,0);
  assert.ok(h.stats().toastErrors>=1);
  console.log('PASS 97 web save failure toasts and skips list');
})().catch(e=>{console.error(e);process.exitCode=1;});

// Audit 92 (import serialize), 93 (panel cache hash), 95/96/98 (vertical input/keys/IME).
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const repo=path.join(__dirname,'..','..');
const read=p=>fs.readFileSync(path.join(repo,p),'utf8');
const napiPaths={paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||'/opt/sand/sand-host/node_modules']};
let createCanvas,Image;
try{
  const native=require(require.resolve('@napi-rs/canvas',napiPaths));
  createCanvas=native.createCanvas;Image=native.Image;
}catch(_){createCanvas=null;}

{
  const settings=read('js/core/settings.js');
  const slice=settings.slice(settings.indexOf('const commonProperties=['),settings.indexOf('\n\nlet jscolorOptions='));
  const x={};vm.runInNewContext(slice+';this.commonProperties=commonProperties;',x);
  for(const k of ['mangaImportReference','mangaImportPanel','mangaImportPanelIndex','mangaImportSourceBox','mangaImportTags','mangaImportCharacterPlaceholder','mangaImportTemplateLayer','mangaImportCharacterReference','mangaImportPlaceholderIndex','mangaImportPlaceholderBounds']){
    assert(x.commonProperties.includes(k),'92 missing '+k);
  }
  console.log('PASS 92 commonProperties includes mangaImport* contract');
}

(async()=>{
  if(!createCanvas){console.log('SKIP 93 (no @napi-rs/canvas)');return;}
  const fixture=JSON.parse(read('scripts/audit/round5-sam-audit-repro.cjs').split('const collision=')[1].split(';\n')[0]);
  let png=fixture.first.png;
  const layer={type:'image',width:64,height:64,_element:{src:png}};
  const x={console,Map,Image,Uint8Array,document:{createElement:()=>createCanvas(1,1)},canvas:{getObjects:()=>[layer]},getCanvasGUID:()=>'same-page'};
  x.window=x;x.MangaGPTRegionEditor={pageImage(){return{image:png,width:64,height:64};}};
  vm.createContext(x);vm.runInContext(read('js/ai/panel-auto.js'),x);
  const before=await x.PanelAuto.get();assert.equal(before.panels[0].x,3);
  png=fixture.second.png;layer._element.src=png;
  const next=await x.PanelAuto.get();
  assert.notEqual(next.key,before.key);
  assert.equal(next.panels[0].x,24);
  assert.equal(next.image,png);
  console.log('PASS 93 panel-auto cache key hashes image content');
})().catch(e=>{console.error(e);process.exitCode=1;});

{
  const fab=read('third/Fabric.js/fabric.min_PlusEraser.js');
  function method(name){
    const at=fab.indexOf(name+':function');assert(at>=0,name);
    const s=at+name.length+1;let p=fab.indexOf('{',s),depth=1,quote=null,escape=false;
    for(p++;p<fab.length;p++){
      const c=fab[p];
      if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;}
      else if(c==='"'||c==="'")quote=c;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return vm.runInNewContext('('+fab.slice(s,p+1)+')',{fabric:{util:{string:{graphemeSplit:Array.from}}}});
    }
    throw Error(name);
  }
  function env(){
    class Base{constructor(text,options){Object.assign(this,{text,fontSize:32,lineHeight:1.16,charSpacing:0,_dimensionAffectingProps:[]},options);}}
    const start=fab.indexOf('keysMapRtl:')+11,end=fab.indexOf('},ctrlKeysMapUp',start)+1;
    Base.prototype.keysMapRtl=vm.runInNewContext('('+fab.slice(start,end)+')');
    Base.prototype.updateFromTextArea=method('updateFromTextArea');
    Base.prototype.fromStringToGraphemeSelection=method('fromStringToGraphemeSelection');
    const controls=Object.fromEntries(['mtr','tr','tl','bl','br','mr','ml','mt','mb'].map(k=>[k,{x:0,y:0}]));
    const x={console,fabric:{IText:Base,Text:{prototype:{}},Object:{prototype:{controls}},controlsUtils:{scaleSkewCursorStyleHandler(){},wrapWithFireEvent:(n,f)=>f,wrapWithFixedAnchor:f=>f,getLocalPoint(){}},Control:function(opts){Object.assign(this,opts);}}};
    vm.createContext(x);vm.runInContext(read('js/sidebar/text/vertical-textbox.js')+'\nthis.V=VerticalTextbox;',x);
    return{Base,V:x.V};
  }
  function editing(h,text,hidden,inputStart=1){
    const events=[];
    const o=Object.create(h.V.prototype);
    Object.assign(o,{
      text,_text:Array.from(text),_textBeforeEdit:text,isEditing:true,dynamicSizing:false,styles:{},
      selectionStart:inputStart,selectionEnd:inputStart,
      hiddenTextarea:{value:hidden,selectionStart:inputStart,selectionEnd:inputStart,textLength:hidden.length,style:{},blur(){},parentNode:{removeChild(){}}},
      _splitTextIntoLines:t=>({graphemeText:Array.from(t)}),
      _shouldClearDimensionCache:()=>false,updateTextareaPosition(){},removeStyleFromTo(){},integrityCheck:()=>[],
      getSelectionStyles:()=>[],insertNewStyleBlock(){},setCoords(){},fire(name){events.push(name);},
      abortCursorAnimation(){},_restoreEditingProps(){},
      canvas:{fire(name){events.push(name);},requestRenderAll(){},off(){}}
    });
    return{o,events};
  }
  const event=(inputType,data=null)=>({inputType,data,stopPropagation(){}});

  const h=env();
  const baseLeft=h.Base.prototype.keysMapRtl[37];
  new h.V('台词',{});
  assert.equal(h.Base.prototype.keysMapRtl[37],baseLeft);
  assert.equal(new h.V('台词',{}).keysMapRtl[37],'moveCursorDown');
  console.log('PASS 96 vertical keysMapRtl is cloned per instance');

  for(const type of ['deleteContentForward','deleteWordForward','historyUndo','insertReplacementText']){
    const {o,events}=editing(h,'甲乙丙','甲丙',2);
    o.onInput(event(type));
    assert.equal(o.text,'甲丙','95 '+type);
    assert(events.includes('changed'),'95 '+type+' changed');
  }
  console.log('PASS 95 vertical onInput syncs Delete/Undo/replacement');

  {
    const {o}=editing(h,'甲你好丙','甲丙',2);
    o.textSuggestBefore='你好';
    o.onInput(event('deleteCompositionText'));
    assert.equal(o.text,'甲丙');
  }
  console.log('PASS 95 deleteCompositionText syncs multi-char cancel');

  if(createCanvas){
    const {o}=editing(h,'😀中文','😀中文',0);
    Object.assign(o,{
      _textLines:[['😀','中','文']],_unwrappedTextLines:[['😀','中','文']],
      __charBounds:[[{top:0,height:20,width:20},{top:20,height:20,width:20},{top:40,height:20,width:20},{top:60,height:0,width:0}]],
      inCompositionMode:true,textAlign:'right',verticalAlign:'top',direction:'rtl',width:20,height:60,lineHeight:1,
      selectionColor:'red',compositionColor:'red',scaleX:1,
      getHeightOfLine:()=>20,getLineWidth:()=>20,_getLineTopOffset:()=>0,_getWidthOfCharSpacing:()=>0,_isRotatedChar:()=>false,
      get2DCursorLocation(i){return{lineIndex:0,charIndex:i};},measureLine(){},isEndOfWrapping:()=>true
    });
    o.hiddenTextarea={value:'😀中文',selectionStart:2,selectionEnd:3,textLength:5};
    const c=createCanvas(20,60);
    o.renderSelection({top:0,left:0,leftOffset:0},c.getContext('2d'));
    const px=y=>Array.from(c.getContext('2d').getImageData(5,y,1,1).data);
    assert.equal(px(25)[3],255,'98 highlight 中');
    assert.equal(px(45)[3],0,'98 not 文');
    console.log('PASS 98 composition selection uses grapheme indices');
  }else{
    console.log('SKIP 98 (no @napi-rs/canvas)');
  }
}

{
  const focusCtx={document:{activeElement:null},focusTrapLogger:{debug(){}}};
  vm.createContext(focusCtx);vm.runInContext(read('js/ui/util/focus-trap.js'),focusCtx);
  let closed=0;
  focusCtx.FocusTrap._handleKey({key:'Escape',isComposing:true,keyCode:229,preventDefault(){},stopPropagation(){}},{closeCallback:()=>closed++});
  assert.equal(closed,0);
  focusCtx.FocusTrap._handleKey({key:'Escape',isComposing:false,keyCode:27,preventDefault(){},stopPropagation(){}},{closeCallback:()=>closed++});
  assert.equal(closed,1);
  console.log('PASS focus-trap ignores Escape during IME composition');
}

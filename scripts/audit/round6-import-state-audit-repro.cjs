// Offline audit of imported manga object metadata across production history.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const repo=process.env.MANGA_AUDIT_ROOT||process.cwd();
const read=p=>fs.readFileSync(path.join(repo,p),'utf8');
function method(source,name,start){
 const at=source.indexOf(name+':function',start),begin=at+name.length+1;
 assert(at>=0);let p=source.indexOf('{',begin),depth=1,quote=null,escape=false;
 for(p++;p<source.length;p++){
  const c=source[p];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;}
  else if(c==='"'||c==="'")quote=c;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return source.slice(begin,p+1);
 }throw Error('Method not found');
}
const fab=read('third/Fabric.js/fabric.min_PlusEraser.js');
const populate=vm.runInNewContext('('+method(fab,'populateWithProperties',0)+')');
const toObject=vm.runInNewContext('('+method(fab,'toObject',fab.indexOf('type:"object"'))+')',{
 e:{Object:{NUM_FRACTION_DIGITS:10},version:'fixture',util:{populateWithProperties:populate}},
 n:(number,digits)=>parseFloat(Number(number).toFixed(digits))
});
const helper=read('scripts/audit/editor-audit-repro.cjs').split('(async()=>{')[0];
const {ctx}=new Function('require',helper+';return {ctx};')(require);
function object(props){return Object.assign({includeDefaultValues:true,originX:'left',originY:'top',left:0,top:0,width:100,height:100,scaleX:1,scaleY:1,skewX:0,skewY:0,angle:0,strokeWidth:0,strokeMiterLimit:4,opacity:1,visible:true,fill:'white',guid:'source'},props);}
(async()=>{
 const x=ctx(),settings=read('js/core/settings.js');x.$=()=>null;
 vm.runInContext(settings.slice(settings.indexOf('const commonProperties=['),settings.indexOf('\n\nlet jscolorOptions=')),x);
 // The captured objects are valid examples of the metadata assigned by the importer.
 x.canvas.objects=[object({type:'image',guid:'ref',mangaImportReference:true,name:'导入漫画参考底图'}),object({type:'polygon',guid:'panel',isPanel:true,mangaImportPanel:true,mangaImportPanelIndex:2,mangaImportSourceBox:{x:50,y:20,w:100,h:100},mangaImportTags:['blue hair']}),object({type:'path',guid:'placeholder',mangaImportCharacterPlaceholder:true,mangaImportTemplateLayer:true,mangaImportPlaceholderIndex:1})];
 x.canvas.toJSON=function(properties){return {canvasGuid:this.canvasGuid,objects:this.objects.map(o=>toObject.call(o,properties))};};
 vm.runInContext(read('js/ai/manga-importer.js'),x);
 const original=JSON.parse(JSON.stringify(x.canvas.objects));
 x.canvas.setActiveObject=o=>x.canvas.active=o;x.canvas.discardActiveObject=()=>{};
 x.MangaImporter.selectNextCharacterPlaceholder();assert.equal(x.canvas.active.guid,'placeholder');
 x.saveState();const serialized=JSON.parse(x.stateStack[0]);
 for(const key of ['mangaImportReference','mangaImportPanel','mangaImportPanelIndex','mangaImportSourceBox','mangaImportTags','mangaImportCharacterPlaceholder','mangaImportTemplateLayer'])assert(serialized.objects.every(o=>!(key in o)),key);
 assert.equal(serialized.objects[1].isPanel,true);assert.equal(serialized.objects[1].guid,'panel');
 await x.restoreHistoryState(0,'A');x.canvas.active=null;
 x.MangaImporter.selectNextCharacterPlaceholder();assert.equal(x.canvas.active,null);
 // The hide step is a lexical production helper exposed only in this isolated VM.
 vm.runInContext(read('js/ai/manga-importer.js').replace('getLastImportSummary:function(){','auditHide:hideImportTemplateLayers,getLastImportSummary:function(){'),x);
 x.MangaImporter.auditHide();assert.equal(x.canvas.objects[0].visible,true);assert.equal(x.canvas.objects[2].visible,true);
 console.log('CONFIRMED IMPORT_METADATA_NOT_SERIALIZED: before history placeholder selectable; production commonProperties+bundled Fabric toObject omit importer flags/index/source/tags; restored placeholder cannot be selected, reference/template layers stay visible after hide');
 // Contrast: the same hide helper works on the original imported records.
 x.canvas.objects=original;x.MangaImporter.auditHide();assert.equal(x.canvas.objects[0].visible,false);assert.equal(x.canvas.objects[2].visible,false);
 console.log('CONTROL IMPORT_METADATA_PRESENT: reference and placeholder are both hidden correctly before serialization');
})().catch(e=>{console.error(e);process.exitCode=1;});

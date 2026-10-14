// Audit 94: leaving a tool mode must not unlock layers the user locked.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const repo=path.join(__dirname,'..','..');
const mk=p=>Object.assign({set(v){Object.assign(this,v);}},p);
const locked=mk({selectable:false,evented:false}),normal=mk({selectable:true,evented:true}),flagged=mk({selectable:false,evented:true,userMoveLock:true});
const objects=[locked,normal,flagged];
const x={console,btoa,cropFrame:null,cropActiveObject:null,isKnifeMode:false,nowPencil:'',currentMode:'select',points:[],canvas:{getObjects:()=>objects,forEachObject:f=>objects.forEach(f),discardActiveObject(){},requestRenderAll(){},renderAll(){}},uiLogger:{debug(){}},$:()=>null,getObjectList:()=>objects,hideCanvasHelpText(){}};
x.window=x;vm.createContext(x);vm.runInContext(fs.readFileSync(path.join(repo,'js/ui/util/mode-manager.js'),'utf8'),x);
x.ModeManager.change(x.ModeManager.MODE.POINT);
assert.equal(normal.selectable,false);
x.ModeManager.change(x.ModeManager.MODE.SELECT);
assert.equal(locked.selectable,false,'94: user-locked layer stays locked');assert.equal(normal.selectable,true);assert.equal(normal.evented,true);
assert.equal(flagged.selectable,false);
// a lock set while a tool is active is still honoured on exit
x.ModeManager.change(x.ModeManager.MODE.POINT);normal.userMoveLock=true;x.ModeManager.change(x.ModeManager.MODE.SELECT);assert.equal(normal.selectable,false);
// knife on/off
normal.userMoveLock=false;normal.selectable=true;x.isKnifeMode=true;x.ModeManager.knife&&x.ModeManager.knife._updateMovement?x.ModeManager.knife._updateMovement():null;
console.log('PASS 94 tool modes restore each layer\'s own lock state');

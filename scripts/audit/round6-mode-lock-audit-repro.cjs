// Production tool-mode state restoration audit. No browser session or user data.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const repo=process.env.MANGA_AUDIT_ROOT||process.cwd();
const locked={selectable:false,evented:false,set(values){Object.assign(this,values);}},normal={selectable:true,evented:true,set(values){Object.assign(this,values);}};
const objects=[locked,normal];
const x={console,btoa,cropFrame:null,cropActiveObject:null,isKnifeMode:false,nowPencil:'',currentMode:'select',points:[],canvas:{getObjects:()=>objects,forEachObject:f=>objects.forEach(f),discardActiveObject(){},requestRenderAll(){},renderAll(){}},uiLogger:{debug(){}},$:()=>null,getObjectList:()=>objects,hideCanvasHelpText(){}};
x.window=x;vm.createContext(x);vm.runInContext(fs.readFileSync(path.join(repo,'js/ui/util/mode-manager.js'),'utf8'),x);
x.ModeManager.change(x.ModeManager.MODE.POINT);
assert.equal(locked.selectable,false);assert.equal(normal.selectable,false);
x.ModeManager.change(x.ModeManager.MODE.SELECT);
assert.equal(locked.selectable,true);assert.equal(locked.evented,true);assert.equal(normal.selectable,true);
console.log('CONFIRMED TOOL_MODE_UNLOCKS_LAYER: original locked selectable=false/evented=false becomes true/true after point-bubble mode -> select; ordinary unlocked layer correctly remains selectable');

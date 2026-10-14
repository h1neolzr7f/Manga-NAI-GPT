(function(root){
"use strict";

function objectHeight(object){
if(object&&typeof object.getScaledHeight==='function')return object.getScaledHeight();
return (Number(object&&object.height)||0)*(Number(object&&object.scaleY)||1);
}
function objectTop(object){return Number(object&&object.top)||0;}

function paginateGroup(group,pageHeight){
var height=Number(group&&group.height)||0;
var limit=Math.max(1,Number(pageHeight)||1800);
if(height<=limit)return [{top:0,height:height,index:0}];
// Page views give object boxes relative to the page, so a moved page paginates the same (audit 42).
var objects=group&&typeof group.layoutObjects==='function'?group.layoutObjects():(group&&typeof group.getObjects==='function'?group.getObjects():[]);
var pages=[];
var start=0;
var boundary=limit;
objects.forEach(function(object,index){
var top=objectTop(object),bottom=top+objectHeight(object);
if(index>0&&bottom>boundary&&top>start){pages.push({top:start,height:Math.max(1,top-start),index:pages.length});start=top;boundary=start+limit;}
while(bottom>boundary){pages.push({top:start,height:Math.max(1,boundary-start),index:pages.length});start=boundary;boundary=start+limit;}
});
if(start<height)pages.push({top:start,height:height-start,index:pages.length});
return pages;
}

function downloadDataUrl(dataUrl,filename){
if(typeof document==='undefined')return false;
var link=document.createElement('a');link.href=dataUrl;link.download=filename;link.click();return true;
}

function capturePages(canvas,group,pageHeight,baseName,download){
if(!canvas||!group)throw new Error('Canvas 或模拟器对象不可用。');
var bounds=group.getBoundingRect(true,true),scale=Number(group.scaleY)||1,pages=paginateGroup(group,pageHeight),name=baseName||'simulator';
// Render only the target simulator (its own objects), without other layers or the edit grid (audit 67).
var all=typeof canvas.getObjects==='function'?canvas.getObjects():[];
var keep=all.indexOf(group)>=0?[group]:(typeof group.getObjects==='function'?group.getObjects():[group]);
var hidden=[];
all.forEach(function(object){if(keep.indexOf(object)<0&&object.visible!==false){hidden.push(object);object.visible=false;}});
var gridWasVisible=typeof isGridVisible!=='undefined'&&isGridVisible&&typeof removeGrid==='function';
if(gridWasVisible)removeGrid();
var outputs;
try{
outputs=pages.map(function(page){
var top=Math.max(bounds.top,bounds.top+page.top*scale);
var height=Math.max(1,Math.min(page.height*scale,bounds.top+bounds.height-top));
var data=canvas.toDataURL({format:'png',left:Math.max(0,bounds.left),top:Math.max(0,top),width:bounds.width,height:height,multiplier:1});
return {index:page.index,top:page.top,height:page.height,dataUrl:data,filename:name+'_'+String(page.index+1).padStart(3,'0')+'.png'};
});
}finally{
hidden.forEach(function(object){object.visible=true;});
if(gridWasVisible&&typeof drawGrid==='function'){drawGrid();isGridVisible=true;}
if(typeof canvas.requestRenderAll==='function')canvas.requestRenderAll();
}
if(download)outputs.forEach(function(item){downloadDataUrl(item.dataUrl,item.filename);});
return outputs;
}

function exportPages(canvas,group,pageHeight,baseName){return capturePages(canvas,group,pageHeight,baseName,true);}
root.NaiComicLongShot={paginateGroup:paginateGroup,capturePages:capturePages,exportPages:exportPages,downloadDataUrl:downloadDataUrl};
})(typeof window!=='undefined'?window:globalThis);

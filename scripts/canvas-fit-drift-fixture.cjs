'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/canvas-manager.js'),'utf8');
const functions=source.slice(0,source.indexOf("document.addEventListener('DOMContentLoaded'"));
const fixture=`<!doctype html><meta charset="utf-8"><title>Canvas sizing regression</title>
<link rel="stylesheet" href="../css/layout.css">
<style>body{margin:20px;background:#222;color:white}#resizable-container{width:340px;height:500px}.canvas-container{background:white}</style>
<pre id="testResults">Running…</pre><div id="resizable-container" class="resizable-container"><div id="canvas-container" class="canvas-container"></div></div>
<script>var $=id=>document.getElementById(id);var dims={width:1000,height:300};var canvas={getWidth:()=>dims.width,getHeight:()=>dims.height};var canvasContinerScale=1;
${functions}
function updateZoomLabel(){}
var results=[];
for(var entry of [{width:1000,height:300,userScale:1.3,wantWidth:442,wantHeight:132.6},{width:200,height:100,userScale:1,wantWidth:340,wantHeight:170}]){
dims=entry;viewUserScale=entry.userScale;fitCanvasViewToContainer(true);
var bounds=$('canvas-container').getBoundingClientRect();
var host=$('resizable-container').getBoundingClientRect();
results.push({pass:Math.abs(bounds.width-entry.wantWidth)<0.5&&Math.abs(bounds.height-entry.wantHeight)<0.5&&bounds.left>=host.left-0.5,actualWidth:bounds.width,actualHeight:bounds.height,wantWidth:entry.wantWidth,wantHeight:entry.wantHeight,reachableLeft:bounds.left>=host.left-0.5});
}
$('testResults').textContent=JSON.stringify({pass:results.every(r=>r.pass),results},null,2);
</script>`;
fs.mkdirSync(path.join(root,'work'),{recursive:true});
fs.writeFileSync(path.join(root,'work/canvas-fit-drift-test.html'),fixture);
console.log('Browser fixture generated: /work/canvas-fit-drift-test.html');

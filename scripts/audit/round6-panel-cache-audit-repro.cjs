// Production PanelAuto cache audit: real PNG, unchanged get/detectFrom functions.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const repo=process.env.MANGA_AUDIT_ROOT||process.cwd();
const {createCanvas,Image}=require(require.resolve('@napi-rs/canvas',process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}:undefined));
const samFixture=fs.readFileSync(path.join(repo,'scripts/audit/round5-sam-audit-repro.cjs'),'utf8');
const fixture=JSON.parse(samFixture.split('const collision=')[1].split(';\n')[0]);
let png=fixture.first.png;
const layer={type:'image',width:64,height:64,_element:{src:png}};
const x={console,Map,Image,Uint8Array,document:{createElement:()=>createCanvas(1,1)},canvas:{getObjects:()=>[layer]},getCanvasGUID:()=> 'same-page'};
x.window=x;x.MangaGPTRegionEditor={pageImage(){return {image:png,width:64,height:64};}};
vm.createContext(x);vm.runInContext(fs.readFileSync(path.join(repo,'js/ai/panel-auto.js'),'utf8'),x);
(async()=>{
 const before=await x.PanelAuto.get();assert.equal(before.panels[0].x,3);
 png=fixture.second.png;layer._element.src=png;
 const stale=await x.PanelAuto.get();assert.strictEqual(stale,before);assert.equal(stale.image,fixture.first.png);assert.equal(stale.panels[0].x,3);
 x.PanelAuto._cache.clear();const fresh=await x.PanelAuto.get();assert.equal(fresh.panels[0].x,24);assert.equal(fresh.image,png);
 console.log('CONFIRMED PANEL_AUTO_LENGTH_CACHE: replacing page pixels with same PNG length keeps old image and panel x=3; clear-cache control detects current x=24. Key only includes page GUID, original image dimensions and source-string length');
})().catch(e=>{console.error(e);process.exitCode=1;});

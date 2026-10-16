(function(root){
"use strict";

function engine(){return root.NaiComicStoryEngine;}

function beatsFromStory(story){
var api=engine();
var value=api?api.normalize(story):story;
var beats=[];
(value.nodes||[]).forEach(function(node){
if(['speech','aside','narrator','title','hint'].indexOf(node.type)<0)return;
var character=node.speaker&&api?api.getCharacter(value,node.speaker):null;
var content=node.content||((node.choices||[]).map(function(choice){return choice.label;}).join(' / '));
beats.push({
type:node.type,
speaker:character?character.name:'',
content:content||'',
description:(character?character.name+'：':'')+(content||node.type)
});
});
if(!beats.length)beats.push({type:'narrator',speaker:'',content:value.title||'场景',description:value.title||'场景'});
return beats;
}

var MAX_PANELS_PER_PAGE=6;
function layoutCells(width,height,count){
var PL=root.PageLayoutCore;
if(PL){
if(PL.v2Enabled()&&Number(count)>=1&&Number(count)<=6){var v=PL.cells(count,{width:width,height:height,dir:'rtl'});return {cols:0,rows:0,code:v.code,cells:v.cells};}
return PL.grid(count,width,height);
}
count=Math.max(1,Number(count)||1);
width=Number(width)||1000;
height=Number(height)||1400;
var cols=count===1?1:(count<=4?2:3);
var rows=Math.ceil(count/cols);
var margin=36;
var gap=18;
var cellW=(width-margin*2-gap*(cols-1))/cols;
var cellH=Math.max(40,(height-margin*2-gap*(rows-1))/rows);
var cells=[];
for(var index=0;index<count;index++){
var col=index%cols;
var row=Math.floor(index/cols);
cells.push({
x:margin+col*(cellW+gap),
y:margin+row*(cellH+gap),
width:cellW,
height:cellH
});
}
return {cols:cols,rows:rows,cells:cells};
}

/* v2 pacing (behind localStorage mnai.storyV2='1' until the user's blind pick): one moment per panel —
 * consecutive lines of the same speaker share a panel (at most 2 bubbles), narration/titles get their own,
 * and pages hold 2–4 panels instead of every line on page 1. */
var MAX_LINES_V2=2,PAGE_PANELS_V2=4;
function storyV2Enabled(){try{return !!(root.localStorage&&root.localStorage.getItem('mnai.storyV2')==='1');}catch(e){return false;}}
function groupBeats(beats){
var groups=[];
beats.forEach(function(beat){
var last=groups[groups.length-1];
var talk=beat.type==='speech';
if(last&&talk&&last.talk&&last.speaker===beat.speaker&&last.beats.length<MAX_LINES_V2){last.beats.push(beat);return;}
groups.push({talk:talk,speaker:beat.speaker,beats:[beat]});
});
return groups;
}
function storyToPlanV2(value,beats){
var groups=groupBeats(beats),pages=[];
var per=groups.length<=PAGE_PANELS_V2?groups.length:(groups.length%PAGE_PANELS_V2===1?PAGE_PANELS_V2-1:PAGE_PANELS_V2);
for(var i=0;i<groups.length;i+=per){
pages.push({page:pages.length+1,panels:groups.slice(i,i+per).map(function(g,k){
return {panel:k+1,mode:'normal',
description:g.beats.map(function(b){return b.description;}).join(' / '),
characters:g.speaker?[g.speaker]:[],
dialogue:g.beats.filter(function(b){return b.content;}).map(function(b){return {speaker:b.speaker||'旁白',content:b.content};}),
template:'',story:undefined};
})});
}
return {schemaVersion:1,title:value.title||'剧情分镜',pages:pages};
}
function storyToPlan(story,opts){
var value=engine()?engine().normalize(story):story;
var beats=beatsFromStory(value);
if((opts&&opts.v2)||(!(opts&&opts.v2===false)&&storyV2Enabled()))return storyToPlanV2(value,beats);
return {
schemaVersion:1,
title:value.title||'剧情分镜',
pages:[{
page:1,
panels:beats.map(function(beat,index){
return {
panel:index+1,
mode:'normal',
description:beat.description,
characters:beat.speaker?[beat.speaker]:[],
dialogue:beat.content?[{speaker:beat.speaker||'旁白',content:beat.content}]:[],
template:'',
story:undefined
};
})
}]
};
}

function fillDirectorPrompt(story){
var value=engine()?engine().normalize(story):story;
var beats=beatsFromStory(value);
var lines=[value.title||'剧情分镜','漫画分镜边框, cinematic manga page'];
beats.forEach(function(beat,index){
lines.push('分镜'+(index+1)+'：'+beat.description);
});
var text=lines.join('\n');
if(typeof document!=='undefined'){
var target=document.getElementById('naiBatchDirectorPrompt');
if(target)target.value=text;
}
return text;
}

function makeMangaPanel(panel,x,y,width,height){
if(!root.fabric)throw new Error('Fabric 尚未加载。');
var fillEl=typeof document!=='undefined'?document.getElementById('panelFillColor'):null;
var strokeEl=typeof document!=='undefined'?document.getElementById('panelStrokeColor'):null;
var widthEl=typeof document!=='undefined'?document.getElementById('panelStrokeWidth'):null;
var rect=new root.fabric.Rect({
left:x,
top:y,
width:width,
height:height,
fill:(fillEl&&fillEl.value)||'rgba(255,255,255,1)',
stroke:(strokeEl&&strokeEl.value)||'rgba(0,0,0,1)',
strokeWidth:widthEl?parseFloat(widthEl.value)||2:2,
strokeUniform:true,
originX:'left',
originY:'top',
objectCaching:false,
isPanel:true,
name:'分镜 '+(panel.panel||'')
});
if(typeof setText2ImageInitPrompt==='function')setText2ImageInitPrompt(rect);
if(typeof setPanelValue==='function')setPanelValue(rect);
if(panel.prompt)rect.text2img_prompt=panel.prompt;
if(panel.negative_prompt)rect.text2img_negative=panel.negative_prompt;
rect.scenePlanPanelIndex=panel.panel;
return rect;
}

function enrichPlanWithDirector(plan){
var director=root.NovelAICompositionDirector;
if(!director||typeof director.draftLayerPromptAsync!=='function'){
return Promise.resolve({plan:plan,source:'heuristic'});
}
var tasks=[];
plan.pages.forEach(function(page){
page.panels.forEach(function(panel){
if(panel.mode==='simulator')return;
var rough=panel.description||'';
tasks.push(director.draftLayerPromptAsync({text2img_prompt:rough},'T2I',rough).then(function(result){
panel.prompt=result.prompt;
panel.negative_prompt=result.negative_prompt;
panel.directorSource=result.apiResult?'api':(result.apiError?'local-fallback':'local');
}));
});
});
if(!tasks.length)return Promise.resolve({plan:plan,source:'heuristic'});
return Promise.all(tasks).then(function(){
var sources=[];
plan.pages.forEach(function(page){
page.panels.forEach(function(panel){
if(panel.directorSource)sources.push(panel.directorSource);
});
});
var source=sources.indexOf('api')>=0?'api':(sources.length?'local':'heuristic');
return {plan:plan,source:source};
});
}

function createPanelsFromPlan(plan,options){
var current=root.canvas;
if(!current||!root.fabric)return Promise.reject(new Error('Canvas 尚未初始化。'));
var parsed=root.NaiScenePlanSchema?root.NaiScenePlanSchema.parse(plan):plan;
// Respect the plan's page boundaries and a per-page cap; never squeeze a whole long script
// into one canvas (audit 21). Only the first page goes onto the current canvas; the rest is
// reported so the user can continue on a new page.
var chunks=[];
parsed.pages.forEach(function(page){
var list=page.panels.filter(function(panel){return panel.mode!=='simulator';});
for(var i=0;i<list.length;i+=MAX_PANELS_PER_PAGE)chunks.push(list.slice(i,i+MAX_PANELS_PER_PAGE));
});
if(!chunks.length)return Promise.reject(new Error('这段剧情没有可生成的漫画分镜。'));
var panels=chunks[0];
var remainingPanels=chunks.slice(1).reduce(function(n,c){return n+c.length;},0);
var layout=layoutCells(current.width,current.height,panels.length);
if(typeof changeDoNotSaveHistory==='function')changeDoNotSaveHistory();
var created=[];
panels.forEach(function(panel,index){
var cell=layout.cells[index];
var object=makeMangaPanel(panel,cell.x,cell.y,cell.width,cell.height);
if(typeof getGUID==='function')getGUID(object);
current.add(object);
created.push(object);
});
if(typeof changeDoSaveHistory==='function')changeDoSaveHistory();
current.renderAll();
if(typeof updateLayerPanel==='function')updateLayerPanel();
if(typeof saveStateByManual==='function')saveStateByManual();
return Promise.resolve({objects:created,plan:parsed,layout:layout,remainingPages:chunks.length-1,remainingPanels:remainingPanels});
}

root.NaiComicStoryToManga={
beatsFromStory:beatsFromStory,
layoutCells:layoutCells,
storyToPlan:storyToPlan,
groupBeats:groupBeats,
fillDirectorPrompt:fillDirectorPrompt,
makeMangaPanel:makeMangaPanel,
enrichPlanWithDirector:enrichPlanWithDirector,
createPanelsFromPlan:createPanelsFromPlan
};
})(typeof window!=='undefined'?window:globalThis);

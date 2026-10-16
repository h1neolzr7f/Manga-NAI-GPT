/* exported TaskLauncher */
// 新手任务: a task-first entry on top of the existing editor. Each task is a short wizard that
// drives an existing feature in a simplified view (preset parameters hidden); 高级 reveals the full
// controls, and 专业模式 brings back the complete original UI.
var TaskLauncher=(function(){
var MODE_KEY='mnai.uiMode';
var active=null;
var timer=null;

function $(id){return document.getElementById(id);}
function el(tag,attrs,html){var e=document.createElement(tag);Object.keys(attrs||{}).forEach(function(k){e.setAttribute(k,attrs[k]);});if(html!=null)e.innerHTML=html;return e;}
function toast(title,msg,isError){
if(isError&&typeof createToastError==='function')return createToastError(title,msg);
if(typeof createToast==='function')createToast(title,msg,3200);
}
function hasPage(){
try{return typeof canvas!=='undefined'&&canvas&&canvas.getObjects().some(function(o){return o.type==='image'||o.isPanel;});}catch(e){return false;}
}

var GPT_PRESETS={
swap:'Replace the character inside the selected area with the character shown in the reference image(s): face, hair, outfit and colours. '+
'Keep the original pose, framing, camera angle, lighting, line art and screentone style. Keep everything outside the character unchanged.',
fix:'Remove the unwanted object, mark or blemish inside the selected area and rebuild what was behind it so it blends naturally with the '+
'surroundings (same line art, screentone and lighting). Do not add anything new. Keep everything else unchanged.'
};

var TASKS=[
{id:'page',icon:'auto_stories',title:'画一页漫画',desc:'选格子数，写每格画面和对白，一键生成整页',kind:'page',section:'常用',
steps:['选 3 格或 4 格','写每格的画面（和对白，可不填）','点「生成整页」：AI 画好每一格并放好对白气泡']},
{id:'swap',icon:'switch_account',title:'换角色',desc:'自动找出人物，点一下换成你的角色',kind:'autoswap',section:'常用',
steps:['点一下要换掉的人物（已自动找出，橙色虚线）','上传新角色的参考图','点「生成」：自动擦掉原角色、补背景、按原姿势画新角色','满意就点「应用」；其他格里的同一角色可一键换掉'],
manualSteps:['在画布上拖一个框，框住要换的人物','上传新角色的参考图（推荐）','点「生成预览」，可用「对比原图」看前后','满意就点「作为新图层应用」'],
placeholder:'补充要求（可不填），例如：表情改成微笑',preset:GPT_PRESETS.swap},
{id:'caption',icon:'translate',title:'改字幕',desc:'识别气泡里的字，改成新台词',kind:'caption',section:'常用',
steps:['自动识别本页文字（打开就开始；识别不到可点「手动框选字幕」）','在每条下面改成新台词','点「应用为可编辑图层」，旧字会自动盖掉']},
{id:'fix',hidden:true,icon:'healing',title:'修瑕疵（框选 · GPT 预览）',desc:'框住不想要的东西，GPT 补好背景（旧版向导，「改一块」已包含）',kind:'gpt',
steps:['在画布上拖一个框，框住要去掉的东西','点「生成预览」，可用「对比原图」看前后','满意就点「作为新图层应用」'],
placeholder:'补充说明（可不填），例如：去掉右下角的水印',preset:GPT_PRESETS.fix},
{id:'fill',icon:'format_paint',title:'改一块',desc:'涂出一块：去掉杂物、换成别的，或自由修改',kind:'aifill',section:'常用',
steps:['用笔刷涂出要改的地方（也可框选或智能点选）','选「去掉杂物」（本机，免费）、「换成…」或「自由修改」，后两种写一句话','点生成，挑一张满意的点「用这张」：会变成可再改、可还原的图层']},
{id:'layer',icon:'layers',title:'分层',desc:'把人物或物体抠成独立图层',kind:'layer',section:'常用',
steps:['点「开始框选」，在画布上框住要分出来的人物或物体','自动抠图并放到新图层（原图不变，可撤销）']},
{id:'custom',hidden:true,icon:'auto_fix_high',title:'自定义修改（框选 · 可加参考图）',desc:'框一块区域，用一句话描述怎么改，可加参考图（旧版向导）',kind:'gpt',
steps:['在画布上拖一个框，框住要改的地方','写一句想怎么改（可加参考图）','点「生成预览」，满意就应用'],
placeholder:'想怎么改？例如：把天空改成黄昏',preset:''},
{id:'decompose',icon:'dashboard_customize',title:'拆成可编辑页',desc:'把整页漫画拆成格子、气泡和文字层，方便改字改图',kind:'decompose',section:'进阶',
steps:['导入或打开一页漫画','点「开始拆解」（本机识别，不花 Anlas）','检查分格和文字，标「待校对」的请核对']},
{id:'story',icon:'menu_book',title:'剧情出分镜',desc:'写几句剧情，一键规划成漫画分镜（默认批量导演）',kind:'story',section:'进阶',
steps:['打开「剧情」写对白和场面','点「生成漫画分镜」：批量导演会规划整页','需要出图时再走「画一页漫画」或自动生成']},
{id:'nai',icon:'brush',title:'AI 生图',desc:'用 NovelAI 从文字生成新画面',kind:'nai',section:'专业',
steps:['在「服务设置」里填好 NovelAI Token','在「自动生成」面板写画面描述','点生成（会花 Anlas，先看提示）']}
];
function task(id){return TASKS.filter(function(t){return t.id===id;})[0];}

// ---------- mode ----------
function mode(){try{return localStorage.getItem(MODE_KEY)==='pro'?'pro':'beginner';}catch(e){return 'beginner';}}
function applyMode(m){
var bar=$('taskBar');
if(bar){var hd=bar.parentNode;if(m==='pro')hd.appendChild(bar);else hd.insertBefore(bar,hd.firstChild);}   // pro: tools first, task bar last
document.body.classList.toggle('ui-beginner',m==='beginner');
groupSidebar(m==='beginner');if(m==='beginner')collapseSidePanel();
document.body.classList.toggle('ui-pro',m==='pro');
var t=$('uiModeToggle');
if(t){t.querySelector('span').textContent=m==='beginner'?'专业模式（全部工具和参数）':'新手模式（按任务操作）';t.title=m==='beginner'?'显示全部工具和参数（原版界面）':'回到按任务操作的简洁界面';t.setAttribute('aria-pressed',String(m==='pro'));}
updateHome();
}
function setMode(m){try{localStorage.setItem(MODE_KEY,m);}catch(e){}if(m==='pro')stop();applyMode(m);}

// ---------- task bar + home ----------
// Layout by usage frequency (report §11): tasks left; the actions used on every page (undo/redo, page nav,
// save, export all) as large targets at a fixed spot on the right; rare things (service settings, theme,
// pro mode, open project, shortcuts) in the ⋯ menu. Shortcuts are in each tooltip.
function iconBtn(id,icon,label,title,cls){return el('button',{type:'button',class:'ui-btn task-quick '+(cls||''),id:id,title:title,'aria-label':title},'<i class="material-icons" aria-hidden="true">'+icon+'</i><span class="task-quick-label">'+label+'</span>');}
function call(fn){return function(){try{if(typeof window[fn]==='function')window[fn]();}catch(e){}};}
function buildBar(){
var header=document.querySelector('#canvas-area .area-header');
if(!header||$('taskBar'))return;
var bar=el('div',{id:'taskBar',class:'task-bar',role:'toolbar','aria-label':'新手任务'});
var tasks=el('div',{class:'task-group task-group-tasks'});
TASKS.forEach(function(t){
if(t.hidden)return;   // folded into 改一块; still reachable via Ctrl+K and 专业模式
var b=el('button',{type:'button',class:'ui-btn task-btn','data-task':t.id,id:'taskBtn-'+t.id,title:t.desc},'<i class="material-icons" aria-hidden="true">'+t.icon+'</i>'+t.title);
b.addEventListener('click',function(){start(t.id);});
tasks.appendChild(b);
});
bar.appendChild(tasks);
var quick=el('div',{id:'taskQuickBar',class:'task-group task-group-quick',role:'group','aria-label':'常用操作'});
var undoB=iconBtn('taskUndo','undo','撤销','撤销 (Ctrl+Z)');undoB.addEventListener('click',call('undo'));
var redoB=iconBtn('taskRedo','redo','重做','重做 (Ctrl+Y)');redoB.addEventListener('click',call('redo'));
var prev=iconBtn('taskPagePrev','chevron_left','上一页','上一页 (Alt+←)','task-icon-only');prev.addEventListener('click',function(){if(typeof btmNavigatePage==='function')btmNavigatePage(-1).then(updatePageNav);});
var label=el('span',{id:'taskPageLabel',class:'task-page-label','aria-live':'polite'},'–');
var next=iconBtn('taskPageNext','chevron_right','下一页','下一页 (Alt+→)','task-icon-only');next.addEventListener('click',function(){if(typeof btmNavigatePage==='function')btmNavigatePage(1).then(updatePageNav);});
var save=iconBtn('taskSave','save','保存','保存项目 (Ctrl+S)');save.addEventListener('click',function(){var s=$('projectSave');if(s)s.click();});
var expAll=iconBtn('taskExportAll','download','导出全部','导出全部页面：每页 PNG + 项目文件，打成一个 zip','ui-btn-primary');expAll.addEventListener('click',function(){exportAll();});
[undoB,redoB,el('span',{class:'task-sep'}),prev,label,next,el('span',{class:'task-sep'}),save,expAll].forEach(function(n){quick.appendChild(n);});
bar.appendChild(quick);
var moreWrap=el('div',{class:'task-more-wrap'});
var more=el('button',{type:'button',class:'ui-btn ui-btn-ghost task-quick task-icon-only',id:'taskMore',title:'更多：服务设置、浅色/深色、专业模式…','aria-label':'更多','aria-haspopup':'menu','aria-expanded':'false'},'<i class="material-icons" aria-hidden="true">more_horiz</i>');
var menu=el('div',{id:'taskMoreMenu',class:'ui-card task-more-menu',role:'menu',hidden:''});
function item(id,icon,text,fn){var b=el('button',{type:'button',class:'task-menu-item',role:'menuitem',id:id},'<i class="material-icons" aria-hidden="true">'+icon+'</i><span>'+text+'</span>');b.addEventListener('click',function(){closeMenu();fn();});menu.appendChild(b);return b;}
// grouped: (找功能 / 历史 are inserted on top by the command layer) | file | services & characters | view
function sep(){menu.appendChild(el('div',{class:'task-menu-sep',role:'separator'}));}
sep();
item('taskOpenProject','folder_open','打开项目 (Ctrl+O)',function(){var l=$('projectLoad');if(l)l.click();});
sep();
item('taskServiceSettings','settings','服务设置（GPT / NovelAI / 本机）',function(){if(window.ServiceSettings)ServiceSettings.open('gpt');});
item('taskCharacters','face','角色库 · 认出本页人物',function(){if(window.CharacterLibrary)CharacterLibrary.open();});
sep();
item('privacyToggle','visibility_off','隐私模式（模糊缩略图）：'+(privacyOn()?'开':'关'),function(){setPrivacy(!privacyOn());var b=$('privacyToggle');if(b)b.lastChild.textContent='隐私模式（模糊缩略图）：'+(privacyOn()?'开':'关');});
item('themeToggle','contrast','浅色 / 深色界面',function(){var box=$('mode-toggle');if(!box)return;box.checked=!box.checked;box.dispatchEvent(new Event('change'));});
item('taskShortcuts','keyboard','快捷键一览 (F1)',call('openShortcutModal'));
item('taskWhatsNewMenu','auto_awesome','1.6.6 新功能导览',function(){try{localStorage.removeItem(WHATSNEW_KEY);}catch(e){}showWhatsNew(true);});
item('uiModeToggle','tune','专业模式',function(){setMode(mode()==='beginner'?'pro':'beginner');});
function closeMenu(){menu.hidden=true;more.setAttribute('aria-expanded','false');}
more.addEventListener('click',function(e){e.stopPropagation();menu.hidden=!menu.hidden;
// fixed + placed from the ⋯ button
if(!menu.hidden){var r=more.getBoundingClientRect();menu.style.position='fixed';menu.style.top=Math.round(r.bottom+6)+'px';menu.style.right=Math.max(4,Math.round(window.innerWidth-r.right))+'px';menu.style.maxHeight=Math.max(200,window.innerHeight-r.bottom-16)+'px';menu.style.overflowY='auto';}
more.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden){var f=menu.querySelector('button');if(f)f.focus();}});
document.addEventListener('click',function(e){if(!menu.hidden&&!moreWrap.contains(e.target)&&!menu.contains(e.target))closeMenu();});
menu.addEventListener('keydown',function(e){if(e.key==='Escape'){closeMenu();more.focus();}});
// the menu lives on <body>: inside the header its z-index could never rise above the start card
moreWrap.appendChild(more);document.body.appendChild(menu);bar.appendChild(moreWrap);
header.insertBefore(bar,header.firstChild);
setInterval(updatePageNav,700);
}
function updatePageNav(){
var lab=$('taskPageLabel');if(!lab)return;
try{
var n=typeof btmGetGuidsSize==='function'?btmGetGuidsSize():0;
var i=n&&typeof btmGetGuidIndex==='function'?btmGetGuidIndex(getCanvasGUID()):-1;
lab.textContent=n?((i>=0?i+1:'–')+' / '+n):'– / –';
$('taskPagePrev').disabled=!(i>0);$('taskPageNext').disabled=!(i>=0&&i<n-1);
}catch(e){/* page bar not ready */}
}
// Beginner sidebar: rarely used tools move into 更多 (pro mode puts them back where they were).
var RARE_TOOLS=['simulator-chat-area','auto-generate-area','prompt-manager-area','ps-tools-area','manga-tone-area','shape-area','cutout-area'];
var RARE_LABELS=['模拟器','刀'];
var movedTools=[];
function rareWrappers(){return Array.from(document.querySelectorAll('#sidebar > .icon-wrapper')).filter(function(w){return RARE_TOOLS.indexOf(w.dataset.target||'')>=0||RARE_LABELS.indexOf((w.innerText||'').trim().split(/\s+/).pop())>=0;});}
function groupSidebar(beginner){
var more=$('sidebarMore');if(!more)return;
if(beginner&&!movedTools.length){
rareWrappers().forEach(function(w){var mark=document.createComment('tool-slot');w.parentNode.insertBefore(mark,w);movedTools.push([w,mark]);more.appendChild(w);});
}else if(!beginner&&movedTools.length){
movedTools.forEach(function(x){x[1].parentNode.insertBefore(x[0],x[1]);x[1].remove();});movedTools=[];
}
}
// The side panel is opened on demand in beginner mode (sidebar icon toggles it); start with the canvas wide.
var panelCollapsedOnce=false;
function collapseSidePanel(){
if(panelCollapsedOnce)return;panelCollapsedOnce=true;
var t=$('svg-container-template');
if(t&&t.style.display!=='none'&&typeof toggleVisibility==='function')toggleVisibility('svg-container-template');
}
function buildHome(){
if($('taskHome'))return;
var area=$('canvas-area');
if(!area)return;
var home=el('section',{id:'taskHome',class:'ui-card task-home','aria-labelledby':'taskHomeTitle'});
home.innerHTML='<h2 id="taskHomeTitle">想做什么？</h2><p class="ui-muted">先导入漫画页，或直接「画一页漫画」。任务按「常用 / 进阶 / 专业」分组，参数已经帮你选好。</p>';
var imp=el('button',{type:'button',class:'ui-btn ui-btn-primary task-import',id:'taskHomeImport'},'<i class="material-icons" aria-hidden="true">upload_file</i>导入漫画页（可多选）');
imp.addEventListener('click',function(){var input=$('imageInput');if(input)input.click();});
home.appendChild(imp);
var SECTIONS=[{id:'常用',hint:'改图、换角、改字'},{id:'进阶',hint:'1.6.5 新能力：拆页、剧情出分镜'},{id:'专业',hint:'直接调 NovelAI'}];
SECTIONS.forEach(function(sec){
var list=TASKS.filter(function(t){return !t.hidden&&(t.section||'常用')===sec.id;});
if(!list.length)return;
var wrap=el('div',{class:'task-section','data-section':sec.id});
wrap.appendChild(el('h3',{class:'task-section-title'},sec.id+' <span class="ui-muted">'+sec.hint+'</span>'));
var grid=el('div',{class:'task-grid'});
list.forEach(function(t){
var c=el('button',{type:'button',class:'task-tile','data-task':t.id},'<i class="material-icons" aria-hidden="true">'+t.icon+'</i><strong>'+t.title+'</strong><span>'+t.desc+'</span>');
c.addEventListener('click',function(){start(t.id);});
grid.appendChild(c);
});
wrap.appendChild(grid);home.appendChild(wrap);
});
var close=el('button',{type:'button',class:'ui-btn ui-btn-ghost task-home-close',title:'先不选','aria-label':'关闭'},'×');
close.addEventListener('click',function(){home.dataset.dismissed='1';updateHome();});
home.appendChild(close);
area.appendChild(home);
}
function updateHome(){
var home=$('taskHome');
if(!home)return;
home.hidden=mode()!=='beginner'||hasPage()||home.dataset.dismissed==='1'||!!active;
// the first page of a session gets the full width: close the template panel once more if something reopened it
if(mode()==='beginner'&&hasPage()&&!firstPageSeen){firstPageSeen=true;var tp=$('svg-container-template');
if(tp&&getComputedStyle(tp).display!=='none'&&typeof toggleVisibility==='function')toggleVisibility('svg-container-template');}
}
var firstPageSeen=false;

// ---------- wizard head (inside the driven panel) ----------
function head(t,container,before){
var old=$('mangaGptTaskHead');if(old)old.remove();
var h=el('div',{id:'mangaGptTaskHead',class:'task-head'});
h.innerHTML='<div class="task-head-top"><strong>'+t.title+'</strong><span class="ui-muted">新手任务</span></div>';
var ol=el('ol',{class:'task-steps'});
t.steps.forEach(function(s,i){ol.appendChild(el('li',{'data-step':String(i)},s));});
h.appendChild(ol);
var row=el('div',{class:'task-head-row'});
var adv=el('label',{class:'task-adv'},'<input type="checkbox" id="taskAdvanced"> 高级（显示全部参数）');
row.appendChild(adv);
if((t.kind==='gpt'||t.kind==='layer')&&window.SamClickSelect){
// 智能点选: only shown when the local model runtime is installed; otherwise the box/lasso select stays the way
var smart=el('button',{type:'button',class:'ui-btn',id:'taskSmartPick',hidden:'',title:'在人物或物体上点一下，自动选出轮廓（本机模型，不花钱）'},'<i class="material-icons" aria-hidden="true">ads_click</i>智能点选');
row.appendChild(smart);
SamClickSelect.available().then(function(ok){smart.hidden=!ok;});
smart.addEventListener('click',function(){smartPick(t);});
}
var back=el('button',{type:'button',class:'ui-btn ui-btn-ghost',id:'taskBack'},'换个任务');
row.appendChild(back);
h.appendChild(row);
container.insertBefore(h,before===undefined?container.firstChild:before);   // before===null appends
$('taskAdvanced').addEventListener('change',function(e){
if(t.kind==='gpt'&&window.MangaGPTRegionEditor)MangaGPTRegionEditor.setSimple(!e.target.checked);
if(t.kind==='caption'&&window.MangaSmartTextEditor)MangaSmartTextEditor.setSimple(!e.target.checked);
});
back.addEventListener('click',function(){stop(true);});
return h;
}
function smartPick(t){
var layer=t.kind==='layer';
if(layer)cancelPick();
var ok=SamClickSelect.begin({target:layer?'layer':'gpt',onDone:function(done,cand,cancelled){
if(cancelled||!done){if(!layer&&!cancelled)toast('智能点选','没能用这个形状做选区，请改用框选。',true);return;}
if(layer){markStep(2,true);setLayerStatus('完成：已放到新图层，原图不变（Ctrl+Z 可撤销）。可以再点选一个。');}
else markStep(1);
}});
if(!ok)toast('智能点选','画布还没准备好，请先打开一页漫画。',true);
}
function markStep(n,doneAll){
var h=$('mangaGptTaskHead');if(!h)return;
Array.prototype.forEach.call(h.querySelectorAll('li'),function(li,i){
li.classList.toggle('is-done',doneAll||i<n);
li.classList.toggle('is-current',!doneAll&&i===n);
});
}

// ---------- wizard card (分层 / AI 生图) ----------
function card(t){
var old=$('taskWizardCard');if(old)old.remove();
var c=el('section',{id:'taskWizardCard',class:'ui-card task-card',role:'dialog','aria-labelledby':'taskWizardTitle'});
// the step head right below already shows the task title; the header only carries the close button
c.setAttribute('aria-label',t.title);c.removeAttribute('aria-labelledby');
c.innerHTML='<header class="task-card-close"><button type="button" class="ui-btn ui-btn-ghost" id="taskWizardClose" aria-label="关闭">×</button></header>';
document.body.appendChild(c);
head(t,c,c.querySelector('header').nextSibling);
$('taskWizardClose').addEventListener('click',function(){stop(true);});
var body=el('div',{class:'task-card-body',id:'taskWizardBody'});
c.appendChild(body);
return body;
}

// ---------- start / stop ----------
// GPT tasks need a configured service; without one, 服务设置 opens with a short hint instead of a failing wizard.
// (修瑕疵 can run on local LaMa; AI 生图 has its own token step.)
var NEEDS_GPT={swap:1,custom:1};
function start(id){
var t=task(id);if(!t)return;
if(id==='page'&&window.NaiEngine&&NaiEngine.configured()){startNow(id);return;}
if(NEEDS_GPT[id]&&window.ServiceSettings&&ServiceSettings.ensureReady&&(t.kind==='page'||hasPage())){
ServiceSettings.ready('gpt').then(function(ok){
if(ok){startNow(id);return;}
if(id==='swap')toast('换角色需要 GPT 图像服务','请先在「服务设置」里选服务、填 API 地址和 Key，点「测试连接」后再回来。换角色会改画面，本机模型不够用。');
else if(id==='custom')toast('自定义改图需要 GPT','请先配置 GPT 图像服务，再回来做这块修改。');
ServiceSettings.ensureReady('gpt').then(function(ready){if(ready)startNow(id);});
});
return;
}
startNow(id);
}
function startNow(id){
var t=task(id);if(!t)return;
stop(false);
if(t.kind!=='nai'&&t.kind!=='page'&&t.kind!=='story'&&!hasPage()){
toast('先导入漫画页','点「导入漫画页」选一张或多张图片，然后再选任务。');
var home=$('taskHome');if(home){home.dataset.dismissed='';updateHome();}
return;
}
active={id:id,kind:t.kind,startApplied:0};
updateHome();
document.querySelectorAll('.task-btn').forEach(function(b){b.classList.toggle('is-active',b.dataset.task===id);});
if(t.kind==='gpt')startGpt(t);
else if(t.kind==='autoswap')startAutoSwap(t);
else if(t.kind==='caption')startCaption(t);
else if(t.kind==='layer')startLayer(t);
else if(t.kind==='page')startPage(t);
else if(t.kind==='decompose')startDecompose(t);
else if(t.kind==='story')startStory(t);
else if(t.kind==='aifill'){if(!window.AiFill){stop(false);return;}AiFill.open().then(function(ok){if(!ok)stop(false);});}
else startNai(t);
timer=setInterval(tick,400);
}
function stop(showHome){
if(pageJob){pageJob.cancel=true;if(pageJob.ctl)pageJob.ctl.abort();}
if(window.PanelAuto)PanelAuto.close();
if(timer){clearInterval(timer);timer=null;}
var was=active;active=null;
document.querySelectorAll('.task-btn').forEach(function(b){b.classList.remove('is-active');});
var h=$('mangaGptTaskHead');if(h)h.remove();
var c=$('taskWizardCard');if(c)c.remove();
cancelPick();
if(window.AutoSwap&&AutoSwap.stop)AutoSwap.stop();
if(was&&was.kind==='aifill'&&window.AiFill)AiFill.close();
if(was&&was.kind==='gpt'&&window.MangaGPTRegionEditor){
MangaGPTRegionEditor.exitTask();
var p=$('mangaGptPanel');if(p&&showHome!==undefined)p.hidden=true;
}
if(was&&was.kind==='caption'&&window.MangaSmartTextEditor){
MangaSmartTextEditor.setSimple(false);
var sp=$('mangaSmartTextPanel');if(sp&&showHome!==undefined)sp.hidden=true;
}
if(showHome){var home=$('taskHome');if(home)home.dataset.dismissed='';}
updateHome();
}

function startGpt(t){
var api=window.MangaGPTRegionEditor;
if(!api||!api.openTask){toast('GPT 改图还没准备好','请稍等页面加载完再试。',true);return;}
api.openTask({id:t.id,preset:t.preset,placeholder:t.placeholder,prompt:''});
active.startApplied=api.wizardState().applied;
var panel=$('mangaGptPanel');
var anchor=$('mangaGptServiceSummary')||(panel&&panel.children[1]);
head(t,panel,anchor);
markStep(0);
}
function startAutoSwap(t){
if(!window.AutoSwap||!AutoSwap.start){toast('换角色还没准备好','请稍等页面加载完再试。',true);return;}
var body=card(t);
AutoSwap.start(body,{markStep:markStep,onApplied:function(){active.applied=(active.applied||0)+1;},
manual:function(){
// fall back to the v1 wizard: box select + GPT panel (kept for full manual control)
var m={id:t.id,kind:'gpt',title:t.title+'（手动）',steps:t.manualSteps,placeholder:'补充要求（可不填），例如：表情改成微笑',preset:GPT_PRESETS.swap};
var c=$('taskWizardCard');if(c)c.remove();
active.kind='gpt';startGpt(m);
}});
}
function startCaption(t){
var api=window.MangaSmartTextEditor;
if(!api||!api.open){toast('智能字幕还没准备好','请稍等页面加载完再试。',true);return;}
api.open(true);
active.startApplied=api.progress().applied;
var panel=$('mangaSmartTextPanel');
head(t,panel,panel.querySelector('header')?panel.querySelector('header').nextSibling:null);
markStep(0);
// no click needed: a page without drafts is read right away (「检测本页文字」 stays for re-reading)
// pages read in the background on import open instantly (per-page cache); switching pages follows in tick()
if(api.ensure){active.captionPage=null;api.ensure().then(function(){if(active)active.captionPage=(typeof getCanvasGUID==='function'?getCanvasGUID():null);});}
}
function startDecompose(t){
var body=card(t);
body.appendChild(el('p',{class:'ui-muted'},'把整页拆成「格子画面 + 边框 + 可改文字」。本机识别，不花 Anlas。实验选项里的「拆解时擦拟声词」默认关。'));
var go=el('button',{type:'button',class:'ui-btn ui-btn-primary',id:'taskDecomposeGo'},'开始拆解（选图或用当前页）');
var gen=el('button',{type:'button',class:'ui-btn',id:'taskDecomposeGen',title:'会用 NovelAI 免费额度画一整页再拆解'},'整页生成并拆解');
body.appendChild(go);body.appendChild(gen);
body.appendChild(el('p',{class:'ui-muted',id:'taskDecomposeHint'},'也可以在左侧「自动生成 / 导演」里找到同名按钮。'));
markStep(0);
go.addEventListener('click',function(){
if(!window.MangaPageDecompose){toast('拆解还没准备好','请稍等页面加载完再试。',true);return;}
markStep(1);
MangaPageDecompose.pickAndDecompose();
markStep(2);
});
gen.addEventListener('click',function(){
if(!window.MangaPageDecompose){toast('拆解还没准备好','请稍等页面加载完再试。',true);return;}
if(!window.NaiEngine||!NaiEngine.configured()){toast('需要 NovelAI Token','请先在「服务设置」里填写。',true);return;}
markStep(1);
MangaPageDecompose.generateAndDecompose().then(function(){markStep(2);}).catch(function(e){toast('整页生成失败',e&&e.message||String(e),true);});
});
}
function startStory(t){
var body=card(t);
body.appendChild(el('p',{class:'ui-muted'},'在「剧情」里写对白和场面，点「生成漫画分镜」。默认开启批量导演（一次规划整页）；可在浏览器控制台设 localStorage mnai.batchDirector=\'0\' 关闭。'));
var open=el('button',{type:'button',class:'ui-btn ui-btn-primary',id:'taskStoryOpen'},'打开剧情面板');
body.appendChild(open);
markStep(0);
open.addEventListener('click',function(){
markStep(1);
var area=$('intro_simulator-chat-area')||$('simulator-chat-area');
if(area&&typeof toggleVisibility==='function'&&getComputedStyle(area).display==='none')toggleVisibility(area.id||'simulator-chat-area');
else if(area){area.scrollIntoView({block:'nearest'});}
var btn=$('storyComposerMakeManga')||document.querySelector('[id*="MakeManga"],[id*="storyComposer"]');
if(btn){markStep(2);toast('剧情出分镜','在剧情面板写完后点「生成漫画分镜」。');}
else toast('剧情出分镜','请在左侧打开「剧情」，写完后点「生成漫画分镜」。');
});
}
function startNai(t){
var body=card(t);
var token=(($('novelaiApiKey')||{}).value||'').trim();
if(!token){
markStep(0);
body.innerHTML='<p>AI 生图用的是 NovelAI，需要先填 Token（测试连接不花 Anlas）。</p>';
var b=el('button',{type:'button',class:'ui-btn ui-btn-primary',id:'taskNaiSettings'},'去填 Token');
b.addEventListener('click',function(){if(window.ServiceSettings)ServiceSettings.open('novelai');});
body.appendChild(b);
return;
}
markStep(1);
body.innerHTML='<p>已为你打开左侧「自动生成」面板。写好画面描述后点生成；花 Anlas 之前会先提示。</p>';
var area=$('auto-generate-area');
if(area&&getComputedStyle(area).display==='none'){var icon=document.querySelector('#sidebar [data-target="auto-generate-area"]');if(icon)icon.click();}
}

// 分层: drag a box on the page, then cut it out into a new layer with the existing local cutout
var pick=null;
function cancelPick(){if(pick){pick.remove();pick=null;}}
function startLayer(t){
var body=card(t);
markStep(0);
var go=el('button',{type:'button',class:'ui-btn ui-btn-primary',id:'taskLayerPick'},'开始框选');
body.appendChild(go);
// whole panels: detected automatically (white gutters), each one toggleable before splitting
var byPanel=el('button',{type:'button',class:'ui-btn',id:'taskLayerPanels'},'按格子拆成图层');
body.appendChild(byPanel);
body.appendChild(el('p',{class:'ui-muted',id:'taskLayerStatus'},'白底或纯色背景效果最好；本机抠图服务开着时会用神经网络抠图。'));
go.addEventListener('click',beginPick);
byPanel.addEventListener('click',function(){
if(!window.PanelAuto)return;
var st=$('taskLayerStatus');
PanelAuto.splitToLayers({status:function(t){if(st)st.textContent=t;}}).then(function(n){if(n){active.applied=(active.applied||0)+1;markStep(2);}});
});
}
function beginPick(){
cancelPick();
if(typeof canvas==='undefined'||!canvas||!canvas.upperCanvasEl)return;
var r=canvas.upperCanvasEl.getBoundingClientRect();
pick=el('div',{class:'task-pick',id:'taskLayerOverlay'});
pick.style.cssText='position:fixed;left:'+r.left+'px;top:'+r.top+'px;width:'+r.width+'px;height:'+r.height+'px;';
var box=el('div',{class:'task-pick-box'});pick.appendChild(box);
document.body.appendChild(pick);
var start=null;
setLayerStatus('在画布上按住鼠标拖一个框（Esc 取消）。');
pick.addEventListener('pointerdown',function(e){start={x:e.clientX,y:e.clientY,ev:e};pick.setPointerCapture(e.pointerId);});
pick.addEventListener('pointermove',function(e){
if(!start)return;
var x=Math.min(start.x,e.clientX)-r.left,y=Math.min(start.y,e.clientY)-r.top;
box.style.cssText='left:'+x+'px;top:'+y+'px;width:'+Math.abs(e.clientX-start.x)+'px;height:'+Math.abs(e.clientY-start.y)+'px;display:block';
});
pick.addEventListener('pointerup',function(e){
if(!start)return;
var a=canvas.getPointer(start.ev),b=canvas.getPointer(e);
start=null;
cancelPick();
var rect={left:Math.min(a.x,b.x),top:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)};
cutRect(rect);
});
}
function setLayerStatus(t,isError){var s=$('taskLayerStatus');if(s){s.textContent=t;s.classList.toggle('is-error',!!isError);}}
function cutRect(rect){
if(!(rect.width>4&&rect.height>4)){setLayerStatus('框太小了，请重新框选。',true);return;}
var cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
var images=canvas.getObjects().filter(function(o){return o.type==='image'&&o.visible!==false;});
var hit=images.slice().reverse().filter(function(o){var b=o.getBoundingRect(true,true);return cx>=b.left&&cx<=b.left+b.width&&cy>=b.top&&cy<=b.top+b.height;})[0];
if(!hit){setLayerStatus('框里没有图片，请框在漫画页上。',true);return;}
var client=window.NaiBackgroundRemovalClient;
if(!client||!client.processRegion){setLayerStatus('抠图模块还没准备好。',true);return;}
markStep(1);
setLayerStatus('正在抠图…');
client.processRegion(hit,rect,'new').then(function(){
markStep(2,true);
setLayerStatus('完成：已放到新图层，原图不变（Ctrl+Z 可撤销）。可以再框一个。');
}).catch(function(error){setLayerStatus('没抠成：'+(error&&error.message||error),true);});
}
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&pick){e.preventDefault();cancelPick();setLayerStatus('已取消框选。');}},true);

// 画一页漫画: layout + batch panel generation + automatic dialogue bubbles (one click instead of
// ~10 per panel: new page, template, open GPT, switch mode, prompt, generate, apply, fit into panel, bubble, text)
var LAYOUTS={
1:[[0,0,1,1]],
2:[[0,0,1,.5],[0,.5,1,.5]],
3:[[0,0,1,.42],[0,.42,.5,.58],[.5,.42,.5,.58]],
4:[[0,0,1,.3],[0,.3,.55,.35],[.55,.3,.45,.35],[0,.65,1,.35]],
5:[[0,0,1,.3],[0,.3,.5,.36],[.5,.3,.5,.36],[0,.66,.6,.34],[.6,.66,.4,.34]],
6:[[0,0,.5,.33],[.5,0,.5,.33],[0,.33,.5,.34],[.5,.33,.5,.34],[0,.67,.5,.33],[.5,.67,.5,.33]]
};
// scene i goes into the i-th frame in reading order (manga: right to left), not in table order
function readingSorted(rects){
if(!window.BalloonLayoutCore)return rects;
var ord=BalloonLayoutCore.readingOrder(rects.map(function(r){return {x:r.left,y:r.top,w:r.width,h:r.height};}),window.BalloonLayout?BalloonLayout.dir():'rtl');
return ord.map(function(i){return rects[i];});
}
function layoutRects(n,w,h){
if(window.PageLayoutCore&&n>=1&&n<=6){
var P=window.PageLayoutCore,v2=P.v2Enabled(),recent=window.__pageLayoutRecent=window.__pageLayoutRecent||[];
var r=P.cells(n,{width:w,height:h,dir:'ltr',recent:v2?recent:[]});recent.push(r.code);
// dir ltr = table order; readingSorted() applies the user's reading direction afterwards, as before
var byTable=P.TEMPLATES[r.id].r.map(function(c){var m=.04*Math.min(w,h),g=.012*Math.min(w,h),iw=w-2*m,ih=h-2*m;return {left:Math.round(m+c[0]*iw+g/2),top:Math.round(m+c[1]*ih+g/2),width:Math.round(c[2]*iw-g),height:Math.round(c[3]*ih-g)};});
return byTable;
}
var m=.04*Math.min(w,h),g=.012*Math.min(w,h);
var iw=w-2*m,ih=h-2*m;
return (LAYOUTS[n]||LAYOUTS[3]).map(function(c){
return {left:Math.round(m+c[0]*iw+g/2),top:Math.round(m+c[1]*ih+g/2),width:Math.round(c[2]*iw-g),height:Math.round(c[3]*ih-g)};
});
}
// One single picture per frame: asking for a "漫画分镜" made the model draw a whole multi-panel page in one frame.
function pagePrompt(style,scene){
return (style?style+'。':'')+'只画一个完整的单幅画面（这是漫画里的一格，但画面本身不要再分格、不要画边框、不要画对白框或任何文字）。画面内容：'+scene;
}
function sizeFor(r){var a=r.width/r.height;return a>1.2?'1536x1024':a<.83?'1024x1536':'1024x1024';}
var pageJob=null,pageLayout=null;
function startPage(t){
var body=card(t);
markStep(0);
body.innerHTML='<div class="svc-row" role="radiogroup" aria-label="格子数">'+
'<button type="button" class="ui-btn" data-panels="3" id="taskPage3">3 格</button>'+
'<button type="button" class="ui-btn" data-panels="4" id="taskPage4">4 格</button></div>'+
'<label class="ui-field"><span>统一画风 / 角色（每格都会用）</span><input id="taskPageStyle" type="text" data-nai-prompt="style tags shared by every panel" value="黑白日式漫画，清晰线稿，网点阴影，安全健康内容"></label>'+
'<details class="task-script" id="taskScriptBox"><summary>粘贴剧本，自动分格</summary>'+
'<textarea class="ui-textarea" id="taskScript" rows="6" placeholder="例如：&#10;第1格：清晨的车站，小雪在等车&#10;小雪：今天也要加油！&#10;第2格：列车进站&#10;旁白：列车准时到了。&#10;（不写「第N格」时，用空行分开每一格）"></textarea>'+
'<div class="svc-row"><button type="button" class="ui-btn" id="taskScriptSplit">拆成格子</button><button type="button" class="ui-btn ui-btn-ghost" id="taskScriptNext" hidden>下一页剧本</button></div>'+
'<p class="ui-muted" id="taskScriptInfo" role="status"></p></details>'+
'<div id="taskPagePanels"></div>'+
'<div class="task-engines" id="taskPageEngines" role="radiogroup" aria-label="用哪个 AI 画"><span class="ui-muted">用</span>'+
'<button type="button" class="ui-btn" role="radio" data-eng="gpt">GPT</button><button type="button" class="ui-btn" role="radio" data-eng="nai">NovelAI</button>'+
'<label class="ui-muted" title="每格及后续页复用保存的系列种子；种子不能保证人物一致"><input type="checkbox" id="taskPageSeedLock"'+(pageSeedLocked()?' checked':'')+'> 复用系列种子</label>'+
'<button type="button" class="ui-btn ui-btn-ghost" id="taskPageNewSeries" title="重置系列种子和承接人物，保留剧本与每格输入">新系列</button>'+
'<span class="task-engine-cost" id="taskPageEngineCost"></span></div>'+
'<p class="ui-muted" id="taskPageCost"></p>'+
'<p class="ui-muted" id="taskPageReferences">每格「出场人物」可指定角色或选空镜。自动承接只按文字推断，请核对每格人物名单。角色档案的外观与标签会作为文字约束；当前整页 NovelAI 路径不发送角色参考图片，仍需逐格检查一致性。</p>'+
'<div class="svc-row"><button type="button" class="ui-btn ui-btn-primary" id="taskPageGo" disabled>生成整页</button>'+
'<button type="button" class="ui-btn" id="taskPageCancel" hidden>停止</button></div>'+
'<p id="taskPageStatus" role="status" class="ui-muted"></p>';
body.querySelectorAll('[data-panels]').forEach(function(b){b.addEventListener('click',function(){pageLayout=null;choosePanels(Number(b.dataset.panels));});});
pageLayout=null;
// the open page already has panels (white gutters) → offer its layout for the new page
if(window.PanelAuto&&canvas.getObjects().some(function(o){return o.type==='image';}))PanelAuto.get().then(function(r){
var n=r.panels.length;if(n<2||n>8||!$('taskPage3'))return;
var b=el('button',{type:'button',class:'ui-btn',id:'taskPageDetected','data-panels':String(n),title:'新的一页用和当前页一样的分格'},'照本页格子（'+n+' 格）');
$('taskPage4').parentNode.appendChild(b);
b.addEventListener('click',function(){pageLayout=r;choosePanels(n);});
}).catch(function(){});
$('taskPageGo').addEventListener('click',runPage);
$('taskPageNewSeries').addEventListener('click',newPageSeries);
$('taskPageSeedLock').addEventListener('change',function(e){try{localStorage.setItem('mnai.page.seedLock',e.target.checked?'1':'0');}catch(error){/* session only */}});
body.querySelectorAll('[data-eng]').forEach(function(b){b.addEventListener('click',function(){setPageEngine(b.dataset.eng,true);});});
setPageEngine(window.NaiEngine?NaiEngine.preferred('page',!!($('mangaGptUrl')&&$('mangaGptUrl').value.trim())):'gpt',false);
$('taskScriptSplit').addEventListener('click',function(){applyScript($('taskScript').value);});
$('taskScriptNext').addEventListener('click',function(){fillScriptPage(scriptQueue.shift());});
$('taskPageCancel').addEventListener('click',function(){if(pageJob)pageJob.cancel=true;if(pageJob&&pageJob.ctl)pageJob.ctl.abort();});
if(window.CharacterLibrary&&CharacterLibrary.loadCards)CharacterLibrary.loadCards().then(function(){if($('taskWizardBody')===body)refreshCastChoices();}).catch(function(){pageStatus('角色档案加载失败，请重新打开任务后重试。',true);});
}
function pageSeedLocked(){try{return localStorage.getItem('mnai.page.seedLock')==='1';}catch(error){return false;}}
var seriesSeed=null;
function pageSeriesSeed(){
if(seriesSeed==null){try{var saved=localStorage.getItem('mnai.page.seriesSeed');if(saved!==null&&/^\d+$/.test(saved)&&Number(saved)<=4294967295)seriesSeed=Number(saved);}catch(error){/* session only */}}
if(seriesSeed==null){seriesSeed=Math.floor(Math.random()*4294967295);try{localStorage.setItem('mnai.page.seriesSeed',String(seriesSeed));}catch(error){/* session only */}}
return seriesSeed;
}
function newPageSeries(){
if(pageJob){toast('正在生成','请先完成或停止本页，再开始新系列。',true);return false;}
seriesSeed=null;try{localStorage.removeItem('mnai.page.seriesSeed');localStorage.removeItem('mnai.page.cast');}catch(error){/* session only */}
pageSeriesSeed();updateCastPreview();toast('已开始新系列','系列种子与承接人物已重置，剧本和每格输入已保留。');return true;
}
function sceneCast(scene,lib,previous){
scene=String(scene||'');
if(/空镜|空无一人|无人(?=[，。！？、\s]|$)|没有人物|没有人|只有(?:风景|背景)|no (?:people|characters)|empty (?:shot|station|room|scene)|(?:scenery|landscape) only/i.test(scene))return [];
var absent=lib.filter(function(c){var name=String(c.name||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return name&&new RegExp('(?:没有|无|不含|不画|without |no )'+name+'|'+name+'(?:不在|缺席|不出现|不出场|离开画面| absent| offscreen)','i').test(scene);});
var named=lib.filter(function(c){return c.name&&scene.indexOf(c.name)>=0&&absent.indexOf(c)<0;}).sort(function(a,b){return scene.indexOf(a.name)-scene.indexOf(b.name);});
return (named.length?named:(previous||[]).filter(function(c){return absent.indexOf(c)<0;})).slice(0,4);
}
// Text anchors survive pronouns and name-free follow-up actions. Scene text controls
// positions: reading order or library order must never imply character coordinates.
function libraryCharacters(scene,lib,previous){
lib=lib||(window.CharacterLibrary&&CharacterLibrary._state&&CharacterLibrary._state.cards)||[];
return sceneCast(scene,lib,previous).map(function(c){var dna=window.MangaCharacterBibleCore&&MangaCharacterBibleCore.dnaTags?MangaCharacterBibleCore.dnaTags(c):'';return {prompt:NaiEngineCore.joinTags(NaiEngineCore.joinTags(c.identity&&c.identity.tags,dna),c.traits)};}).filter(function(c){return c.prompt;});
}
function castSelections(){
var roles=Array.from(document.querySelectorAll('#taskPagePanels [data-cast-role]'));
var result={};document.querySelectorAll('#taskPagePanels [data-cast-mode]').forEach(function(select){var i=select.dataset.castMode;result[i]={mode:select.value,ids:roles.filter(function(x){return x.checked&&x.dataset.castPanel===i;}).map(function(x){return x.dataset.castRole;})};});return result;
}
function pageCasts(scenes,lib,selection){
var previous=[];try{var ids=JSON.parse(localStorage.getItem('mnai.page.cast')||'[]');previous=lib.filter(function(c){return ids.indexOf(c.id)>=0;});}catch(error){/* no prior cast */}
return scenes.map(function(scene,i){var chosen=selection[i]||{mode:'auto'};previous=chosen.mode==='none'?[]:chosen.mode==='manual'?lib.filter(function(c){return chosen.ids.indexOf(c.id)>=0;}):sceneCast(scene,lib,previous);return previous;});
}
function updateCastPreview(){
var lib=window.CharacterLibrary&&CharacterLibrary._state&&CharacterLibrary._state.cards||[];
var scenes=Array.from(document.querySelectorAll('#taskPagePanels [data-scene]')).map(function(x){return x.value;});
var casts=pageCasts(scenes,lib,castSelections());
document.querySelectorAll('#taskPagePanels [data-cast-summary]').forEach(function(out){var cast=casts[Number(out.dataset.castSummary)]||[];out.textContent='本格人物：'+(cast.length?cast.map(function(c){return c.name;}).join('、'):'空镜 / 未推断出人物');});
}
function refreshCastChoices(){
var lib=window.CharacterLibrary&&CharacterLibrary._state&&CharacterLibrary._state.cards||[];
document.querySelectorAll('#taskPagePanels [data-cast-choices]').forEach(function(box){
var selected=Array.from(box.querySelectorAll('input')).filter(function(x){return x.checked;}).map(function(x){return x.dataset.castRole;});box.innerHTML='';
lib.forEach(function(c){var label=el('label',{class:'ui-muted'}),input=el('input',{type:'checkbox','data-cast-panel':box.dataset.castChoices,'data-cast-role':c.id});input.checked=selected.indexOf(c.id)>=0;label.appendChild(input);var text=el('span');text.textContent=c.name;label.appendChild(text);box.appendChild(label);
input.addEventListener('change',function(){var select=document.querySelector('#taskPagePanels [data-cast-mode="'+box.dataset.castChoices+'"]');if(select)select.value='manual';updateCastPreview();});});
});updateCastPreview();
}
var pageEngine='gpt';
var GPT_STYLE='黑白日式漫画，清晰线稿，网点阴影，安全健康内容',NAI_STYLE='monochrome, greyscale, manga, screentone, clean lineart';
function setPageEngine(v,user){
pageEngine=v==='nai'?'nai':'gpt';if(user&&window.NaiEngine)NaiEngine.remember('page',pageEngine);
document.querySelectorAll('#taskPageEngines [data-eng]').forEach(function(b){var on=b.dataset.eng===pageEngine;b.classList.toggle('is-active',on);b.setAttribute('aria-checked',String(on));});
var st=$('taskPageStyle');if(st&&(st.value===GPT_STYLE||st.value===NAI_STYLE))st.value=pageEngine==='nai'?NAI_STYLE:GPT_STYLE;
if(st)st.parentNode.querySelector('span').textContent=pageEngine==='nai'?'统一画风 / 角色标签（每格都会用，英文标签效果最好）':'统一画风 / 角色（每格都会用）';
updatePageCost();
}
function updatePageCost(){
var n=document.querySelectorAll('#taskPagePanels [data-scene]').length,c=$('taskPageEngineCost'),t=$('taskPageCost');
if(c){c.textContent='';c.dataset.free='';}
if(t&&n)t.textContent=(pageEngine==='nai'?'会调用 NovelAI '+n+' 次（每格一次，按格子比例出图，一张一张排队）。':'会调用 GPT 图像 '+n+' 次（每格一次）。')+'生成的每一格、气泡和文字都是独立图层，可单独修改或撤销。';
if(pageEngine!=='nai'||!c||!window.NaiEngine)return;
if(!NaiEngine.configured()){c.textContent='NovelAI 还没配置：点「生成整页」会打开「服务设置」。';return;}
NaiEngine.costText({width:3,height:4},Math.max(1,n)).then(function(r){c.textContent=(n?n+' 格 · ':'每格 · ')+r.text.replace(/ · \d+×\d+/,'');c.dataset.free=String(r.free);});
}
var scriptQueue=[];
function applyScript(text){
var info=$('taskScriptInfo');
if(!window.ScriptPageCore){info.textContent='剧本拆分还没加载好，请稍等再试。';return;}
var r=ScriptPageCore.parse(text);
if(!r.stats.panels){info.textContent='没读到内容。每格写一行画面，对白写成「名字：台词」；格子之间用空行或「第N格」分开。';info.classList.add('is-error');return;}
info.classList.remove('is-error');
scriptQueue=r.pages.slice(1);
fillScriptPage(r.pages[0]);
info.textContent='拆好了：'+r.stats.pages+' 页、'+r.stats.panels+' 格、'+r.stats.lines+' 句对白。'+(r.pages.length>1?'这一页先做第 1 页，做完点「下一页剧本」。':'')+(r.warnings.length?' 注意：'+r.warnings.join(' '):'');
window.__lastScript=r;
}
function fillScriptPage(pg){
if(!pg)return;
pageLayout=null;choosePanels(pg.panels.length);
pg.panels.forEach(function(p,i){var w=ScriptPageCore.toWizard(p);var a=document.querySelector('#taskPagePanels [data-scene="'+i+'"]'),b=document.querySelector('#taskPagePanels [data-line="'+i+'"]');if(a)a.value=w.scene;if(b){b.value=w.line;if(b.dataset&&ScriptPageCore.wizardLines)b.dataset.scriptLines=JSON.stringify(ScriptPageCore.wizardLines(p));}});
updateCastPreview();
var nx=$('taskScriptNext');if(nx){nx.hidden=!scriptQueue.length;nx.textContent='下一页剧本（还剩 '+scriptQueue.length+' 页）';}
}
function choosePanels(n){
document.querySelectorAll('#taskWizardBody [data-panels]').forEach(function(b){b.classList.toggle('is-active',Number(b.dataset.panels)===n);b.setAttribute('aria-pressed',String(Number(b.dataset.panels)===n));});
var box=$('taskPagePanels');box.innerHTML='';
box.hidden=false;if($('taskPageEdit'))$('taskPageEdit').hidden=true;
for(var i=0;i<n;i++){
var f=el('fieldset',{class:'task-page-panel'});
f.innerHTML='<legend>第 '+(i+1)+' 格</legend>'+
'<textarea class="ui-textarea" rows="2" data-nai-prompt="one manga panel" data-scene="'+i+'" placeholder="画面，例如：清晨，少女在车站等车"></textarea>'+
'<input class="ui-textarea" type="text" data-line="'+i+'" placeholder="对白（可不填；多句用 / 分开）">'+
'<label class="ui-field"><span>出场人物</span><select class="ui-input" data-cast-mode="'+i+'"><option value="auto">自动承接（核对下方名单）</option><option value="none">空镜 / 无人</option><option value="manual">指定人物（勾选下方角色）</option></select></label><div class="svc-row" data-cast-choices="'+i+'"></div><p class="ui-muted" data-cast-summary="'+i+'"></p>';
box.appendChild(f);
}
box.querySelectorAll('[data-scene]').forEach(function(input){input.addEventListener('input',updateCastPreview);});
box.querySelectorAll('[data-cast-mode]').forEach(function(select){select.addEventListener('change',updateCastPreview);});
refreshCastChoices();
$('taskPageGo').disabled=false;
updatePageCost();
markStep(1);
}
function collapseForm(){
// after a page is done, fold the form so the card stops covering the page
var box=$('taskPagePanels');if(!box)return;
box.hidden=true;
var more=$('taskPageEdit');
if(!more){more=el('button',{type:'button',class:'ui-btn ui-btn-ghost',id:'taskPageEdit'},'展开每格内容');box.parentNode.insertBefore(more,box);
more.addEventListener('click',function(){box.hidden=!box.hidden;more.textContent=box.hidden?'展开每格内容':'收起每格内容';});}
more.hidden=false;more.textContent='展开每格内容';
}
function pageStatus(t,isError){var s=$('taskPageStatus');if(s){s.textContent=t;s.classList.toggle('is-error',!!isError);}}
// Frames must be polygons: image clipping (updateClipPath) follows polygon points, a Rect is not clipped.
function makePanel(r,index){
var p=new fabric.Polygon([{x:r.left,y:r.top},{x:r.left+r.width,y:r.top},{x:r.left+r.width,y:r.top+r.height},{x:r.left,y:r.top+r.height}],{
fill:'#ffffff',stroke:'#000000',strokeWidth:3,strokeUniform:true,objectCaching:false,isPanel:true,name:'分镜 '+index});
if(typeof setText2ImageInitPrompt==='function')setText2ImageInitPrompt(p);
if(typeof setPanelValue==='function')setPanelValue(p);
if(typeof getGUID==='function')getGUID(p);
return p;
}
function loadFabricImage(url){return new Promise(function(res,rej){fabric.Image.fromURL(url,function(img){if(img&&img.width)res(img);else rej(new Error('图片读取失败。'));});});}
async function runPage(){
if(pageJob||exporting)return;
var scenes=Array.prototype.map.call(document.querySelectorAll('#taskPagePanels [data-scene]'),function(x){return x.value.trim();});
var lines=Array.prototype.map.call(document.querySelectorAll('#taskPagePanels [data-line]'),function(x){return x.value.trim();});
if(!scenes.length)return pageStatus('先选 3 格或 4 格。',true);
var empty=scenes.indexOf('');
if(empty>=0)return pageStatus('第 '+(empty+1)+' 格还没写画面。',true);
var style=($('taskPageStyle').value||'').trim();
var selection=castSelections();
var engine=pageEngine;
if(engine==='nai'&&!(window.NaiEngine&&NaiEngine.configured())){pageStatus('NovelAI 还没配置：已打开「服务设置」，填好 Token 后再点「生成整页」。',true);if(window.ServiceSettings)ServiceSettings.ensureReady('novelai');return;}
var goBtn=$('taskPageGo'),cancelBtn=$('taskPageCancel'),statusNode=$('taskPageStatus');
var job={cancel:false,ctl:null,canvas:canvas,guid:typeof getCanvasGUID==='function'?getCanvasGUID():null};pageJob=job;
function samePage(){return canvas===job.canvas&&(typeof getCanvasGUID!=='function'||getCanvasGUID()===job.guid);}
function sameTarget(){return samePage()&&(!job.panels||job.panels.every(function(p){return canvas.getObjects().indexOf(p)>=0;}));}
function current(){return !job.cancel&&pageJob===job&&sameTarget();}
function status(text,err){if($('taskPageStatus')===statusNode)pageStatus(text,err);}
var key=(($('mangaGptKey')||{}).value||'').trim().replace(/^Bearer\s+/i,'');
var gptUrl=(($('mangaGptUrl')||{}).value||'').trim(),gptModel=(($('mangaGptModel')||{}).value||'').trim();
var settings=engine==='nai'?{model:NaiEngine.modelId(),ucPreset:Number((($('novelaiUcPreset')||{}).value)||0),quality:!$('novelaiQualityToggle')||$('novelaiQualityToggle').checked,safeMode:NaiEngine.safeMode(),preservePositiveStyle:true}:{};
var lockSeed=$('taskPageSeedLock')&&$('taskPageSeedLock').checked?pageSeriesSeed():null;
var layout=pageLayout?JSON.parse(JSON.stringify(pageLayout)):null;
// say 'checking' synchronously so a stale '整页完成' never stands for this click while settings are checked
status('正在检查服务设置…');if(goBtn)goBtn.disabled=true;if(cancelBtn)cancelBtn.hidden=false;
try{
var gptOk=engine!=='gpt'||!window.ServiceSettings||await ServiceSettings.ready('gpt');
if(!current())return;
if(!gptOk){status('GPT 还没配置：已打开「服务设置」。也可以点上面的「NovelAI」改用 NovelAI。',true);ServiceSettings.ensureReady('gpt');return;}
var lib=window.CharacterLibrary&&CharacterLibrary.loadCards?await CharacterLibrary.loadCards():[];
if(!current())return;
lib=(lib||[]).map(function(c){return {id:c.id,name:c.name,traits:c.traits,identity:{tags:c.identity&&c.identity.tags}};});
var casts=pageCasts(scenes,lib,selection),previous=casts[casts.length-1]||[];
var characters=casts.map(function(cast){return libraryCharacters('',lib,cast);});
markStep(2);
var W=canvas.getWidth()/(canvas.getZoom()||1),H=canvas.getHeight()/(canvas.getZoom()||1);
if(!(W>200&&H>200)){W=1200;H=1700;}
if(canvas.getObjects().length&&typeof loadBookSize==='function'){
status('正在新建一页…');
await loadBookSize(1200,1700,false,true);
job.canvas=canvas;job.guid=typeof getCanvasGUID==='function'?getCanvasGUID():null;
if(!current())return;
W=1200;H=1700;
}else if(!canvas.getObjects().length&&typeof resizeCanvasToObject==='function'){W=1200;H=1700;resizeCanvasToObject(W,H);}
var rects=layout&&layout.panels.length===scenes.length?
layout.panels.map(function(q){var kx=W/layout.W,ky=H/layout.H;return {left:Math.round(q.x*kx),top:Math.round(q.y*ky),width:Math.round(q.w*kx),height:Math.round(q.h*ky)};}):
layoutRects(scenes.length,W,H);
rects=readingSorted(rects);
// the whole generated page is ONE history step: one Ctrl+Z takes it all back
if(typeof changeDoNotSaveHistory==='function'){changeDoNotSaveHistory();job.historyPaused=true;}
var panels=rects.map(function(r,i){var p=makePanel(r,i+1);canvas.add(p);return p;});
job.panels=panels;
canvas.renderAll();
if(engine!=='nai'&&window.ProviderRoute)window.ProviderRoute.notice('gpt');
var done=0,failed=[];
// Anlas guard for the batch (AUDIT-v2 #10): on the free tier the balance must not drop; stop the queue if it does.
var anlasFree=false,anlasPrev=null;
if(engine==='nai'&&window.NaiEngine&&NaiEngine.subscription){try{anlasFree=!!(await NaiEngine.costText({width:rects[0].width,height:rects[0].height},1)).free;anlasPrev=await NaiEngine.subscription(true);}catch(e){}}
for(var i=0;i<rects.length;i++){
if(!current())break;
status('正在画第 '+(i+1)+' / '+rects.length+' 格…');
job.ctl=new AbortController();
try{
var naiPrompt=NaiEngineCore.joinTags(style,scenes[i]);
if(engine==='nai'&&!NaiEngineCore.features(settings.model).characters)naiPrompt=NaiEngineCore.joinTags(naiPrompt,characters[i].map(function(c){return c.prompt;}).join(', '));
var data=engine==='nai'?await NaiEngine.run(Object.assign({},settings,{prompt:naiPrompt,characters:characters[i],width:rects[i].width,height:rects[i].height,seed:lockSeed==null?undefined:lockSeed}),job.ctl.signal,status):
await ServiceRequest.request('gpt','/gpt-image-proxy',{signal:job.ctl.signal,timeoutMs:300000,headers:key?{Authorization:'Bearer '+key}:{},
body:{operation:'generate',baseUrl:gptUrl,model:gptModel,size:sizeFor(rects[i]),
prompt:pagePrompt(style,scenes[i])+(characters[i].length?'\n本格人物须保持这些外观与服装特征：'+characters[i].map(function(c){return c.prompt;}).join('；'):'')}});
if(!current())break;
var img=await loadFabricImage(data.image);
if(!current())break;
img.name='第'+(i+1)+'格画面';if(data.seed!=null){img.naiSeed=data.seed;img.tempSeed=data.seed;img.tempPrompt=NaiEngineCore.joinTags(style,scenes[i]);}
putImageInFrame(img,rects[i].left+rects[i].width/2,rects[i].top+rects[i].height/2,true,false,true,panels[i]);
done++;
if(anlasFree&&window.MangaPageDecomposeCore){var anlasNow=await NaiEngine.subscription(true),ag=MangaPageDecomposeCore.anlasGuard(anlasPrev&&anlasPrev.anlas,anlasNow&&anlasNow.anlas,true);anlasPrev=anlasNow;if(ag.stop){status(ag.message,true);break;}}
}catch(error){if(error.name==='AbortError')job.cancel=true;if(!current())break;failed.push(i+1);var em=error.userMessage||error.message||'';status('第 '+(i+1)+' 格没画成：'+(engine==='gpt'&&window.NaiEngine&&NaiEngine.isRefusal(em)?'这个 GPT 服务按它自己的内容规则拒绝了这一格（不是本编辑器的限制）。可以点上面的「NovelAI」改用 NovelAI 再生成。':em),true);if(engine==='gpt'&&window.NaiEngine&&NaiEngine.isRefusal(em))job.refused=true;if(error.status===401||error.network||engine==='nai')break;}
canvas.renderAll();
}
if(!sameTarget())return;
if(lines.some(Boolean)&&current()&&window.BalloonLayout){
status('正在排对白气泡（避开人脸，按阅读顺序）…');
try{var info=await BalloonLayout.analyze();if(!current())return;var bl=await BalloonLayout.layoutPage(rects,lines,info);window.__lastBalloonLayout=bl;if(BalloonLayout.recheck)BalloonLayout.recheck(lines).then(function(rc){window.__lastLetteringRecheck=rc;var msg=BalloonLayout.recheckMessage(rc);if(msg&&current())status(msg);});}
catch(error){status('对白气泡没排好：'+(error.message||error),true);}
}
if(!sameTarget())return;
if(typeof updateLayerPanel==='function')updateLayerPanel();
if(job.historyPaused&&typeof changeDoSaveHistory==='function'){changeDoSaveHistory();job.historyPaused=false;}
if(typeof saveStateByManual==='function')saveStateByManual();
// register/refresh this page in the page bar now (otherwise it only appears once another page is made)
if(typeof btmSaveProjectFile==='function'){try{await btmSaveProjectFile(null,false);}catch(e){/* thumbnail is best-effort */}}
if(!sameTarget())return;
if(job.cancel)status('已停止：画好 '+done+' 格。');
else if(failed.length)status('画好 '+done+' 格；第 '+failed.join('、')+' 格没成功，'+(job.refused?'GPT 服务按它自己的内容规则拒绝了（不是本编辑器的限制），可以点上面的「NovelAI」改用 NovelAI 再生成。':'可以用「改一块」→「自由修改」重画那一格。'),true);
else{try{localStorage.setItem('mnai.page.cast',JSON.stringify(previous.map(function(c){return c.id;})));}catch(error){/* session only */}collapseForm();status('整页完成：'+done+' 格画面和对白气泡都是独立图层，可直接拖动或修改（Ctrl+Z 可撤销）。');markStep(3,true);}
}catch(error){if(!job.cancel)status('整页生成失败：'+(error.message||error),true);
}finally{
if(job.historyPaused&&typeof changeDoSaveHistory==='function'){changeDoSaveHistory();if(samePage()&&typeof saveStateByManual==='function')saveStateByManual();}
if(pageJob===job)pageJob=null;
if(goBtn)goBtn.disabled=false;if(cancelBtn)cancelBtn.hidden=true;
}
}

// ---------- progress ----------
function tick(){
if(!active)return;
if(active.kind==='aifill'){if(!window.AiFill||!AiFill.isOpen())stop(false);return;}
if(active.kind==='gpt'&&window.MangaGPTRegionEditor){
var s=MangaGPTRegionEditor.wizardState();
if(!s.open||s.task!==active.id){stop(false);return;}
var t=task(active.id);
var n;
if(s.applied>active.startApplied)n=-1;
else if(s.result)n=t.steps.length-1;
else if(!s.region)n=0;
else if(active.id==='swap')n=s.references?2:1;
else if(active.id==='custom')n=($('mangaGptPrompt').value.trim()?2:1);
else n=1;
if(n<0)markStep(0,true);else markStep(n);
}else if(active.kind==='caption'&&window.MangaSmartTextEditor){
var p=MangaSmartTextEditor.progress();
if(!p.open){stop(false);return;}
// page switched with 改字幕 open: that page's own drafts (cached, or read now)
var gid=typeof getCanvasGUID==='function'?getCanvasGUID():null;
if(active.captionPage&&gid&&gid!==active.captionPage&&!p.busy&&MangaSmartTextEditor.ensure){active.captionPage=null;var a0=active;MangaSmartTextEditor.ensure().then(function(){if(active===a0)active.captionPage=getCanvasGUID();});}
if(p.applied>active.startApplied)markStep(0,true);else markStep(p.drafts?1:0);
}
}

// Dogfood: exporting 4 pages took 18 clicks (展开页面→选页→文件→下载图片 per page, then 保存项目).
// One button: every page as PNG (page-bar order) + the merged project, in one zip; then back to the page you were on.
function pageOrder(){
var ids=Array.from(document.querySelectorAll('#btm-image-container .btm-image')).map(function(i){return i.dataset.index;}).filter(function(g){return btmProjectsMap.has(g);});
btmProjectsMap.forEach(function(v,k){if(ids.indexOf(k)<0)ids.push(k);});
return ids;
}
function dataUrlBytes(u){var b=atob(String(u).split(',')[1]||'');var a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return a;}
var exporting=false;
async function exportAll(){
if(exporting)return null;
if(pageJob){toast('正在画一页','请先完成或停止生成，再导出页面。',true);return null;}
if(typeof btmProjectsMap==='undefined'||typeof JSZip==='undefined'){toast('导出全部','页面还没加载完，请稍等再试。',true);return null;}
if(!hasPage()&&!btmProjectsMap.size){toast('没有可导出的页面','先导入图片或用「画一页漫画」做一页。',true);return null;}
exporting=true;var btn=$('taskExportAll');if(btn)btn.disabled=true;
var back=typeof getCanvasGUID==='function'?getCanvasGUID():null;
try{
if(hasPage())await btmSaveProjectFile(null,false);
var ids=pageOrder(),zip=new JSZip(),n=0;
for(var i=0;i<ids.length;i++){
if(ids.length>1||ids[i]!==back)await chengeCanvasByGuid(ids[i],false);
if(typeof removeGrid==='function')removeGrid();
var link;try{link=await ImageUtil.getCropAndDownloadLink('png');}finally{if(typeof restoreGridAfterExport==='function')restoreGridAfterExport();}
zip.file('page-'+String(i+1).padStart(2,'0')+'.png',dataUrlBytes(link.href));n++;
}
var lz4=await lz4Compressor.mergeLz4Blobs(Array.from(btmProjectsMap.values()).map(function(d){return d.blob;}));
zip.file('漫画项目.lz4',lz4);
var blob=await zip.generateAsync({type:'blob'});
if(back&&btmProjectsMap.has(back))await chengeCanvasByGuid(back,false);
var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='漫画-全部页面.zip';document.body.appendChild(a);a.click();a.remove();
setTimeout(function(){URL.revokeObjectURL(a.href);},5000);
toast('已导出 '+n+' 页','zip 里是每页 PNG 和项目文件（用「文件 › 打开项目」可继续编辑）。');
return {pages:n,bytes:blob.size};
}catch(e){toast('导出失败',(e&&e.message)||'生成导出文件时出错，请重试。',true);return null;}
finally{try{if(back&&btmProjectsMap.has(back)&&getCanvasGUID()!==back)await chengeCanvasByGuid(back,false);}catch(error){toast('恢复页面失败',error.message||String(error),true);}exporting=false;if(btn)btn.disabled=false;}
}

function registerHiddenTasks(){
if(!window.Commands)return setTimeout(registerHiddenTasks,300);
TASKS.forEach(function(t){if(t.hidden)Commands.register({id:'task.'+t.id,label:t.title,group:'任务',keywords:t.desc+' 向导 task',run:function(){start(t.id);}});});
}
function privacyOn(){try{return localStorage.getItem('mnai.privacyBlur')==='1';}catch(e){return false;}}
function setPrivacy(on){try{localStorage.setItem('mnai.privacyBlur',on?'1':'0');}catch(e){/* private window */}document.body.classList.toggle('privacy-blur',!!on);}

var WHATSNEW_KEY='mnai.whatsNew.1.6.6';
function showWhatsNew(force){
try{if(!force&&localStorage.getItem(WHATSNEW_KEY)==='1')return;}catch(e){}
if($('taskWhatsNew'))return;
// Playwright / automated browsers set navigator.webdriver: skip the modal so e2e can click the task bar
if(!force&&typeof navigator!=='undefined'&&navigator.webdriver){
try{localStorage.setItem(WHATSNEW_KEY,'1');}catch(e){}
return;
}
// wait for the tutorial overlay to go away so first-run is not blocked by two overlays
if(!force&&document.querySelector('.tutorial-overlay')){
setTimeout(function(){showWhatsNew(false);},800);return;
}
var ov=el('div',{id:'taskWhatsNew',class:'task-whatsnew',role:'dialog','aria-labelledby':'taskWhatsNewTitle'});
ov.innerHTML='<div class="task-whatsnew-card">'+
'<h2 id="taskWhatsNewTitle">1.6.6 新功能导览</h2>'+
'<p class="ui-muted">这一版把「整页拆解、剧情出分镜、批量导演」收进新手任务，并修好了透视文字存档等小问题。</p>'+
'<ol>'+
'<li><b>拆成可编辑页</b>：导入漫画后点任务栏「拆成可编辑页」，本机切格、擦字、提出文字层。</li>'+
'<li><b>剧情出分镜</b>：在「剧情」写对白，用批量导演一次规划整页（默认开）。</li>'+
'<li><b>画一页漫画</b>：仍是最快出图路径；竖排气泡更贴格子，不会轻易撑爆。</li>'+
'<li><b>实验功能</b>：服务设置里四项默认全关（换采样、减少串脸、擦场景字、招牌透视文字）。</li>'+
'</ol>'+
'<div class="task-whatsnew-actions">'+
'<button type="button" class="ui-btn ui-btn-ghost" id="taskWhatsNewSkip">稍后</button>'+
'<button type="button" class="ui-btn ui-btn-primary" id="taskWhatsNewGo">知道了</button>'+
'</div></div>';
document.body.appendChild(ov);
function done(){try{localStorage.setItem(WHATSNEW_KEY,'1');}catch(e){}ov.remove();}
$('taskWhatsNewSkip').addEventListener('click',done);
$('taskWhatsNewGo').addEventListener('click',done);
ov.addEventListener('keydown',function(e){if(e.key==='Escape')done();});
}
function init(){
setPrivacy(privacyOn());
registerHiddenTasks();
buildBar();
buildHome();
applyMode(mode());
setTimeout(function(){showWhatsNew(false);},600);
setInterval(updateHome,1000);
// a newly imported page: let 换角色 detection run in the background so the wizard opens instantly
var lastPageSig='';
setInterval(function(){
if(typeof canvas==='undefined'||!window.AutoSwap||!AutoSwap.prefetch||mode()!=='beginner')return;
var img=canvas.getObjects().filter(function(o){return o.type==='image'&&!o.autoSwap;})[0];
var sig=img?(img.width+'x'+img.height+':'+((img._element&&img._element.src)||'').length):'';
if(sig&&sig!==lastPageSig){lastPageSig=sig;AutoSwap.prefetch();if(window.MangaSmartTextEditor&&MangaSmartTextEditor.prefetch)setTimeout(function(){if(!document.querySelector('#taskWizardCard'))MangaSmartTextEditor.prefetch();},2500);if(window.PanelAuto)setTimeout(function(){PanelAuto.get().catch(function(){});},1500);}
},2000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,0);});
else setTimeout(init,0);

return {exportAll:exportAll,start:start,stop:stop,setMode:setMode,mode:mode,TASKS:TASKS,showWhatsNew:showWhatsNew,active:function(){return active&&active.id;}};
})();
if(typeof window!=='undefined')window.TaskLauncher=TaskLauncher;

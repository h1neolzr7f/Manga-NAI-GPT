// Audit 114 (images rendered), 117 (studio keeps hidden fields), 118 (name keys), 119 (VN index), 120 (story types kept).
const assert=require('assert/strict');const {makeContext}=require('./_fabric-stub.cjs');
const x=makeContext();
for(const f of ['template-registry','chat-scene','scene-serializer','story-engine','timeline','extra-renderer-factory','story-adapters','chat-renderer','site-ui-parts'])x.load('js/simulator/'+f+'.js');
for(const f of ['visual-novel','social-feed','forum','phone'])x.load('js/simulator/renderers/'+f+'-renderer.js');
x.load('js/simulator/simulator-studio.js',s=>s.replace('root.NaiComicSimulatorStudio={','root.__T={webFormValues:webFormValues,applyWebForm:applyWebForm,renderWebForm:renderWebForm,webSceneFromForm:webSceneFromForm,showStoryScript:showStoryScript,parseStudioScript:parseStudioScript,setWeb:function(id){currentWebId=id;}};\nroot.NaiComicSimulatorStudio={'));
function texts(g){const out=[];(function v(o){if(typeof o.text==='string')out.push(o.text);if(o.getObjects)o.getObjects().forEach(v);})(g);return out;}
function images(g){const out=[];(function v(o){if(o.type==='image')out.push(o);if(o.getObjects)o.getObjects().forEach(v);})(g);return out;}
(async()=>{
 // 114
 let loads=0;x.fabric.Image.fromURL=(src,cb)=>{loads++;const el=x.document.createElement('canvas');el.width=64;el.height=32;cb(new x.fabric.Image(el));};
 const scene=x.NaiComicChatScene.createDefaultScene();
 const imageScene=x.NaiComicChatScene.normalize?x.NaiComicChatScene.normalize({...scene,messages:[{id:'img',type:'image',speaker:scene.participants[0].id,image:'data:image/png;base64,AA==',content:'caption'}]}):null;
 let g=await x.NaiComicChatRenderer.renderScene(imageScene,x.NaiComicTemplateRegistry.get('discord-chat-dark'));
 assert.equal(images(g).length,1,'114: discord image message shows the image');
 const social=await x.NaiComicExtraRendererRegistry.get('social-feed-generic').render({image:'data:image/png;base64,AA=='});
 assert.equal(images(social).length,1,'114: social post image rendered');
 console.log('PASS 114 discord and social simulators render image fields');
 // 118
 for(const id of ['forum-generic','phone-generic']){const r=x.NaiComicExtraRendererRegistry.get(id),src=r.normalize({title:'fixture',replies:[{author:'ALICE',body:'HELLO'}],messages:[{sender:'ALICE',body:'HELLO',side:'right'}]}),f=x.__T.webFormValues(src,id),model=x.__T.applyWebForm(r.normalize({}),f,id),out=await r.render(model),m=texts(out).filter(t=>t.includes('HELLO')||t.includes('ALICE'));assert(m.some(t=>t.includes('ALICE')),'118 '+id+': '+JSON.stringify(m));}
 console.log('PASS 118 studio names reach forum and phone renderers');
 // 119
 const story=x.NaiComicStoryEngine.normalize({characters:[{id:'hero',name:'HERO'}],nodes:[{id:'bg',type:'background',background:'#000000'},{id:'A',type:'speech',speaker:'hero',content:'LINE A'},{id:'B',type:'speech',speaker:'hero',content:'LINE B'}],currentIndex:1});
 const ad=x.NaiComicStoryAdapters.toVisualNovel(story);assert.equal(ad.dialogue[ad.activeNodeIndex].content,'LINE A','119');
 console.log('PASS 119 visual novel index follows node id after background filtering');
 // 117
 const vn=x.NaiComicExtraRendererRegistry.get('visual-novel-generic');
 const custom=vn.normalize({title:'CUSTOM',background:'#123456',characters:[{id:'hero',name:'CUSTOM HERO',position:'center',onStage:true}],dialogue:[{id:'d1',speaker:'CUSTOM HERO',speakerId:'hero',content:'one',effect:'shake'},{id:'d2',speaker:'CUSTOM HERO',speakerId:'hero',content:'two'}],activeNodeIndex:1,theme:{accent:'#f00'}});
 x.__T.setWeb('visual-novel-generic');x.__T.renderWebForm(custom);
 const kept=x.__T.webSceneFromForm(vn);
 assert.equal(kept.background,'#123456');assert.equal(kept.activeNodeIndex,1);assert.equal(kept.characters[0].id,'hero');assert.equal(kept.dialogue[0].speakerId,'hero');assert.equal(kept.dialogue[0].effect,'shake');
 console.log('PASS 117 unedited studio form keeps hidden scene fields');
 // 120
 const original=x.NaiComicStoryEngine.normalize({characters:[{id:'hero',name:'HERO'}],nodes:[{id:'one',type:'speech',speaker:'hero',content:'SPEECH'},{id:'two',type:'aside',speaker:'hero',content:'THOUGHT'},{id:'choice',type:'choice',choices:[{label:'YES',target:'one'},{label:'NO',target:'two'}]}]});
 const box={value:''};x.document.getElementById=id=>id==='simStudioChatScript'?box:null;
 x.__T.showStoryScript(original);const back=x.__T.parseStudioScript(x.NaiComicStoryEngine,box.value,'t');
 assert.equal(back.nodes.map(n=>n.type).join(),'speech,aside,choice','120');assert.equal(back.nodes[2].choices[1].target,'two');
 console.log('PASS 120 opening a story in the studio keeps aside/choice nodes');
})().catch(e=>{console.error(e);process.exitCode=1;});

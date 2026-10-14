// Audit 113: chat message rows must keep their computed vertical positions (not all at 0,0).
const assert=require('assert');const {makeContext}=require('./_fabric-stub.cjs');
const x=makeContext();
for(const f of ['template-registry','chat-scene','scene-serializer','timeline','extra-renderer-factory','chat-renderer'])x.load('js/simulator/'+f+'.js');
(async()=>{
 const scene=x.NaiComicChatScene.createDefaultScene();scene.messages[0].content='FIRST';scene.messages[1].content='SECOND';
 for(const id of ['generic-chat-dark','story-log-dark','discord-chat-dark']){
  const g=await x.NaiComicChatRenderer.renderScene(scene,x.NaiComicTemplateRegistry.get(id));
  const rows=g.getObjects().filter(o=>o.simulatorMessageId);assert.equal(rows.length,2,id);
  const tops=rows.map(o=>{const p=x.fabric.util.transformPoint(new x.fabric.Point(-o.width/2,-o.height/2),o.calcTransformMatrix());return p.y;});
  assert(tops[1]-tops[0]>10,id+': second row must sit below the first, got '+tops);
 }
 console.log('PASS 113 chat rows keep their computed positions in generic/story-log/discord layouts');
})().catch(e=>{console.error(e);process.exitCode=1;});

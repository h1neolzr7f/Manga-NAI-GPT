'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/core/util/fabric-text-focus.js'),'utf8');

for(const mode of ['ignored','unsupported','frozen-options']){
  const root={scrollLeft:80,scrollTop:500,parentElement:null};
  const outer={scrollLeft:31,scrollTop:120,parentElement:root};
  const host={scrollLeft:17,scrollTop:240,parentElement:outer};
  let calls=0;
  const proto={initHiddenTextarea(){
    this.hiddenTextarea={parentElement:host,focus(options){
      calls++;
      if(mode==='unsupported'&&options)throw new TypeError('focus options unsupported');
      root.scrollLeft=99;root.scrollTop=900;
      outer.scrollLeft=11;outer.scrollTop=400;
      host.scrollLeft=0;host.scrollTop=700;
    }};
  }};
  const ctx={document:{scrollingElement:root,documentElement:root,body:root},fabric:{IText:{prototype:proto}}};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
  const text=Object.create(proto);text.initHiddenTextarea();
  text.hiddenTextarea.focus(mode==='frozen-options'?Object.freeze({focusVisible:true}):undefined);
  assert.deepEqual([root.scrollLeft,root.scrollTop,outer.scrollLeft,outer.scrollTop,host.scrollLeft,host.scrollTop],
    [80,500,31,120,17,240],mode+': text focus must retain every ancestor scroll position');
  assert.equal(calls,mode==='unsupported'?2:1,mode+': focus still reaches the input');
}
console.log('fabric text nested focus: 3 cases PASS');

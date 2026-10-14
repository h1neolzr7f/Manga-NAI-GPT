// Audit 51: balloon speaker index is page-wide; the tail must point at that face even in panel 2.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const c={};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'..','..','js/ai/balloon-layout-core.js'),'utf8'),c);
const C=c.BalloonLayoutCore||Object.values(c).find(v=>v&&typeof v.place==='function');
const faces=[[50,50,150,150],[650,200,750,300]];   // face 0 in panel 1, face 1 in panel 2
const panel2={x:600,y:0,w:400,h:600};
const out=C.place(panel2,[{w:120,h:60,speaker:1}],{faces,dir:'rtl'});
assert(out[0].tail,'51: tail present for the page-wide speaker index');
const t=out[0].tail;const pts=JSON.stringify(t);assert(/6[5-9]\d|7[0-5]\d/.test(pts),'tail points at face 1: '+pts);
const none=C.place(panel2,[{w:120,h:60,speaker:0}],{faces,dir:'rtl'});assert.equal(none[0].tail,null,'face outside the panel gives no tail');
console.log('PASS 51 balloon tails use page-wide speaker identity');

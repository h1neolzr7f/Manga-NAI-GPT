// Audit 72: a multi-column OCR box is not one glyph. The OCR glyph size flows through mapDetections
// and caps the font; without it the per-character area estimate is used.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const read=f=>fs.readFileSync(path.join(__dirname,'..','..',f),'utf8');
const c={};c.window=c;vm.createContext(c);vm.runInContext(read('js/ai/manga-smart-text-core.js'),c);
const d=c.MangaSmartTextCore.mapDetections([{text:'新字',x:60,y:40,width:70,height:160,vertical:true,confidence:95,glyph:20,bubble:{x:40,y:20,width:140,height:220}}],200,300)[0];
assert.equal(d.glyph,20,'72: glyph kept by mapDetections');
const src=read('js/ai/manga-smart-text-editor.js');
assert(/candidate\.glyph > 0 \? Math\.min\(cross, candidate\.glyph\)/.test(src),'72: editor caps by OCR glyph');
const fit=c.MangaSmartTextCore.fitText('新字',d.textArea,true,(t,s)=>t.length*s,Math.min(70,d.glyph)*1.1);
assert(fit.fontSize<=22,'72: font stays near the original glyph, got '+fit.fontSize);
console.log('PASS 72 replacement font is capped by the OCR glyph size, not the whole column stack');

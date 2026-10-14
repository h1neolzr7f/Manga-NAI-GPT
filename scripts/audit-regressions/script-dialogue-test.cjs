// Audit 49: overflowing dialogue must not be merged across speakers; each line keeps ID + speaker.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const c={};c.window=c;vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','..','js/ai/script-page-core.js'),'utf8'),c);
const S=c.ScriptPageCore;
const parsed=S.parse('第1格：两人对话\n甲：第一句\n乙：第二句\n甲：第三句\n乙：第四句\n甲：第五句');
const all=[].concat(...parsed.pages.map(p=>[].concat(...p.panels.map(q=>q.lines))));
assert.deepEqual(all.map(l=>l.speaker+':'+l.text),['甲:第一句','乙:第二句','甲:第三句','乙:第四句','甲:第五句']);
parsed.pages.forEach(p=>p.panels.forEach(q=>assert(q.lines.length<=S.MAX_LINES)));
const ids=all.map(l=>l.id);assert.equal(new Set(ids).size,5);assert(ids.every(Boolean));
const wl=S.wizardLines(parsed.pages[0].panels[0]);assert.equal(wl[1].speaker,'乙');assert.equal(wl[1].id,ids[1]);
assert(parsed.warnings.some(w=>w.includes('续格')));
console.log('PASS 49 overflow dialogue goes to a continuation panel; speakers and line IDs preserved');

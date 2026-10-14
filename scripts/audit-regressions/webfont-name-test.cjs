// Audit 46: Google Fonts family names are URL-decoded before saving/applying.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','..','js/core/font/font-manager-core.js'),'utf8');
const a=src.indexOf('  async registerWebFont(');const b=src.indexOf('\n  }',src.indexOf('await this.setUserFontData();',a))+4;
const saved=[];
const P=()=>new Proxy(function(){},{get:()=>P(),apply:()=>undefined});
const c={console,fmUserFontManager:P(),FontSelectorManager:new Proxy({},{get:()=>()=>{}}),fmFontRepository:{async saveWebFont(n,u){saved.push(n);}},fontLogger:{error(u,e){throw e;}},createToastError(){},getText:x=>x,i18next:{t:x=>x},$:()=>({value:''})};
vm.createContext(c);
vm.runInContext('globalThis.fm={existsFont(){return false;},async loadWebFontStylesheet(){},addFontOption(o){globalThis.added=o.name;},async setUserFontData(){},\n'+src.slice(a,b)+'\n};',c);
(async()=>{
 await c.fm.registerWebFont('https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400&display=swap');
 await c.fm.registerWebFont('https://fonts.googleapis.com/css2?family=Noto%20Sans%20JP');
 assert.deepEqual(saved,['Roboto Slab','Noto Sans JP']);
 console.log('PASS 46 web font family names are URL-decoded');
})().catch(e=>{console.error(e);process.exitCode=1;});

/* Character Bible data contract (own implementation).
 * AI reference material is local data, never an API key or provider auth.
 */
(function (root) {
  'use strict';
  const VERSION=1, MAX_CARDS=24, MAX_REFS=3, MAX_IMAGE_DATA_LENGTH=3_600_000;
  // 2.0 character library: optional identity block (CCIP 768-d float32 features as base64, main colours, tags).
  const MAX_FEATURES=8, FEATURE_B64_LENGTH=4096, MAX_PALETTE=6;
  function validFeature(s){return typeof s==='string'&&s.length===FEATURE_B64_LENGTH&&/^[A-Za-z0-9+/]+={0,2}$/.test(s);}
  function normalizeIdentity(raw){
    if(raw==null)return undefined;
    if(typeof raw!=='object'||Array.isArray(raw))throw Error('角色身份数据无效。');
    const features=Array.isArray(raw.features)?raw.features.filter(validFeature).slice(0,MAX_FEATURES):[];
    const palette=Array.isArray(raw.palette)?raw.palette.slice(0,MAX_PALETTE).filter(c=>c&&/^#[0-9a-f]{6}$/i.test(c.rgb)&&Array.isArray(c.lab)&&c.lab.length===3&&c.lab.every(Number.isFinite)&&Number.isFinite(c.share))
      .map(c=>({rgb:c.rgb.toLowerCase(),share:Math.max(0,Math.min(1,c.share)),lab:c.lab.map(Number)})):[];
    return {features,palette,tags:limitedText(raw.tags,400)};
  }
  function limitedText(value,limit){
    return (typeof value==='string'?value:'')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'')
      .trim().slice(0,limit);
  }
  function validReference(value){
    if(typeof value!=='string'||value.length>MAX_IMAGE_DATA_LENGTH) return false;
    const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if(!match || match[2].length<16 || match[2].length%4!==0)return false;
    return true;
  }
  function normalize(raw){
    if(!raw || typeof raw!=='object' || Array.isArray(raw))throw Error('角色档案必须是对象。');
    const id=limitedText(raw.id,64);
    if(!/^[A-Za-z0-9_-]{1,64}$/.test(id))throw Error('角色 ID 无效。');
    const name=limitedText(raw.name,80);
    if(!name)throw Error('角色名称不能为空。');
    const refs=raw.references;
    if(!Array.isArray(refs)||refs.length>MAX_REFS||refs.some(r=>!validReference(r)))
      throw Error('角色参考图片无效，或超过 3 张图片上限。');
    if(!refs.length) throw Error('角色需要至少一张有效的参考图片。');
    return {
      schemaVersion:VERSION,id,name,
      traits:limitedText(raw.traits,1200),
      notes:limitedText(raw.notes,500),
      references:refs.slice(),
      ...(raw.identity!=null?{identity:normalizeIdentity(raw.identity)}:{})
    };
  }
  function fromDocument(document) {
    if(!document || typeof document!=='object' || document.schemaVersion!==VERSION ||
      !Array.isArray(document.characters) || document.characters.length>MAX_CARDS)
      throw Error('角色档案格式或数量不受支持。');
    const entries=document.characters.map(normalize);
    if(new Set(entries.map(x=>x.id)).size!==entries.length)
      throw Error('角色档案存在重复 ID。');
    return entries;
  }
  function toDocument(cards){
    if(!Array.isArray(cards)||cards.length>MAX_CARDS) throw Error('角色数量超过上限。');
    return {schemaVersion:VERSION,product:'Manga-NAI-GPT',characters:fromDocument({
      schemaVersion:VERSION,characters:cards
    })};
  }
  function withCharacterPrompt(instruction,card){
    const safe=normalize(card);
    const basic=limitedText(instruction,3000);
    const tag='【角色参考档案：'+safe.name+'】';
    const constraints=[tag];
    if(safe.traits)constraints.push('必须尽量保持这些识别特征：'+safe.traits);
    if(safe.notes)constraints.push('参考备注：'+safe.notes);
    if(safe.identity&&safe.identity.tags)constraints.push('标签：'+safe.identity.tags);
    if(safe.identity&&safe.identity.palette.length)constraints.push('主色（按面积）：'+safe.identity.palette.map(c=>c.rgb).join('、'));
    constraints.push('以提供的参考图为角色外形依据，尽量保持脸、发型、瞳色、服装等可见特征；保留所选原画动作、画风、构图和未选中部分。');
    return (basic?basic+'\n\n':'')+constraints.join('\n');
  }
  root.MangaCharacterBibleCore=Object.freeze({
    VERSION,MAX_CARDS,MAX_REFS,MAX_IMAGE_DATA_LENGTH,
    normalize,fromDocument,toDocument,withCharacterPrompt,validReference,normalizeIdentity,validFeature,MAX_FEATURES
  });
})(typeof window!=='undefined'?window:this);

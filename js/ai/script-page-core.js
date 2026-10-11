/* 2.0 #4 script -> page (LLM-free). Paste a script in almost any everyday format; it is split into pages,
 * panels, scene descriptions and dialogue (speaker + line), ready for 画一页漫画. Pure, unit-tested. */
(function (root) {
  'use strict';
  const MAX_PANELS = 6, MAX_LINES = 4;
  const NUM = '[0-9０-９一二三四五六七八九十]+';
  const PAGE_RE = new RegExp('^\\s*(?:第\\s*' + NUM + '\\s*[页頁]|page\\s*\\d+|p\\.?\\s*\\d+\\s*$)\\s*[:：.、]?\\s*(.*)$', 'i');
  const PANEL_RE = new RegExp('^\\s*(?:第\\s*' + NUM + '\\s*[格幕镜鏡コマ]|[格镜]\\s*' + NUM + '|【\\s*' + NUM + '\\s*】|\\[\\s*' + NUM + '\\s*\\]|panel\\s*\\d+|#+\\s*' + NUM + '?|' + NUM + '\\s*[.、．)）])\\s*[:：.、]?\\s*(.*)$', 'i');
  const QUOTE_RE = /^[「『"“](.+?)[」』"”]\s*$/;
  const SPEAKER_RE = /^([^\s:：「『"“（(]{1,12}?)\s*(?:[（(]([^）)]{1,12})[）)])?\s*[:：]\s*(.+)$/;
  const SFX_RE = /^[（(]?\s*(?:音效|效果音|sfx|se)\s*[:：]\s*(.+?)[）)]?$/i;
  const SCENE_LABEL_RE = /^(?:画面|場面|场景|场面|scene|描写|镜头|时间|時間|地点|場所|背景|天气|time|place|location|setting)\s*[:：]\s*(.+)$/i;
  const NARRATION = /^(?:旁白|ナレーション|narration|narrator|独白)$/i;

  function clean(s) { return String(s).replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim(); }
  function stripQuotes(s) { const m = QUOTE_RE.exec(s.trim()); return m ? m[1].trim() : s.trim(); }

  function classify(line) {
    let m;
    if ((m = SCENE_LABEL_RE.exec(line))) return { kind: 'scene', text: m[1] };
    if ((m = SFX_RE.exec(line))) return { kind: 'scene', text: '音效「' + m[1] + '」' };
    if ((m = QUOTE_RE.exec(line))) return { kind: 'line', speaker: '', text: m[1].trim() };
    if ((m = SPEAKER_RE.exec(line)) && !/[，。,.!！?？]/.test(m[1])) {
      const sp = m[1].trim();
      return { kind: 'line', speaker: NARRATION.test(sp) ? '旁白' : sp, note: m[2] || '', text: stripQuotes(m[3]) };
    }
    if (/^[（(].+[）)]$/.test(line)) return { kind: 'scene', text: line.slice(1, -1) };
    return { kind: 'scene', text: line };
  }

  /** Script text -> { pages: [{ panels: [{ scene, lines: [{speaker, text}] }] }], warnings, stats }. */
  function parse(text) {
    const src = String(text || '').replace(/\r\n?/g, '\n');
    const rows = src.split('\n');
    const explicit = rows.some(r => PANEL_RE.test(r) && !/^\s*$/.test(r.replace(PANEL_RE, '$1x')));
    const pages = [{ panels: [], forced: false }];
    let cur = null, warnings = [];
    const page = () => pages[pages.length - 1];
    const newPanel = () => { cur = { scene: '', lines: [] }; page().panels.push(cur); return cur; };
    for (const raw of rows) {
      const line = clean(raw);
      if (!line) { if (!explicit && cur && (cur.scene || cur.lines.length)) cur = null; continue; }
      let m;
      if ((m = PAGE_RE.exec(line))) {
        if (page().panels.length) pages.push({ panels: [], forced: true });
        cur = null; if (m[1]) newPanel().scene = clean(m[1]);
        continue;
      }
      if (explicit && (m = PANEL_RE.exec(line))) { newPanel(); if (m[1]) addTo(cur, classify(clean(m[1]))); continue; }
      if (!cur) newPanel();
      addTo(cur, classify(line));
    }
    function addTo(p, c) {
      if (c.kind === 'scene') p.scene = p.scene ? p.scene + '；' + c.text : c.text;
      else p.lines.push({ speaker: c.speaker, text: c.text });
    }
    // drop empty panels; split long pages (one page holds up to MAX_PANELS)
    const out = [];
    for (const pg of pages) {
      const ps = pg.panels.filter(p => p.scene || p.lines.length);
      for (let i = 0; i < ps.length; i += MAX_PANELS) out.push({ panels: ps.slice(i, i + MAX_PANELS) });
      if (ps.length > MAX_PANELS) warnings.push('一页最多 ' + MAX_PANELS + ' 格：多出来的格子放到了下一页。');
    }
    out.forEach((pg, pi) => pg.panels.forEach((p, i) => {
      if (!p.scene) {
        const who = Array.from(new Set(p.lines.map(l => l.speaker).filter(s => s && s !== '旁白')));
        p.scene = who.length ? who.join('和') + '在说话' : '与上一格同一场景';
        p.sceneGuessed = true;
        warnings.push('第 ' + (pi + 1) + ' 页第 ' + (i + 1) + ' 格没写画面，先用「' + p.scene + '」代替，可以改。');
      }
      if (p.lines.length > MAX_LINES) { warnings.push('第 ' + (pi + 1) + ' 页第 ' + (i + 1) + ' 格对白超过 ' + MAX_LINES + ' 句，多的合并进最后一个气泡。'); const extra = p.lines.splice(MAX_LINES - 1); p.lines.push({ speaker: extra[0].speaker, text: extra.map(l => l.text).join('') }); }
    }));
    const panels = out.reduce((a, p) => a + p.panels.length, 0), lines = out.reduce((a, p) => a + p.panels.reduce((b, q) => b + q.lines.length, 0), 0);
    return { pages: out, warnings: Array.from(new Set(warnings)), stats: { pages: out.length, panels, lines, explicit } };
  }
  /** One panel -> the wizard's two fields: scene (with speakers named, for the character library) and the / line. */
  function toWizard(panel) {
    const who = Array.from(new Set(panel.lines.map(l => l.speaker).filter(s => s && s !== '旁白')));
    const scene = panel.scene + (who.length && !panel.sceneGuessed && !who.every(w => panel.scene.includes(w)) ? '（出场：' + who.join('、') + '）' : '');
    return { scene, line: panel.lines.map(l => l.text.replace(/[/／|｜]/g, '・')).join(' / ') };
  }
  root.ScriptPageCore = Object.freeze({ parse, toWizard, MAX_PANELS, MAX_LINES });
})(typeof window !== 'undefined' ? window : globalThis);

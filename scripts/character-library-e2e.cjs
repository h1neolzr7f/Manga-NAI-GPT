// 2.0 #1 character library, novice flow in a real browser.
//   node scripts/character-library-e2e.cjs                 mocked recognition routes (CI): UI contract + GPT auto-reference
//   CHARLIB_REAL=1 CHARLIB_PAGES=a.png,b.png PYTHON=<venv python> node scripts/character-library-e2e.cjs
//                                                          real local models (anime face + CCIP, CPU), screenshots + timing
'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const REAL = process.env.CHARLIB_REAL === '1';
const SERVER = 'http://127.0.0.1:8000';
const OUT = process.env.CHARLIB_OUT || path.join(ROOT, 'artifacts', 'character-library');
const FIX = path.join(__dirname, 'fixtures', 'novice');
const PAGES = REAL ? (process.env.CHARLIB_PAGES || '').split(',').filter(Boolean) : [path.join(FIX, 'page1.png'), path.join(FIX, 'page2.png')];
const python = process.env.PYTHON || 'python3';
fs.mkdirSync(OUT, { recursive: true });

let server;
async function startServer() {
  const busy = await new Promise(r => { const s = net.connect(8000, '127.0.0.1'); s.once('connect', () => { s.destroy(); r(true); }); s.once('error', () => r(false)); });
  if (busy) throw new Error('port 8000 busy');
  server = spawn(python, ['99_server.py'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, NAI_QUIET: '1', GPT_IMAGE_API_KEY: '', NOVELAI_API_KEY: '', DIRECTOR_API_KEY: '' } });
  for (let i = 0; ; i++) {
    try { if ((await fetch(SERVER + '/index.html')).ok) return; } catch { /* starting */ }
    if (i > 150) throw new Error('server not ready'); await new Promise(r => setTimeout(r, 200));
  }
}

// mocked recognition: two faces; a face is "known" once its feature has been embedded
const FEAT = n => Buffer.from(new Float32Array(768).fill(n).buffer).toString('base64');
function mockIdentify(body) {
  const known = new Map((body.library || []).map(c => [c.features[0], c]));
  const faces = [[300, 200, 420, 330], [900, 260, 1010, 380]].map((f, i) => {
    const c = known.get(FEAT(i + 1));
    const base = { face: f, box: [f[0] - 60, f[1] - 60, f[2] + 60, f[3] + 120], panel: i, conf: 0.9, palette: [] };
    return c ? { ...base, id: c.id, name: c.name, status: 'match', difference: 0.05, score: 86, paletteDelta: null }
      : { ...base, id: null, status: 'unknown', nearest: null };
  });
  const scores = {}; faces.forEach(f => { if (f.id) scores[String(f.panel)] = f.score; });
  return { ok: true, width: 1654, height: 2339, faces, threshold: 0.178, possible: 0.2, panelScores: scores };
}

(async () => {
  await startServer();
  const browser = await chromium.launch({ headless: true });
  const errors = []; const gptCalls = []; const names = ['小美', '阿明'];
  const report = { mode: REAL ? 'real' : 'mock', steps: [] };
  try {
    const context = const __ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (process.env.CHARLIB_DEBUG) console.log('PAGE', m.type(), m.text().slice(0, 160)); });
    page.on('dialog', d => d.type() === 'prompt' ? d.accept(names.shift() || '路人') : d.accept());
    await page.route(/https?:\/\/(?!127\.0\.0\.1:8000)/, r => r.abort());
    if (!REAL) {
      let embeds = 0;
      await page.route('**/manga-smart/character-embed', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, feature: FEAT(++embeds), palette: [], face: null, box: [0, 0, 1, 1] }) }));
      await page.route('**/manga-smart/character-identify', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(mockIdentify(r.request().postDataJSON())) }));
    }
    await page.route('**/gpt-image-proxy', async r => {
      const p = r.request().postDataJSON() || {};
      if (['config', 'trust'].includes(p.operation)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      gptCalls.push({ refs: (p.references || []).length, prompt: p.prompt || '' });
      r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, image: p.image }) });
    });
    await page.addInitScript(() => { try { localStorage.setItem('mnai.whatsNew.1.6.6', '1'); } catch (e) {} });
    await page.goto(SERVER + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof canvas !== 'undefined' && canvas.getWidth() > 0 && window.CharacterLibrary && window.MangaCharacterBibleUI, null, { timeout: 60000 });
    await page.locator('#imageInput').setInputFiles(PAGES);
    await page.waitForFunction(() => canvas.getObjects().some(o => o.type === 'image'), null, { timeout: 30000 });
    await page.waitForTimeout(1500);

    let clicks = 0;
    const click = async sel => { await page.locator(sel).first().click(); clicks++; };
    await click('#taskMore'); await click('#taskCharacters');
    await page.locator('#charLibCard').waitFor({ state: 'visible' });
    const t0 = Date.now();
    await click('#charLibRun');
    await page.waitForFunction(() => window.CharacterLibrary.result, null, { timeout: +(process.env.CHARLIB_WAIT || 180000) });
    report.steps.push({ step: 'first identify (empty library)', ms: Date.now() - t0, faces: await page.evaluate(() => CharacterLibrary.result.faces.length) });
    assert(await page.locator('#charLibView').count(), 'labels drawn over the canvas');
    assert(await page.locator('.charlib-add').count() >= 2, 'unknown faces offer 加入角色库');
    await page.screenshot({ path: path.join(OUT, '01-unknown.png') });

    // name the first two faces (as a novice: click, type a name)
    for (let k = 0; k < 2; k++) {
      await page.locator('.charlib-add', { hasText: '加入角色库' }).first().click(); clicks++;
      await page.waitForFunction(n => CharacterLibrary.result && new Set(CharacterLibrary.result.faces.filter(f => f.status === 'match').map(f => f.name)).size >= n,
        k + 1, { timeout: +(process.env.CHARLIB_WAIT || 180000) });
    }
    const r1 = await page.evaluate(() => CharacterLibrary.result);
    const matched = r1.faces.filter(f => f.status === 'match').map(f => f.name);
    assert(matched.includes('小美') && matched.includes('阿明'), 'both named characters are recognised: ' + matched);
    assert(Object.keys(r1.panelScores).length >= 1, 'per-panel consistency scores');
    assert.match(await page.locator('#charLibBody').innerText(), /每格一致性/);
    const cards = await page.evaluate(() => MangaCharacterBibleUI.list());
    assert.equal(cards.filter(c => c.identity).length, 2, 'cards saved with identity in the Character Bible');
    await page.screenshot({ path: path.join(OUT, '02-named.png') });
    report.steps.push({ step: 'name 2 characters', clicks, recognised: matched });

    // the library survives a reload (IndexedDB) and the next page is recognised in the background
    if (PAGES.length > 1) {
      const closed = await page.evaluate(() => { const d = document.getElementById('btm-drawer'); return !d || d.classList.contains('btm-closed') || getComputedStyle(d).display === 'none'; });
      if (closed) { await page.locator('#btm-drawer-handle').click(); await page.waitForTimeout(500); }
      const g0 = await page.evaluate(() => getCanvasGUID());
      for (const n of [0, 1]) {   // after a multi-file import the last page may already be current
        await page.locator('#btm-image-container .btm-image').nth(n).click();
        if (await page.waitForFunction(g => getCanvasGUID() !== g, g0, { timeout: 8000 }).then(() => true, () => false)) break;
      }
      assert.notEqual(await page.evaluate(() => getCanvasGUID()), g0, 'switched page');
      const t1 = Date.now();
      await page.waitForFunction(k => CharacterLibrary.result && CharacterLibrary.result.key !== k, r1.key, { timeout: +(process.env.CHARLIB_WAIT || 180000) });
      const r2 = await page.evaluate(() => CharacterLibrary.result);
      report.steps.push({ step: 'page 2 auto-recognised (no click)', ms: Date.now() - t1, faces: r2.faces.length,
        recognised: r2.faces.filter(f => f.status === 'match').map(f => f.name), panelScores: r2.panelScores });
      assert(r2.faces.some(f => f.status === 'match'), 'page 2 recognised automatically');
      await page.screenshot({ path: path.join(OUT, '03-page2-auto.png') });
    }

    if (!REAL) {
      // GPT edit over a recognised face automatically carries that character's reference + anchors
      await page.evaluate(() => { const f = CharacterLibrary.result.faces.find(x => x.status === 'match');
        MangaGPTRegionEditor.openTask('custom'); MangaGPTRegionEditor.selectRegionForPanel({ x: f.face[0] - 20, y: f.face[1] - 20, width: f.face[2] - f.face[0] + 40, height: f.face[3] - f.face[1] + 40 }, '把表情改成微笑'); });
      await page.locator('#mangaGptPrompt').fill('把表情改成微笑');
      await page.locator('#mangaGptGenerate').click();
      await page.waitForFunction(() => /已自动带上角色/.test((document.getElementById('mangaGptStatus') || document.body).innerText), null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(800);
      assert.equal(gptCalls.length, 1, 'one GPT request');
      assert(gptCalls[0].refs >= 1, 'reference attached automatically');
      assert(/【角色参考档案：(小美|阿明)】/.test(gptCalls[0].prompt), 'character anchors in prompt');
      // toggle off -> no automatic reference
      await page.evaluate(() => { const b = document.getElementById('charLibAutoRef'); b.checked = false; b.dispatchEvent(new Event('change')); });
      assert.equal(await page.evaluate(() => CharacterLibrary.cardForRegion({ left: 0, top: 0, width: 5000, height: 5000 })), null);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.MangaCharacterBibleUI && MangaCharacterBibleUI.all, null, { timeout: 60000 });
    assert.equal((await page.evaluate(async () => (await MangaCharacterBibleUI.all()).filter(c => c.identity).length)), 2, 'library persists after reload');
    assert.deepEqual(errors, [], 'no page errors');
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    console.log('PASS character library e2e (' + report.mode + ')');
  } catch (e) {
    const pg = browser.contexts()[0] && browser.contexts()[0].pages()[0];
    if (pg) console.log('STATE', await pg.evaluate(() => ({ st: document.getElementById('charLibStatus') && document.getElementById('charLibStatus').textContent, busy: CharacterLibrary._state.busy, cards: CharacterLibrary._state.cards.length, res: CharacterLibrary.result && CharacterLibrary.result.faces.map(f => f.status + ':' + f.name), errs: 0 })).catch(x => String(x)), errors);
    throw e;
  } finally {
    await browser.close(); if (server) server.kill();
  }
})().catch(e => { console.error(String(e.stack).split('\n').slice(0, 3).join(' | ')); if (server) server.kill(); process.exit(1); });

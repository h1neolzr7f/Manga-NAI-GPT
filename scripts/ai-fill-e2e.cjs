// 2.0 #2 AI 填充 as a non-destructive layer: novice flow in a real browser (mocked GPT + LaMa; no API cost).
'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const SERVER = 'http://127.0.0.1:8000';
const OUT = process.env.AIFILL_OUT || path.join(ROOT, 'artifacts', 'ai-fill');
const PAGE = process.env.AIFILL_PAGE || path.join(__dirname, 'fixtures', 'novice', 'page1.png');
const GPT_URL = 'https://api.openai.com/v1';
fs.mkdirSync(OUT, { recursive: true });
let server;
async function startServer() {
  const busy = await new Promise(r => { const s = net.connect(8000, '127.0.0.1'); s.once('connect', () => { s.destroy(); r(true); }); s.once('error', () => r(false)); });
  if (busy) throw new Error('port 8000 busy');
  server = spawn(process.env.PYTHON || 'python3', ['99_server.py'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, NAI_QUIET: '1', GPT_IMAGE_API_KEY: '' } });
  for (let i = 0; ; i++) { try { if ((await fetch(SERVER + '/index.html')).ok) return; } catch { /* starting */ } if (i > 150) throw new Error('server not ready'); await new Promise(r => setTimeout(r, 200)); }
}

(async () => {
  await startServer();
  const browser = await chromium.launch({ headless: true });
  const errors = [], gpt = [], lama = [];
  const report = { clicks: {} };
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', acceptDownloads: true });
    const p = await context.newPage();
    p.on('pageerror', e => errors.push(e.message));
    p.on('dialog', d => d.accept());
    await p.route(/https?:\/\/(?!127\.0\.0\.1:8000)/, r => r.abort());
    await p.route('**/gpt-image-proxy', async r => {
      const b = r.request().postDataJSON() || {};
      if (b.operation === 'config') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, envKey: true, trustedBaseUrl: GPT_URL }) });
      if (b.operation !== 'edit') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      const k = gpt.length; gpt.push({ refs: (b.references || []).length, prompt: b.prompt, size: b.size });
      const image = await p.evaluate(async ({ src, k }) => {   // tint the whole image (the model "repaints everything")
        const i = new Image(); i.src = src; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
        const g = c.getContext('2d'); g.drawImage(i, 0, 0); g.fillStyle = ['rgba(220,40,40,.5)', 'rgba(40,160,60,.5)', 'rgba(40,80,220,.5)', 'rgba(200,160,0,.5)'][k % 4]; g.fillRect(0, 0, c.width, c.height);
        return c.toDataURL('image/png'); }, { src: b.image, k });
      await new Promise(res => setTimeout(res, 150 * (k % 3)));
      r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, image }) });
    });
    if (process.env.AIFILL_REAL_LAMA !== '1') await p.route('**/manga-smart/lama-inpaint', async r => { const b = r.request().postDataJSON(); lama.push(1); r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, image: b.image }) }); });

    await p.addInitScript(() => { try { localStorage.setItem('mnai.whatsNew.1.6.6', '1'); } catch (e) {} });
    await p.goto(SERVER + '/index.html', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof canvas !== 'undefined' && canvas.getWidth() > 0 && window.AiFill && window.MangaGPTRegionEditor, null, { timeout: 60000 });
    await p.evaluate(u => { const i = document.getElementById('mangaGptUrl'); i.value = u; i.dispatchEvent(new Event('change')); }, GPT_URL);
    await p.locator('#imageInput').setInputFiles(PAGE);
    await p.waitForFunction(() => canvas.getObjects().some(o => o.type === 'image'), null, { timeout: 30000 });
    await p.waitForTimeout(1200);
    const layers = () => p.evaluate(() => canvas.getObjects().filter(o => o.aiFill).map(o => ({ chosen: o.aiFill.chosen, n: o.aiFill.candidates.length, prompt: o.aiFill.prompt, engine: o.aiFill.engine, visible: o.visible !== false, left: o.left, top: o.top, w: o.width, h: o.height })));

    // 1) open from the task bar, paint, describe, generate
    let clicks = 0;
    await p.locator('#taskBtn-fill').click(); clicks++;
    await p.locator('#aiFillCard').waitFor({ state: 'visible' });
    const vb = await p.locator('#aiFillView').boundingBox();
    const sx = vb.x + vb.width * 0.35, sy = vb.y + vb.height * 0.30;
    await p.mouse.move(sx, sy); await p.mouse.down();
    for (let i = 1; i <= 10; i++) await p.mouse.move(sx + i * vb.width * 0.012, sy + i * vb.height * 0.004);
    await p.mouse.up(); clicks++;
    await p.screenshot({ path: path.join(OUT, '01-painted.png') });
    // 改一块: default preset 去掉杂物 (no text box); 换成… needs a sentence
    assert.equal(await p.locator('[data-preset="remove"]').getAttribute('aria-checked'), 'true', 'default preset = 去掉杂物');
    assert(await p.locator('#aiFillPrompt').isHidden(), '去掉杂物 needs no text');
    await p.locator('[data-preset="replace"]').click(); clicks++;
    assert.equal(await p.locator('#aiFillGenerate').innerText(), '生成 3 张');
    await p.locator('#aiFillGenerate').click();
    assert.match(await p.locator('#aiFillStatus').innerText(), /写一下换成什么/);
    await p.locator('#aiFillPrompt').fill('一把红色雨伞'); clicks++;
    await p.locator('#aiFillGenerate').click(); clicks++;
    await p.locator('.ai-fill-cand[data-k]').nth(2).waitFor({ timeout: 30000 });
    assert.equal(gpt.length, 3, '3 candidates requested');
    assert(gpt.every(g => g.refs === 1 && /红色雨伞/.test(g.prompt) && /蒙版/.test(g.prompt)), 'mask sent as reference, sentence in prompt');
    await p.screenshot({ path: path.join(OUT, '02-candidates.png') });
    await p.locator('.ai-fill-cand[data-k="1"]').click(); clicks++;
    await p.locator('#aiFillUse').click(); clicks++;
    report.clicks.firstFill = clicks;
    await p.waitForFunction(() => canvas.getObjects().some(o => o.aiFill), null, { timeout: 10000 });
    let L = await layers();
    assert.equal(L.length, 1); assert.equal(L[0].chosen, 1); assert.equal(L[0].n, 3); assert.equal(L[0].engine, 'gpt');
    assert.equal(await p.locator('#aiFillCard').count(), 0, 'card closed after apply');

    // 2) mask-only compositing: opaque on the stroke, transparent away from it, soft in between
    const px = await p.evaluate(() => {
      const o = canvas.getObjects().find(x => x.aiFill); const m = o.aiFill; const c = document.createElement('canvas'); c.width = o.width; c.height = o.height;
      const g = c.getContext('2d'); g.drawImage(o._element, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data;
      let full = 0, zero = 0, soft = 0; for (let i = 3; i < d.length; i += 4) { if (d[i] === 255) full++; else if (d[i] === 0) zero++; else soft++; }
      return { full, zero, soft, total: d.length / 4, cornerA: d[3], box: m.box };
    });
    assert(px.full > 0 && px.soft > 0 && px.zero > px.total * 0.4 && px.cornerA === 0, 'layer only covers the painted area: ' + JSON.stringify(px));
    report.alpha = px;
    await p.screenshot({ path: path.join(OUT, '03-applied-chip.png') });

    // 3) chip: next candidate, compare with the original, back
    await p.locator('#aiFillChip').waitFor({ state: 'visible' });
    await p.locator('#aiFillChip [data-a="next"]').click();
    await p.waitForFunction(() => canvas.getObjects().find(o => o.aiFill).aiFill.chosen === 2, null, { timeout: 10000 });
    await p.locator('#aiFillChip [data-a="toggle"]').click();
    assert.equal((await layers())[0].visible, false, '看原图 hides the AI layer');
    await p.locator('#aiFillChip [data-a="toggle"]').click();
    assert.equal((await layers())[0].visible, true);

    // 4) regenerate replaces the same layer (prompt + mask remembered)
    await p.locator('#aiFillChip [data-a="regen"]').click();
    await p.locator('#aiFillCard').waitFor({ state: 'visible' });
    assert.equal(await p.locator('#aiFillPrompt').inputValue(), '一把红色雨伞', 'typed text remembered (not the wrapped prompt)');
    assert.equal(await p.locator('[data-preset="replace"]').getAttribute('aria-checked'), 'true', 'preset remembered');
    await p.locator('#aiFillPrompt').fill('一把蓝色雨伞');
    await p.locator('#aiFillGenerate').click();
    await p.locator('.ai-fill-cand[data-k]').nth(2).waitFor({ timeout: 30000 });
    await p.locator('#aiFillUse').click();
    await p.waitForFunction(() => /蓝色/.test(canvas.getObjects().find(o => o.aiFill).aiFill.prompt), null, { timeout: 10000 });
    L = await layers(); assert.equal(L.length, 1, 'regenerate replaced the layer, no duplicate'); assert.equal(gpt.length, 6);

    // 5) project save -> clear -> open: metadata survives
    await p.locator('#navbarDropdownFile').click();
    const dlP = p.waitForEvent('download', { timeout: 60000 });
    await p.locator('#projectSave').click();
    const dl = await dlP; const proj = path.join(OUT, 'project' + path.extname(dl.suggestedFilename() || '.zip')); await dl.saveAs(proj);
    await p.evaluate(() => { canvas.getObjects().filter(o => o.aiFill).forEach(o => canvas.remove(o)); canvas.renderAll(); });
    await p.locator('#navbarDropdownFile').click();
    const fcP = p.waitForEvent('filechooser', { timeout: 15000 }); await p.locator('#projectLoad').click(); (await fcP).setFiles(proj);
    await p.waitForFunction(() => canvas.getObjects().some(o => o.aiFill), null, { timeout: 60000 });
    L = await layers(); assert.equal(L.length, 1); assert.equal(L[0].n, 3); assert(/蓝色/.test(L[0].prompt), 'aiFill restored from project');
    // switching candidates still works on the restored layer
    await p.evaluate(() => { const o = canvas.getObjects().find(x => x.aiFill); canvas.setActiveObject(o); canvas.fire('selection:created', { selected: [o] }); });
    await p.locator('#aiFillChip [data-a="prev"]').click();
    await p.waitForFunction(c => canvas.getObjects().find(o => o.aiFill).aiFill.chosen !== c, L[0].chosen, { timeout: 10000 });

    // 6) LaMa: free local removal, one result
    await p.evaluate(() => canvas.discardActiveObject());
    await p.locator('#taskBtn-fill').click();
    await p.locator('#aiFillCard').waitFor({ state: 'visible' });
    await p.locator('[data-tool="box"]').click();
    const vb2 = await p.locator('#aiFillView').boundingBox();
    // box straddling the gutter between the first two panels (frames must survive)
    const gut = await p.evaluate(async () => { const pa = await PanelAuto.get(); const [a, b] = pa.panels.slice().sort((u, v) => u.y - v.y);
      return { W: pa.W, H: pa.H, y: (a.y + a.h + b.y) / 2, x: a.x + a.w * 0.4, aBottom: a.y + a.h, bTop: b.y, n: pa.panels.length }; });
    assert(gut.n >= 2, 'fixture has 2+ panels');
    const toView = (x, y) => [vb2.x + x * vb2.width / gut.W, vb2.y + y * vb2.height / gut.H];
    let [bx, by] = toView(gut.x, gut.y - 60); await p.mouse.move(bx, by); await p.mouse.down();
    [bx, by] = toView(gut.x + 160, gut.y + 60); await p.mouse.move(bx, by, { steps: 4 }); await p.mouse.up();
    await p.locator('[data-preset="remove"]').click();
    await p.locator('#aiFillGenerate').click();
    await p.locator('.ai-fill-cand[data-k="0"]').waitFor({ timeout: 30000 });
    assert.equal(await p.locator('.ai-fill-cand[data-k]').count(), 1); if (process.env.AIFILL_REAL_LAMA !== '1') assert.equal(lama.length, 1);
    await p.screenshot({ path: path.join(OUT, '04-lama.png') });
    await p.locator('#aiFillUse').click();
    await p.waitForFunction(() => canvas.getObjects().filter(o => o.aiFill).length === 2, null, { timeout: 10000 });
    assert.equal((await layers())[1].engine, 'lama');
    const frame = await p.evaluate(g => {
      const o = canvas.getObjects().filter(x => x.aiFill)[1]; const c = document.createElement('canvas'); c.width = o.width; c.height = o.height;
      const ctx = c.getContext('2d'); ctx.drawImage(o._element, 0, 0); const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let maxA = 0, inside = 0;
      for (let y = Math.floor(g.aBottom - 5 - o.top); y <= Math.ceil(g.bTop + 5 - o.top); y++) { if (y < 0 || y >= c.height) continue; for (let x = 0; x < c.width; x++) maxA = Math.max(maxA, d[(y * c.width + x) * 4 + 3]); }
      for (let i = 3; i < d.length; i += 4) if (d[i] === 255) inside++;
      return { maxA, inside, clip: o.aiFill.clip.length };
    }, gut);
    assert(frame.clip >= 1 && frame.maxA === 0 && frame.inside > 0, 'panel frame + gutter untouched: ' + JSON.stringify(frame));
    report.frame = frame;

    // 7) undo removes the last AI layer (one step); empty mask is refused with a hint
    await p.evaluate(() => { canvas.discardActiveObject(); undo(); });
    await p.waitForFunction(() => canvas.getObjects().filter(o => o.aiFill).length === 1, null, { timeout: 15000 });
    await p.locator('#taskBtn-fill').click(); await p.locator('#aiFillCard').waitFor({ state: 'visible' });
    await p.locator('#aiFillGenerate').click();
    assert.match(await p.locator('#aiFillStatus').innerText(), /先在画面上涂出/);
    await p.keyboard.press('Escape');
    assert.equal(await p.locator('#aiFillCard').count(), 0, 'Esc closes');
    assert.deepEqual(errors, [], 'no page errors');
    report.gptCalls = gpt.length; report.lamaCalls = lama.length;
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    console.log('PASS ai-fill e2e: paint -> 3 candidates -> layer (mask-only) -> switch/compare/regenerate -> save/load -> LaMa -> undo');
  } finally { await browser.close(); if (server) server.kill(); }
})().catch(e => { console.error(String(e.stack || e).split('\n').slice(0, 4).join(' | ')); if (server) server.kill(); process.exit(1); });

// 2.0 #4 script -> page: paste a script into 画一页漫画, split, generate (mock GPT), next page from the queue.
'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const SERVER = 'http://127.0.0.1:8000';
const OUT = process.env.SCRIPT_OUT || path.join(ROOT, 'artifacts', 'script-page');
fs.mkdirSync(OUT, { recursive: true });
const SCRIPT = `第1页
第1格：清晨的车站站台，小雪背着书包在等车
小雪：今天也要加油！
第2格：列车缓缓进站，车灯照亮站台
旁白：七点零五分，列车准时到了。
第3格：车厢里，小雪发现阿明坐在窗边
小雪：咦？阿明！
阿明：早啊，小雪。
第4格：两人并排坐着，窗外是海
（音效：哐当哐当）
第5格：小雪看着海微笑
小雪：「今天的海真蓝。」
第2页
1. 学校门口，樱花飘落
阿明：快迟到了！
2. 两人跑进校门
小雪：等等我！`;
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
  const errors = [], calls = [], report = {};
  let clicks = 0, typed = 0;
  try {
    const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })).newPage();
    p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept());
    await p.route(/https?:\/\/(?!127\.0\.0\.1:8000)/, r => r.abort());
    await p.route('**/manga-smart/faces', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, available: false, faces: [] }) }));
    await p.route('**/gpt-image-proxy', async route => {
      const body = route.request().postDataJSON() || {};
      if (['config', 'trust'].includes(body.operation)) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, envKey: true, trustedBaseUrl: 'https://api.openai.com/v1' }) });
      if (body.operation === 'models') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, models: ['gpt-image-1'], imageModels: ['gpt-image-1'] }) });
      calls.push(body.prompt || '');
      const n = calls.length;
      const image = await p.evaluate(({ size, n }) => { const [w, h] = size.split('x').map(Number); const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
        g.fillStyle = 'hsl(' + (n * 47 % 360) + ',40%,85%)'; g.fillRect(0, 0, w, h); g.fillStyle = '#333'; g.font = 'bold ' + Math.round(h / 4) + 'px sans-serif'; g.textAlign = 'center'; g.fillText(String(n), w / 2, h / 2 + h / 10); return c.toDataURL('image/png'); }, { size: body.size || '1024x1024', n });
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, image }) });
    });
    await p.goto(SERVER + '/index.html', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof canvas !== 'undefined' && window.ScriptPageCore && document.getElementById('taskBtn-page'), null, { timeout: 60000 });
    // GPT service set once (as a user would in 服务设置)
    await p.locator('#taskMore').click(); await p.locator('#taskServiceSettings').click();
    await p.locator('#mangaGptUrl').fill('https://api.openai.com/v1'); await p.locator('#mangaGptModel').fill('gpt-image-1'); await p.locator('#svcDone').click();
    const click = async (sel) => { await p.locator(sel).click(); clicks++; };
    await click('#taskBtn-page');
    await p.locator('#taskScriptBox summary').click(); clicks++;
    await p.locator('#taskScript').fill(SCRIPT); typed++;
    await click('#taskScriptSplit');
    const info = await p.locator('#taskScriptInfo').innerText();
    report.info = info;
    assert(/2 页、7 格、7 句对白/.test(info), info);
    const fields = await p.evaluate(() => Array.from(document.querySelectorAll('#taskPagePanels fieldset')).map(f => ({ scene: f.querySelector('[data-scene]').value, line: f.querySelector('[data-line]').value })));
    assert.equal(fields.length, 5);
    assert.equal(fields[2].line, '咦？阿明！ / 早啊，小雪。');
    assert(!/出场/.test(fields[2].scene) && /音效「哐当哐当」/.test(fields[3].scene), 'names already in the scene are not repeated: ' + JSON.stringify(fields));
    assert.equal(fields[4].line, '今天的海真蓝。');
    assert(await p.locator('#taskScriptNext').isVisible());
    await p.screenshot({ path: path.join(OUT, '1-script-split.png') });
    await click('#taskPageGo');
    await p.waitForFunction(() => /整页完成|没成功/.test(document.getElementById('taskPageStatus').textContent) && !document.getElementById('taskPageGo').disabled, null, { timeout: 90000 });
    assert.equal(calls.length, 5);
    assert(calls.every((c, i) => c.includes(fields[i].scene.split('（')[0])), 'GPT prompts in panel order');
    // scene 1 lands in the frame read first (top-right for manga), the first image is "1"
    const geo = await p.evaluate(() => {
      const frames = canvas.getObjects().filter(o => o.isPanel && o.type === 'polygon').map(o => { const b = o.getBoundingRect(true, true); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
      const imgs = canvas.getObjects().filter(o => o.type === 'image' && /第\d+格画面$/.test(o.name || '')).map(o => { const b = o.getBoundingRect(true, true); return { n: Number(o.name.match(/第(\d+)格画面$/)[1]), cx: b.left + b.width / 2, cy: b.top + b.height / 2 }; });
      const ord = BalloonLayoutCore.readingOrder(frames, 'rtl');
      return { frames: frames.length, imgs, first: frames[ord[0]], second: frames[ord[1]], balloons: canvas.getObjects().filter(o => o.balloon && o.balloon.role === 'shape').length,
        texts: canvas.getObjects().filter(o => o.balloon && o.balloon.role === 'text').map(o => o.text.replace(/\n/g, '')) };
    });
    report.page1 = { frames: geo.frames, balloons: geo.balloons };
    assert.equal(geo.frames, 5); assert.equal(geo.balloons, 5, 'one balloon per line (2 lines in panel 3, none in panel 4)');
    const in1 = geo.imgs.find(i => i.n === 1), in2 = geo.imgs.find(i => i.n === 2);
    const inside = (pt, f) => pt.cx > f.x && pt.cx < f.x + f.w && pt.cy > f.y && pt.cy < f.y + f.h;
    assert(inside(in1, geo.first) && inside(in2, geo.second), 'scene i drawn into the i-th frame in reading order');
    assert(geo.texts.includes('今天也要加油！'));
    await p.screenshot({ path: path.join(OUT, '2-page1-done.png') });
    // page 2 from the queue
    await p.locator('#taskPageEdit').click(); clicks++;
    await click('#taskScriptNext');
    assert.equal(await p.locator('#taskPagePanels fieldset').count(), 2);
    await click('#taskPageGo');
    await p.waitForFunction(() => /整页完成|没成功/.test(document.getElementById('taskPageStatus').textContent) && !document.getElementById('taskPageGo').disabled, null, { timeout: 90000 });
    await p.waitForFunction(() => btmGetGuids().length >= 2, null, { timeout: 15000 });
    assert.equal(calls.length, 7);
    assert.equal(await p.evaluate(() => canvas.getObjects().filter(o => o.balloon && o.balloon.role === 'shape').length), 2);
    assert(await p.locator('#taskScriptNext').isHidden(), 'queue empty');
    await p.screenshot({ path: path.join(OUT, '3-page2-done.png') });
    // whole page = one undo step
    await p.keyboard.press('Escape'); await p.evaluate(() => document.activeElement && document.activeElement.blur());
    await p.evaluate(() => undo()); await p.waitForTimeout(1000);
    assert.equal(await p.evaluate(() => canvas.getObjects().filter(o => o.type === 'image').length), 0, 'one undo removes the generated page');
    // effort: script path vs typing every field by hand (7 scenes + 7 lines fields + 2 panel-count clicks)
    report.effort = { scriptPath: { clicks, pastes: typed }, manual: { clicks: 2 + 2 + 1, fieldsTyped: 14 } };
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    console.log('PASS script -> page e2e: paste -> 2 pages / 7 panels / 7 lines -> reading-order frames -> balloons -> next page -> one undo');
  } finally { await browser.close(); if (server) server.kill(); }
})().catch(e => { console.error(String(e.stack || e).split('\n').slice(0, 4).join(' | ')); if (server) server.kill(); process.exit(1); });

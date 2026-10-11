// 2.0 PSD import/export (ag-psd) in a real browser + structure checks in Node (no canvas package needed).
'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
// the vendored browser bundle exports nothing under require(): run it with a window global instead
const ag = (() => { const vm = require('vm'); const sb = { window: {}, console, TextEncoder, TextDecoder, Buffer, setTimeout };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'ui', 'third', 'ag-psd', 'ag-psd.js'), 'utf8'), sb); const a = sb.window.agPsd;
  a.initializeCanvas(() => { throw new Error('no canvas in Node'); }, (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }));
  return a; })();

const ROOT = path.join(__dirname, '..');
const SERVER = 'http://127.0.0.1:8000';
const OUT = process.env.PSD_OUT || path.join(ROOT, 'artifacts', 'psd');
const PAGE = path.join(__dirname, 'fixtures', 'novice', 'page1.png');
fs.mkdirSync(OUT, { recursive: true });
let server;
async function startServer() {
  const busy = await new Promise(r => { const s = net.connect(8000, '127.0.0.1'); s.once('connect', () => { s.destroy(); r(true); }); s.once('error', () => r(false)); });
  if (busy) throw new Error('port 8000 busy');
  server = spawn(process.env.PYTHON || 'python3', ['99_server.py'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, NAI_QUIET: '1', GPT_IMAGE_API_KEY: '' } });
  for (let i = 0; ; i++) { try { if ((await fetch(SERVER + '/index.html')).ok) return; } catch { /* starting */ } if (i > 150) throw new Error('server not ready'); await new Promise(r => setTimeout(r, 200)); }
}
function solid(w, h, rgba) { const d = new Uint8ClampedArray(w * h * 4); for (let i = 0; i < w * h; i++) d.set(rgba, i * 4); return { width: w, height: h, data: d }; }
function leaves(list, out = []) { for (const l of list || []) { if (l.children) leaves(l.children, out); else out.push(l); } return out; }

// a PSD as another app would write it: background, group, masked layer, multiply, hidden, offset
function thirdPartyPsd() {
  const W = 400, H = 300;
  const mask = solid(100, 80, [0, 0, 0, 255]); for (let y = 0; y < 80; y++) for (let x = 0; x < 50; x++) mask.data.set([255, 255, 255, 255], (y * 100 + x) * 4);
  return ag.writePsdUint8Array({ width: W, height: H, imageData: solid(W, H, [255, 255, 255, 255]), children: [
    { name: '背景', imageData: solid(W, H, [250, 250, 250, 255]), left: 0, top: 0 },
    { name: '组', opened: true, children: [
      { name: '蒙版层', imageData: solid(100, 80, [200, 30, 30, 255]), left: 20, top: 30, mask: { imageData: mask, left: 20, top: 30, defaultColor: 0 } },
      { name: '正片叠底', imageData: solid(60, 60, [30, 30, 200, 255]), left: 200, top: 100, blendMode: 'multiply', opacity: 0.5 },
    ] },
    { name: '隐藏层', imageData: solid(40, 40, [0, 200, 0, 255]), left: 300, top: 200, hidden: true },
  ] }, { generateThumbnail: false });
}

(async () => {
  await startServer();
  const browser = await chromium.launch({ headless: true });
  const errors = []; const report = {};
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', acceptDownloads: true });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept());
    await p.route(/https?:\/\/(?!127\.0\.0\.1:8000)/, r => r.abort());
    await p.route('**/manga-smart/lama-inpaint', async r => { const b = r.request().postDataJSON(); r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, image: b.image }) }); });
    await p.goto(SERVER + '/index.html', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof canvas !== 'undefined' && canvas.getWidth() > 0 && window.PsdIO && window.AiFill, null, { timeout: 60000 });
    assert.equal(await p.evaluate(() => !!window.agPsd), false, 'ag-psd not loaded at startup');
    await p.locator('#imageInput').setInputFiles(PAGE);
    await p.waitForFunction(() => canvas.getObjects().some(o => o.type === 'image'), null, { timeout: 30000 });
    await p.waitForTimeout(1000);
    // text + hidden extra layer + an AI 填充 layer (LaMa, mocked)
    await p.evaluate(() => {
      canvas.add(new fabric.Textbox('测试文字', { left: 100, top: 120, width: 200, fontSize: 40, fill: '#112233', name: '台词' }));
      const r = new fabric.Rect({ left: 600, top: 300, width: 80, height: 60, fill: '#ff0000', name: '隐藏的方块', visible: false }); canvas.add(r);
    });
    await p.locator('#taskBtn-fill').click(); await p.locator('#aiFillCard').waitFor({ state: 'visible' });
    await p.locator('[data-tool="box"]').click();
    const vb = await p.locator('#aiFillView').boundingBox();
    await p.mouse.move(vb.x + vb.width * 0.3, vb.y + vb.height * 0.15); await p.mouse.down(); await p.mouse.move(vb.x + vb.width * 0.4, vb.y + vb.height * 0.22, { steps: 3 }); await p.mouse.up();
    await p.locator('input[name=aiFillEngine][value=lama]').check(); await p.locator('#aiFillGenerate').click();
    await p.locator('#aiFillUse').click(); await p.waitForFunction(() => canvas.getObjects().some(o => o.aiFill), null, { timeout: 15000 });
    await p.evaluate(() => canvas.discardActiveObject());
    const nObjs = await p.evaluate(() => canvas.getObjects().filter(o => !o.excludeFromLayerPanel && !o.isIcon).length);

    // export via the File menu
    await p.locator('#navbarDropdownFile').click();
    const dlP = p.waitForEvent('download', { timeout: 60000 });
    await p.locator('#psdExport').click();
    const dl = await dlP; const file = path.join(OUT, 'export.psd'); await dl.saveAs(file);
    assert(/\.psd$/.test(dl.suggestedFilename()));
    const psd = ag.readPsd(fs.readFileSync(file), { useImageData: true, skipThumbnail: true });
    const L = leaves(psd.children);
    report.export = { bytes: fs.statSync(file).size, layers: L.map(l => l.name + (l.text ? '[T]' : '') + (l.mask ? '[M]' : '') + (l.hidden ? '[H]' : '')) };
    assert.equal(L.length, nObjs, 'one PSD layer per canvas object');
    const W = await p.evaluate(() => canvas.getWidth());
    assert.equal(psd.width, W);
    const txt = L.find(l => l.text); assert(txt && txt.text.text === '测试文字', 'editable text layer');
    assert(L.some(l => l.name === '隐藏的方块' && l.hidden), 'hidden flag kept');
    const hid = L.find(l => l.name === '隐藏的方块'); const hc = ((hid.imageData.height >> 1) * hid.imageData.width + (hid.imageData.width >> 1)) * 4; assert(hid.imageData.data[hc] === 255 && hid.imageData.data[hc + 1] === 0 && hid.imageData.data[hc + 3] === 255, 'hidden layer keeps its real pixels (red)');
    assert(report.export.bytes < 10 * 1048576, 'compact PSD: ' + report.export.bytes);
    const fill = L.find(l => /^AI 填充/.test(l.name)); assert(fill && fill.mask && fill.mask.imageData, 'AI layer exported with a layer mask');
    const md = fill.mask.imageData.data; let on = 0, off = 0; for (let i = 0; i < md.length; i += 4) { if (md[i] > 250) on++; else if (md[i] < 5) off++; }
    assert(on > 0 && off > 0, 'mask has inside and outside');
    assert(fill.imageData.data.every((v, i) => i % 4 !== 3 || v === 255), 'AI layer pixels opaque (edge lives in the mask)');

    // re-import the exported PSD through 导入漫画页
    await p.evaluate(() => { canvas.getObjects().slice().forEach(o => { if (!o.excludeFromLayerPanel) canvas.remove(o); }); canvas.renderAll(); });
    await p.locator('#imageInput').setInputFiles(file);
    await p.waitForFunction(n => canvas.getObjects().filter(o => !o.excludeFromLayerPanel && !o.isIcon).length >= n, nObjs, { timeout: 30000 });
    const back = await p.evaluate(() => canvas.getObjects().filter(o => !o.excludeFromLayerPanel && !o.isIcon).map(o => ({ t: o.type, name: o.name, text: o.text, visible: o.visible !== false })));
    report.reimport = back.map(b => b.name + ':' + b.t);
    assert(back.some(b => b.text === '测试文字' && /text/i.test(b.t)), 'text comes back editable');
    assert(back.some(b => b.name === '隐藏的方块' && !b.visible), 'hidden comes back hidden');

    // a third-party PSD: group flattened, mask baked into alpha, multiply + opacity mapped, hidden kept, offsets kept
    const tp = path.join(OUT, 'third-party.psd'); fs.writeFileSync(tp, thirdPartyPsd());
    const pages0 = await p.evaluate(() => btmGetGuids().length);
    await p.locator('#imageInput').setInputFiles(tp);
    await p.waitForFunction(() => canvas.getObjects().some(o => o.name === '隐藏层'), null, { timeout: 30000 });
    const tpr = await p.evaluate(() => {
      const by = n => canvas.getObjects().find(o => o.name === n); const b = canvas.getObjects().find(o => o.type === 'image' && o._element && o._element.naturalWidth === 400); const k = b.getScaledWidth() / 400;
      const m = by('蒙版层'); const c = document.createElement('canvas'); c.width = m._element.width; c.height = m._element.height; const g = c.getContext('2d'); g.drawImage(m._element, 0, 0);
      const a = x => g.getImageData(x, 40, 1, 1).data[3];
      return { k, left: (m.left - b.left) / k, top: (m.top - b.top) / k, pageW: canvas.getWidth(), aLeft: a(10), aRight: a(90), mult: by('正片叠底').globalCompositeOperation, op: by('正片叠底').opacity, hidden: by('隐藏层').visible === false, group: !!by('组') };
    });
    report.thirdParty = tpr;
    assert.equal(await p.evaluate(() => btmGetGuids().length), pages0 + 1, 'PSD into a used page -> its own new page');
    assert.equal(await p.evaluate(() => canvas.getObjects().some(o => o.text === '测试文字')), false, 'not mixed into the previous page');
    assert.equal(Math.round(tpr.left), 20); assert.equal(Math.round(tpr.top), 30);
    assert(tpr.aLeft === 255 && tpr.aRight === 0, 'mask baked into alpha');
    assert.equal(tpr.mult, 'multiply'); assert(Math.abs(tpr.op - 0.5) < 0.01, 'opacity (8-bit in PSD)'); assert(tpr.hidden); assert(!tpr.group, 'groups flattened');
    await p.screenshot({ path: path.join(OUT, 'third-party-import.png') });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    console.log('PASS psd e2e: export (layers, text, hidden, AI mask) -> re-import -> third-party PSD (group, mask, multiply, hidden, offset)');
  } finally { await browser.close(); if (server) server.kill(); }
})().catch(e => { console.error(String(e.stack || e).split('\n').slice(0, 4).join(' | ')); if (server) server.kill(); process.exit(1); });

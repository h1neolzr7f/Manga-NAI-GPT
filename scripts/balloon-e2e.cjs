// 2.0 #3 automatic balloons + reading order.
// CI (default): mocked face endpoint, deterministic checks.  BALLOON_REAL=1 PYTHON=<venv>: real local faces on the
// dogfood pages + benchmark old fixed top-right rule vs the new placement (metrics + before/after screenshots).
'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const SERVER = 'http://127.0.0.1:8000';
const REAL = process.env.BALLOON_REAL === '1';
const OUT = process.env.BALLOON_OUT || path.join(ROOT, 'artifacts', 'balloons');
const FIX = path.join(__dirname, 'fixtures', 'novice', 'page1.png');
fs.mkdirSync(OUT, { recursive: true });
let server;
async function startServer() {
  const busy = await new Promise(r => { const s = net.connect(8000, '127.0.0.1'); s.once('connect', () => { s.destroy(); r(true); }); s.once('error', () => r(false)); });
  if (busy) throw new Error('port 8000 busy');
  server = spawn(process.env.PYTHON || 'python3', ['99_server.py'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, NAI_QUIET: '1', GPT_IMAGE_API_KEY: '' } });
  for (let i = 0; ; i++) { try { if ((await fetch(SERVER + '/index.html')).ok) return; } catch { /* starting */ } if (i > 150) throw new Error('server not ready'); await new Promise(r => setTimeout(r, 200)); }
}
async function fresh(browser) {
  const p = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })).newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept());
  await p.route(/https?:\/\/(?!127\.0\.0\.1:8000)/, r => r.abort());
  await p.addInitScript(() => { try { localStorage.setItem('mnai.whatsNew.1.6.6', '1'); localStorage.setItem('mnai.whatsNew.1.6.7', '1'); } catch (e) {} });
  await p.goto(SERVER + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof canvas !== 'undefined' && canvas.getWidth() > 0 && window.BalloonLayout && window.Commands && Commands.list().some(c => c.id === 'view.readingOrder'), null, { timeout: 60000 });
  return { p, errors };
}
async function importPage(p, file) {
  await p.locator('#imageInput').setInputFiles(file);
  await p.waitForFunction(() => canvas.getObjects().some(o => o.type === 'image'), null, { timeout: 30000 });
  await p.waitForTimeout(800);
}
// the rule used before 2.0: one balloon in the top-right corner of each panel (second line stacked below)
async function shotCanvas(p, file) {
  const url = await p.evaluate(() => { const vt = canvas.viewportTransform.slice(); canvas.viewportTransform = [1, 0, 0, 1, 0, 0]; try { canvas.renderAll(); return canvas.toDataURL({ format: 'png', multiplier: Math.min(1, 1100 / canvas.getWidth()) }); } finally { canvas.viewportTransform = vt; canvas.renderAll(); } });
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
}
const OLD_RULE = `(rects, lines) => { const out = []; rects.forEach((r, i) => { const t = BalloonLayout.splitLines(lines[i]); let y = r.y + r.h * 0.05;
  t.forEach(s => { const fs = Math.max(20, Math.round(Math.min(r.w, r.h) * 0.06)); const n = Array.from(s).length, per = n <= 9 ? n : Math.ceil(Math.sqrt(n * 1.6));
    const L = window.CjkBreak ? CjkBreak.breakLines(s, per) : [s]; const longest = Math.max(...L.map(l => Array.from(l).length));
    const w = Math.max(longest * fs * 1.08 / 0.66, fs * 4), h = Math.max(L.length * fs * 1.16 * 1.75, fs * 2.6);
    out.push({ x: r.x + r.w - w - r.w * 0.04, y, w, h, panel: i, panelRect: r }); y += h + 6; }); }); return out; }`;

(async () => {
  await startServer();
  const browser = await chromium.launch({ headless: true });
  const report = { mode: REAL ? 'real faces' : 'mock faces' };
  try {
    if (!REAL) {
      const { p, errors } = await fresh(browser);
      // fixture page1: girl's face in the top panel, right of centre -> the old top-right corner sits near it
      // the client sends a <=1024 px PNG (page 1200x1700 -> x0.602) and scales boxes back: answer in that image's pixels
      const fk = 1024 / 1700;
      await p.route('**/manga-smart/faces', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, available: true, faces: [[540 * fk, 150 * fk, 720 * fk, 330 * fk, 0.9]] }) }));
      await importPage(p, FIX);
      const pa = await p.evaluate(async () => (await PanelAuto.get()).panels.map(q => ({ x: q.x, y: q.y, w: q.w, h: q.h })));
      assert(pa.length >= 2);
      const lines = pa.map((_, i) => i === 0 ? '今天也要加油！/ 嗯，一起走吧。' : '再见啦，明天见！');
      const res = await p.evaluate(async ([pa, lines]) => { const r = await BalloonLayout.layoutPage(pa, lines); saveStateByManual(); return { m: r.metrics, n: r.placed.length, placed: r.placed.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h, tail: !!b.tail, panel: b.panel })) }; }, [pa, lines]);
      report.mock = res.m;
      assert.equal(res.n, pa.length + 1, '"/" splits panel 1 into two balloons');
      assert.equal(res.m.facesCovered, 0, 'face kept clear'); assert.equal(res.m.balloonOverlap, 0); assert.equal(res.m.orderViolations, 0);
      assert(res.placed.filter(b => b.panel === 0).every(b => b.tail), 'balloons in the face panel get a tail');
      const objs = await p.evaluate(() => canvas.getObjects().filter(o => o.balloon).map(o => ({ role: o.balloon.role, id: o.balloon.id, type: o.type, text: o.text })));
      assert.equal(objs.filter(o => o.role === 'shape' && o.type === 'group').length, res.n);
      assert.equal(objs.filter(o => o.role === 'text').length, res.n);
      // move a balloon onto the face, then 自动排对白气泡 (palette) fixes it; one undo step named after the command
      await p.evaluate(() => { const g = canvas.getObjects().find(o => o.balloon && o.balloon.role === 'shape'); g.set({ left: 560, top: 180 }); g.balloon.rect = [560, 180, g.balloon.w, g.balloon.h]; g.setCoords(); saveStateByManual(); });
      await p.keyboard.press('Control+k'); await p.locator('#cmdPaletteInput').fill('自动排'); await p.keyboard.press('Enter');
      await p.waitForFunction(() => CommandHistory.entries().slice(-1)[0].label === '自动排对白气泡', null, { timeout: 15000 });
      const after = await p.evaluate(() => canvas.getObjects().filter(o => o.balloon && o.balloon.role === 'shape').map(o => o.balloon.rect));
      const tips = await p.evaluate(() => canvas.getObjects().filter(o => o.balloon && o.balloon.role === 'shape' && o.balloon.tip).map(o => o.balloon.tip));
      assert(tips.length && tips.every(([x, y]) => !(x > 540 && x < 720 && y > 150 && y < 330)), 'tails stop outside the face: ' + JSON.stringify(tips));
      assert(after.every(([x, y, w, h]) => x + w <= 540 || x >= 720 || y + h <= 150 || y >= 330), 'arrange moved it off the face: ' + JSON.stringify(after));
      // the user's edited text survives a re-arrange
      await p.evaluate(() => { const t = canvas.getObjects().find(o => o.balloon && o.balloon.role === 'text'); t.set({ text: '改过的台词', fill: '#c00' }); saveStateByManual(); });
      await p.evaluate(() => Commands.run('balloon.arrange'));
      await p.waitForTimeout(500);
      assert(await p.evaluate(() => canvas.getObjects().some(o => o.balloon && o.balloon.role === 'text' && o.text === '改过的台词' && o.fill === '#c00')), 'user text + colour kept');
      // undo -> redo keeps balloon metadata (history JSON includes it)
      await p.evaluate(() => undo()); await p.waitForTimeout(800); await p.evaluate(() => redo()); await p.waitForTimeout(800);
      assert.equal(await p.evaluate(() => canvas.getObjects().filter(o => o.balloon && o.balloon.role === 'shape').length), res.n, 'metadata survives undo/redo');
      // reading-order overlay + direction toggle
      const ord = await p.evaluate(() => Commands.run('view.readingOrder'));
      assert.equal(ord.panels, pa.length); assert(await p.locator('#readingOrderView').count() === 1);
      await p.screenshot({ path: path.join(OUT, 'reading-order.png') });
      await p.evaluate(() => Commands.run('view.readingDir')); assert.equal(await p.evaluate(() => BalloonLayout.dir()), 'ltr');
      await p.evaluate(() => Commands.run('view.readingDir')); assert.equal(await p.evaluate(() => BalloonLayout.dir()), 'rtl');
      // no face model installed: still works, avoiding busy art only
      await p.unroute('**/manga-smart/faces');
      await p.route('**/manga-smart/faces', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, available: false, faces: [] }) }));
      const r2 = await p.evaluate(() => BalloonLayout.arrange().then(r => r.facesAvailable));
      assert.equal(r2, false);
      assert.deepEqual(errors, []);
    } else {
      // benchmark on the 4 dogfood pages with the real local face detector
      report.pages = [];
      const pages = [1, 2, 3, 4].map(i => `/workspace/shots-20261010/comic/page-${i}.png`).filter(f => fs.existsSync(f));
      for (const file of pages) {
        const { p, errors } = await fresh(browser);
        await importPage(p, file);
        const pa = await p.evaluate(async () => (await PanelAuto.get()).panels.map(q => ({ x: q.x, y: q.y, w: q.w, h: q.h })));
        const lines = pa.map((_, i) => ['今天也要加油！/ 嗯，一起走吧。', '咦？那是什么……', '快看，下雪了！/ 好漂亮啊。', '明天见！'][i % 4]);
        const drawn = await p.evaluate(async () => { await MangaSmartTextEditor.ensure(); return MangaSmartTextEditor.cachedRegions(); });
        const t0 = Date.now();
        const info = await p.evaluate(async () => { const i = await BalloonLayout.analyze(); window.__info = i; return { faces: i.faces, avail: i.facesAvailable }; });
        const tAnalyze = Date.now() - t0;
        const old = await p.evaluate(`(${OLD_RULE})(${JSON.stringify(pa)}, ${JSON.stringify(lines)})`);
        const oldM = await p.evaluate(([o]) => BalloonLayoutCore.metrics(o, window.__info.faces, window.__info.energy, 'rtl'), [old]);
        // draw the old rule for the before screenshot
        await p.evaluate(([o]) => { o.forEach(b => canvas.add(new fabric.Ellipse({ left: b.x, top: b.y, rx: b.w / 2, ry: b.h / 2, fill: '#fff', stroke: '#e11d48', strokeWidth: 4, isOld: true }))); canvas.renderAll(); }, [old]);
        const base = path.basename(file, '.png');
        await shotCanvas(p, path.join(OUT, base + '-old.png'));
        await p.evaluate(() => { canvas.getObjects().filter(o => o.isOld).forEach(o => canvas.remove(o)); canvas.renderAll(); });
        const t1 = Date.now();
        const nw = await p.evaluate(async ([pa, lines]) => (await BalloonLayout.layoutPage(pa, lines, window.__info)).metrics, [pa, lines]);
        const tPlace = Date.now() - t1;
        await p.evaluate(() => canvas.renderAll());
        await shotCanvas(p, path.join(OUT, base + '-new.png'));
        const hit = list => Math.round(list.reduce((a, b) => a + drawn.reduce((s2, d) => { const w = Math.min(b.x + b.w, d.x + d.w) - Math.max(b.x, d.x), h = Math.min(b.y + b.h, d.y + d.h) - Math.max(b.y, d.y); return s2 + (w > 0 && h > 0 ? w * h : 0); }, 0), 0));
        const newPlaced = await p.evaluate(() => canvas.getObjects().filter(o => o.balloon && o.balloon.role === 'shape').map(o => { const [x, y, w, h] = o.balloon.rect; return { x, y, w, h }; }));
        oldM.drawnTextOverlap = hit(old); nw.drawnTextOverlap = hit(newPlaced);
        report.pages.push({ page: base, panels: pa.length, faces: info.faces.length, facesAvailable: info.avail, drawnText: drawn.length, old: oldM, new: nw, msAnalyze: tAnalyze, msPlace: tPlace });
        assert.deepEqual(errors, []);
        await p.context().close();
      }
      const sum = k => report.pages.reduce((a, r) => ({ old: a.old + r.old[k], new: a.new + r.new[k] }), { old: 0, new: 0 });
      report.total = { facesCovered: sum('facesCovered'), drawnTextOverlap: sum('drawnTextOverlap'), balloonOverlap: sum('balloonOverlap'), orderViolations: sum('orderViolations'),
        meanDetail: { old: +(report.pages.reduce((a, r) => a + r.old.meanDetail, 0) / report.pages.length).toFixed(3), new: +(report.pages.reduce((a, r) => a + r.new.meanDetail, 0) / report.pages.length).toFixed(3) } };
    }
    fs.writeFileSync(path.join(OUT, REAL ? 'bench.json' : 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report.total || report));
    console.log('PASS balloon e2e (' + report.mode + ')');
  } finally { await browser.close(); if (server) server.kill(); }
})().catch(e => { console.error(String(e.stack || e).split('\n').slice(0, 4).join(' | ')); if (server) server.kill(); process.exit(1); });

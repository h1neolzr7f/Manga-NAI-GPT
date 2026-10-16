// 2.0 command layer + history panel: labelled steps with thumbnails, jump back, palette (Ctrl+K) search/run.
'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const SERVER = 'http://127.0.0.1:8000';
const OUT = process.env.CMD_OUT || path.join(ROOT, 'artifacts', 'command-history');
const PAGE = path.join(__dirname, 'fixtures', 'novice', 'page1.png');
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
  const errors = []; const report = {};
  try {
    const p = await (const __ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })).newPage();
    p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept());
    await p.route(/https?:\/\/(?!127\.0\.0\.1:8000)/, r => r.abort());
    await p.addInitScript(() => { try { localStorage.setItem('mnai.whatsNew.1.6.6', '1'); } catch (e) {} });
    await p.goto(SERVER + '/index.html', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => typeof canvas !== 'undefined' && canvas.getWidth() > 0 && window.Commands && Commands.list().some(c => c.id.startsWith('task.')), null, { timeout: 60000 });
    await p.locator('#imageInput').setInputFiles(PAGE);
    await p.waitForFunction(() => canvas.getObjects().some(o => o.type === 'image'), null, { timeout: 30000 });
    // wait until the import has finished saving history (slow CI runners): stack length stable for 1.5 s
    await p.waitForFunction(() => !canvas.getObjects().some(o => o.text === '拖放或生成图片') && stateStack.some(x => /"type":"image"/i.test(x)), null, { timeout: 30000, polling: 200 });
    await p.waitForFunction(() => { const n = stateStack.length; if (window.__hn !== n) { window.__hn = n; window.__ht = Date.now(); } return Date.now() - window.__ht > 1500; }, null, { timeout: 30000, polling: 200 });
    // regression: a window resize must not put the empty-page hint back over an imported page
    await p.evaluate(() => initMessage());   // what the resize handler calls
    assert.equal(await p.evaluate(() => canvas.getObjects().filter(o => o.text === '拖放或生成图片').length), 0, 'no empty-page hint after resize');
    // three ordinary edits, no command announced -> labels come from the diff
    await p.evaluate(() => { const t = new fabric.Textbox('早上好', { left: 100, top: 100, width: 200, fontSize: 40, fill: '#111' }); t.guid = 'cmd-t'; canvas.add(t); saveStateByManual(); });
    await p.evaluate(() => { const t = canvas.getObjects().find(o => o.text === '早上好'); t.set({ left: 300 }); saveStateByManual(); });
    await p.evaluate(() => { const t = canvas.getObjects().find(o => o.text === '早上好'); canvas.setActiveObject(t); });
    // palette: Ctrl+K -> "复制" -> Enter (selected text gets duplicated; step named by the command)
    await p.keyboard.press('Control+k');
    await p.locator('#cmdPaletteInput').waitFor({ state: 'visible' });
    await p.locator('#cmdPaletteInput').fill('复制');
    await p.screenshot({ path: path.join(OUT, 'palette.png') });
    assert.equal(await p.locator('.cmd-item').first().getAttribute('data-id'), 'sel.duplicate');
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => canvas.getObjects().filter(o => o.text === '早上好').length === 2, null, { timeout: 5000 });
    assert.equal(await p.locator('#cmdPalette').count(), 0, 'palette closes after running');
    // history panel from the ⋯ menu
    await p.locator('#taskMore').click(); await p.locator('#taskHistory').click();
    await p.locator('#naiHistoryPanel').waitFor({ state: 'visible' });
    await p.waitForFunction(() => document.querySelectorAll('#naiHistoryList img').length >= 4, null, { timeout: 8000 });
    assert.equal(await p.locator('.nai-history-nothumb').count(), 0, 'every step has a thumbnail, even quick successive ones');
    const rows = await p.locator('.nai-history-label').allTextContents();
    report.rows = rows;
    assert(/复制图层/.test(rows[0]) && /当前/.test(rows[0]), 'newest first, named by command: ' + rows[0]);
    assert(rows.some(r => /^移动文字「早上好」/.test(r)), 'move inferred: ' + JSON.stringify(rows));
    assert(rows.some(r => /^添加文字「早上好」/.test(r)), 'add inferred: ' + JSON.stringify(rows));
    assert(!rows.some(r => /^步骤 \d+/.test(r)), 'no anonymous 步骤 n');
    const box = await p.locator('#naiHistoryPanel').boundingBox(); const canvasBox = await p.locator('#canvas-container, .canvas-container').first().boundingBox().catch(() => null);
    report.panel = box; report.canvas = canvasBox;
    const tb = await p.evaluate(() => Math.max(...Array.from(document.querySelectorAll('.task-bar, #taskBar, .navbar')).map(e => e.getBoundingClientRect().bottom)));
    assert(box.y >= tb, 'history panel below the toolbars (' + box.y + ' vs ' + tb + ')');
    await p.screenshot({ path: path.join(OUT, 'history-panel.png') });
    // jump back to "添加文字" -> the move and the copy are undone; they stay as future steps
    await p.locator('.nai-history-item', { hasText: '添加文字' }).first().click();
    await p.waitForFunction(() => { const t = canvas.getObjects().filter(o => o.text === '早上好'); return t.length === 1 && t[0].left === 100; }, null, { timeout: 8000 });
    await p.waitForFunction(() => document.querySelectorAll('.nai-history-item.is-future').length === 2, null, { timeout: 5000 });
    // redo through the palette
    await p.keyboard.press('Control+k'); await p.locator('#cmdPaletteInput').fill('重做'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => canvas.getObjects().filter(o => o.text === '早上好')[0].left === 300, null, { timeout: 8000 });
    // palette search: tasks, files, empty result, Esc, Ctrl+K toggles, plain K is still the knife
    await p.keyboard.press('Control+k');
    const find = async q => { await p.locator('#cmdPaletteInput').fill(q); return p.locator('.cmd-item').evaluateAll(n => n.map(x => x.dataset.id)); };
    assert((await find('psd'))[0] === 'file.exportPsd');
    assert((await find('换角色')).includes('task.swap'));
    assert((await find('导出')).includes('file.exportAll'));
    assert.equal((await find('zzqqxx')).length, 0); assert.equal(await p.locator('.cmd-empty').count(), 1);
    await p.keyboard.press('Escape'); assert.equal(await p.locator('#cmdPalette').count(), 0);
    await p.keyboard.press('Control+k'); await p.keyboard.press('Control+k'); assert.equal(await p.locator('#cmdPalette').count(), 0, 'Ctrl+K toggles');
    await p.mouse.click(700, 450); await p.keyboard.press('k'); assert.equal(await p.locator('#cmdPalette').count(), 0, 'plain K does not open the palette');
    // a command needing a selection is hidden without one
    await p.evaluate(() => canvas.discardActiveObject());
    assert(!(await p.evaluate(() => Commands.list().map(c => c.id))).includes('sel.delete'));
    report.commands = await p.evaluate(() => Commands.list().length);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    console.log('PASS command/history e2e: labelled steps + thumbnails, jump back, palette run/search/toggle');
  } finally { await browser.close(); if (server) server.kill(); }
})().catch(e => { console.error(String(e.stack || e).split('\n').slice(0, 4).join(' | ')); if (server) server.kill(); process.exit(1); });

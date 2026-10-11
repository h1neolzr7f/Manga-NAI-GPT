// 1.6 prompt assist (mock LLM, local tag fixture): off by default; enable in 服务设置 -> tag DB download + SHA check ->
// autocomplete with aliases in a NovelAI prompt box -> 查标签 alias fix -> 润色 via the configured chat model -> diff -> apply.
const assert = require('assert'); const path = require('path'); const fs = require('fs'); const crypto = require('crypto'); const { spawn } = require('child_process');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'); const PORT = 8000 + Math.floor(Math.random() * 900) + 50; const SHOTS = process.env.SHOTS_DIR || '';
const FIX = fs.readFileSync(path.join(__dirname, 'fixtures/danbooru-sample.csv'), 'utf8');
(async () => {
  const srv = spawn('python3', ['99_server.py'], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, MNAI_PORT: String(PORT), NAI_QUIET: '1' } });
  try {
    await new Promise(r => setTimeout(r, 2500));
    const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', serviceWorkers: 'block' }); const p = await ctx.newPage();
    const errors = []; p.on('pageerror', e => errors.push(e.message));
    const sha = crypto.createHash('sha256').update(FIX).digest('hex'); let tagFetches = 0, llm = [];
    await p.addInitScript(([s, n]) => { window.__PA_TAG_SOURCE = { url: 'https://tags.example/danbooru.csv', sha256: s, bytes: n }; }, [sha, FIX.length]);
    await p.route(/https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    await p.route('https://tags.example/danbooru.csv', r => { tagFetches++; r.fulfill({ contentType: 'text/csv', body: FIX }); });
    await p.route(/\/director-proxy\/chat-completions/, r => { const body = r.request().postDataJSON(); llm.push({ body, headers: r.request().headers() });
      r.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: 'PROMPT:\n1girl, serafuku, red umbrella, rain, train station\nshe holds the umbrella over her head\nbest quality, absurdres\n\nCHARACTER:\n1|C3| togawa sakiko, girl, smile\n\nUC:\nlowres' } }] }) }); });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await p.waitForFunction(() => window.TaskLauncher && window.PromptAssist, null, { timeout: 60000 }); await p.waitForTimeout(800);
    // off by default: nothing extra on the 改一块 prompt box
    await p.locator('#imageInput').setInputFiles(path.join(ROOT, 'docs/images/comic-page.jpg')); await p.waitForFunction(() => canvas.getObjects().some(o => o.type === 'image'), null, { timeout: 30000 });
    await p.locator('#taskBtn-fill').click(); await p.locator('#aiFillCard').waitFor(); await p.locator('[data-preset="replace"]').click(); await p.waitForTimeout(1000);
    assert.strictEqual(await p.locator('#aiFillCard .pa-bar').count(), 0, 'off by default'); await p.locator('#aiFillClose').click();
    // polish without a chat model configured -> 服务设置 opens on that section
    assert.strictEqual(await p.evaluate(() => localStorage.getItem('mnai.promptAssist')), null);
    await p.locator('#taskMore').click(); await p.locator('#taskServiceSettings').click();
    await p.locator('#svcPaEnable').check(); await p.locator('#svcPaTags').click();
    await p.waitForFunction(() => /标签库就绪/.test(document.getElementById('svcPaTagStatus').textContent), null, { timeout: 15000 });
    assert.strictEqual(tagFetches, 1);
    await p.locator('#naiDirectorApiUrl').fill('https://api.deepseek.com/v1'); await p.locator('#naiDirectorApiKey').fill('mock-key-not-real');
    if (SHOTS) await p.screenshot({ path: SHOTS + '/6-settings-prompt-assist.png' });
    await p.locator('#svcDone').click();
    // 改一块 (NAI prompt box): autocomplete, alias, check, polish
    await p.locator('#taskBtn-fill').click(); await p.locator('#aiFillCard').waitFor(); await p.locator('[data-preset="replace"]').click();
    await p.locator('#aiFillCard .pa-bar').waitFor({ state: 'visible', timeout: 5000 });
    const t = p.locator('#aiFillPrompt'); await t.click(); await t.pressSequentially('1girl, sailor', { delay: 20 });
    await p.locator('#paMenu .pa-item').first().waitFor(); const first = await p.locator('#paMenu .pa-item').first().textContent();
    assert(/serafuku/.test(first) && /sailor fuku/.test(first), first);
    await p.keyboard.press('Tab'); assert.strictEqual(await t.inputValue(), '1girl, serafuku, ');
    await t.pressSequentially('raining', { delay: 10 }); await p.keyboard.press('Escape');
    await p.locator('#aiFillCard [data-pa="check"]').click(); await p.locator('#paDiff').waitFor();
    assert(/raining→rain/.test(await p.locator('#aiFillCard .pa-note').textContent()));
    await p.locator('#paDiffApply').click(); assert.strictEqual(await t.inputValue(), '1girl, serafuku, rain');
    await p.locator('#aiFillCard [data-pa="polish"]').click(); await p.locator('#paDiff').waitFor();
    const chips = await p.locator('#paDiff .pa-chip').allTextContents();
    assert(chips.includes('+ red umbrella') && chips.includes('serafuku'), chips.join('|'));
    if (SHOTS) await p.screenshot({ path: SHOTS + '/7-polish-diff.png' });
    assert.strictEqual(await t.inputValue(), '1girl, serafuku, rain', 'nothing applied before 应用');
    await p.locator('#paDiffApply').click();
    assert(/^1girl, serafuku, red umbrella, rain, train station, she holds the umbrella over her head, best quality, absurdres$/.test(await t.inputValue()), await t.inputValue());
    // request went to the configured endpoint via the local proxy; system prompt carries the ported rules
    assert.strictEqual(llm.length, 1); assert.strictEqual(llm[0].headers['x-director-api-url'], 'https://api.deepseek.com/v1/chat/completions');
    assert(/NovelAI V4/.test(llm[0].body.messages[0].content) && /POLISH/.test(llm[0].body.messages[1].content));
    // weight hotkeys + token estimate (always on for NAI prompt boxes)
    await t.fill('1girl, rain'); await t.press('End'); await p.keyboard.press('Control+ArrowUp');
    assert.strictEqual(await t.inputValue(), '1girl, 1.1::rain::'); await p.keyboard.press('Control+ArrowDown'); assert.strictEqual(await t.inputValue(), '1girl, rain');
    assert(/约 \d+ \/ 512 token/.test(await p.locator('#aiFillCard .pa-tokens').textContent()));
    // NovelAI PNG info -> apply positive to the focused box; save as style snippet
    const png = require('zlib') && (() => { const zlib = require('zlib'); const crc = b => { let c, tb = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; tb[n] = c >>> 0; } c = 0xffffffff; for (const x of b) c = tb[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
      const ch = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty, 'latin1'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
      const ih = Buffer.alloc(13); ih.writeUInt32BE(1, 0); ih.writeUInt32BE(1, 4); ih[8] = 8;
      return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ch('IHDR', ih), ch('tEXt', Buffer.from('Comment\0' + JSON.stringify({ prompt: 'monochrome, manga, screentone, 1girl', uc: 'lowres', seed: 5, steps: 28, scale: 5, width: 832, height: 1216 }), 'utf8')), ch('IDAT', zlib.deflateSync(Buffer.from([0, 0]))), ch('IEND', Buffer.alloc(0))]); })();
    await t.focus();
    await p.evaluate(b64 => { const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); return PromptAssist.readImageParams(new File([bytes], 'nai.png', { type: 'image/png' })); }, png.toString('base64'));
    await p.locator('#paMeta').waitFor(); if (SHOTS) await p.screenshot({ path: SHOTS + '/8-png-params.png' });
    await p.locator('#paMeta [data-apply="pos"]').click(); assert.strictEqual(await t.inputValue(), 'monochrome, manga, screentone, 1girl');
    await p.evaluate(b64 => { const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); return PromptAssist.readImageParams(new File([bytes], 'nai.png', { type: 'image/png' })); }, png.toString('base64'));
    p.once('dialog', d => d.accept('黑白网点')); await p.locator('#paMetaSnip').click();
    assert.strictEqual((await p.evaluate(() => PromptAssist.snippets()))[0].name, '黑白网点');
    // turning it off hides the buttons again
    await p.evaluate(() => PromptAssist.setEnabled(false)); assert(!(await p.locator('#aiFillCard .pa-bar').isVisible()));
    assert.deepStrictEqual(errors, []);
    console.log('PASS prompt assist (mock LLM): off by default, tag DB SHA-checked + cached, autocomplete/aliases, check, polish diff -> apply');
    await b.close();
  } finally { srv.kill(); }
})().catch(e => { console.error(e); process.exit(1); });

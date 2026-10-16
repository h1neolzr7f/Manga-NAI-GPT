// 1.6 NovelAI routes (mock NAI): 改一块 via NAI inpaint, GPT refusal -> 改用 NovelAI, 画一页 via NAI with panel aspect sizes,
// cost preview / free tier, engine choice remembered, privacy blur, safe mode opt-in, prompt passed through untouched.
const assert = require('assert'); const path = require('path'); const { spawn } = require('child_process');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'); const PORT = 8000 + Math.floor(Math.random() * 900) + 50; const SHOTS = process.env.SHOTS_DIR || '';
const PAGE = path.join(ROOT, 'docs/images/comic-page.jpg');
const REAL = false; // real SFW calls are run by hand, never in CI
(async () => {
  const srv = spawn('python3', ['99_server.py'], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, MNAI_PORT: String(PORT), NAI_QUIET: '1' } });
  try {
    await new Promise(r => setTimeout(r, 2500));
    const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', serviceWorkers: 'block' }); const p = await ctx.newPage();
    const errors = []; p.on('pageerror', e => errors.push(e.message));
    const naiBodies = [];
    await p.route(/https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    await p.route('**/manga-smart/faces', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, available: false, faces: [] }) }));
    if (!REAL) {
      await p.route(/\/nai-proxy\/health/, r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, tier: 3, anlas: 1000, active: true }) }));
      await p.route('**/nai-proxy/generate-image', async route => {
        const body = route.request().postDataJSON(); naiBodies.push(body); const P = body.parameters;
        const image = await p.evaluate(async ({ w, h, src }) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
          if (src) { const i = new Image(); i.src = 'data:image/png;base64,' + src; await i.decode(); g.drawImage(i, 0, 0); } else { g.fillStyle = '#ddd'; g.fillRect(0, 0, w, h); }
          g.fillStyle = 'rgba(40,40,40,.55)'; g.beginPath(); g.arc(w / 2, h / 2, Math.min(w, h) / 4, 0, 7); g.fill(); return c.toDataURL('image/png').split(',')[1]; }, { w: P.width, h: P.height, src: P.image });
        route.fulfill({ contentType: 'application/json', body: JSON.stringify({ image }) });
      });
    }
    await p.route('**/gpt-image-proxy', async route => {
      const body = route.request().postDataJSON() || {};
      if (['config', 'trust'].includes(body.operation)) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, envKey: true, trustedBaseUrl: 'https://api.openai.com/v1' }) });
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Your request was rejected as a result of our safety system.' }) });
    });
    await p.addInitScript(() => { try { localStorage.setItem('mnai.whatsNew.1.6.6', '1'); localStorage.setItem('mnai.whatsNew.1.6.7', '1'); } catch (e) {} });
    await p.goto('http://127.0.0.1:' + PORT + '/index.html'); await p.waitForFunction(() => window.TaskLauncher && window.NaiEngine && document.querySelector('[data-task]'), null, { timeout: 60000 }); await p.waitForTimeout(1000);
    // settings: GPT + NAI token; model + safe-mode controls live in 服务设置
    await p.locator('#taskMore').click(); await p.locator('#taskServiceSettings').click();
    await p.locator('#mangaGptUrl').fill('https://api.openai.com/v1'); await p.locator('#mangaGptModel').fill('gpt-image-1');
    const tok = REAL ? (process.env.NOVELAI_API_KEY || '') : 'pst-mock-token';
    await p.locator('#novelaiApiKey').fill(tok);
    assert(await p.locator('#svcNaiModel').isVisible(), 'NAI model in settings'); assert.strictEqual(await p.locator('#svcNaiSafeMode').isChecked(), false, 'safe mode off by default');
    if (SHOTS) await p.screenshot({ path: SHOTS + '/1-settings-nai.png' });
    await p.locator('#svcDone').click();
    await p.locator('#imageInput').setInputFiles(PAGE); await p.waitForFunction(() => canvas.getObjects().some(o => o.type === 'image'), null, { timeout: 30000 }); await p.waitForTimeout(1500);
    // --- 改一块 with GPT: refusal -> neutral message + one-click NovelAI
    await p.locator('#taskBtn-fill').click(); await p.locator('#aiFillCard').waitFor();
    const vb = await p.locator('#aiFillView').boundingBox(); const X = f => vb.x + vb.width * f, Y = f => vb.y + vb.height * f;
    await p.mouse.move(X(.1), Y(.05)); await p.mouse.down(); for (let k = 0; k < 5; k++) { await p.mouse.move(X(.4), Y(.05 + k * .02), { steps: 5 }); await p.mouse.move(X(.1), Y(.06 + k * .02), { steps: 5 }); } await p.mouse.up();
    await p.locator('[data-preset="replace"]').click();
    await p.locator('#aiFillEngines [data-ai="gpt"]').click();
    await p.locator('#aiFillPrompt').fill('red umbrella, rain');
    if (!REAL) {
      await p.locator('#aiFillGenerate').click();
      await p.locator('#aiFillUseNai').waitFor({ state: 'visible', timeout: 30000 });
      const st = await p.locator('#aiFillStatus').textContent(); assert(/自己的内容规则/.test(st) && /不是本编辑器的限制/.test(st), st);
      if (SHOTS) await p.screenshot({ path: SHOTS + '/2-gpt-refusal.png' });
      await p.locator('#aiFillUseNai').click();
    }
    await p.locator('.ai-fill-cand[data-k]').first().waitFor({ timeout: REAL ? 240000 : 60000 });
    const cost = await p.locator('#aiFillCost').textContent(); assert(/免费|Anlas/.test(cost), 'cost shown: ' + cost);
    if (SHOTS) await p.screenshot({ path: SHOTS + '/3-fill-nai.png' });
    if (!REAL) {
      assert.strictEqual(naiBodies.length, 3, '3 NAI candidates (queued)'); const inf = naiBodies[0];
      assert.strictEqual(inf.action, 'infill'); assert(/inpainting$/.test(inf.model)); assert(inf.parameters.mask && inf.parameters.image);
      assert(inf.parameters.width % 64 === 0 && inf.parameters.width * inf.parameters.height <= 1048576 && inf.parameters.steps <= 28 && inf.parameters.n_samples === 1, 'free-tier params');
      assert(/^red umbrella, rain/.test(inf.input), 'prompt passed through: ' + inf.input); assert(!/nsfw/.test(inf.parameters.negative_prompt), 'no hidden nsfw filter');
    }
    await p.locator('#aiFillUse').click(); await p.waitForTimeout(800);
    const layer = await p.evaluate(() => { const o = canvas.getObjects().find(x => x.aiFill); return o && { engine: o.aiFill.engine, seeds: o.aiFill.seeds }; });
    assert(layer && layer.engine === 'nai' && layer.seeds && layer.seeds.length >= 1, JSON.stringify(layer));
    assert.strictEqual(await p.evaluate(() => localStorage.getItem('mnai.engine.fill')), 'nai', 'engine choice remembered');
    // --- 画一页 with NAI: per-panel sizes follow the frame aspect
    if (!REAL) {
      naiBodies.length = 0;
      await p.locator('#taskBtn-page').click(); await p.locator('#taskPage4').waitFor();
      await p.locator('#taskPageEngines [data-eng="nai"]').click();
      assert.strictEqual(await p.locator('#taskPageStyle').inputValue(), 'monochrome, greyscale, manga, screentone, clean lineart');
      await p.locator('#taskPage3').click();
      for (let i = 0; i < 3; i++) await p.locator('[data-scene="' + i + '"]').fill(['1girl, train station, morning', 'train arriving, platform', '1girl, 1boy, sitting, train interior, window'][i]);
      await p.locator('#taskPageSeedLock').check();
      await p.waitForFunction(() => /免费/.test(document.getElementById("taskPageEngineCost").textContent), null, { timeout: 8000 }).catch(async e => { throw new Error("cost: " + await p.locator("#taskPageEngineCost").textContent() + " / " + await p.locator("#taskPageCost").textContent()); });
      await p.locator('#taskPageGo').click();
      await p.waitForFunction(() => /整页完成|没成功/.test(document.getElementById('taskPageStatus').textContent), null, { timeout: 120000 });
      assert(/整页完成/.test(await p.locator('#taskPageStatus').textContent()));
      assert.strictEqual(naiBodies.length, 3); const sz = naiBodies.map(x => x.parameters.width / x.parameters.height);
      assert(sz[0] > 1.5 && sz[1] < 1.2, 'aspect follows frames ' + sz);
      assert(new Set(naiBodies.map(x => x.parameters.seed)).size === 1, 'seed lock');
      assert(naiBodies.every(x => x.action === 'generate' && x.parameters.steps <= 28));
      if (SHOTS) await p.screenshot({ path: SHOTS + '/4-page-nai.png' });
      await p.locator('#taskWizardClose, .task-wizard [aria-label="关闭"]').first().click().catch(() => {});
      // privacy mode + safe mode
      await p.locator('#taskMore').click(); await p.locator('#privacyToggle').click();
      assert(await p.evaluate(() => document.body.classList.contains('privacy-blur')));
      await p.evaluate(() => NaiPsTools.toggleHistory()); await p.waitForTimeout(800);
      const blur = await p.evaluate(() => { const i = document.querySelector('.nai-history-panel img'); return i ? getComputedStyle(i).filter : 'none'; });
      assert(/blur/.test(blur), 'history thumbs blurred: ' + blur);
      if (SHOTS) await p.screenshot({ path: SHOTS + '/5-privacy-blur.png' });
      await p.evaluate(() => NaiEngine.setSafeMode(true));
      const body = await p.evaluate(() => NaiEngineCore.payload({ prompt: 'x', safeMode: NaiEngine.safeMode() }));
      assert(/nsfw/.test(body.parameters.negative_prompt));
    }
    assert.deepStrictEqual(errors, []);
    console.log(REAL ? 'PASS nai real (SFW)' : 'PASS nai routes (mock): fill infill x3, refusal->NAI, page aspect sizes, seed lock, free cost, privacy, safe mode');
    await b.close();
  } finally { srv.kill(); }
})().catch(e => { console.error(e); process.exit(1); });

/* AI 填充 (2.0 #2): paint / smart-select an area + one sentence -> up to 3 candidates -> chosen one becomes a
 * non-destructive layer that remembers prompt, model, mask, source crop and every candidate (switch, regenerate,
 * hide to compare, delete to revert). UX after Photoshop Generative Fill / Canva Magic Edit / Krita AI Diffusion. */
(function (root) {
  'use strict';
  const F = root.AiFillCore;
  const $ = id => document.getElementById(id);
  const ed = () => root.MangaGPTRegionEditor;
  const fc = () => root.canvas;
  let S = null;        // open session
  let chip = null;     // floating controls for a selected AI layer

  function el(tag, attrs, html) { const e = document.createElement(tag); Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k])); if (html != null) e.innerHTML = html; return e; }
  function loadImg(src) { return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('图片加载失败')); i.src = src; }); }
  function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // ---------- selection overlay ----------
  function placeOverlay() {
    if (!S || !S.ov) return;
    const r = fc().upperCanvasEl.getBoundingClientRect(), o = S.ov;
    Object.assign(o.box.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    if (o.view.width !== Math.round(r.width) || o.view.height !== Math.round(r.height)) { o.view.width = Math.round(r.width); o.view.height = Math.round(r.height); }
    drawView();
  }
  function drawView() {
    const v = S.ov.view, g = v.getContext('2d');
    g.clearRect(0, 0, v.width, v.height);
    g.globalAlpha = 0.45; g.drawImage(S.tint, 0, 0, v.width, v.height); g.globalAlpha = 1;
    if (S.drag && S.drag.rect) { const [a, b, c, d] = S.drag.rect, sx = v.width / S.W, sy = v.height / S.H; g.strokeStyle = '#38bdf8'; g.lineWidth = 2; g.setLineDash([6, 4]); g.strokeRect(a * sx, b * sy, (c - a) * sx, (d - b) * sy); g.setLineDash([]); }
  }
  function refreshTint() {   // blue view of the mask
    const g = S.tint.getContext('2d'); g.clearRect(0, 0, S.W, S.H);
    g.drawImage(S.mask, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#2563eb'; g.fillRect(0, 0, S.W, S.H); g.globalCompositeOperation = 'source-over';
    drawView(); updateButtons();
  }
  function pagePoint(e) { const r = S.ov.view.getBoundingClientRect(); return [(e.clientX - r.left) * S.W / r.width, (e.clientY - r.top) * S.H / r.height]; }
  function stroke(a, b) {
    const g = S.mask.getContext('2d');
    g.globalCompositeOperation = S.tool === 'erase' ? 'destination-out' : 'source-over';
    g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = S.size;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0] + 0.01, b[1]); g.stroke(); g.globalCompositeOperation = 'source-over';
  }
  function bindOverlay() {
    const v = S.ov.view;
    v.addEventListener('pointerdown', e => {
      if (S.tool === 'sam') return;
      e.preventDefault(); v.setPointerCapture(e.pointerId);
      const p = pagePoint(e); S.drag = { last: p, start: p };
      if (S.tool !== 'box') { stroke(p, p); refreshTint(); }
    });
    v.addEventListener('pointermove', e => {
      if (!S || !S.drag) return;
      const p = pagePoint(e);
      if (S.tool === 'box') { const s = S.drag.start; S.drag.rect = [Math.min(s[0], p[0]), Math.min(s[1], p[1]), Math.max(s[0], p[0]), Math.max(s[1], p[1])]; drawView(); }
      else { stroke(S.drag.last, p); S.drag.last = p; refreshTint(); }
    });
    const up = () => {
      if (!S || !S.drag) return;
      if (S.tool === 'box' && S.drag.rect) { const [a, b, c, d] = S.drag.rect; if (c - a > 4 && d - b > 4) { const g = S.mask.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(a, b, c - a, d - b); } }
      S.drag = null; refreshTint(); showCost();
    };
    v.addEventListener('pointerup', up); v.addEventListener('pointercancel', up);
  }
  function maskData() { const d = S.mask.getContext('2d').getImageData(0, 0, S.W, S.H).data, m = new Uint8Array(S.W * S.H); for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3]; return m; }

  function smartSelect() {
    if (!root.SamClickSelect) return status('智能点选不可用。', true);
    S.ov.box.hidden = true;
    const ok = root.SamClickSelect.begin({ target: 'mask', onDone: async (done, cand) => {
      if (!S) return;
      S.ov.box.hidden = false; setTool('brush');
      if (!done || !cand || !cand.mask) return;
      const im = await loadImg(cand.mask); const g = S.mask.getContext('2d'); g.drawImage(im, 0, 0, S.W, S.H); refreshTint();
      status('已加入点选区域，可以再用笔刷补一补。');
    } });
    if (!ok) { S.ov.box.hidden = false; status('智能点选启动失败（需要先下载 SAM 模型，或页面未就绪）。', true); }
  }

  // ---------- card ----------
  function status(t, err) { const s = $('aiFillStatus'); if (s) { s.textContent = t; s.dataset.error = err ? 'true' : ''; } }
  function setTool(t) { S.tool = t; document.querySelectorAll('#aiFillCard [data-tool]').forEach(b => b.classList.toggle('is-active', b.dataset.tool === t)); if (t === 'sam') smartSelect(); }
  function updateButtons() { const g = $('aiFillGenerate'); if (g) g.disabled = !!S.busy; }

  async function open(opts) {
    opts = opts || {};
    close();
    const api = ed(); const pg = api && api.pageImage && api.pageImage(false);
    if (!pg || !pg.image) return false;
    const gptReady = root.ServiceSettings ? await root.ServiceSettings.ready('gpt') : true;
    // 改一块: one entry, three presets. Default 去掉杂物 (local LaMa: free, works before any GPT is set up).
    const preset = opts.preset || (opts.engine === 'gpt' ? 'free' : 'remove');
    S = { W: pg.width, H: pg.height, page: pg.image, tool: 'brush', size: Math.max(12, Math.round(pg.width / 40)), preset, engine: PRESETS[preset].engine,
      count: 3, layer: opts.layer || null, results: [], busy: false, pageGuid: pageGuidNow(), ai: root.NaiEngine ? root.NaiEngine.preferred('fill', gptReady) : 'gpt' };
    S.mask = canvasOf(S.W, S.H); S.tint = canvasOf(S.W, S.H);
    const meta = opts.layer && opts.layer.aiFill;
    if (meta) {   // regenerate: start from the stored mask and prompt
      const im = await loadImg(meta.mask); S.mask.getContext('2d').drawImage(im, meta.box[0], meta.box[1]);
      S.engine = meta.engine; if (meta.engine !== 'lama') S.ai = meta.engine; S.prompt = meta.typed != null ? meta.typed : meta.prompt; S.preset = meta.preset || (meta.engine === 'lama' ? 'remove' : 'free');
    }
    const box = el('div', { class: 'ai-fill-pick', id: 'aiFillPick' }); const view = el('canvas', { id: 'aiFillView' });
    box.appendChild(view); document.body.appendChild(box); S.ov = { box, view }; bindOverlay();
    const card = el('div', { id: 'aiFillCard', class: 'ui-card ai-fill-card', role: 'dialog', 'aria-label': 'AI 填充' });
    card.innerHTML = '<div class="charlib-head"><b>改一块' + (meta ? ' · 重新生成' : '') + '</b><button type="button" class="ui-btn ui-btn-ghost" id="aiFillClose" aria-label="关闭">×</button></div>' +
      '<p class="ui-muted">① 在画面上涂出要改的地方</p>' +
      '<div class="ai-fill-tools"><button type="button" class="ui-btn is-active" data-tool="brush">笔刷</button><button type="button" class="ui-btn" data-tool="erase">橡皮</button>' +
      '<button type="button" class="ui-btn" data-tool="box">框选</button><button type="button" class="ui-btn" data-tool="sam" title="点一下物体，自动选出轮廓">智能点选</button>' +
      '<button type="button" class="ui-btn ui-btn-ghost" id="aiFillClear">清除</button></div>' +
      '<label class="ai-fill-size">笔刷大小 <input type="range" id="aiFillSize" min="4" max="160" value="' + S.size + '"></label>' +
      '<p class="ui-muted">② 想怎么改？</p>' +
      '<div class="ai-fill-presets" role="radiogroup" aria-label="怎么改">' + Object.keys(PRESETS).map(k => '<button type="button" class="ui-btn" role="radio" data-preset="' + k + '" title="' + PRESETS[k].tip + '">' + PRESETS[k].label + '</button>').join('') + '</div>' +
      '<div class="ai-fill-engines" id="aiFillEngines" role="radiogroup" aria-label="用哪个 AI"><span class="ui-muted">用</span>' +
      '<button type="button" class="ui-btn" role="radio" data-ai="gpt" title="OpenAI 兼容图像服务，一句中文就行">GPT</button>' +
      '<button type="button" class="ui-btn" role="radio" data-ai="nai" title="NovelAI 局部重绘（inpaint），英文标签效果最好">NovelAI</button>' +
      '<span class="ui-muted ai-fill-cost" id="aiFillCost"></span></div>' +
      '<textarea id="aiFillPrompt" rows="2" class="ui-input" data-nai-prompt="inpaint: what to draw in the painted area"></textarea>' +
      '<p class="ui-muted ai-fill-hint" id="aiFillHint"></p>' +
      '<div class="charlib-actions"><button type="button" class="ui-btn ui-btn-primary" id="aiFillGenerate">生成</button></div>' +
      '<div id="aiFillResults" class="ai-fill-results"></div><p id="aiFillStatus" class="ui-muted" role="status"></p>' +
      '<button type="button" class="ui-btn" id="aiFillUseNai" hidden>改用 NovelAI 再试</button>';
    document.body.appendChild(card); S.card = card;
    if (S.prompt) $('aiFillPrompt').value = S.prompt;
    card.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
    $('aiFillClear').addEventListener('click', () => { S.mask.getContext('2d').clearRect(0, 0, S.W, S.H); refreshTint(); });
    $('aiFillSize').addEventListener('input', e => { S.size = +e.target.value; });
    card.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => setPreset(b.dataset.preset, true)));
    card.querySelectorAll('[data-ai]').forEach(b => b.addEventListener('click', () => setAi(b.dataset.ai, true)));
    $('aiFillUseNai').addEventListener('click', () => { setAi('nai', true); generate(); });
    setPreset(S.preset, false);
    $('aiFillGenerate').addEventListener('click', generate);
    $('aiFillClose').addEventListener('click', close);
    S.onResize = () => placeOverlay(); window.addEventListener('resize', S.onResize);
    S.onKey = e => { if (e.key === 'Escape' && S && !(root.SamClickSelect && root.SamClickSelect.active())) close(); };
    document.addEventListener('keydown', S.onKey);
    placeOverlay(); refreshTint();
    status(S.engine === 'lama' || (S.engine === 'gpt' ? gptReady : root.NaiEngine && root.NaiEngine.configured()) ? '' : '「换成…」「自由修改」要用 GPT 或 NovelAI：点「生成」时会打开「服务设置」。「去掉杂物」用本机模型，不用配置。');
    return true;
  }
  const PRESETS = {
    remove: { label: '去掉杂物', engine: 'lama', tip: '本机 LaMa 补背景，免费、不用配置', placeholder: '', hint: '涂出要去掉的东西就行，不用写字。用本机模型，免费。', go: '去掉' },
    replace: { label: '换成…', engine: 'gpt', tip: 'GPT 按一句话重画这块，给 3 张候选', placeholder: '换成什么？例如：一只白猫 / 红色的雨伞', hint: '用 GPT 生成 3 张候选，挑一张；之后还能换、重生或还原。', go: '生成 3 张' },
    free: { label: '自由修改', engine: 'gpt', tip: '用一句话描述怎么改这块（GPT）', placeholder: '想怎么改？例如：把天空改成黄昏 / 表情改成微笑', hint: '用 GPT 按描述修改涂出的地方，给 3 张候选。', go: '生成 3 张' },
  };
  function setPreset(k, user) {
    if (!S || !PRESETS[k]) return; const P = PRESETS[k]; S.preset = k; S.engine = P.engine === 'lama' ? 'lama' : S.ai;
    const nai = S.engine === 'nai', eg = $('aiFillEngines'); eg.hidden = k === 'remove';
    eg.querySelectorAll('[data-ai]').forEach(b => { const on = b.dataset.ai === S.ai; b.classList.toggle('is-active', on); b.setAttribute('aria-checked', String(on)); });
    $('aiFillUseNai').hidden = true; showCost();
    S.card.querySelectorAll('[data-preset]').forEach(b => { const on = b.dataset.preset === k; b.classList.toggle('is-active', on); b.setAttribute('aria-checked', String(on)); });
    const t = $('aiFillPrompt'); t.hidden = k === 'remove'; t.placeholder = P.placeholder;
    $('aiFillHint').textContent = nai ? 'NovelAI 局部重绘：生成 3 张候选（一张一张排队）。写英文标签效果最好，例如：red umbrella, rain。' : P.hint;
    if (nai) t.placeholder = k === 'replace' ? '换成什么？例如：red umbrella / white cat' : '想怎么改？例如：smile, closed eyes / sunset sky';
    $('aiFillGenerate').textContent = P.go;
    if (user && nai && root.NaiEngine && !root.NaiEngine.configured()) status('NovelAI 还没配置：点「' + P.go + '」时会先打开「服务设置」。');
    else if (user && S.engine === 'gpt' && root.ServiceSettings) root.ServiceSettings.ready('gpt').then(ok => { if (!ok && S) status('「' + P.label + '」要用 GPT：点「' + P.go + '」时会先打开「服务设置」。'); });
    else if (user) status('');
  }
  function setAi(v, user) { if (!S || (v !== 'gpt' && v !== 'nai')) return; S.ai = v; if (user && root.NaiEngine) root.NaiEngine.remember('fill', v); setPreset(S.preset, user); }
  async function showCost() {
    const c = $('aiFillCost'); if (!c) return; c.textContent = '';
    if (S.engine !== 'nai' || !root.NaiEngine || !root.NaiEngine.configured()) return;
    const box = F.maskBox(maskData(), S.W, S.H); const r = box ? F.contextBox(box, S.W, S.H) : { w: 1024, h: 1024 };
    const t = await root.NaiEngine.costText({ width: r.w, height: r.h, action: 'infill' }, S.count); if (S && S.engine === 'nai') { c.textContent = t.text.replace(/^/, S.count + ' 张 · '); c.dataset.free = String(t.free); }
  }
  async function naiCandidates(r, source, mask, sentence) {
    const S = current();
    const N = root.NaiEngineCore, size = N.sizeFor(r.w, r.h);
    const fit = async (url, bg) => { const im = await loadImg(url), c = canvasOf(size.width, size.height), g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height); return c.toDataURL('image/png'); };
    const image = await fit(source, '#fff'), m = await fit(mask, '#000'); const seeds = [];
    for (let k = 0; k < S.count; k++) {
      status('NovelAI 正在生成第 ' + (k + 1) + ' / ' + S.count + ' 张…');
      const d = await root.NaiEngine.run({ action: 'infill', prompt: sentence, image, mask: m, width: r.w, height: r.h }, S.ctrl.signal, t => status(t));
      const im = await loadImg(d.image), c = canvasOf(r.w, r.h); c.getContext('2d').drawImage(im, 0, 0, r.w, r.h);
      S.pending.push(c.toDataURL('image/jpeg', 0.92)); seeds.push(d.seed);
    }
    return seeds;
  }
  function close() {
    if (!S) return;
    if (root.SamClickSelect && root.SamClickSelect.active()) root.SamClickSelect.cancel();
    if (S.ctrl) S.ctrl.abort();
    S.ov.box.remove(); S.card.remove();
    window.removeEventListener('resize', S.onResize); document.removeEventListener('keydown', S.onKey);
    S = null;
  }

  // ---------- generation ----------
  function cropURL(img, r, type) { const c = canvasOf(r.w, r.h); c.getContext('2d').drawImage(img, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h); return c.toDataURL(type || 'image/png'); }
  function padTo(img, plan, bg) {   // letterbox a crop into the model size (same plan as the GPT region editor)
    const c = canvasOf(plan.width, plan.height), g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    const i = plan.inner; g.drawImage(img, i.x * c.width, i.y * c.height, i.w * c.width, i.h * c.height); return c.toDataURL('image/png');
  }
  async function gptOnce(payload, signal) {
    const key = (($('mangaGptKey') || {}).value || '').trim().replace(/^Bearer\s+/i, '');
    const r = await fetch('/gpt-image-proxy', { method: 'POST', signal, headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { Authorization: 'Bearer ' + key } : {}), body: JSON.stringify(payload) });
    let j; try { j = await r.json(); } catch (_) { throw new Error('本地服务返回了非 JSON 响应（HTTP ' + r.status + '）。'); }
    if (!r.ok || !j.ok || !/^data:image\//.test(j.image || '')) throw new Error(j.error || '上游没有返回图像。');
    return j.image;
  }
  /** model output (letterboxed) -> raw candidate at crop size (JPEG; alpha comes from the mask) */
  async function unpad(url, plan, w, h) {
    const im = await loadImg(url), i = plan.inner, c = canvasOf(w, h);
    c.getContext('2d').drawImage(im, i.x * im.width, i.y * im.height, i.w * im.width, i.h * im.height, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.92);
  }

  /** Candidate + source + mask -> layer PNG: tone-matched on a ring just outside the mask, alpha = soft mask. */
  async function composite(meta, k) {
    const w = meta.box[2], h = meta.box[3];
    const [src, cand, mk] = await Promise.all([loadImg(meta.source), loadImg(meta.candidates[k]), loadImg(meta.mask)]);
    const c = canvasOf(w, h), g = c.getContext('2d');
    g.drawImage(src, 0, 0, w, h); const sd = g.getImageData(0, 0, w, h).data;
    g.clearRect(0, 0, w, h); g.drawImage(mk, 0, 0, w, h); const md = g.getImageData(0, 0, w, h).data;
    g.clearRect(0, 0, w, h); g.drawImage(cand, 0, 0, w, h); const out = g.getImageData(0, 0, w, h);
    const hard = new Uint8Array(w * h); for (let i = 0; i < hard.length; i++) hard[i] = md[i * 4] >= 128 ? 255 : 0;
    const edge = meta.edge || F.edgeFor(maskBoxOf(hard, w, h));
    const alpha = F.softMask(hard, w, h, edge.grow, edge.feather);
    F.applyClip(alpha, w, h, meta.clip);   // panel frame lines and gutters always keep the original
    const ring = F.softMask(hard, w, h, edge.grow + edge.feather * 2, 0);
    const sum = [0, 0, 0]; let n = 0;
    for (let i = 0; i < hard.length; i++) if (ring[i] > 0 && alpha[i] === 0) { for (let ch = 0; ch < 3; ch++) sum[ch] += sd[i * 4 + ch] - out.data[i * 4 + ch]; n++; }
    const shift = n > 20 ? sum.map(v => v / n) : [0, 0, 0];
    for (let i = 0; i < hard.length; i++) {
      for (let ch = 0; ch < 3; ch++) out.data[i * 4 + ch] = Math.max(0, Math.min(255, out.data[i * 4 + ch] + shift[ch]));
      out.data[i * 4 + 3] = Math.round(255 * alpha[i]);
    }
    g.putImageData(out, 0, 0);
    return { url: c.toDataURL('image/png'), shift };
  }
  function maskBoxOf(hard, w, h) { return F.maskBox(hard, w, h) || [0, 0, w, h]; }

  // The session is occupied before the first await (a double click must not start two rounds,
  // audit 27) and every write/cleanup is scoped to that session object (audit 29).
  async function generate() {
    if (!S || S.busy) return;
    const sess = S;
    sess.busy = true; updateButtons();
    try { await generateIn(sess); }
    finally { if (S === sess) { sess.busy = false; sess.ctrl = null; updateButtons(); } }
  }
  async function generateIn(sess) {
    const S = sess;
    const hard = maskData(); const box = F.maskBox(hard, S.W, S.H);
    if (!box) return status('先在画面上涂出要改的地方（笔刷、框选或智能点选）。', true);
    const typed = S.preset === 'remove' ? '' : $('aiFillPrompt').value.trim();
    if (S.preset !== 'remove' && !typed) { $('aiFillPrompt').focus(); return status(S.preset === 'replace' ? '写一下换成什么，例如：一只白猫。' : '写一句想怎么改，例如：把天空改成黄昏。', true); }
    const sentence = S.engine === 'nai' ? typed : S.preset === 'replace' ? '把涂出的地方换成：' + typed : typed;
    if (S.engine === 'nai' && !(root.NaiEngine && root.NaiEngine.configured())) {
      status('NovelAI 还没配置：已打开「服务设置」，填好 Token 后回来再点一次。', true);
      if (root.ServiceSettings && root.ServiceSettings.ensureReady) root.ServiceSettings.ensureReady('novelai');
      return;
    }
    if (S.engine === 'gpt' && root.ServiceSettings && !(await root.ServiceSettings.ready('gpt'))) {
      status('「' + PRESETS[S.preset].label + '」要用 GPT：已打开「服务设置」。只想去掉东西可以选「去掉杂物」（本机，免费）。', true);
      if (root.ServiceSettings.ensureReady) root.ServiceSettings.ensureReady('gpt');
      return;
    }
    const r = F.contextBox(box, S.W, S.H);
    const page = await loadImg(S.page);
    const source = cropURL(page, r);
    const mc = canvasOf(r.w, r.h), mg = mc.getContext('2d'); mg.fillStyle = '#000'; mg.fillRect(0, 0, r.w, r.h); mg.drawImage(S.mask, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    const md = mg.getImageData(0, 0, r.w, r.h); let cover = 0; for (let i = 0; i < md.data.length; i += 4) { const v = md.data[i + 3] && md.data[i] >= 128 ? 255 : 0; md.data[i] = md.data[i + 1] = md.data[i + 2] = v; md.data[i + 3] = 255; cover += v ? 1 : 0; }
    mg.putImageData(md, 0, 0); const mask = mc.toDataURL('image/png');
    if (S.engine === 'lama' && cover / (r.w * r.h) > 0.6) return status('要去掉的区域太大了（超过裁切范围的 60%），请分几次涂。', true);
    S.ctrl = new AbortController();
    const model = (($('mangaGptModel') || {}).value || '').trim();
    const pa = root.PanelAuto ? await root.PanelAuto.get().catch(() => null) : null;
    const meta = { engine: S.engine, preset: S.preset, typed, prompt: sentence, model: S.engine === 'gpt' ? model : S.engine === 'nai' ? root.NaiEngine.modelId() : (function(){ try { return localStorage.getItem('mnai.lama.engine') || 'auto'; } catch (_) { return 'auto'; } })(), box: [r.x, r.y, r.w, r.h], mask, source, candidates: [], chosen: 0, edge: F.edgeFor(F.maskBox(hard, S.W, S.H).map((v, i) => v - (i % 2 ? r.y : r.x))), created: new Date().toISOString(), clip: F.panelClip(pa && pa.panels && pa.panels.length > 1 ? pa.panels : [], r, S.W) };
    $('aiFillResults').innerHTML = '';
    const t0 = performance.now();
    try {
      if (S.engine === 'lama') {
        status('本机 LaMa 修复中…');
        let lamaEngine = 'auto';
        try { lamaEngine = localStorage.getItem('mnai.lama.engine') || 'auto'; } catch (_) {}
        const d = await root.MangaModelRequest.post('/manga-smart/lama-inpaint', { image: source, mask, engine: lamaEngine }, { signal: S.ctrl.signal });
        if (!d || !d.ok) throw new Error((d && d.error) || 'LaMa 没有返回结果。');
        meta.candidates.push(d.image);
      } else if (S.engine === 'nai') {
        S.pending = []; try { meta.seeds = await naiCandidates(r, source, mask, typed); } finally { meta.candidates.push(...S.pending); }
        if (!meta.candidates.length) throw new Error('NovelAI 没有返回结果。');
      } else {
        const ref = await loadImg(mask), src = await loadImg(source);
        const plan = ed().letterboxPlan(r.w, r.h, 'auto');
        const payload = { baseUrl: (($('mangaGptUrl') || {}).value || '').trim(), model, operation: 'edit', prompt: F.prompt(sentence, true), size: plan.size,
          image: padTo(src, plan, '#fff'), references: [padTo(ref, plan, '#000')] };
        let done = 0;
        status('正在生成 ' + S.count + ' 张候选（同时请求，可能产生 API 费用）…');
        const settled = await Promise.allSettled(Array.from({ length: S.count }, () => gptOnce(payload, S.ctrl.signal).then(async u => {
          const c = await unpad(u, plan, r.w, r.h); done++; status('已收到 ' + done + ' / ' + S.count + ' 张…'); return c; })));
        settled.forEach(s => { if (s.status === 'fulfilled') meta.candidates.push(s.value); });
        if (!meta.candidates.length) throw settled.find(s => s.status === 'rejected').reason;
      }
      if (current() !== sess) return;   // closed/reopened while decoding: results belong to the old session
      S.meta = F.normalizeMeta(meta); S.ms = Math.round(performance.now() - t0);
      await showResults();
      status('生成好了（' + (S.ms / 1000).toFixed(1) + ' 秒）。点一张看大图，满意就「用这张」。');
    } catch (e) {
      if (current() !== sess) return;
      const msg = e.name === 'AbortError' ? '已取消。' : (e.message || String(e));
      if (S && S.engine === 'gpt' && root.NaiEngine && root.NaiEngine.isRefusal(msg)) {
        status('这个 GPT 服务按它自己的内容规则拒绝了这次请求（不是本编辑器的限制）。可以改用 NovelAI 再试，提示词只发给 NovelAI。', true);
        $('aiFillUseNai').hidden = false;
      } else status(msg, true);
    }
  }
  function current() { return S; }

  async function showResults() {
    const box = $('aiFillResults'); box.innerHTML = '';
    const page = await loadImg(S.page); const [x, y, w, h] = S.meta.box;
    S.layers = [];
    for (let k = 0; k < S.meta.candidates.length; k++) {
      const comp = await composite(S.meta, k); S.layers.push(comp.url);
      const c = canvasOf(w, h), g = c.getContext('2d'); g.drawImage(page, x, y, w, h, 0, 0, w, h); g.drawImage(await loadImg(comp.url), 0, 0);
      const b = el('button', { type: 'button', class: 'ai-fill-cand', 'data-k': String(k), 'aria-label': '候选 ' + (k + 1) });
      b.appendChild(Object.assign(new Image(), { src: c.toDataURL('image/jpeg', 0.85), alt: '候选 ' + (k + 1) }));
      b.addEventListener('click', () => pick(k)); box.appendChild(b);
    }
    const before = el('button', { type: 'button', class: 'ai-fill-cand is-source', 'aria-label': '原图' });
    before.appendChild(Object.assign(new Image(), { src: S.meta.source, alt: '原图' })); box.appendChild(before);
    const use = el('button', { type: 'button', class: 'ui-btn ui-btn-primary', id: 'aiFillUse' }, '用这张'); box.appendChild(use);
    use.addEventListener('click', () => apply(S.pick || 0));
    pick(0);
  }
  function pick(k) { S.pick = k; document.querySelectorAll('#aiFillResults .ai-fill-cand').forEach(b => b.classList.toggle('is-active', b.dataset.k === String(k))); }

  /** Chosen candidate -> layer (new, or replaces the regenerated one); one undo step. */
  function pageGuidNow() { return typeof getCanvasGUID === 'function' ? getCanvasGUID() : null; }
  const WRONG_PAGE = '这些候选是为另一页生成的。请切回原页再点「用这张」（候选已保留）。';
  /** Candidates belong to the page they were made for (audit 28): checked before and after decoding. */
  function apply(k) {
    if (S.pageGuid && pageGuidNow() !== S.pageGuid) { status(WRONG_PAGE, true); return Promise.resolve(null); }
    const meta = Object.assign({}, S.meta, { chosen: k }); const url = S.layers[k]; const target = S.layer; const pageGuid = S.pageGuid;
    close();
    return putLayer(target, meta, url, pageGuid);
  }
  function putLayer(target, meta, url, pageGuid) {
    const c = fc();
    const stale = () => pageGuid && pageGuidNow() !== pageGuid;
    const refuse = resolve => { if (typeof createToastError === 'function') createToastError('改一块', '页面已切换，结果没有贴到当前页。请回到原页重新生成或应用。'); resolve(null); };
    return new Promise(resolve => {
      if (target) {
        if (stale()) return refuse(resolve);
        target.setSrc(url, () => {
          if (stale()) return refuse(resolve); target.set({ aiFill: meta, left: meta.box[0], top: meta.box[1], scaleX: 1, scaleY: 1, name: layerName(meta) }); c.requestRenderAll(); if (typeof saveStateByManual === 'function') saveStateByManual(); showChip(target); resolve(target); });
        return;
      }
      fabric.Image.fromURL(url, obj => {
        if (stale()) return refuse(resolve);
        obj.set({ left: meta.box[0], top: meta.box[1], name: layerName(meta), aiFill: meta });
        c.add(obj);
        const api = ed(); if (api && api.letteringInsertIndex) { const i = api.letteringInsertIndex(c.getObjects(), obj); if (i < c.getObjects().indexOf(obj)) obj.moveTo(i); }
        c.setActiveObject(obj); c.requestRenderAll();
        if (typeof updateLayerPanel === 'function') updateLayerPanel();
        showChip(obj); resolve(obj);
      });
    });
  }
  function layerName(meta) { return 'AI 填充：' + ((meta.typed || meta.prompt) ? (meta.typed || meta.prompt).slice(0, 14) : meta.engine === 'lama' ? '去除' : '修改'); }

  // ---------- controls on a selected AI layer ----------
  async function switchCandidate(obj, k) {
    const meta = F.normalizeMeta(obj.aiFill); if (!meta || !meta.candidates[k]) return;
    meta.chosen = k; const comp = await composite(meta, k);
    await putLayer(obj, meta, comp.url);
  }
  function hideChip() { if (chip) { chip.remove(); chip = null; } }
  function showChip(obj) {
    hideChip();
    const meta = obj && F.normalizeMeta(obj.aiFill); if (!meta) return;
    chip = el('div', { id: 'aiFillChip', class: 'ui-card ai-fill-chip', role: 'toolbar', 'aria-label': 'AI 填充图层' });
    const n = meta.candidates.length;
    chip.innerHTML = '<b title="' + (meta.prompt || '').replace(/"/g, '&quot;') + '">AI 填充</b>' +
      (n > 1 ? '<button type="button" class="ui-btn ui-btn-ghost" data-a="prev" aria-label="上一张">‹</button><span id="aiFillChipN">' + (meta.chosen + 1) + ' / ' + n + '</span><button type="button" class="ui-btn ui-btn-ghost" data-a="next" aria-label="下一张">›</button>' : '') +
      '<button type="button" class="ui-btn" data-a="regen">重新生成</button><button type="button" class="ui-btn" data-a="toggle">' + (obj.visible === false ? '显示' : '看原图') + '</button>' +
      '<button type="button" class="ui-btn" data-a="revert" title="删除这个 AI 图层，画面回到原样（可撤销）">还原</button>';
    document.body.appendChild(chip);
    const r = fc().upperCanvasEl.getBoundingClientRect(); chip.style.left = Math.round(r.left + 8) + 'px'; chip.style.top = Math.round(Math.max(56, r.top + 8)) + 'px';
    chip.addEventListener('click', async e => {
      const a = e.target.dataset && e.target.dataset.a; if (!a) return;
      if (a === 'prev' || a === 'next') await switchCandidate(obj, (meta.chosen + (a === 'next' ? 1 : n - 1)) % n);
      else if (a === 'regen') { hideChip(); open({ layer: obj }); }
      else if (a === 'toggle') { obj.visible = obj.visible === false; fc().requestRenderAll(); if (typeof saveStateByManual === 'function') saveStateByManual(); showChip(obj); }
      else if (a === 'revert') { hideChip(); fc().remove(obj); fc().discardActiveObject(); fc().requestRenderAll(); if (typeof updateLayerPanel === 'function') updateLayerPanel(); }
    });
  }
  function bindSelection() {
    const c = fc(); if (!c || c.__aiFillBound) return; c.__aiFillBound = true;
    const on = e => { const o = (e && e.selected && e.selected[0]) || c.getActiveObject(); if (o && o.aiFill) showChip(o); else hideChip(); };
    c.on('selection:created', on); c.on('selection:updated', on); c.on('selection:cleared', hideChip);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(bindSelection, 0)); else setTimeout(bindSelection, 0);
  setInterval(bindSelection, 2000);   // canvas can be recreated

  root.AiFill = { open, close, generate, apply: k => S && apply(k), switchCandidate, composite, isOpen: () => !!S, state: () => S && { tool: S.tool, engine: S.engine, results: S.layers ? S.layers.length : 0, ms: S.ms || 0, busy: S.busy } };
})(typeof window !== 'undefined' ? window : globalThis);

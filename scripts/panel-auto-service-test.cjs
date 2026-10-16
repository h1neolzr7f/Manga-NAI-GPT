// AUDIT-v2 #9: the JS splitter prefers the local service's panels (scaled to page px) and falls back to XY-cut.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const c = { console, Math, JSON, Object, Array, Uint8Array, Map, document: {} }; c.window = c; c.globalThis = c; vm.createContext(c);
const src = fs.readFileSync(path.join(__dirname, '../js/ai/panel-auto.js'), 'utf8');
vm.runInContext(src, c);
const P = c.PanelAuto;
const r = P.fromService({ ok: true, width: 500, height: 700, panels: [{ bbox: [250, 0, 250, 350] }, { bbox: [0, 0, 250, 350] }] }, 1000, 1400);
assert.equal(JSON.stringify(r), JSON.stringify([{ x: 500, y: 0, w: 500, h: 700, n: 1 }, { x: 0, y: 0, w: 500, h: 700, n: 2 }]));
assert.equal(P.fromService({ ok: false }, 1, 1), null); assert.equal(P.fromService({ ok: true, width: 10, panels: [] }, 1, 1), null);
assert.ok(src.includes("'/manga-smart/panels'") && src.includes("svc || detectFrom("), 'service first, XY-cut fallback');
assert.ok(fs.readFileSync(path.join(__dirname, '../manga_smart_ocr.py'), 'utf8').includes('"/manga-smart/panels"'));
console.log('panel auto service ok');

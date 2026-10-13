const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ROOT = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

class Element {
  constructor(value = '') { this.value = value; this.handlers = {}; this.children = []; this.dataset = {}; this.tagName = 'INPUT'; this.type = 'text'; this.innerHTML = ''; }
  addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
  dispatchEvent(event) { return Promise.all((this.handlers[event.type] || []).map(fn => fn.call(this, event))); }
  appendChild(child) { this.children.push(child); return child; }
  set innerHTML(value) { this._innerHTML = value; this.children = []; }
  get innerHTML() { return this._innerHTML; }
  querySelectorAll() { return this.children; }
}
function loadSettings(model, payload = { data: [] }, pending) {
  const fields = Object.fromEntries(['naiDirectorModel', 'naiDirectorApiUrl', 'naiDirectorApiKey', 'naiDirectorModelList', 'naiDirectorRefreshModels'].map(id => [id, new Element()]));
  fields.naiDirectorModel.value = model;
  fields.naiDirectorApiUrl.value = 'https://chat.example/v1';
  fields.naiDirectorApiKey.value = 'test-key';
  const stored = new Map([['localSettingsData', JSON.stringify({ naiDirectorModel: model })]]);
  let boot;
  const context = vm.createContext({
    document: { addEventListener(type, fn) { boot = fn; }, createElement: () => new Element() },
    $: id => fields[id] || null,
    localStorage: { getItem: k => stored.get(k) || null, setItem: (k, v) => stored.set(k, v) },
    providerRegistry: { register() {}, mapApiMode() {}, syncFromApiMode() {} },
    NovelAIProvider: function() {}, apis: { NOVELAI: 'novelai' }, apiHeartbeat() {}, setInterval() {},
    Event: class { constructor(type) { this.type = type; } },
    fetch: async () => pending ? pending : ({ ok: true, json: async () => payload }),
    createToast() {}, createToastError() {}
  });
  context.window = context;
  context.location = { origin: 'http://127.0.0.1:8000', protocol: 'http:' };
  vm.runInContext(read('js/ai/ai-settings.js'), context);
  boot();
  return { fields, stored, context };
}
const settled = () => new Promise(resolve => setImmediate(resolve));

test('startup and saved preferences preserve custom chat model identifiers', async () => {
  for (const model of ['gpt-4.1-mini', 'chatgpt-custom', 'qwen3.5-flash', 'Vendor/MyModel:Latest']) {
    const { fields, stored } = loadSettings(model);
    await settled();
    assert.equal(fields.naiDirectorModel.value, model);
    assert.equal(JSON.parse(stored.get('localSettingsData')).naiDirectorModel, model);
  }
});
test('blur trims whitespace without changing model case or provider', async () => {
  const { fields } = loadSettings('Vendor/MyModel:Latest');
  await settled();
  fields.naiDirectorModel.value = '  GPT-Custom-V2  ';
  await fields.naiDirectorModel.dispatchEvent({ type: 'blur' });
  assert.equal(fields.naiDirectorModel.value, 'GPT-Custom-V2');
});
test('refreshing an incomplete model list never replaces an explicit custom model', async () => {
  const { fields } = loadSettings('Private/Deployment', { data: [{ id: 'AnotherModel' }], default: 'AnotherModel' });
  await settled();
  assert.equal(fields.naiDirectorModel.value, 'Private/Deployment');
});
test('typing a model while its list loads preserves the new input', async () => {
  let release;
  const pending = new Promise(r => { release = r; });
  const { fields } = loadSettings('OldModel', {}, pending);
  fields.naiDirectorModel.value = 'New/Model';
  release({ ok: true, json: async () => ({ data: [{ id: 'ListModel' }] }) });
  await settled();
  assert.equal(fields.naiDirectorModel.value, 'New/Model');
});
test('suggested models keep exact IDs and selecting one dispatches persistence input', async () => {
  const { fields } = loadSettings('Private/Deployment', { data: [{ id: 'Vendor/Model:Latest', name: '<custom name>' }] });
  await settled();
  const chip = fields.naiDirectorModelList.children[0];
  assert.ok(chip, 'the model list exposes a selectable suggestion');
  let saves = 0;
  fields.naiDirectorModel.addEventListener('input', () => saves++);
  await chip.dispatchEvent({ type: 'click', stopPropagation() {} });
  assert.equal(fields.naiDirectorModel.value, 'Vendor/Model:Latest');
  assert.equal(saves, 1);
  assert.equal(chip.textContent, 'Vendor/Model:Latest');
});
test('Director request configuration preserves model ID case', () => {
  const fields = { naiDirectorModel: { value: ' Vendor/MyModel:Latest ' } };
  const context = vm.createContext({ document: { getElementById: id => fields[id] || null, addEventListener() {} } });
  context.window = context;
  vm.runInContext(read('js/ai/prompt/novelai-composition-director.js'), context);
  assert.equal(context.NovelAICompositionDirector.getDirectorApiConfig().model, 'Vendor/MyModel:Latest');
});
function restoreProjectSettings(saved) {
  const fields = Object.fromEntries(['naiDirectorModel', 'naiDirectorApiUrl', 'bg-color', 'basePrompt_height', 'basePrompt_width'].map(id => [id, new Element()]));
  const stored = new Map([['localSettingsData', JSON.stringify(saved)]]);
  const context = vm.createContext({
    $: id => fields[id] || null,
    localStorage: { getItem: k => stored.get(k) || null, setItem: (k, v) => stored.set(k, v) },
    SETTINGS_SCHEMA: { naiDirectorModel: { id: 'naiDirectorModel', default: 'deepseek-v4-flash' }, naiDirectorApiUrl: { id: 'naiDirectorApiUrl', default: '' } },
    BASEPROMPT_SCHEMA: {}, basePrompt: {}, readSecretStore: () => ({}),
    applyBeginnerLayoutMigration() {}, applyBeginnerUxMigration() {}, applyAssemblyPageSizeMigration() {},
    syncExportPlanAfterSettingsLoad() {}, providerRegistry: { syncFromApiMode() {} },
    apis: { NOVELAI: 'novelai' }, updateWorkflowType() {},
    Event: class { constructor(type) { this.type = type; } }
  });
  context.window = context;
  const source = read('js/project-management.js');
  vm.runInContext(source.slice(source.indexOf('function loadSettingsLocalStrage(){'), source.indexOf('function sanitizeSettingsValueForStorage')), context);
  context.loadSettingsLocalStrage();
  return { fields, stored };
}
test('project settings restore preserves explicitly saved legacy model choices', () => {
  const { fields } = restoreProjectSettings({ naiDirectorModel: 'qwen3.5-flash' });
  assert.equal(fields.naiDirectorModel.value, 'qwen3.5-flash');
});
test('project restore preserves a user URL when its key lives only in server env', () => {
  const url = 'https://private-chat.example/v1';
  const { fields, stored } = restoreProjectSettings({ naiDirectorApiUrl: url, naiDirectorModel: 'Vendor/Chat' });
  assert.equal(fields.naiDirectorApiUrl.value, url);
  assert.equal(JSON.parse(stored.get('localSettingsData')).naiDirectorApiUrl, url);
});


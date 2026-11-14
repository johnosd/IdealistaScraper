const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function setup(existing = []) {
  const elements = new Map(), callbacks = [], calls = [];
  const element = () => ({ value: '', checked: false, disabled: false, addEventListener(event, fn) { this[event] = fn; } });
  const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
  const api = { runtime: { onMessage: { addListener() {} }, getURL: file => 'chrome-extension://test/' + file },
    storage: { local: { get: (keys, cb) => cb({}), set: () => assert.fail('launcher não altera fila') } },
    windows: { update: async (id, data) => calls.push(['focus', id, data]) },
    tabs: { query: async options => options.url ? existing : [{ id: 7 }],
      create: async options => calls.push(['create', options]), update: async (id, data) => calls.push(['update', id, data]) },
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../src/popup.js'), 'utf8'), {
    chrome: api, console, alert() {}, document: { getElementById: get, addEventListener: (event, fn) => callbacks.push(fn) },
  });
  callbacks.forEach(fn => fn());
  return { get, calls, api };
}
test('launcher abre página durável com ID da aba de origem sem alterar fila', async () => {
  const f = setup(); await f.get('openLote').click();
  assert.equal(f.calls[0][0], 'create'); assert.equal(f.calls[0][1].url, 'chrome-extension://test/lote.html?sourceTabId=7');
  assert.equal(f.get('openLote').disabled, false);
});
test('launcher reutiliza tela existente e foca sua janela', async () => {
  const f = setup([{ id: 8, windowId: 2 }]); await f.get('openLote').click();
  assert.equal(f.calls[0][0], 'update'); assert.equal(f.calls[0][1], 8); assert.equal(f.calls[1][0], 'focus');
});
test('falha ao abrir libera botão e preserva estado', async () => {
  const f = setup(); f.api.tabs.create = async () => { throw new Error('blocked'); };
  await f.get('openLote').click(); assert.equal(f.get('openLote').disabled, false); assert.equal(f.calls.length, 0);
});

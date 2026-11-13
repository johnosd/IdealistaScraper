const test = require('node:test');
const assert = require('node:assert/strict');
const { createCollector } = require('../../src/localidades-collector.js');

function event() {
  const listeners = new Set();
  return { listeners, addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn),
    emit: (...args) => [...listeners].forEach(fn => fn(...args)) };
}
function fixture() {
  const onUpdated = event(), onRemoved = event(), removed = [], scripts = [];
  const api = { tabs: { onUpdated, onRemoved,
    create: async options => { assert.equal(options.active, false); return { id: 42 }; },
    get: async () => ({ status: 'complete' }), remove: async id => { removed.push(id); } },
  scripting: { executeScript: async input => { scripts.push(input); return [{ result: scripts.length === 1 ? true : [{ URL: 'fixture' }] }]; } } };
  return { api, removed, scripts, onUpdated, onRemoved };
}
function clean(f) {
  assert.deepEqual(f.removed, [42]);
  assert.equal(f.onUpdated.listeners.size, 0);
  assert.equal(f.onRemoved.listeners.size, 0);
}
test('coleta em aba propria, injeta funcoes autonomas e encerra somente a criada', async () => {
  const f = fixture();
  assert.deepEqual(await createCollector(f.api, 30)(), [{ URL: 'fixture' }]);
  assert.equal(f.scripts.length, 2);
  assert.match(f.scripts[1].func.toString(), /nav.locations-list/);
  clean(f);
});
test('falha de injecao fecha aba e limpa listeners', async () => {
  const f = fixture();
  f.api.scripting.executeScript = async () => { throw new Error('Injecao falhou'); };
  await assert.rejects(createCollector(f.api, 30)(), /Injecao falhou/);
  clean(f);
});
test('timeout de navegacao limpa listeners e aba', async () => {
  const f = fixture(); f.api.tabs.get = async () => ({ status: 'loading' });
  await assert.rejects(createCollector(f.api, 10)(), /carregamento/);
  clean(f);
});
test('aba removida durante navegacao encerra espera', async () => {
  const f = fixture();
  f.api.tabs.get = async () => { queueMicrotask(() => f.onRemoved.emit(42)); return { status: 'loading' }; };
  await assert.rejects(createCollector(f.api, 30)(), /fechada/);
  clean(f);
});
test('timeout de DOM fecha aba mesmo quando executeScript nao resolve', async () => {
  const f = fixture(); f.api.scripting.executeScript = () => new Promise(() => {});
  await assert.rejects(createCollector(f.api, 10)(), /DOM/);
  clean(f);
});

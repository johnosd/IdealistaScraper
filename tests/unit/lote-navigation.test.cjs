const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { inspectBatchDestination, resolveBatchListing } = require('../../src/lote-navigation.js');
const listing = 'https://www.idealista.pt/arrendar-casas/sao-miguel-ilha-dos-acores/';
const index = listing + 'concelhos-freguesias';

function fixture(results) {
  const updates = [], waits = [];
  const api = { scripting: { executeScript: async () => [{ result: results.shift() }] },
    tabs: { update: async (id, data) => { updates.push({ id, ...data }); } } };
  return { api, updates, waits, waitForComplete: async id => { waits.push(id); } };
}
test('listagem existente conserva destino sem navegacao extra', async () => {
  const f = fixture([{ url: listing, listing: true, candidates: [] }]);
  assert.equal(await resolveBatchListing({ tabId: 8, ...f }), listing);
  assert.deepEqual(f.updates, []);
});
test('indice segue CTA explicito e confirma listagem', async () => {
  const f = fixture([{ url: index, listing: false, candidates: [listing] }, { url: listing, listing: true, candidates: [] }]);
  assert.equal(await resolveBatchListing({ tabId: 8, ...f }), listing);
  assert.deepEqual(f.updates, [{ id: 8, url: listing }]);
  assert.deepEqual(f.waits, [8]);
});
test('falhas nao inventam destino nem geram navegacao ilimitada', async () => {
  for (const candidates of [[], [index], ['https://evil.test/'], [listing, listing + 'outro/']]) {
    const f = fixture([{ url: index, listing: false, candidates }]);
    await assert.rejects(resolveBatchListing({ tabId: 8, ...f }), /listagem|destino|Idealista/i);
    assert.deepEqual(f.updates, []);
  }
  const f = fixture([{ url: index, listing: false, candidates: [listing] }, { url: listing, listing: false, candidates: [index] }]);
  await assert.rejects(resolveBatchListing({ tabId: 8, ...f }), /listagem/i);
  assert.equal(f.updates.length, 1);
});
test('inspecao e autonoma e nao toma links arbitrarios por CTA', () => {
  const anchors = [
    { textContent: 'Procurar por mapa', href: index + '/mapa' },
    { textContent: ' Ver 72 casas e apartamentos em São Miguel ', href: listing },
  ];
  const result = vm.runInNewContext(`(${inspectBatchDestination.toString()})()`, {
    document: { querySelector: () => null, querySelectorAll: () => anchors }, location: { href: index },
  });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0], listing);
});

test('bloqueio explícito é diagnosticado sem inventar URL nem navegar', async () => {
  const f = fixture([{ url: index, listing: false, candidates: [], blocked: true, title: 'Just a moment...' }]);
  await assert.rejects(resolveBatchListing({ tabId: 8, ...f }), error => {
    assert.equal(error.code, 'BATCH_ACCESS_BLOCKED');
    assert.match(error.message, /Just a moment|verificação/i);
    assert.match(error.message, /sao-miguel/);
    return true;
  });
  assert.deepEqual(f.updates, []);
});

test('inspeção aguarda DOM tardio antes de concluir ausência de destino', async () => {
  let available = false, observe;
  const result = vm.runInNewContext(`(${inspectBatchDestination.toString()})(100)`, {
    document: { title: 'Idealista', readyState: 'complete', documentElement: {}, querySelector: () => null,
      querySelectorAll: () => available ? [{ textContent: 'Ver 17 casas e apartamentos na Terceira', href: listing }] : [] },
    location: { href: index }, setTimeout, clearTimeout,
    MutationObserver: class { constructor(callback) { observe = callback; } observe() {} disconnect() {} },
  });
  available = true; observe();
  assert.deepEqual(Array.from((await result).candidates), [listing]);
});

const test = require('node:test'); const assert = require('node:assert/strict');
const { validateSender, createCollectionClient } = require('../../src/coleta-protocol');
const { runPage, abortableDelay } = require('../../src/coleta-runner');
const api = { runtime: { getURL: f => 'chrome-extension://extension/' + f } };
test('site não pode alterar política nem escolher owner de outra página', () => {
  const site = { url: 'https://www.idealista.pt/test/', tab: { id: 3 }, frameId: 0 };
  assert.throws(() => validateSender(api, { cmd: 'COLETA_SET_POLICY' }, site));
  assert.equal(validateSender(api, { cmd: 'COLETA_READ', payload: { owner: 500 } }, { ...site, url: 'chrome-extension://extension/itens.html' }).owner, '3');
});
test('client propaga recusa e runner sem ready não transporta página', async () => {
  await assert.rejects(createCollectionClient({ runtime: { sendMessage: async () => ({ ok: false }) } })('READ'));
  const result = await runPage({ reserve: async () => ({ status: 'wait' }), collect: () => assert.fail(), commit: () => assert.fail() });
  assert.equal(result.status, 'wait');
  const abort = new AbortController(); abort.abort(); await assert.rejects(abortableDelay(100, abort.signal));
});

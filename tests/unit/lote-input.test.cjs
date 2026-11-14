const test = require('node:test');
const assert = require('node:assert/strict');
const { parseBatchInput, normalizeBatchItem, validateBatchURL } = require('../../src/lote-input.js');

test('aceita JSON exportado sem alterar campos e conserva nome/URL', () => {
  const raw = { URL: 'https://www.idealista.pt/arrendar-casas/ponta-delgada/', Texto: 'Ponta Delgada', 'Município': null };
  const before = JSON.stringify(raw);
  assert.deepEqual(normalizeBatchItem(raw), { url: raw.URL, nome: raw.Texto });
  assert.deepEqual(parseBatchInput(JSON.stringify([raw])), [{ url: raw.URL, nome: raw.Texto }]);
  assert.equal(JSON.stringify(raw), before);
});
test('compatibilidade com link/nome, url, strings e linhas', () => {
  const url = 'https://www.idealista.pt/arrendar-casas/lisboa/';
  for (const raw of [{ link: '/arrendar-casas/lisboa/', nome: 'Lisboa' }, { url }, url]) {
    assert.equal(normalizeBatchItem(raw).url, url);
  }
  assert.equal(parseBatchInput(url + '\n\n' + url).length, 2);
  assert.equal(parseBatchInput(JSON.stringify([url])).length, 1);
});
test('lista invalida identifica item antes de retornar entradas', () => {
  for (const text of ['', '{}', 'null', '[]', '[null]', '[2]', '[{}]', '[[]]', '[{"URL":""}]', '[{invalid]']) {
    assert.throws(() => parseBatchInput(text));
  }
  assert.throws(() => parseBatchInput('["https://www.idealista.pt/arrendar-casas/",{}]'), /Item 2/);
});
test('enderecos vazios, dominio externo, credenciais e esquemas invalidos rejeitados', () => {
  for (const url of ['', null, 42, 'chrome-extension://id/', 'javascript:alert(1)', 'http://www.idealista.pt/', 'https://idealista.pt.evil.test/', '//evil.test/', 'https://user:pass@www.idealista.pt/']) {
    assert.throws(() => validateBatchURL(url));
  }
});

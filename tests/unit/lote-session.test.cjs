const test = require('node:test');
const assert = require('node:assert/strict');
const { createBatchSession } = require('../../src/lote-session');
const item = { nome: 'dup', url: 'https://www.idealista.pt/arrendar-casas/' };
test('duplicatas são posições distintas e estado público é defensivo', async () => {
  let collections = 0;
  const session = createBatchSession({ items: [item, item], startedAt: new Date(), collect: async () => { collections++; return { records: [{ id: '1' }], totalPages: 1 }; }, save: async () => ({ status: 'saved' }), commit: async () => {} });
  session.getState().remaining.splice(0); await session.advance();
  assert.equal(session.getState().remaining.length, 1); await session.advance();
  assert.equal(collections, 2); assert.equal((await session.advance()).status, 'done');
});
test('erro de coleta não chama save/commit; falha de save conserva snapshot', async () => {
  let fail = true, saves = 0;
  const session = createBatchSession({ items: [item], startedAt: new Date(),
    collect: async () => { if (fail) throw new Error('network'); return { records: [{ id: '1' }], totalPages: 1 }; },
    save: async () => { saves++; throw new Error('disk'); }, commit: async () => assert.fail('não consumir'),
  });
  await assert.rejects(session.advance(), /network/); assert.equal(saves, 0); assert.equal(session.getState().pending, null);
  fail = false; await assert.rejects(session.advance(), /disk/);
  const exposed = session.getState(); exposed.pending.records[0].id = 'changed';
  assert.equal(session.getState().pending.records[0].id, '1'); assert.equal(session.getState().remaining.length, 1);
});
test('resposta inválida rejeitada antes de salvar e fila vazia não coleta', async () => {
  for (const records of [null, [null]]) {
    const session = createBatchSession({ items: [item], startedAt: new Date(), collect: async () => ({ records, totalPages: 1 }), save: () => assert.fail(), commit: () => assert.fail() });
    await assert.rejects(session.advance(), TypeError);
  }
  const empty = createBatchSession({ items: [], startedAt: new Date(), collect: () => assert.fail() });
  assert.equal((await empty.advance()).status, 'done');
});

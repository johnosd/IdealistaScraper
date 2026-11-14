const test = require('node:test');
const assert = require('node:assert/strict');
const { getMunicipalityDestination, writeMunicipality } = require('../../src/lote-export.js');
const { createBatchSession } = require('../../src/lote-session.js');
const { MemoryDirectory, MemoryLocks } = require('../fixtures/localidades-filesystem.cjs');
const start = () => new Date(2026, 10, 30, 23, 59);
const items = () => [
  { nome: 'Alvor', url: 'https://www.idealista.pt/arrendar-casas/portimao/alvor/' },
  { nome: 'Lagos', url: 'https://www.idealista.pt/arrendar-casas/lagos/' },
];
async function fileAt(directory, name = 'Alvor-Paginas2.json') {
  const month = await directory.getDirectoryHandle('202611', { create: true });
  return month.getFileHandle(name, { create: true });
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }

test('C1 FR-001/002/005/006/007: caminho mensal seguro e substituição integral com snapshot', async () => {
  assert.deepEqual(getMunicipalityDestination({ startedAt: start(), nome: 'Ponta Delgada', totalPages: 2 }), {
    yearMonth: '202611', fileName: 'Ponta Delgada-Paginas2.json', relativePath: '202611/Ponta Delgada-Paginas2.json',
  });
  const safe = getMunicipalityDestination({ startedAt: start(), nome: '../São: João\\teste', totalPages: 1 });
  assert.equal(safe.yearMonth, '202611');
  assert.match(safe.fileName, /São/);
  assert.ok(!/[<>:"/\\|?*\u0000-\u001f]/.test(safe.fileName));
  assert.ok(!/[. ]$/.test(safe.fileName));
  assert.equal(safe.relativePath, `202611/${safe.fileName}`);
  const directory = new MemoryDirectory('municipios');
  const file = await fileAt(directory);
  file.contents = 'previous much longer JSON file content '.repeat(40);
  const unrelated = await fileAt(directory, 'Outro-Paginas1.json'); unrelated.contents = 'preserve';
  const gate = deferred(); directory.queryPermission = async () => { await gate.promise; return 'granted'; };
  const records = [{ id: '1', Titulo: 'São João', imagens: null }];
  const startedAt = start();
  const operation = writeMunicipality({ directory, records, startedAt, nome: 'Alvor', totalPages: 2, locks: new MemoryLocks() });
  records[0].Titulo = 'mutated'; startedAt.setMonth(11); gate.resolve();
  const result = await operation;
  assert.equal(result.status, 'saved'); assert.equal(result.total, 1);
  assert.equal(result.relativePath, '202611/Alvor-Paginas2.json');
  assert.deepEqual(JSON.parse(file.contents), [{ id: '1', Titulo: 'São João', imagens: null }]);
  assert.equal(unrelated.contents, 'preserve'); assert.equal(directory.directories.size, 1);
});

test('C2 FR-003/012: acesso, vazio e falhas preservam arquivo anterior', async () => {
  const directory = new MemoryDirectory('municipios'); const file = await fileAt(directory); file.contents = 'original';
  const options = { directory, records: [{ id: '1' }], startedAt: start(), nome: 'Alvor', totalPages: 2, locks: new MemoryLocks() };
  directory.permission = 'denied';
  assert.equal((await writeMunicipality(options)).status, 'permission-required');
  directory.permission = 'granted';
  assert.equal((await writeMunicipality({ ...options, records: [] })).status, 'empty');
  await assert.rejects(writeMunicipality({ ...options, records: [null] }), TypeError);
  for (const failAt of ['write', 'close']) {
    file.failAt = failAt; await assert.rejects(writeMunicipality(options));
    assert.equal(file.contents, 'original');
  }
  assert.equal(file.aborts, 2);
  file.failAt = null;
  assert.equal((await writeMunicipality(options)).status, 'saved');
});

test('C3 FR-013: segunda escrita ocupada não altera o destino', async () => {
  assert.equal(getMunicipalityDestination({ startedAt: start(), nome: 'Alvor', totalPages: 2 }).yearMonth, '202611');
  const directory = new MemoryDirectory('municipios'); const file = await fileAt(directory); file.contents = 'original';
  const locks = new MemoryLocks(); const entered = deferred(); const release = deferred(); let queries = 0;
  directory.queryPermission = async () => { queries++; entered.resolve(); await release.promise; return 'granted'; };
  const options = { directory, records: [{ id: 'first' }], startedAt: start(), nome: 'Alvor', totalPages: 2, locks };
  const first = writeMunicipality(options); await entered.promise;
  const second = await writeMunicipality({ ...options, records: [{ id: 'second' }] });
  assert.equal(second.status, 'busy'); assert.equal(queries, 1); assert.equal(file.contents, 'original');
  release.resolve(); assert.equal((await first).status, 'saved');
  assert.deepEqual(JSON.parse(file.contents), [{ id: 'first' }]);
});

test('C4 FR-008/009/010/011: permissão mantém pendente e retry não recoleta nem muda mês', async () => {
  let collections = 0; let writes = 0; const commits = []; const startedAt = start();
  const session = createBatchSession({ items: items(), startedAt,
    collect: async item => { collections++; return { records: [{ id: item.nome }], totalPages: 2 }; },
    save: async pending => { writes++; assert.equal(pending.startedAt.getMonth(), 10); return writes === 1 ? { status: 'permission-required' } : { status: 'saved', relativePath: '202611/Alvor-Paginas2.json', total: 1 }; },
    commit: async change => { commits.push(change); },
  });
  startedAt.setMonth(11);
  assert.equal((await session.advance()).status, 'permission-required');
  assert.equal(session.getState().remaining.length, 2); assert.equal(commits.length, 0);
  assert.deepEqual(session.getState().pending.records, [{ id: 'Alvor' }]);
  assert.equal((await session.advance()).status, 'saved');
  assert.equal(collections, 1); assert.equal(writes, 2); assert.equal(commits.length, 1);
  assert.equal(commits[0].completed.nome, 'Alvor'); assert.equal(commits[0].remaining[0].nome, 'Lagos');
  assert.equal(session.getState().remaining.length, 1); assert.equal(session.getState().pending, null);
});

test('C5 FR-008/009/013: close precede commit, reentrada é busy e falha de commit não perde resultado', async () => {
  const entered = deferred(); const release = deferred(); let collected = 0; let saved = 0; let committed = 0;
  const session = createBatchSession({ items: items(), startedAt: start(),
    collect: async () => { collected++; return { records: [{ id: '1' }], totalPages: 2 }; },
    save: async () => { saved++; entered.resolve(); await release.promise; return { status: 'saved', relativePath: '202611/Alvor-Paginas2.json', total: 1 }; },
    commit: async () => { committed++; if (committed === 1) throw new Error('storage failed'); },
  });
  const operation = session.advance(); await entered.promise;
  assert.equal(committed, 0); assert.equal(session.getState().remaining.length, 2);
  assert.equal((await session.advance()).status, 'busy'); release.resolve();
  await assert.rejects(operation, /storage failed/);
  assert.equal(session.getState().remaining.length, 2); assert.ok(session.getState().pending);
  assert.equal((await session.advance()).status, 'saved');
  assert.equal(collected, 1); assert.equal(saved, 1); assert.equal(committed, 2);
  assert.equal(session.getState().remaining.length, 1);
});

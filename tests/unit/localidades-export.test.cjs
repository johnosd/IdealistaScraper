const test = require('node:test');
const assert = require('node:assert/strict');
const { getMonthlyDestination, exportLocalities } = require('../../src/localidades-export.js');
const { MemoryDirectory, MemoryLocks, existingMonthlyFile } = require('../fixtures/localidades-filesystem.cjs');

function options(directory = new MemoryDirectory(), extra = {}) {
  return { directory, records: [{ nome: 'São João' }], startedAt: new Date(2026, 10, 30),
    locks: new MemoryLocks(), confirmOverwrite: async () => true, ...extra };
}

test('mes local inclui zeros e transicao de ano', () => {
  assert.equal(getMonthlyDestination(new Date(2027, 0, 1)).relativePath, '202701/links_localidades_202701.json');
  assert.equal(getMonthlyDestination(new Date(2026, 11, 31)).yearMonth, '202612');
  for (const date of [new Date(NaN), null, '2026-11-30']) {
    assert.throws(() => getMonthlyDestination(date));
  }
});

test('dados invalidos e ciclicos rejeitam antes de acessar a pasta', async () => {
  const directory = new MemoryDirectory();
  directory.queryPermission = async () => assert.fail('Nao deve acessar a pasta');
  const cyclic = {}; cyclic.self = cyclic;
  for (const records of [null, {}, [null], [[]], Array(1), ['texto'], [cyclic], [{ value: 1n }]]) {
    await assert.rejects(exportLocalities(options(directory, { records })), TypeError);
  }
  await assert.rejects(exportLocalities(options(directory, { startedAt: new Date(NaN) })));
  assert.deepEqual(directory.snapshot(), { directories: [], files: [] });
});

test('erro na confirmacao libera trava e preserva todos os bytes', async () => {
  const directory = new MemoryDirectory();
  const file = existingMonthlyFile(directory, 'original');
  const locks = new MemoryLocks();
  const failure = new Error('Confirmacao indisponivel');
  await assert.rejects(exportLocalities(options(directory, { locks, confirmOverwrite: async () => { throw failure; } })), error => error === failure);
  assert.equal(file.contents, 'original');
  assert.equal((await exportLocalities(options(directory, { locks }))).status, 'saved');
});

test('somente confirmacao explicitamente verdadeira permite substituir', async () => {
  const directory = new MemoryDirectory();
  const file = existingMonthlyFile(directory, 'original');
  for (const decision of [undefined, null, false, 'true']) {
    assert.equal((await exportLocalities(options(directory, { confirmOverwrite: async () => decision }))).status, 'cancelled');
    assert.equal(file.contents, 'original');
  }
});

test('erros diferentes de NotFoundError nao viram criacao de pasta ou arquivo', async () => {
  for (const stage of ['permission', 'directory', 'file']) {
    const directory = new MemoryDirectory();
    existingMonthlyFile(directory, 'original');
    const before = directory.snapshot();
    const failure = new DOMException('Acesso indisponivel', 'NotAllowedError');
    if (stage === 'permission') directory.queryPermission = async () => { throw failure; };
    if (stage === 'directory') directory.getDirectoryHandle = async () => { throw failure; };
    if (stage === 'file') directory.directories.get('202611').getFileHandle = async () => { throw failure; };
    await assert.rejects(exportLocalities(options(directory)), error => error === failure);
    assert.deepEqual(directory.snapshot(), before);
  }
});

test('falha de escrita e abort preserva erro original e libera a trava', async () => {
  const directory = new MemoryDirectory();
  const file = existingMonthlyFile(directory, 'original');
  const locks = new MemoryLocks();
  const failure = new Error('Falha de escrita');
  const original = file.createWritable.bind(file);
  file.createWritable = async () => ({ write: async () => { throw failure; },
    close: async () => assert.fail('Nao deve confirmar'), abort: async () => { throw new Error('Abort falhou'); } });
  await assert.rejects(exportLocalities(options(directory, { locks })), error => error === failure);
  assert.equal(file.contents, 'original');
  file.createWritable = original;
  assert.equal((await exportLocalities(options(directory, { locks }))).status, 'saved');
});

test('snapshot de dados e mes nao muda enquanto aguarda permissao', async () => {
  const directory = new MemoryDirectory();
  let release;
  directory.queryPermission = () => new Promise(resolve => { release = resolve; });
  const records = [{ nome: 'inicial' }];
  const startedAt = new Date(2026, 10, 30, 23, 59);
  const pending = exportLocalities(options(directory, { records, startedAt }));
  records[0].nome = 'alterado'; records.push({ nome: 'extra' });
  startedAt.setMonth(11);
  release('granted');
  const result = await pending;
  assert.equal(result.total, 1);
  const file = directory.directories.get('202611').files.get('links_localidades_202611.json');
  assert.deepEqual(JSON.parse(file.contents), [{ nome: 'inicial' }]);
});

test('sucesso aguarda close e ausencia de Web Locks rejeita sem IO', async () => {
  const directory = new MemoryDirectory();
  const file = existingMonthlyFile(directory, 'original');
  let releaseClose, enteredClose;
  const entered = new Promise(resolve => { enteredClose = resolve; });
  const original = file.createWritable.bind(file);
  file.createWritable = async options => {
    const stream = await original(options);
    return { ...stream, close: async () => { enteredClose(); await new Promise(resolve => { releaseClose = resolve; }); await stream.close(); } };
  };
  let settled = false;
  const pending = exportLocalities(options(directory)).then(result => { settled = true; return result; });
  await entered;
  assert.equal(settled, false);
  assert.equal(file.contents, 'original');
  releaseClose();
  assert.equal((await pending).status, 'saved');
  const untouched = new MemoryDirectory();
  await assert.rejects(exportLocalities(options(untouched, { locks: undefined })), /Web Locks/);
  assert.deepEqual(untouched.snapshot(), { directories: [], files: [] });
});

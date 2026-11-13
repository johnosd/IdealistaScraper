const test = require('node:test');
const assert = require('node:assert/strict');
const { getMonthlyDestination, exportLocalities } = require('../../src/localidades-export.js');
const { MemoryDirectory, MemoryLocks, existingMonthlyFile } = require('../fixtures/localidades-filesystem.cjs');

const records = [{ 'Região': 'Açores', 'Município': 'São João', URL: 'https://www.idealista.pt/geo/sao-joao/' }];
const startedAt = () => new Date(2026, 10, 30, 23, 59);
function options(directory, extra = {}) {
  return { directory, records, startedAt: startedAt(), locks: new MemoryLocks(),
    confirmOverwrite: async () => true, ...extra };
}

// US1/AC1-3, FR-003/004/005/009, SC-001/003.
test('grava JSON UTF-8 no mes local capturado sem duplicar a pasta base', async () => {
  assert.deepEqual(getMonthlyDestination(startedAt()), {
    yearMonth: '202611', fileName: 'links_localidades_202611.json',
    relativePath: '202611/links_localidades_202611.json',
  });
  const directory = new MemoryDirectory();
  const result = await exportLocalities(options(directory, {
    confirmOverwrite: async () => assert.fail('Primeira gravacao nao deve pedir substituicao'),
  }));
  assert.equal(result.status, 'saved');
  assert.equal(result.relativePath, '202611/links_localidades_202611.json');
  assert.equal(result.total, 1);
  assert.deepEqual([...directory.directories.keys()], ['202611']);
  const month = await directory.getDirectoryHandle('202611');
  const file = await month.getFileHandle('links_localidades_202611.json');
  assert.deepEqual(JSON.parse(await (await file.getFile()).text()), records);
});

// US2/AC1-2, FR-006/007, SC-002.
test('recusar substituicao preserva os bytes e todos os arquivos existentes', async () => {
  const directory = new MemoryDirectory();
  existingMonthlyFile(directory, 'conteudo anterior com acentos: São João');
  const before = directory.snapshot();
  let confirmations = 0;
  const result = await exportLocalities(options(directory, {
    confirmOverwrite: async target => {
      confirmations += 1;
      assert.equal(target.directoryName, 'localidades');
      assert.equal(target.relativePath, '202611/links_localidades_202611.json');
      assert.equal(target.total, 1);
      return false;
    },
  }));
  assert.equal(confirmations, 1);
  assert.equal(result.status, 'cancelled');
  assert.deepEqual(directory.snapshot(), before);
});

// US2/AC3, FR-005/006/009, SC-003.
test('substituicao confirmada elimina residuos e preserva outros meses', async () => {
  const directory = new MemoryDirectory();
  const file = existingMonthlyFile(directory, 'x'.repeat(4000));
  const previousMonth = await directory.getDirectoryHandle('202610', { create: true });
  const previous = await previousMonth.getFileHandle('preservar.json', { create: true });
  previous.contents = 'outro mes';
  let confirmations = 0;
  const result = await exportLocalities(options(directory, {
    confirmOverwrite: async () => { confirmations += 1; return true; },
  }));
  assert.equal(confirmations, 1);
  assert.equal(result.status, 'saved');
  assert.equal(file.contents, JSON.stringify(records, null, 2));
  assert.equal(previous.contents, 'outro mes');
  assert.deepEqual([...directory.files.keys()], []);
});

// US1/AC4, US2/AC4, FR-008/010/011, SC-004; Constitution IV/V.
test('sem dados ou permissao nao grava e erros de escrita preservam o anterior', async () => {
  for (const permission of ['prompt', 'denied']) {
    const directory = new MemoryDirectory(); directory.permission = permission;
    const result = await exportLocalities(options(directory));
    assert.equal(result.status, 'permission-required');
    assert.deepEqual(directory.snapshot(), { directories: [], files: [] });
  }
  const directory = new MemoryDirectory();
  const file = existingMonthlyFile(directory, 'original');
  assert.equal((await exportLocalities(options(directory, { records: [] }))).status, 'empty');
  assert.equal(file.contents, 'original');
  const invalid = [{ value: 1n }];
  await assert.rejects(exportLocalities(options(directory, { records: invalid })), TypeError);
  for (const failAt of ['write', 'close']) {
    file.failAt = failAt;
    await assert.rejects(exportLocalities(options(directory)), error =>
      error.name === (failAt === 'write' ? 'NotReadableError' : 'QuotaExceededError'));
    assert.equal(file.contents, 'original');
  }
  assert.ok(file.aborts >= 2, 'Streams com erro devem ser abortados');
});

// FR-013, SC-002/004; concorrencia entre instancias da extensao.
test('gravacao concorrente retorna ocupado e libera a trava apos cancelamento', async () => {
  const directory = new MemoryDirectory();
  const file = existingMonthlyFile(directory, 'original');
  const locks = new MemoryLocks();
  let enterConfirmation, finishConfirmation;
  const entered = new Promise(resolve => { enterConfirmation = resolve; });
  const confirm = new Promise(resolve => { finishConfirmation = resolve; });
  const first = exportLocalities(options(directory, { locks,
    confirmOverwrite: async () => { enterConfirmation(); return confirm; },
  }));
  await Promise.race([entered, first.then(() => assert.fail('Confirmacao nao aguardada'))]);
  const second = await exportLocalities(options(directory, { locks,
    confirmOverwrite: async () => assert.fail('Nao deve confirmar enquanto ocupado'),
  }));
  assert.equal(second.status, 'busy');
  assert.equal(file.contents, 'original');
  finishConfirmation(false);
  assert.equal((await first).status, 'cancelled');
  assert.equal((await exportLocalities(options(directory, { locks }))).status, 'saved');
});

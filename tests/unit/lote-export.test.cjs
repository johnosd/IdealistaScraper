const test = require('node:test');
const assert = require('node:assert/strict');
const { getMunicipalityDestination: destination, writeMunicipality: write } = require('../../src/lote-export');
const { MemoryDirectory, MemoryLocks } = require('../fixtures/localidades-filesystem.cjs');
function options() { return { directory: new MemoryDirectory(), records: [{ id: 'a' }], startedAt: new Date(2026, 10, 1), nome: 'Alvor', totalPages: 1, locks: new MemoryLocks() }; }
test('destinos rejeitam data/páginas inválidas e limitam nome em pontos de código', () => {
  for (const startedAt of [new Date('invalid'), null]) assert.throws(() => destination({ ...options(), startedAt }), TypeError);
  for (const totalPages of [0, -1, 1.5, NaN]) assert.throws(() => destination({ ...options(), totalPages }), TypeError);
  assert.equal(destination({ ...options(), nome: '.. ' }).fileName, 'municipio-Paginas1.json');
  assert.equal(destination({ ...options(), nome: '😀'.repeat(200) }).fileName, '😀'.repeat(100) + '-Paginas1.json');
});
test('JSON inválido e ausência de lock não fazem IO', async () => {
  const opts = options(); opts.directory.queryPermission = () => { throw new Error('não consultar'); };
  const cyclic = {}; cyclic.self = cyclic;
  for (const records of [[null], [cyclic], [{ id: 1n }], [{ toJSON: () => null }]]) await assert.rejects(write({ ...opts, records }));
  await assert.rejects(write({ ...opts, locks: null }), /Locks/);
  assert.deepEqual(opts.directory.snapshot(), { directories: [], files: [] });
});
test('erros de lookup não criam destinos e lock é liberado', async () => {
  const opts = options(); let calls = 0;
  opts.directory.getDirectoryHandle = async () => { calls++; throw new DOMException('denied', 'NotAllowedError'); };
  await assert.rejects(write(opts), { name: 'NotAllowedError' });
  assert.equal(calls, 1); assert.equal(opts.locks.held.size, 0);
});
test('sucesso aguarda close e abort falho preserva erro original', async () => {
  const opts = options(); let release; const gate = new Promise(r => { release = r; }); let closing;
  const entered = new Promise(r => { closing = r; });
  const month = await opts.directory.getDirectoryHandle('202611', { create: true });
  const file = await month.getFileHandle('Alvor-Paginas1.json', { create: true });
  const create = file.createWritable.bind(file); let settled = false;
  file.createWritable = async config => { const stream = await create(config); return { ...stream, close: async () => { closing(); await gate; return stream.close(); } }; };
  const operation = write(opts).then(r => { settled = true; return r; });
  await entered; assert.equal(settled, false); release(); assert.equal((await operation).status, 'saved');
  file.createWritable = async () => ({ write: async () => { throw new Error('original'); }, abort: async () => { throw new Error('abort'); } });
  await assert.rejects(write(opts), /original/); assert.equal(opts.locks.held.size, 0);
});

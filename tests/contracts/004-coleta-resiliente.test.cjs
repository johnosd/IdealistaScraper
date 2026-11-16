const test = require('node:test');
const assert = require('node:assert/strict');
const { createCollectionCoordinator } = require('../../src/coleta-coordinator');
const { MemoryCollectionStore } = require('../fixtures/coleta-store.cjs');
const base = 'https://www.idealista.pt/arrendar-casas/alvor/';
const page = n => n === 1 ? base : `${base}pagina-${n}/`;
function setup() {
  const store = new MemoryCollectionStore(); let time = Date.parse('2026-11-30T12:00:00Z');
  return { store, now: () => time, advance: ms => { time += ms; }, coordinator: () => createCollectionCoordinator({ store, now: () => time }) };
}
const policy = { minIntervalMs: 10000, windowMs: 60000, maxPagesPerWindow: 2, maxPagesPerRun: 200,
  maxPagesPerItem: 100, maxAttempts: 3, requestTimeoutMs: 30000, maxSessionMs: 21600000,
  backoffBaseMs: 30000, maxNoNewPages: 3 };
function session(id = 's1', mode = 'lote', owner = 'screen1') {
  return { id, mode, owner, domain: 'idealista.pt', startedAt: '2026-11-30T12:00:00.000Z',
    items: [{ nome: 'Alvor', url: base }], proxyRevision: 'proxy-v1', exportContext: { yearMonth: '202611' } };
}
const request = (epoch, n, extra = {}) => ({ id: 's1', owner: 'screen1', epoch, requestId: `r${n}`, url: page(n), kind: n === 1 ? 'navigation' : 'pagination', ...extra });
const report = (epoch, n, extra = {}) => ({ ...request(epoch, n), status: 200, finalUrl: page(n), listing: true,
  records: [{ id: String(n), Titulo: `Item ${n}` }], nextUrl: page(n + 1), ...extra });

test('C1 US1 FR-001/004/005/006: intervalo e orçamento sobrevivem a troca de modo e coordenador', async () => {
  const f = setup(); let c = f.coordinator(); await c.updatePolicy(policy);
  const { epoch } = await c.start(session());
  assert.equal((await c.requestPage(request(epoch, 1))).status, 'ready');
  await c.reportPage(report(epoch, 1)); f.advance(9999);
  const waiting = await c.requestPage(request(epoch, 2)); assert.equal(waiting.status, 'wait'); assert.equal(waiting.until, f.now() + 1);
  f.advance(1); c = f.coordinator(); assert.equal((await c.requestPage(request(epoch, 2))).status, 'ready');
  await c.reportPage(report(epoch, 2));
  await c.control({ id: 's1', owner: 'screen1', epoch, action: 'cancel' });
  const second = await c.start(session('s2', 'itens', 'screen2')); f.advance(10000);
  const denied = await c.requestPage(request(second.epoch, 1, { id: 's2', owner: 'screen2', requestId: 's2r1' }));
  assert.equal(denied.status, 'wait'); assert.equal(denied.reason, 'window_budget');
  assert.equal((await c.read({ id: 's1' })).counters.requested, 2);
  assert.equal((await c.read({ id: 's2' })).counters.requested, 0);
});

test('C2 US2 FR-008/010/011: 429 persistente e desafio exigem retomada explícita', async () => {
  const f = setup(); let c = f.coordinator(); await c.updatePolicy({ ...policy, maxPagesPerWindow: 60 });
  let { epoch } = await c.start(session()); await c.requestPage(request(epoch, 1));
  await c.reportPage(report(epoch, 1, { status: 429, retryAfter: '120', listing: false, records: [] }));
  f.advance(119999); c = f.coordinator();
  assert.equal((await c.control({ id: 's1', owner: 'screen1', epoch, action: 'resume', proxyRevision: 'proxy-v1' })).status, 'wait');
  f.advance(1);
  assert.equal((await c.requestPage(request(epoch, 1, { requestId: 'r2' }))).status, 'paused');
  const resumed = await c.control({ id: 's1', owner: 'screen1', epoch, action: 'resume', proxyRevision: 'proxy-v1' }); epoch = resumed.epoch;
  assert.equal((await c.requestPage(request(epoch, 1, { requestId: 'r2' }))).status, 'ready');
  await c.reportPage(report(epoch, 1, { requestId: 'r2', status: 200, challenge: true, listing: false, records: [] }));
  f.advance(3600000);
  const blocked = await c.control({ id: 's1', owner: 'screen1', epoch, action: 'resume', proxyRevision: 'proxy-v1', accessConfirmed: false });
  assert.equal(blocked.status, 'paused'); assert.equal(blocked.reason, 'access_blocked');
  assert.equal((await c.read({ id: 's1' })).checkpoint.confirmedPages, 0);
});

test('C3 US3 FR-013/014: corrida, execução ainda viva e proprietário antigo não duplicam coleta', async () => {
  const f = setup(); const a = f.coordinator(), b = f.coordinator(); await a.updatePolicy(policy);
  const results = await Promise.all([a.start(session()), b.start(session('s2', 'links', 'screen2'))]);
  assert.equal(results.filter(r => r.status === 'started').length, 1);
  assert.equal(results.filter(r => r.status === 'busy').length, 1);
  const winner = results[0].status === 'started' ? session() : session('s2', 'links', 'screen2');
  const epoch = results.find(r => r.status === 'started').epoch;
  const cmd = request(epoch, 1, { id: winner.id, owner: winner.owner });
  assert.equal((await a.requestPage(cmd)).status, 'ready');
  assert.equal((await b.requestPage(cmd)).status, 'duplicate');
  assert.equal((await a.recover({ id: winner.id, ownerAlive: false, executorAlive: true })).status, 'busy');
  assert.equal((await a.read({ id: winner.id })).counters.requested, 1);
  await a.recover({ id: winner.id, ownerAlive: false, executorAlive: false }); f.advance(31000);
  const resumed = await b.control({ id: winner.id, owner: 'new-screen', epoch, action: 'resume', proxyRevision: 'proxy-v1' });
  assert.ok(resumed.epoch > epoch);
  const stale = await a.requestPage({ ...cmd, requestId: 'stale' });
  assert.equal(stale.status, 'rejected'); assert.equal(stale.reason, 'stale_owner');
});

test('C4 US4 FR-021/022/023/024: checkpoint de três páginas retoma após reconstrução sem refazer progresso', async () => {
  const f = setup(); let c = f.coordinator(); await c.updatePolicy({ ...policy, maxPagesPerWindow: 60 });
  let { epoch } = await c.start(session());
  for (let n = 1; n <= 3; n++) { assert.equal((await c.requestPage(request(epoch, n))).status, 'ready'); await c.reportPage(report(epoch, n)); f.advance(10000); }
  c = f.coordinator(); await c.recover({ id: 's1', ownerAlive: false, executorAlive: false });
  const recovered = await c.read({ id: 's1' });
  assert.equal(recovered.state, 'interrupted'); assert.equal(recovered.checkpoint.nextUrl, page(4));
  assert.equal(recovered.checkpoint.confirmedPages, 3); assert.deepEqual(recovered.checkpoint.records.map(r => r.id), ['1', '2', '3']);
  assert.equal((await c.requestPage(request(epoch, 4))).status, 'paused');
  f.advance(86400000);
  // Para este contrato o orçamento temporal da sessão é ampliado explicitamente, sem apagar consumo.
  await c.updatePolicy({ ...policy, maxPagesPerWindow: 60, maxSessionMs: 172800000 });
  const resumed = await c.control({ id: 's1', owner: 'screen2', epoch, action: 'resume', proxyRevision: 'proxy-v1' }); epoch = resumed.epoch;
  assert.equal((await c.requestPage(request(epoch, 4, { owner: 'screen2' }))).status, 'ready');
  await c.reportPage(report(epoch, 4, { owner: 'screen2', nextUrl: null }));
  const done = await c.read({ id: 's1' });
  assert.equal(done.state, 'awaiting-save'); assert.equal(done.counters.requested, 4);
  assert.equal(done.exportContext.yearMonth, '202611'); assert.equal(done.checkpoint.records.length, 4);
});

test('C5 US4 FR-026/027 Constitution IV: falha de commit preserva checkpoint e resultado salvo é idempotente', async () => {
  const f = setup(); let c = f.coordinator(); await c.updatePolicy({ ...policy, maxPagesPerWindow: 60 });
  const { epoch } = await c.start(session()); await c.requestPage(request(epoch, 1)); await c.reportPage(report(epoch, 1)); f.advance(10000);
  await c.requestPage(request(epoch, 2)); f.store.failNextCommit = true;
  await assert.rejects(c.reportPage(report(epoch, 2, { nextUrl: null })), /quota/);
  c = f.coordinator(); const previous = await c.read({ id: 's1' });
  assert.equal(previous.checkpoint.confirmedPages, 1); assert.deepEqual(previous.checkpoint.records.map(r => r.id), ['1']);
  assert.notEqual((await c.requestPage(request(epoch, 3))).status, 'ready');
  await c.reportPage(report(epoch, 2, { nextUrl: null }));
  assert.equal((await c.read({ id: 's1' })).state, 'awaiting-save');
  const receipt = { id: 'save-1', relativePath: '202611/Alvor-Paginas2.json' };
  await c.markSaved({ id: 's1', epoch, owner: 'screen1', receipt });
  await c.markSaved({ id: 's1', epoch, owner: 'screen1', receipt });
  const saved = await c.read({ id: 's1' }); assert.equal(saved.state, 'saved');
  assert.equal(saved.counters.requested, 2); assert.equal(saved.checkpoint.records.length, 2);
});

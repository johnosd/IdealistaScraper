const test = require('node:test');
const assert = require('node:assert/strict');
const { createBatchCollector } = require('../../src/lote-collector');
function setup({ fail, index = false, missing = false } = {}) {
  const calls = [], listeners = new Set(); let url = 'https://www.idealista.pt/arrendar-casas/';
  const event = { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) };
  const api = { tabs: {
    create: async options => { calls.push(['create', options]); url = options.url; return { id: 42 }; },
    update: async (id, options) => { calls.push(['navigate', id, options]); url = options.url; },
    get: async () => ({ status: 'complete' }), onUpdated: event, onRemoved: event,
    remove: async id => calls.push(['remove', id]),
    sendMessage: async (id, msg) => {
      calls.push(['message', msg.cmd]);
      if (missing) { missing = false; throw new Error('Could not establish connection. Receiving end does not exist.'); }
      if (fail) return { ok: false, error: fail };
      return msg.cmd === 'START_CRAWL' ? { ok: true } : { ok: true, complete: true, dados: [{ id: '1' }], totalPaginas: 2 };
    },
  }, scripting: { executeScript: async options => {
    if (options.files) { calls.push(['inject']); return []; }
    const listing = !index || url.endsWith('/listing/');
    return [{ result: { url, listing, candidates: ['https://www.idealista.pt/listing/'] } }];
  } } };
  return { api, calls, listeners };
}

test('proxy confirmado antes da primeira navegação do lote', async () => {
  const f = setup({ index: true });
  f.api.storage = { local: { get: async () => ({ proxyHost: 'proxy.invalid', proxyPort: '8080' }) } };
  f.api.runtime = { sendMessage: async () => { f.calls.push(['proxy']); return { ok: true }; } };
  await createBatchCollector(f.api, { useProxy: () => true })({ url: 'https://www.idealista.pt/index/' });
  assert.equal(f.calls[0][0], 'proxy');
});
test('adapter legado estável não reaplica proxy a cada município',async()=>{
 const f=setup();f.api.storage={local:{get:async()=>({proxyHost:'proxy.invalid',proxyPort:'8080'})}};
 f.api.runtime={sendMessage:async()=>{f.calls.push(['proxy']);return {ok:true};}};
 const collect=createBatchCollector(f.api,{useProxy:()=>true});for(let i=0;i<100;i++)await collect({url:`https://www.idealista.pt/item-${i}/`});
 assert.equal(f.calls.filter(c=>c[0]==='proxy').length,1);
});
test('falha de proxy bloqueia navegação e coleta do lote', async () => {
  for (const response of [undefined, { ok: false, error: 'proxy failed' }, new Error('message failed')]) {
    const f = setup();
    f.api.storage = { local: { get: async () => ({}) } };
    f.api.runtime = { sendMessage: async () => { if (response instanceof Error) throw response; return response; } };
    await assert.rejects(createBatchCollector(f.api, { useProxy: () => true })({ url: 'https://www.idealista.pt/' }));
    assert.equal(f.calls.length, 0);
  }
});
test('URL/Texto normalizados, CTA antes do crawl e cleanup apenas da aba própria', async () => {
  const f = setup({ index: true });
  const result = await createBatchCollector(f.api)({ url: 'https://www.idealista.pt/index/', nome: 'São Miguel' });
  assert.equal(result.totalPages, 2); assert.equal(f.calls[0][1].active, false);
  assert.ok(f.calls.findIndex(c => c[0] === 'navigate') < f.calls.findIndex(c => c[0] === 'message'));
  assert.deepEqual(f.calls.at(-1), ['remove', 42]); assert.equal(f.listeners.size, 0);
});
test('falha funcional não reinjeta/recoleta e destino inválido não abre aba', async () => {
  const f = setup({ fail: 'HTTP 403' }); const collect = createBatchCollector(f.api);
  await assert.rejects(collect({ url: 'https://www.idealista.pt/' }), /HTTP 403/);
  assert.equal(f.calls.filter(c => c[0] === 'message').length, 1); assert.ok(!f.calls.some(c => c[0] === 'inject'));
  const before = f.calls.length; await assert.rejects(collect({ url: 'chrome-extension://bad/' })); assert.equal(f.calls.length, before);
  assert.deepEqual(f.calls.at(-1), ['remove', 42]);
});
test('receptor ausente permite uma injeção e resposta completa é obrigatória', async () => {
  const f = setup({ missing: true }); await createBatchCollector(f.api)({ url: 'https://www.idealista.pt/' });
  assert.equal(f.calls.filter(c => c[0] === 'inject').length, 1);
  f.api.tabs.sendMessage = async () => ({ ok: true, complete: false });
  await assert.rejects(createBatchCollector(f.api)({ url: 'https://www.idealista.pt/' }), /incompleta/);
});

test('página bloqueada fica aberta e a tentativa explícita reutiliza a própria aba', async () => {
  const f = setup(); let blocked = true;
  const url = 'https://www.idealista.pt/index/';
  f.api.tabs.get = async () => ({ id: 42, status: 'complete', url });
  f.api.scripting.executeScript = async () => [{ result: { url, blocked, listing: !blocked, candidates: [], title: blocked ? 'Just a moment...' : 'Idealista' } }];
  const collect = createBatchCollector(f.api);
  await assert.rejects(collect({ url }), /mantida aberta/i);
  assert.equal(f.calls.filter(c => c[0] === 'remove').length, 0);
  assert.ok(f.calls.some(c => c[0] === 'navigate' && c[2].active));
  blocked = false; await collect({ url });
  assert.equal(f.calls.filter(c => c[0] === 'create').length, 1);
  assert.deepEqual(f.calls.at(-1), ['remove', 42]);
});

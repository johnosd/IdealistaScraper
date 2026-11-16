// Extensão/crawler/writer reais; picker/permissão simulados, OPFS, perfil temporário.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const origin = 'https://www.idealista.pt';
const listing = origin + '/arrendar-casas/alvor/';
const direct = origin + '/arrendar-casas/lagos/';
const index = origin + '/arrendar-casas/alvor/concelhos-freguesias';
const sourceURL = origin + '/arrendar-casas/origem/';
function html(id, next = false) {
  return `<section class="items-container items-list"><article class="item" data-element-id="${id}"><div class="item-info-container"><a class="item-link" href="/imovel/${id}/">Apartamento São João</a><div class="price-row"><span class="item-price">900 €/mês</span></div><div class="item-detail-char"><span class="item-detail">T2</span><span class="item-detail">90 m² área bruta</span><span class="item-detail">Garagem incluída</span></div></div><div class="item-multimedia-pictures__counter"><span>1/</span><span>9</span></div></article></section>${next ? '<div class="pagination"><li class="next"><a href="/arrendar-casas/alvor/pagina-2">Seguinte</a></li></div>' : ''}`;
}
(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'idealista-003-e2e-'));
  let context, brokenNext = false, blockedEntry = false, autoLoadEmpty = false;
  const cases = [], errors = [], downloads = [];
  try {
    context = await chromium.launchPersistentContext(profile, { channel: 'chromium', headless: true,
      ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging', '--host-resolver-rules=MAP * ~NOTFOUND'] });
    await context.route('https://**/*', route => {
      const url = route.request().url();
      if (url.startsWith('https://api.ipify.org/')) return route.fulfill({ contentType: 'application/json', body: '{"ip":"127.0.0.1"}' });
      if (!url.startsWith(origin)) return route.abort();
      if (url === sourceURL) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: autoLoadEmpty ? '<h1>Sem localidades</h1>' : `<div class="breadcrumb-dropdown-element highlighted"><ul class="breadcrumb-dropdown-subitem-list"><li><a href="/arrendar-casas/alvor/">Alvor</a><span>opções</span><span class="breadcrumb-navigation-sidenote">17</span></li><li><a href="/arrendar-casas/sao-joao/">São João</a><span class="breadcrumb-navigation-sidenote">1.234</span></li></ul></div><div class="breadcrumb-dropdown-element"><ul class="breadcrumb-dropdown-subitem-list"><li><a href="/arrendar-casas/ignorar/">Ignorar</a><span class="breadcrumb-navigation-sidenote">9999</span></li></ul></div>` });
      if (url === index && blockedEntry) return route.fulfill({ status: 403, contentType: 'text/html', body: '<title>Just a moment...</title><form id="challenge-form">Verificação necessária</form>' });
      if (url === index) return route.fulfill({ contentType: 'text/html', body: `<a href="${listing}">Ver 2 casas e apartamentos em Alvor</a>` });
      if (url.includes('/delayed/')) return route.fulfill({ contentType: 'text/html', body: `<h1>Carregando</h1><script>setTimeout(() => document.body.insertAdjacentHTML('beforeend', '<a href="${listing}">Ver 17 casas e apartamentos na Terceira</a>'), 150)</script>` });
      if (url.endsWith('/pagina-2') && brokenNext === 'empty') return route.fulfill({ contentType: 'text/html', body: '<section class="items-container items-list"></section>' });
      if (url.endsWith('/pagina-2') && brokenNext) return brokenNext === 'network' ? route.abort() : route.fulfill({ status: brokenNext === 'html' ? 200 : 418, contentType: 'text/html', body: '<h1>Erro</h1>' });
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: html(url.endsWith('/pagina-2') ? '2' : '1', url === listing) });
    });
    await context.addInitScript(() => {
      if (location.protocol !== 'chrome-extension:' || location.pathname !== '/lote.html') return;
      const NativeDate = Date;
      const state = window.__e2e = { permission: localStorage.getItem('__permission') || 'granted', folder: 'municipios', cancel: false, failPersist: false, failAt: null,
        failCommit: false, hold: false, activation: [], collections: 0, created: 0, writes: 0, now: new NativeDate(2026, 10, 30, 23, 59).getTime() };
      window.Date = new Proxy(NativeDate, { construct(target, args) { return Reflect.construct(target, args.length ? args : [state.now]); } });
      FileSystemHandle.prototype.queryPermission = async () => state.permission;
      FileSystemHandle.prototype.requestPermission = async () => { state.activation.push(navigator.userActivation.isActive); return state.permission = 'granted'; };
      window.showDirectoryPicker = async () => {
        state.activation.push(navigator.userActivation.isActive);
        if (state.cancel) throw new DOMException('Cancelado', 'AbortError');
        return (await navigator.storage.getDirectory()).getDirectoryHandle(state.folder, { create: true });
      };
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) { if (state.failPersist) throw new Error('persist failed'); return put.apply(this, args); };
      const createWritable = FileSystemFileHandle.prototype.createWritable;
      FileSystemFileHandle.prototype.createWritable = async function (...args) {
        state.writes++;
        const stream = await createWritable.apply(this, args);
        return { write: async value => { if (state.failAt === 'write') throw new Error('write failed'); return stream.write(value); }, abort: () => stream.abort(), close: async () => {
          if (state.failAt === 'close') throw new Error('close failed');
          if (state.hold) { state.closing = true; await new Promise(r => { state.release = r; }); }
          return stream.close();
        } };
      };
      const create = chrome.tabs.create;
      chrome.tabs.create = async options => { state.created++; const tab = await create({ ...options, url: 'about:blank' }); await window.__attachFixture(tab.id, options.url); return tab; };
      const send = chrome.tabs.sendMessage;
      chrome.tabs.sendMessage = async (tabId, message) => {
        if (message.cmd === 'COLLECT_PAGE') {
          state.collections++;
        }
        const result = await send(tabId, message);
        if (message.cmd === 'COLLECT_PAGE' && result?.ok && !result.nextUrl && state.denyOnSave) { state.permission = 'denied'; state.denyOnSave = false; }
        return result;
      };
      const set = chrome.storage.local.set.bind(chrome.storage.local);
      chrome.storage.local.set = async values => {
        if (state.failCommit && values.loteStatusArr?.some(s => s.status === 'Sucesso')) { state.failCommit = false; throw new Error('commit failed'); }
        return set(values);
      };
    });
    await context.exposeBinding('__attachFixture', async ({ page }, tabId, url) => {
      await page.waitForFunction(async id => (await chrome.tabs.get(id)).url === 'about:blank', tabId);
      assert.ok(context.pages().some(p => p.url() === 'about:blank'));
      await page.evaluate(({ tabId, url }) => chrome.tabs.update(tabId, { url }), { tabId, url });
    });
    context.on('page', page => { page.on('pageerror', error => errors.push(error.message)); page.on('download', d => downloads.push(d)); });
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path: path.resolve(__dirname, '../..') });
    const base = `chrome-extension://${id}/`;
    const sourcePage = await context.newPage(); await sourcePage.goto(sourceURL);
    const popup = await context.newPage(); await popup.goto(base + 'popup.html'); await popup.locator('#tab-lote').click();
    // Reproduzir a aba web ativa de um popup de ação enquanto o HTML do popup
    // está aberto como página do harness; não substituir o launcher/autoload.
    const sourceTabId = await popup.evaluate(async sourceURL => (await chrome.tabs.query({ url: sourceURL }))[0].id, sourceURL);
    await popup.evaluate(sourceTabId => {
      const query = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = options => options.active ? Promise.resolve([{ id: sourceTabId }]) : query(options);
    }, sourceTabId);
    const opened = context.waitForEvent('page'); await popup.locator('#openLote').click();
    const page = await opened; await page.waitForURL(base + 'lote.html*'); await popup.close();
    await page.evaluate(async()=>{const p=(await chrome.runtime.sendMessage({cmd:'COLETA_GET_POLICY'})).result;await chrome.runtime.sendMessage({cmd:'COLETA_SET_POLICY',payload:{limits:{...p.limits,minIntervalMs:1000},ipEnabled:false}});});
    let confirmations = 0;
    page.on('dialog', async dialog => { if (dialog.type() === 'confirm') confirmations++; await dialog.accept(); });
    async function state(expected, target = page) {
      try { await target.locator(`#loteLog[data-state="${expected}"]`).waitFor({ timeout: 15000 }); console.log('E2E003:', expected); }
      catch (error) { console.error('Estado:', await target.locator('#loteLog').textContent(), 'Erros:', errors); throw error; }
    }
    async function claim() { if (await page.locator('#loteClaim').isVisible()) { await page.locator('#loteClaim').click(); await page.waitForFunction(() => !document.getElementById('loteUrls').disabled); } }
    async function run(rows, expected = 'complete') { await claim();
      await page.evaluate(async()=>{const all=(await chrome.runtime.sendMessage({cmd:'COLETA_LIST'})).result;for(const row of all.filter(s=>s.state==='saved')){const r=await chrome.runtime.sendMessage({cmd:'COLETA_DISCARD',payload:{id:row.id,epoch:row.epoch}});if(!r.ok)throw Error('Explicit cleanup failed');}}); await page.locator('#loteUrls').fill(JSON.stringify(rows)); await page.locator('#loteStart').click(); await state(expected); }
    async function read(name) { return page.evaluate(async name => {
      const root = await navigator.storage.getDirectory(); const dir = await root.getDirectoryHandle('municipios'); const month = await dir.getDirectoryHandle('202611'); return (await (await month.getFileHandle(name)).getFile()).text();
    }, name); }
    const collections = () => page.evaluate(() => window.__e2e.collections);
    await state('needs-directory');
    await page.bringToFront();
    assert.notEqual(await page.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id), sourceTabId);
    const expectedAutoLoad = [
      { nome: 'São João', link: origin + '/arrendar-casas/sao-joao/', quantidade: 1234 },
      { nome: 'Alvor', link: listing, quantidade: 17 },
    ];
    await page.locator('#loteAutoLoad').click();
    await page.waitForFunction(() => /localidades carregadas|Nenhuma localidade encontrada/.test(document.getElementById('loteLog').textContent));
    const loadedText = await page.locator('#loteUrls').inputValue();
    assert.deepEqual(JSON.parse(loadedText), expectedAutoLoad, 'autoload deve conservar ambos os itens do breadcrumb anterior');
    assert.deepEqual(await page.evaluate(async () => (await chrome.storage.local.get('loteLista')).loteLista), expectedAutoLoad);
    autoLoadEmpty = true; await sourcePage.reload();
    await page.locator('#loteAutoLoad').click(); await state('error');
    assert.equal(await page.locator('#loteUrls').inputValue(), loadedText);
    assert.deepEqual(await page.evaluate(async () => (await chrome.storage.local.get('loteLista')).loteLista), expectedAutoLoad);
    await page.evaluate(() => {
      const execute = chrome.scripting.executeScript;
      chrome.scripting.executeScript = async () => {
        chrome.scripting.executeScript = execute;
        throw new Error('Falha de autoload simulada');
      };
    });
    await page.locator('#loteAutoLoad').click();
    await page.waitForFunction(() => document.getElementById('loteLog').textContent.includes('Falha de autoload simulada'));
    assert.equal(await page.locator('#loteUrls').inputValue(), loadedText);
    assert.deepEqual(await page.evaluate(async () => (await chrome.storage.local.get('loteLista')).loteLista), expectedAutoLoad);
    cases.push('autoload do breadcrumb anterior usa origem, coleta todos, ordena contagens e preserva fila quando vazio');
    await page.locator('#choose').click(); await state('ready');
    await page.evaluate(async () => {
      const db = await new Promise(resolve => { const r = indexedDB.open('idealista-localidades', 1); r.onupgradeneeded = () => r.result.createObjectStore('settings'); r.onsuccess = () => resolve(r.result); });
      await new Promise(resolve => { const tx = db.transaction('settings', 'readwrite'); tx.objectStore('settings').put('sentinel', 'directory'); tx.oncomplete = resolve; }); db.close();
    });
    await run([{ URL: index, Texto: 'Alvor', Município: null }, { nome: 'Lagos', link: direct }]);
    const original = await read('Alvor-Paginas2.json'); assert.equal(JSON.parse(original).length, 2);
    assert.ok(JSON.parse(original).every(row => Object.keys(row).length === 17 && row.imagens === 9 && row.estacionamento === 'Garagem incluída'));
    assert.equal(JSON.parse(await read('Lagos-Paginas1.json')).length, 1); assert.equal(downloads.length, 0); assert.equal(confirmations, 0);
    cases.push('dois itens, CTA, paginação, UTF-8, mês/nome e zero Downloads');
    await page.reload(); await state('ready');
    await page.evaluate(() => localStorage.setItem('__permission', 'prompt'));
    await page.reload(); await state('permission-required');
    await page.evaluate(() => localStorage.removeItem('__permission'));
    await page.locator('#reauthorize').click(); await state('ready');
    await page.evaluate(() => { window.__e2e.cancel = true; }); await page.locator('#choose').click(); await state('cancelled');
    assert.match(await page.locator('#destination').textContent(), /municipios/);
    await page.evaluate(() => { window.__e2e.cancel = false; window.__e2e.failPersist = true; window.__e2e.folder = 'temporaria'; });
    await page.locator('#choose').click(); await state('error'); assert.match(await page.locator('#destination').textContent(), /temporaria/);
    await page.reload(); await state('ready'); assert.match(await page.locator('#destination').textContent(), /municipios/);
    cases.push('reutilização IDB, cancelar troca e falha de persistência');
    await page.locator('#loteUrls').fill('[{"URL":"chrome-extension://invalido/"}]');
    await page.waitForFunction(async () => (await chrome.storage.local.get('loteLista')).loteLista.includes('invalido'));
    const before = await page.evaluate(() => chrome.storage.local.get(null)); const count = await collections();
    await page.locator('#loteStart').click(); await state('error'); assert.equal(await collections(), count);
    assert.deepEqual(await page.evaluate(() => chrome.storage.local.get(null)), before); cases.push('input inválido sem efeitos');
    await page.evaluate(() => { window.__e2e.denyOnSave = true; });
    await run([{ nome: 'Alvor', link: listing }], 'permission-required');
    assert.equal(await read('Alvor-Paginas2.json'), original); const savedCollections = await collections();
    await page.evaluate(() => { window.__e2e.now = new Date(2026, 11, 1).getTime(); });
    await page.locator('#reauthorize').click(); await state('ready'); await page.locator('#loteSave').click(); await state('complete');
    assert.equal(await collections(), savedCollections); assert.equal(await read('Alvor-Paginas2.json'), original);
    cases.push('gesto, reautorização, retry sem recoleta e mês fixo');
    await page.reload(); await state('ready');
    for (const failAt of ['write', 'close']) {
      await page.evaluate(failAt => { window.__e2e.failAt = failAt; }, failAt);
      await run([{ nome: 'Alvor', link: listing }], 'error'); assert.equal(await read('Alvor-Paginas2.json'), original);
      const count = await collections(); assert.match(await page.locator('#loteUrls').inputValue(), /Alvor/);
      await page.evaluate(() => { window.__e2e.failAt = null; }); await page.locator('#loteSave').click(); await state('complete'); assert.equal(await collections(), count);
    }
    cases.push('write/close falhos preservam arquivo/fila/pendente');
    await page.evaluate(() => { window.__e2e.failCommit = true; });
    await run([{ nome: 'Lagos', link: direct }], 'error'); const commitCount = await collections();
    const commitWrites = await page.evaluate(() => window.__e2e.writes);
    assert.match(await page.locator('#loteLog').textContent(), /commit failed/);
    await page.evaluate(() => { window.__e2e.folder = 'nova-base'; }); await page.locator('#choose').click(); await state('ready');
    await page.locator('#loteSave').click(); await state('complete'); assert.equal(await collections(), commitCount);
    assert.equal(await page.evaluate(() => window.__e2e.writes), commitWrites);
    assert.match(await page.locator('#loteStatusList').textContent(), /municipios\/202611\/Lagos-Paginas1.json/);
    await claim(); await page.evaluate(() => { window.__e2e.folder = 'municipios'; }); await page.locator('#choose').click(); await state('ready');
    cases.push('commit recuperado sem recoleta');
    await page.evaluate(async () => {
      const root = await navigator.storage.getDirectory(); const dir = await root.getDirectoryHandle('municipios'); const month = await dir.getDirectoryHandle('202611');
      const file = await month.getFileHandle('Lagos-Paginas1.json'); const stream = await file.createWritable(); await stream.write('x'.repeat(10000)); await stream.close();
    });
    await run([{ nome: 'Lagos', link: direct }]); assert.equal(JSON.parse(await read('Lagos-Paginas1.json')).length, 1);
    assert.equal(await read('Alvor-Paginas2.json'), original); assert.equal(confirmations, 0);
    cases.push('overwrite menor sem cauda/diálogo e outros arquivos intactos');
    for (const failure of ['http', 'html', 'empty', 'network']) {
      brokenNext = failure; await run([{ nome: 'Alvor', link: listing }], failure==='network'?'waiting':'paused');
      assert.equal(await read('Alvor-Paginas2.json'), original); assert.match(await page.locator('#loteUrls').inputValue(), /Alvor/);
      assert.equal(await page.locator('#loteSave').isDisabled(), true); if(failure==='network'){await page.locator('#collection-cancel').click();await page.waitForFunction(()=>!document.querySelector('#loteClear').disabled);} await page.locator('#loteClear').click(); await state('ready');
    }
    brokenNext = false;await page.waitForTimeout(31000);cases.push('HTTP/rede/HTML inesperado impedem gravação parcial; cooldown de rede sobrevive ao descarte');
    await page.evaluate(() => { window.__e2e.hold = true; window.__e2e.closing = false; });
    await page.locator('#loteUrls').fill(JSON.stringify([{ nome: 'Alvor', link: listing }, { URL: direct, Texto: 'Lagos', extra: 'preservar' }]));
    await page.locator('#loteStart').click(); await page.waitForFunction(() => window.__e2e.closing);
    await page.locator('#lotePause').click();
    await page.evaluate(() => { window.__e2e.hold = false; window.__e2e.now = new Date(2026, 11, 1).getTime(); window.__e2e.release(); });
    await state('paused'); assert.equal(JSON.parse(await page.locator('#loteUrls').inputValue())[0].extra, 'preservar');await page.waitForTimeout(1100);
    await page.locator('#loteStart').click(); await state('complete');
    assert.equal(JSON.parse(await read('Lagos-Paginas1.json')).length, 1);
    cases.push('pausar/continuar mantém mês e campos originais da fila');
    await page.reload(); await state('ready');
    await page.evaluate(() => { window.__e2e.hold = true; });
    await page.locator('#loteUrls').fill(JSON.stringify([{ nome: 'Alvor', link: listing }])); await page.locator('#loteStart').click(); await page.waitForFunction(() => window.__e2e.closing);
    const other = await context.newPage(); await other.goto(base + 'lote.html'); await state('busy', other);
    assert.equal(await other.locator('#loteUrls').isDisabled(), true); const snapshot = await other.evaluate(() => chrome.storage.local.get(null));
    await other.locator('#loteClaim').click(); await state('busy', other); assert.deepEqual(await other.evaluate(() => chrome.storage.local.get(null)), snapshot);
    await page.bringToFront(); await page.evaluate(() => window.__e2e.release()); await state('complete'); await other.close();
    assert.ok((await page.evaluate(() => window.__e2e.activation)).every(Boolean));
    assert.equal(await page.evaluate(async () => {
      const db = await new Promise(resolve => { const r = indexedDB.open('idealista-localidades', 1); r.onsuccess = () => resolve(r.result); });
      const value = await new Promise(resolve => { const r = db.transaction('settings').objectStore('settings').get('directory'); r.onsuccess = () => resolve(r.result); }); db.close(); return value;
    }), 'sentinel');
    assert.deepEqual(errors, []); assert.equal(downloads.length, 0); cases.push('duas telas, foco e close aguardado');
    await page.evaluate(() => { window.__e2e.hold = false; });
    await run([{ nome: 'Tardio', link: origin + '/arrendar-casas/delayed/concelhos-freguesias' }]);
    cases.push('DOM tardio aguardado antes de resolver CTA');
    // Fluxo Itens conserva seu download, mas usa as mesmas correções de campos.
    const itemsPopup = await context.newPage(); await itemsPopup.goto(base + 'popup.html');
    await itemsPopup.locator('#tab-itens').click(); await itemsPopup.locator('#extractItemsUrl').fill(direct);
    const launched=context.waitForEvent('page');await itemsPopup.locator('#extractItems').click();const itemPage=await launched;await itemPage.waitForURL(base+'itens.html');
    const downloaded=itemPage.waitForEvent('download');await itemPage.locator('#items-start').click();
    const download = await downloaded; const rows = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    assert.equal(rows[0].imagens, 9); assert.equal(rows[0].estacionamento, 'Garagem incluída'); assert.equal(Object.keys(rows[0]).length, 17);
    assert.equal(downloads.length, 1); assert.deepEqual(errors, []);
    cases.push('Itens mantém download e campos corrigidos; Lote corrige DOM e HTML parseado');
    blockedEntry=true;await run([{nome:'Diagnostico',link:index}],'blocked');
    assert.match(await page.locator('#collection-status').textContent(),/verificação|acesso/i);
    const retained=context.pages().find(p=>p.url()===index);assert.ok(retained&&!retained.isClosed());
    const createdBeforeRetry=await page.evaluate(()=>window.__e2e.created);
    blockedEntry=false;await retained.reload();await page.locator('#collection-resume').click();
    await page.waitForFunction(()=>/Próxima elegibilidade/.test(document.querySelector('#collection-status').textContent));
    assert.equal(await page.evaluate(()=>window.__e2e.created),createdBeforeRetry);
    assert.notEqual(await page.locator('#loteLog').getAttribute('data-state'),'complete');
    cases.push('403 mantém diagnóstico e exige espera persistente mesmo após acesso normalizado');
    console.log(JSON.stringify({ result: 'PASS', proof: 'MV3/real-crawler/OPFS/simulated-picker', browser: context.browser().version(), cases, loteDownloads: 0, itensDownloads: 1, errors }, null, 2));
  } finally { if (context) await context.close();assert.ok(path.resolve(profile).startsWith(path.resolve(os.tmpdir())+path.sep+'idealista-003-e2e-'));await fs.rm(profile, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });

// Prova simulada: extensão real, fixtures locais, OPFS e IndexedDB nativos.
// Não prova seleção nativa nem autorização de pasta externa.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { getMonthlyDestination } = require('../../src/localidades-export.js');

(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'idealista-002-e2e-'));
  let context;
  const errors = [], downloads = [], cases = [];
  const fixture = await fs.readFile(path.join(__dirname, '../fixtures/localidades-list.html'), 'utf8');
  let small = false, broken=false;
  try {
    console.log('E2E: launching isolated browser');
    context = await chromium.launchPersistentContext(profile, {
      channel: process.env.E2E_CHANNEL || 'chromium', headless: true,
      ignoreDefaultArgs: ['--disable-extensions'],
      args: ['--enable-unsafe-extension-debugging', '--host-resolver-rules=MAP www.idealista.pt ~NOTFOUND, MAP api.ipify.org ~NOTFOUND'],
    });
    await context.route('https://**/*', route => route.request().url().startsWith('https://www.idealista.pt/arrendar-casas/')
      ? route.fulfill({status:broken?418:200, contentType: 'text/html; charset=utf-8', body: broken?'<h1>Erro de coleta</h1>':small ? fixture.replace(/<li><a href="\/geo\/sao-joao\/">São João<\/a><\/li>/, '') : fixture })
      : route.abort());
    await context.addInitScript(() => {
      if (location.protocol !== 'chrome-extension:') return;
      const state = window.__e2e = { permission: localStorage.getItem('__testPermission') || 'granted', cancel: false, folder: 'localidades', activation: [], failPersist: false, hold: false };
      // Abas abertas por chrome.tabs.create podem navegar antes do attach do
      // Playwright. Criar em branco e avisar o harness antes de navegar a fixture.
      if (location.pathname === '/localidades.html') {
        const execute = chrome.scripting.executeScript;
        state.scripts = [];
        chrome.scripting.executeScript = async options => {
          state.scripts.push({ code: options.func.toString(), stage: 'started' });
          const current = state.scripts.at(-1);
          try { const result = await execute(options); current.stage = 'done'; return result; }
          catch (error) { current.stage = error.message; throw error; }
        };
        const create = chrome.tabs.create;
        chrome.tabs.create = async options => {
          const tab = await create({ ...options, url: 'about:blank' });
          await window.__attachFixture(tab.id, options.url);
          return tab;
        };
      }
      FileSystemHandle.prototype.queryPermission = async () => state.permission;
      FileSystemHandle.prototype.requestPermission = async () => {
        state.activation.push(navigator.userActivation.isActive);
        return state.permission = 'granted';
      };
      window.showDirectoryPicker = async () => {
        state.activation.push(navigator.userActivation.isActive);
        if (state.cancel) throw new DOMException('Cancelado', 'AbortError');
        return (await navigator.storage.getDirectory()).getDirectoryHandle(state.folder, { create: true });
      };
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (state.failPersist && this.name === 'settings') throw new DOMException('Persistência de teste falhou', 'DataCloneError');
        return put.apply(this, args);
      };
      const createWritable = FileSystemFileHandle.prototype.createWritable;
      FileSystemFileHandle.prototype.createWritable = async function (...args) {
        const stream = await createWritable.apply(this, args);
        if (!state.hold) return stream;
        return { write: value => stream.write(value), abort: () => stream.abort(), close: async () => {
          state.closing = true;
          await new Promise(resolve => { state.release = resolve; });
          await stream.close();
        } };
      };
    });
    await context.exposeBinding('__attachFixture', async ({ page }, tabId, url) => {
      console.log('E2E: attach fixture', tabId);
      // Esperar o target existir no Playwright antes de iniciar sua navegação.
      await page.waitForFunction(async id => {
        const tab = await chrome.tabs.get(id);
        return tab.url === 'about:blank';
      }, tabId);
      // Conferir anexação antes de navegar pela API da extensão. Navegação
      // via CDP/Page.goto pode perder onUpdated nesta corrida do harness.
      const blank = context.pages().filter(candidate => candidate.url() === 'about:blank').at(-1);
      assert.ok(blank, 'Aba de coleta deve estar anexada ao harness');
      await page.evaluate(({ tabId, url }) => chrome.tabs.update(tabId, { url }), { tabId, url });
      console.log('E2E: fixture ready', tabId);
    });
    context.on('page', page => {
      page.on('pageerror', error => errors.push(error.message));
      page.on('download', download => downloads.push(download.suggestedFilename()));
    });
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send('Extensions.loadUnpacked', { path: path.resolve(__dirname, '../..') });
    console.log('E2E: extension loaded');
    const base = `chrome-extension://${id}/`;
    const popup = await context.newPage();
    await popup.goto(base + 'popup.html');
    console.log('E2E: popup loaded');
    // As quatro abas antigas continuam acessíveis, sem acionar proxy.
    const buttons = popup.locator('[data-tab]');
    assert.equal(await buttons.count(), 4);
    for (let i = 0; i < await buttons.count(); i++) await buttons.nth(i).click();
    await popup.locator('#tab-links').click();
    const pagePromise = context.waitForEvent('page');
    await popup.locator('#export-links').click();
    console.log('E2E: opening export page');
    const page = await pagePromise;
    await page.waitForURL(base + 'localidades.html');
    await page.evaluate(async()=>{const p=(await chrome.runtime.sendMessage({cmd:'COLETA_GET_POLICY'})).result;await chrome.runtime.sendMessage({cmd:'COLETA_SET_POLICY',payload:{limits:{...p.limits,minIntervalMs:1000},ipEnabled:false}});});
    await popup.close();
    let confirm = false, confirmations = 0;
    page.on('dialog', async dialog => {
      if (dialog.type() === 'confirm') { confirmations++; await (confirm ? dialog.accept() : dialog.dismiss()); }
      else await dialog.accept();
    });
    const state = async (expected, target = page) => {
      try { await target.locator(`#status[data-state="${expected}"]`).waitFor(); }
      catch (error) {
        console.error('Status observado:', await target.locator('#status').textContent());
        console.error('Páginas abertas:', context.pages().map(p => p.url()));
        console.error('Scripts:', await target.evaluate(() => window.__e2e.scripts));
        console.error('Chrome tabs:', await target.evaluate(() => chrome.tabs.query({})));
        for (const candidate of context.pages().filter(p => p.url().startsWith('https://www.idealista.pt/'))) {
          console.error('Fixture DOM:', await candidate.locator('body').textContent());
        }
        throw error;
      }
    };
    const click = id => page.locator('#' + id).click();
    const { yearMonth, fileName } = getMonthlyDestination(new Date());
    const read = () => page.evaluate(async ({ yearMonth, fileName }) => {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle('localidades');
      const month = await dir.getDirectoryHandle(yearMonth);
      return (await (await month.getFileHandle(fileName)).getFile()).text();
    }, { yearMonth, fileName });
    await state('needs-directory');
    console.log('E2E: choosing OPFS directory');
    await click('choose'); await state('ready');
    await click('extract-save'); await state('saved');
    console.log('E2E: first write completed');
    const original = await read();
    const rows = JSON.parse(original);
    assert.equal(rows.length, 4);
    assert.ok(rows.some(row => row['Município'] === 'São João'));
    assert.ok(rows.every(row => row['Região'] === 'Açores'));
    assert.equal(confirmations, 0);
    cases.push('primeira gravação UTF-8 sem popup');
    small = true;
    await click('extract-save'); await state('cancelled');
    assert.equal(await read(), original);
    assert.equal(confirmations, 1);
    cases.push('recusa preserva bytes');
    confirm = true;
    await click('save'); await state('saved');
    const shorter = await read();
    assert.equal(JSON.parse(shorter).length, 3);
    assert.ok(shorter.length < original.length);
    assert.equal(shorter, JSON.stringify(JSON.parse(shorter), null, 2));
    cases.push('substituição menor sem cauda');

    await page.reload(); await state('ready');
    assert.match(await page.locator('#destination').textContent(), /localidades/);
    cases.push('reabertura com handle em IndexedDB');
    await page.evaluate(() => localStorage.setItem('__testPermission', 'prompt'));
    await page.reload(); await state('needs-permission');
    await page.evaluate(() => localStorage.removeItem('__testPermission'));
    await click('reauthorize'); await state('ready-to-save');
    await page.evaluate(() => { window.__e2e.permission = 'denied'; });
    await click('extract-save'); await state('permission-required');
    assert.equal(await read(), shorter);
    await click('reauthorize'); await state('ready-to-save');
    await click('save'); await state('saved');
    assert.ok((await page.evaluate(() => window.__e2e.activation)).every(Boolean));
    cases.push('reautorizar por gesto e salvar dados mantidos');

    await page.evaluate(() => { window.__e2e.cancel = true; });
    await click('choose'); await state('cancelled');
    assert.match(await page.locator('#destination').textContent(), /localidades/);
    await page.evaluate(() => { window.__e2e.cancel = false; window.__e2e.failPersist = true; window.__e2e.folder = 'outra'; });
    await click('choose'); await state('error');
    assert.match(await page.locator('#status').textContent(), /não foi memorizada/);
    assert.match(await page.locator('#destination').textContent(), /outra/);
    await page.reload(); await state('ready');
    assert.match(await page.locator('#destination').textContent(), /localidades/);
    cases.push('cancelar troca e falha de persistência mantêm destino anterior no banco');

    // Erro de coleta: colaborador Chrome rejeita, writer real continua intocado.
    broken=true;
    await click('extract-save'); await state('paused');broken=false;
    assert.equal(await read(), shorter);
    cases.push('erro de coleta preserva arquivo');

    await page.evaluate(() => { window.__e2e.hold = true; });
    await click('extract-save');
    await page.waitForFunction(() => window.__e2e.closing);
    const other = await context.newPage();
    await other.goto(base + 'localidades.html'); await state('ready', other);
    await other.locator('#extract-save').click(); await state('busy', other);
    await page.evaluate(() => window.__e2e.release()); await state('saved');
    await other.close();
    cases.push('duas páginas: segunda recebe ocupado');
    assert.equal(downloads.length, 0);
    assert.deepEqual(errors, []);
    assert.ok((await page.evaluate(() => window.__e2e.activation)).every(Boolean));
    console.log(JSON.stringify({ result: 'PASS', proof: 'simulated-picker/OPFS', browser: context.browser().version(), cases, downloads, errors }, null, 2));
  } finally {
    if (context) await context.close();
    assert.ok(path.resolve(profile).startsWith(path.resolve(os.tmpdir())+path.sep+'idealista-002-e2e-'));
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

// Chrome APIs reais, perfil temporário, proxy fictício e rede externa bloqueada.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

function nextVersion(cdp, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { cdp.off('ServiceWorker.workerVersionUpdated', listener); reject(Error('Timeout aguardando worker')); }, 15000);
    function listener({ versions }) {
      const found = versions.find(predicate);
      if (found) { clearTimeout(timer); cdp.off('ServiceWorker.workerVersionUpdated', listener); resolve(found); }
    }
    cdp.on('ServiceWorker.workerVersionUpdated', listener);
  });
}

(async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'idealista-proxy-e2e-'));
  let context;
  const errors = [];
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium', headless: true, ignoreDefaultArgs: ['--disable-extensions'],
      args: ['--enable-unsafe-extension-debugging', '--host-resolver-rules=MAP * ~NOTFOUND', '--disable-background-networking'],
    });
    await context.route('https://**/*', route => route.abort());
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    const browserCDP = await context.browser().newBrowserCDPSession();
    const { id } = await browserCDP.send('Extensions.loadUnpacked', { path: path.resolve(__dirname, '../..') });
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/popup.html`);
    const send = msg => page.evaluate(message => chrome.runtime.sendMessage(message), msg);
    assert.equal((await send({ cmd: 'PROXY_STATUS' })).enabled, false);
    assert.equal((await send({ cmd: 'ENABLE_PROXY', host: 'proxy.invalid', port: 8080, username: 'fixture-user', password: 'fixture-secret' })).ok, true);
    assert.equal((await send({ cmd: 'PROXY_STATUS' })).enabled, true);
    const cdp = await context.newCDPSession(page);
    const versionPromise = nextVersion(cdp, v => v.scriptURL?.startsWith(`chrome-extension://${id}/`) && v.runningStatus === 'running');
    await cdp.send('ServiceWorker.enable');
    const version = await versionPromise;
    const stopped = nextVersion(cdp, v => v.versionId === version.versionId && v.runningStatus === 'stopped');
    await cdp.send('ServiceWorker.stopWorker', { versionId: version.versionId });
    await stopped;
    // A mensagem acorda uma nova execução; nenhuma ativação adicional é enviada.
    const recovered = await send({ cmd: 'PROXY_STATUS' });
    assert.equal(recovered.enabled, true);
    assert.deepEqual(recovered.config, { host: 'proxy.invalid', port: 8080 });
    assert.equal(JSON.stringify(recovered).includes('fixture-secret'), false);
    assert.equal((await send({ cmd: 'DISABLE_PROXY' })).ok, true);
    assert.equal((await send({ cmd: 'PROXY_STATUS' })).enabled, false);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ pass: true, cases: ['load', 'enable', 'stop-worker', 'recover-on-message', 'status-without-credentials', 'disable'], pageErrors: errors.length }));
  } finally {
    await context?.close();
    // Único destino removido: diretório criado por mkdtemp para este teste.
    assert.ok(path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep + 'idealista-proxy-e2e-'));
    await fs.rm(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
function localFile(relative) {
  assert.equal(typeof relative, 'string', 'Entrada local deve ter um caminho');
  const absolute = path.resolve(root, relative);
  assert.ok(absolute.startsWith(root + path.sep), 'Entrada deve permanecer no projeto');
  assert.ok(fs.existsSync(absolute), `Entrada da extensao ausente: ${relative}`);
  return fs.readFileSync(absolute, 'utf8');
}
function manifest() {
  return JSON.parse(localFile('manifest.json'));
}

// FR-002/004, US1-AC1/3, SC-001/002: valida o artefato carregavel.
test('manifesto e popup resolvem todas as entradas locais geradas', () => {
  const config = manifest();
  assert.equal(config.manifest_version, 3);
  const entries = [config.background.service_worker,
    ...config.content_scripts.flatMap(script => script.js)];
  const html = localFile(config.action.default_popup);
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)]
    .map(match => match[1]);
  assert.ok(scripts.length > 0, 'Popup deve carregar scripts');
  for (const file of [...entries, ...scripts]) {
    assert.ok(file.startsWith('dist/'), `Script deve usar bundle: ${file}`);
    const code = localFile(file);
    assert.doesNotThrow(() => new vm.Script(code, { filename: file }));
  }
  assert.deepEqual([...config.permissions].sort(), [
    'activeTab', 'tabs', 'scripting', 'proxy', 'webRequest',
    'webRequestAuthProvider', 'storage'
  ].sort(), 'Reorganizacao deve preservar as permissoes');
  assert.deepEqual(config.host_permissions, [
    'https://*.idealista.pt/*', 'https://api.ipify.org/*'
  ]);
});

// FR-004/005/008, Constitution III/V: executa entradas sem globais de outro contexto.
test('bundles de background conteudo e popup inicializam em contextos isolados', () => {
  const config = manifest();
  function environment() {
    const messages = [];
    const domEvents = [];
    const scope = vm.createContext({
      console, URL, Blob, setTimeout, clearTimeout,
      location: { origin: 'https://www.idealista.pt', href: 'https://www.idealista.pt/' },
      fetch() { throw new Error('Rede proibida no contrato'); },
      document: {
        getElementById() { return null; },
        addEventListener(event, callback) { domEvents.push({ event, callback }); }
      },
      chrome: { runtime: { onMessage: { addListener(fn) { messages.push(fn); } } } }
    });
    return { scope, messages, domEvents };
  }
  function run(env, file) {
    vm.runInContext(localFile(file), env.scope, { filename: file, timeout: 2000 });
  }
  const background = environment();
  run(background, config.background.service_worker);
  assert.ok(background.messages.length > 0, 'Background deve registrar mensageria');
  let status;
  for (const listener of background.messages) {
    listener({ cmd: 'PROXY_STATUS' }, {}, response => { status = response; });
  }
  assert.equal(status?.enabled, false);
  assert.equal(status?.config, null);

  const content = environment();
  for (const file of config.content_scripts.flatMap(script => script.js)) run(content, file);
  let result;
  for (const listener of content.messages) {
    listener({ cmd: 'STOP_AND_DOWNLOAD' }, {}, response => { result = response; });
  }
  assert.equal(result?.ok, true);
  assert.ok(Array.isArray(result.dados));
  assert.equal(result.dados.length, 0);

  const popup = environment();
  const html = localFile(config.action.default_popup);
  for (const match of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    run(popup, match[1]);
  }
  assert.ok(popup.domEvents.some(item => item.event === 'DOMContentLoaded'));
  assert.ok(popup.messages.length > 0, 'Popup deve registrar recepcao de logs');
});

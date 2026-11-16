// Estado ativo separado dos campos editáveis do painel. Não devolver credenciais no status.
const ACTIVE_PROXY_KEY = 'activeProxyState';
const PROXY_DOMAINS_BASE = ['idealista.pt', '*.idealista.pt', 'api.ipify.org'];
let collectionRuntime = null;
let collectionSettings = null;
let settingsRepository = null;
let applySavedConnection = null;
let currentProxy = null;
let currentProxyDomains = [...PROXY_DOMAINS_BASE];

function buildSelectivePacScript(host, port, domains) {
  const checks = domains.map(domain =>
    `dnsDomainIs(host, ${JSON.stringify(domain.replace(/^\*\./, ''))}) || shExpMatch(host, ${JSON.stringify(domain)})`
  ).join(' || ');
  return `function FindProxyForURL(url, host) { if (${checks}) return ${JSON.stringify(`PROXY ${host}:${port}`)}; return "DIRECT"; }`;
}

function updateBadge() {
  chrome.action.setBadgeText({ text: currentProxy ? 'PROX' : '' });
  if (currentProxy) chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
}

async function reconcileProxy() {
  const stored = (await chrome.storage.local.get([ACTIVE_PROXY_KEY]))[ACTIVE_PROXY_KEY];
  const actual = await chrome.proxy.settings.get({ incognito: false });
  currentProxy = stored && actual.levelOfControl === 'controlled_by_this_extension' &&
    actual.value?.mode === 'pac_script' && actual.value.pacScript?.data === stored.pacScript ? stored : null;
  currentProxyDomains = currentProxy?.domains || [...PROXY_DOMAINS_BASE];
  updateBadge();
}

// Todas as operações aguardam recuperação e mantêm a ordem dos comandos.
let operations = reconcileProxy();
function enqueue(operation) {
  const result = operations.catch(() => {}).then(operation);
  operations = result.catch(() => {});
  return result;
}
// Evitar rejeição não tratada no boot; comandos sempre tentam reconciliar novamente.
operations = operations.catch(() => { currentProxy = null; updateBadge(); });

async function enableProxy({ host, port, username = '', password = '', extraDomains = [] }) {
  if (typeof host !== 'string' || !/^[a-z0-9.-]+$/i.test(host) ||
      !Number.isInteger(port) || port < 1 || port > 65535 || !Array.isArray(extraDomains) ||
      extraDomains.some(d => typeof d !== 'string' || !/^(\*\.)?[a-z0-9.-]+$/i.test(d))) {
    throw new Error('Configuração de proxy inválida.');
  }
  await reconcileProxy();
  const previous = currentProxy;
  const domains = [...new Set([...PROXY_DOMAINS_BASE, ...extraDomains])];
  const same = previous && previous.host === host && previous.port === port && previous.username === username && previous.password === password && JSON.stringify(previous.domains) === JSON.stringify(domains);
  const serial = ((await chrome.storage.local.get(['proxyRevisionSerial'])).proxyRevisionSerial || 0) + (same ? 0 : 1);
  const snapshot = { host, port, username, password, domains, revision: same ? previous.revision || 'proxy-legacy' : `proxy-${serial}`, pacScript: buildSelectivePacScript(host, port, domains) };
  // Persistir antes de set: se o worker terminar após aplicar o PAC, o próximo boot pode recuperá-lo.
  await chrome.storage.local.set({ [ACTIVE_PROXY_KEY]: snapshot, proxyRevisionSerial: serial });
  try {
    await chrome.proxy.settings.set({ value: { mode: 'pac_script', pacScript: { data: snapshot.pacScript } }, scope: 'regular' });
    await reconcileProxy();
    if (!currentProxy) throw new Error('O Chrome não aplicou o proxy solicitado; confira políticas ou outras extensões.');
  } catch (error) {
    // Restaurar também o snapshot anterior para não perder autenticação numa reativação recusada.
    await chrome.storage.local.set({ [ACTIVE_PROXY_KEY]: previous });
    if (previous) {
      await chrome.proxy.settings.set({ value: { mode: 'pac_script', pacScript: { data: previous.pacScript } }, scope: 'regular' });
    } else {
      await chrome.proxy.settings.clear({ scope: 'regular' });
    }
    await reconcileProxy();
    throw error;
  }
}

async function disableProxy() {
  // Se clear falhar, manter snapshot e autenticação para o PAC ainda aplicado.
  await chrome.proxy.settings.clear({ scope: 'regular' });
  await chrome.storage.local.set({ [ACTIVE_PROXY_KEY]: null });
  await reconcileProxy();
}

function onAuthRequiredHandler(details, callback) {
  enqueue(async () => {
    await reconcileProxy();
    const challenger = details.challenger;
    if (!details.isProxy || !currentProxy || !challenger ||
        challenger.host.toLowerCase() !== currentProxy.host.toLowerCase() || Number(challenger.port) !== currentProxy.port) return {};
    return { authCredentials: { username: currentProxy.username, password: currentProxy.password } };
  }).then(callback, () => callback({ cancel: true }));
}

// Registro síncrono no topo: o evento precisa poder acordar qualquer instância MV3.
chrome.webRequest.onAuthRequired.addListener(onAuthRequiredHandler, { urls: ['<all_urls>'] }, ['asyncBlocking']);
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!['ENABLE_PROXY', 'DISABLE_PROXY', 'PROXY_STATUS','SAVE_PROXY_CONFIG','APPLY_SAVED_CONNECTION'].includes(msg?.cmd)) return;
  enqueue(async () => {
    if(typeof chrome.runtime.getURL==='function'&&(!sender.url?.startsWith(chrome.runtime.getURL(''))||sender.id!==chrome.runtime.id))throw new Error('Comando reservado à extensão.');
    if (msg.cmd !== 'PROXY_STATUS' && collectionRuntime && await collectionRuntime.busy()) throw new Error('Pause a coleta antes de alterar o proxy.');
    if (msg.cmd === 'APPLY_SAVED_CONNECTION') {
      if(!applySavedConnection)throw new Error('Abra Configurações para aplicar a conexão salva.');
      return applySavedConnection(msg.expectedRevision);
    }
    if (msg.cmd === 'ENABLE_PROXY') { await enableProxy(msg); return { ok: true }; }
    if (msg.cmd === 'DISABLE_PROXY') { await disableProxy(); return { ok: true }; }
    if (msg.cmd === 'SAVE_PROXY_CONFIG') {
      const values={};for(const key of ['proxyHost','proxyPort','proxyUser','proxyPass']){if(typeof msg.config?.[key]!=='string')throw new Error('Configuração inválida.');values[key]=msg.config[key];}
      if(collectionSettings){const v=await collectionSettings.load(),r=await collectionSettings.save({expectedRevision:v.revision,values:{...v,proxy:{host:values.proxyHost,port:values.proxyPort,user:values.proxyUser,password:values.proxyPass}}});if(r.status!=='saved')throw Error('Configuração não salva.');return {ok:true};}
      await chrome.storage.local.set(values);return {ok:true};
    }
    await reconcileProxy();
    const actual=await chrome.proxy.settings.get({incognito:false});
    const saved=settingsRepository?await settingsRepository.load():null;
    const external=!currentProxy&&actual.value?.mode!=='system'&&actual.value?.mode!=='direct';
    const matchesSaved=saved?saved.useProxy?!!currentProxy&&currentProxy.host===saved.proxy.host&&currentProxy.port===Number(saved.proxy.port)&&currentProxy.username===saved.proxy.user&&currentProxy.password===saved.proxy.password:!currentProxy&&!external:null;
    return { enabled: !!currentProxy, external, requested:saved?.useProxy??null,matchesSaved, config: currentProxy ? { host: currentProxy.host, port: currentProxy.port } : null, domains: currentProxyDomains };
  }).then(sendResponse, error => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});

if (typeof chrome.runtime.getURL === 'function') {
  chrome.sidePanel?.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>{});
  const { installCollectionBackground } = require('./coleta-background');
  const {createProxyRevision}=require('./coleta-proxy');
  const observeRevision=createProxyRevision(chrome.storage.local);
  async function prepare(requested,saved=null) {
        await reconcileProxy();
        if(!requested){
          if(currentProxy)await disableProxy();
          const actual=await chrome.proxy.settings.get({incognito:false});
          if(!['system','direct'].includes(actual.value?.mode))throw new Error('Outra política ou extensão controla a conexão. Confira-a antes de usar conexão direta.');
          return;
        }
        const row=saved||(settingsRepository?await settingsRepository.load():null);
        const data = row?{proxyHost:row.proxy.host,proxyPort:row.proxy.port,proxyUser:row.proxy.user,proxyPass:row.proxy.password}:await chrome.storage.local.get(['proxyHost','proxyPort','proxyUser','proxyPass']);
        const config = {host:data.proxyHost||'',port:Number(data.proxyPort||0),username:data.proxyUser||'',password:data.proxyPass||''};
        if (currentProxy && ['host','port','username','password'].every(k => currentProxy[k] === config[k])) return;
        await enableProxy(config);
  }
  async function snapshot(details) {
    await reconcileProxy();
    const actual=details||await chrome.proxy.settings.get({incognito:false});
    return {revision:await observeRevision(actual,currentProxy?.revision||''),enabled:!!currentProxy};
  }
  const collectionProxy = {
    // Aplicação, snapshot e aquisição da sessão compartilham a fila de alteração.
    begin:(requested,create)=>enqueue(async()=>{
      if(collectionRuntime&&await collectionRuntime.busy()){const rows=await collectionRuntime.store?.read(['domain:idealista.pt']);return {status:'busy',reason:'active_session',id:rows?.['domain:idealista.pt']?.active};}
      await prepare(requested);return create(await snapshot());
    }),
    prepare:requested=>enqueue(()=>prepare(requested)),
    snapshot:()=>enqueue(()=>snapshot()),
  };
  collectionRuntime = installCollectionBackground(chrome, collectionProxy);
  if(chrome.tabs?.create){
    const {createSettingsRepository}=require('./coleta-settings-repository');
    const {createCollectionSettings}=require('./coleta-settings');
    settingsRepository=createSettingsRepository({store:collectionRuntime.store,storage:chrome.storage.local});
    collectionSettings=createCollectionSettings({repository:settingsRepository,isActive:()=>collectionRuntime.busy()});
    collectionRuntime.setSettings(collectionSettings);
    applySavedConnection=async expectedRevision=>{
      const row=await settingsRepository.load();
      if(row.revision!==expectedRevision)return {ok:false,code:'SETTINGS_CHANGED',error:'Outra tela salvou configurações. Recarregue os valores antes de aplicar.'};
      await prepare(row.useProxy,row);
      return {ok:true,connection:row.useProxy?'proxy':'system',revision:row.revision};
    };
    const {installAutonomousBackground}=require('./coleta-autonoma-background');installAutonomousBackground(chrome,{runtime:collectionRuntime,proxy:collectionProxy,settings:collectionSettings});
  }
  chrome.proxy.settings.onChange.addListener(details=>{
    if(details.incognitoSpecific)return;
    enqueue(()=>snapshot(details)).then(s=>collectionRuntime.proxyChanged(s.revision)).catch(()=>{});
  });
}

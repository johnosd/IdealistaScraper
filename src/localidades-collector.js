const { extractLinks } = require('./linkExtractor.js');

// Esta função é serializada pelo Chrome; não capturar imports ou variáveis externas.
function waitForLocations(timeoutMs) {
  return new Promise((resolve, reject) => {
    let observer;
    const timer = setTimeout(() => finish(new Error('Timeout esperando DOM de localidades')), timeoutMs);
    function finish(error) {
      clearTimeout(timer);
      observer?.disconnect();
      if (error) reject(error); else resolve(true);
    }
    function check() { if (document.querySelector('nav.locations-list')) finish(); }
    observer = new MutationObserver(check);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    check();
  });
}

function waitForComplete(api, tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error('Timeout aguardando carregamento da aba')), timeoutMs);
    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      api.tabs.onUpdated.removeListener(onUpdated);
      api.tabs.onRemoved.removeListener(onRemoved);
      if (error) reject(error); else resolve();
    }
    function onUpdated(id, info) { if (id === tabId && info.status === 'complete') finish(); }
    function onRemoved(id) { if (id === tabId) finish(new Error('A aba de coleta foi fechada')); }
    api.tabs.onUpdated.addListener(onUpdated);
    api.tabs.onRemoved.addListener(onRemoved);
    api.tabs.get(tabId).then(tab => { if (tab.status === 'complete') finish(); }, finish);
  });
}

function guardedScript(api, tabId, options, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('Timeout esperando DOM/extração de localidades')), timeoutMs);
    function onRemoved(id) { if (id === tabId) finish(new Error('A aba de coleta foi fechada')); }
    function finish(error, result) {
      clearTimeout(timer);
      api.tabs.onRemoved.removeListener(onRemoved);
      if (error) reject(error); else resolve(result);
    }
    api.tabs.onRemoved.addListener(onRemoved);
    api.scripting.executeScript({ target: { tabId }, ...options }).then(result => finish(null, result), finish);
  });
}

function createCollector(api, timeoutMs = 30000) {
  return async function collectLocalities() {
    const tab = await api.tabs.create({ url: 'https://www.idealista.pt/arrendar-casas/#municipality-search', active: false });
    try {
      await waitForComplete(api, tab.id, timeoutMs);
      await guardedScript(api, tab.id, { func: waitForLocations, args: [timeoutMs] }, timeoutMs + 100);
      const results = await guardedScript(api, tab.id, { func: extractLinks }, timeoutMs);
      const records = results[0]?.result;
      if (!Array.isArray(records)) throw new Error('Resposta inválida da coleta de localidades');
      return records;
    } finally {
      // O usuário pode ter fechado a aba; nunca encerrar outra aba em seu lugar.
      try { await api.tabs.remove(tab.id); } catch { /* Já encerrada. */ }
    }
  };
}

function collectLocalities() { return createCollector(chrome)(); }
module.exports = { collectLocalities, createCollector };

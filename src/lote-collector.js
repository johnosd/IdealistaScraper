const { validateBatchURL } = require('./lote-input');
const { resolveBatchListing } = require('./lote-navigation');

function waitForComplete(api, tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => finish(new Error('Timeout aguardando a aba de coleta')), timeoutMs);
    function finish(error) {
      if (settled) return;
      settled = true; clearTimeout(timer);
      api.tabs.onUpdated.removeListener(updated); api.tabs.onRemoved.removeListener(removed);
      if (error) reject(error); else resolve();
    }
    function updated(id, info) { if (id === tabId && info.status === 'complete') finish(); }
    function removed(id) { if (id === tabId) finish(new Error('Aba de coleta fechada')); }
    api.tabs.onUpdated.addListener(updated); api.tabs.onRemoved.addListener(removed);
    api.tabs.get(tabId).then(tab => { if (tab.status === 'complete') finish(); }, finish);
  });
}

function createBatchCollector(api, { timeoutMs = 30000, useProxy = () => false } = {}) {
  let held = null, proxyPrepared=false;
  return async item => {
    const url = validateBatchURL(item.url);
    if (useProxy()&&!proxyPrepared) {
      const data = await api.storage.local.get(['proxyHost', 'proxyPort', 'proxyUser', 'proxyPass']);
      const enabled = await api.runtime.sendMessage({ cmd: 'ENABLE_PROXY', host: data.proxyHost || '', port: parseInt(data.proxyPort || '0', 10), username: data.proxyUser || '', password: data.proxyPass || '', extraDomains: [] });
      if (!enabled?.ok) throw new Error(enabled?.error || 'Não foi possível ativar o proxy solicitado.');
      proxyPrepared=true;
    }
    let tab, keep = false;
    if (held?.source === url) {
      try {
        const candidate = await api.tabs.get(held.id);
        if (validateBatchURL(candidate.url) === held.pageUrl) tab = candidate;
      } catch { /* Fechada ou alterada: não navegar/recolher em outra aba. */ }
    }
    held = null;
    if (!tab) tab = await api.tabs.create({ url, active: false });
    try {
      const wait = id => waitForComplete(api, id, timeoutMs);
      await wait(tab.id);
      await resolveBatchListing({ tabId: tab.id, api, waitForComplete: wait });
      let response;
      try { response = await api.tabs.sendMessage(tab.id, { cmd: 'START_CRAWL', silent: true, requireComplete: true }); }
      catch (error) {
        // Reinjetar só quando não existe receptor; falha funcional não recoleta.
        if (!/receiving end does not exist|could not establish connection/i.test(error.message)) throw error;
        await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['dist/content.bundle.js'] });
        response = await api.tabs.sendMessage(tab.id, { cmd: 'START_CRAWL', silent: true, requireComplete: true });
      }
      if (!response?.ok) throw new Error(response?.error || 'Coleta não concluída');
      const result = await api.tabs.sendMessage(tab.id, { cmd: 'STOP_AND_DOWNLOAD' });
      if (!result?.ok || result.complete !== true) throw new Error(result?.error || 'Coleta incompleta');
      return { records: result.dados, totalPages: result.totalPaginas };
    } catch (error) {
      if (error.code === 'BATCH_ACCESS_BLOCKED' || error.code === 'BATCH_DESTINATION') {
        try {
          const current = await api.tabs.get(tab.id);
          held = { id: tab.id, source: url, pageUrl: validateBatchURL(current.url) };
          keep = true;
          await api.tabs.update(tab.id, { active: true });
        } catch { /* Não é possível manter uma aba que já foi fechada. */ }
        if (keep) error.message += '\nPágina de coleta mantida aberta para inspeção. Confira o acesso antes de usar Continuar lote.';
      }
      throw error;
    } finally { if (!keep) { try { await api.tabs.remove(tab.id); } catch { /* Já fechada pelo usuário. */ } } }
  };
}
module.exports = { createBatchCollector };

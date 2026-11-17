const { validateBatchURL } = require('./lote-input.js');

// Serializada por scripting.executeScript: sem imports/capturas do bundle.
function inspectBatchDestination(timeoutMs = 0) {
  function read() {
    const listing = !!document.querySelector('section.items-container.items-list');
    const title = document.title || '';
    // Serializada: o padrão é repetido aqui (mesmo conteúdo de CHALLENGE_TITLE em coleta-page.js).
    const blocked = !listing && (/just a moment|um momento|attention required|access denied|acesso negado|verifique que é humano/i.test(title)
      || !!document.querySelector('#challenge-running, #challenge-form, #cf-challenge-running, iframe[src*="captcha"]'));
    const candidates = listing ? [] : [...document.querySelectorAll('a[href]')]
      .filter(anchor => /^Ver\s+[\d.,\s]+\s+(?:casas|apartamentos|imóveis)\b/i.test(anchor.textContent.trim().replace(/\s+/g, ' ')))
      .map(anchor => anchor.href);
    return { url: location.href, listing, candidates, blocked, title, readyState: document.readyState };
  }
  const ready = info => info.listing || info.blocked || info.candidates.length > 0;
  const initial = read();
  if (!timeoutMs || ready(initial)) return initial;
  return new Promise(resolve => {
    let observer;
    const timer = setTimeout(() => finish(read()), timeoutMs);
    function finish(info) { clearTimeout(timer); observer?.disconnect(); resolve(info); }
    observer = new MutationObserver(() => { const info = read(); if (ready(info)) finish(info); });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
    const info = read(); if (ready(info)) finish(info);
  });
}

async function resolveBatchListing({ tabId, api = chrome, waitForComplete }) {
  let observedURL;
  try {
    const inspect = async () => {
      const results = await api.scripting.executeScript({ target: { tabId }, func: inspectBatchDestination, args: [10000] });
      const info = results[0]?.result;
      if (!info || typeof info.listing !== 'boolean' || !Array.isArray(info.candidates)) {
        throw new Error('Não foi possível identificar a página de destino');
      }
      info.url = validateBatchURL(info.url);
      observedURL = info.url;
      if (info.blocked) {
        const error = new Error(`O site apresentou verificação ou bloqueio de acesso (${info.title || 'página de verificação'}). Abra a página no Chrome para verificar o acesso.`);
        error.code = 'BATCH_ACCESS_BLOCKED'; throw error;
      }
      return info;
    };
    const first = await inspect();
    if (first.listing) return first.url;
    const destinations = [...new Set(first.candidates.map(validateBatchURL))];
    if (destinations.length !== 1 || destinations[0].split('#')[0] === first.url.split('#')[0]) {
      throw new Error(`Página sem listagem após aguardar o conteúdo: ${destinations.length} destino(s) explícito(s). Título: ${first.title || 'não disponível'}`);
    }
    await api.tabs.update(tabId, { url: destinations[0] });
    await waitForComplete(tabId);
    const target = await inspect();
    if (!target.listing) throw new Error('O link indicado não abriu uma listagem de anúncios');
    return target.url;
  } catch (cause) {
    let page = '';
    try { const url = new URL(observedURL || (await api.tabs.get?.(tabId))?.url); page = ` Página: ${url.origin}${url.pathname}`; } catch { /* Contexto indisponível. */ }
    const error = new Error(`Não foi possível resolver a listagem: ${cause.message}${page}`);
    error.code = cause.code || 'BATCH_DESTINATION';
    throw error;
  }
}

module.exports = { inspectBatchDestination, resolveBatchListing };

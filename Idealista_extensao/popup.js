// ============== Utils ==============
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const randDelay = () => 3000 + Math.floor(Math.random() * 7000);

const extraDomainsInput = document.getElementById('extraDomains');
function getExtraDomains() {
  if (!extraDomainsInput) return [];
  return extraDomainsInput.value.split(/\n+/).map(d => d.trim()).filter(Boolean);
}

// Configuração do proxy (desativado por padrão)
const PROXY_CONFIG = {
  host: "proxy-us.proxy-cheap.com",
  port: 5959,
  username: "pcOoqLBiLs-res-any",
  password: "PC_5djX4v5F9aXvIl5gn",
};

async function enableProxy() {
  try {
    const res = await chrome.runtime.sendMessage({
      cmd: "ENABLE_PROXY",
      host: PROXY_CONFIG.host,
      port: PROXY_CONFIG.port,
      username: PROXY_CONFIG.username,
      password: PROXY_CONFIG.password,
      extraDomains: getExtraDomains(),
    });
    return res?.ok;
  } catch (e) {
    console.error('Erro ao habilitar proxy:', e);
    alert('Falha ao habilitar o proxy: ' + e);
    return false;
  }
}

async function disableProxy() {
  try {
    const res = await chrome.runtime.sendMessage({ cmd: "DISABLE_PROXY" });
    return res?.ok;
  } catch (e) {
    console.warn('Erro ao desativar proxy:', e);
    alert('Falha ao desativar o proxy: ' + e);
    return false;
  }
}

async function ensureProxyPrompt() {
  try {
    const st = await chrome.runtime.sendMessage({ cmd: "PROXY_STATUS" });
    if (!st?.enabled) {
      if (confirm('Proxy desativado. Deseja ativá-lo?')) {
        await enableProxy();
        await refreshProxyStatus();
      }
    }
  } catch (e) {
    console.warn('Falha ao verificar status do proxy:', e);
  }
}

function waitForTabComplete(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        reject(new Error('Timeout aguardando carregamento da aba.'));
      }
    }, timeoutMs);

    const onUpdated = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === 'complete') {
        done = true;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    };

    chrome.tabs.get(tabId, (t) => {
      if (chrome.runtime.lastError) {
        clearTimeout(timer);
        return reject(chrome.runtime.lastError);
      }
      if (t.status === 'complete') {
        done = true; clearTimeout(timer); resolve();
      } else {
        chrome.tabs.onUpdated.addListener(onUpdated);
      }
    });
  });
}

// Obtém o IP público visto pela aba (usando content.js)
async function getTabPublicIp(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { cmd: 'TEST_IP' });
    if (res?.ok) return res.ip || null;
    console.warn('[ExtrairLinks] Falha ao obter IP: ' + (res?.error || 'sem resposta'));
  } catch (e) {
    console.warn('[ExtrairLinks] Erro ao obter IP da aba:', e);
  }
  return null;
}

// ============== Extrair Links (JSON) ==============
const extractBtn = document.getElementById("extract");
if (extractBtn) extractBtn.addEventListener("click", async () => {
  extractBtn.disabled = true;
  const prev = extractBtn.textContent;
  extractBtn.textContent = "Extraindo...";
  try {
    console.log('[ExtrairLinks] Iniciando extração de links...');
    await ensureProxyPrompt();
    const proxySt = await chrome.runtime.sendMessage({ cmd: 'PROXY_STATUS' });
    console.log('[ExtrairLinks] Proxy ' + (proxySt?.enabled ? 'ativado' : 'desativado'));

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const targetUrl = "https://www.idealista.pt/arrendar-casas/#municipality-search";
    console.log('[ExtrairLinks] Navegando para', targetUrl);
    await chrome.tabs.update(tab.id, { url: targetUrl });
    console.log('[ExtrairLinks] Aguardando carregamento da página...');
    await waitForTabComplete(tab.id);
    console.log('[ExtrairLinks] Página carregada. Obtendo IP público...');
    const ip = await getTabPublicIp(tab.id);
    if (ip) console.log('[ExtrairLinks] IP público (aba):', ip);

    const delay = randDelay();
    console.log(`[ExtrairLinks] Aguardando ${Math.round(delay/1000)}s antes da extração...`);
    await sleep(delay);
    console.log('[ExtrairLinks] Executando script de extração...');
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extrairLinksESalvarJSONNaPagina
    });
    console.log('[ExtrairLinks] Extração de links concluída.');
  } catch (err) {
    console.error('Erro em Extrair Links:', err);
    alert('Erro ao extrair links. Veja o console para detalhes.');
  } finally {
    extractBtn.disabled = false;
    extractBtn.textContent = prev;
  }
});

// roda na página
function extrairLinksESalvarJSONNaPagina() {
  console.log('[ExtrairLinks|Página] Iniciando coleta de links...');
  if (typeof extractLinks !== 'function') {
    console.warn('[ExtrairLinks|Página] Função extractLinks não disponível.');
    alert('Função extractLinks não disponível.');
    return;
  }
  const rows = extractLinks(document);
  console.log('[ExtrairLinks|Página] Links encontrados:', rows.length);
  if (!rows.length) {
    alert('Nenhum link encontrado em <nav.locations-list>.');
    return;
  }

  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `links_localidades_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  console.log('[ExtrairLinks|Página] JSON gerado com', rows.length, 'registros.');
  alert(`JSON gerado com ${rows.length} registros.`);
}

// ============== Extrair Itens (proxy + paginação) ==============
const itemsBtn = document.getElementById("extractItems");
if (itemsBtn) itemsBtn.addEventListener("click", async () => {
  itemsBtn.disabled = true;
  const prevText = itemsBtn.textContent;
  itemsBtn.textContent = "Extraindo...";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!/^https:\/\/(?:www\.)?idealista\.pt\//.test(tab?.url || "")) {
    alert('Abra uma página de resultados no idealista.pt e depois clique em "Extrair Itens".');
    return;
  }

  await ensureProxyPrompt();

  // Aguarda carregamento e dispara o crawler
  try {
    // garante que o content script já foi injetado
    await waitForTabComplete(tab.id);
    const res = await chrome.tabs.sendMessage(tab.id, { cmd: 'START_CRAWL' });
    if (!res?.ok) throw new Error(res?.error || 'Sem resposta OK do content.js');
  } catch (e) {
    console.warn('Falha ao iniciar a extração:', e);
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await sleep(500);
    } catch (ee) {
      console.warn('Falha ao injetar content.js:', ee);
    }
    const res2 = await chrome.tabs.sendMessage(tab.id, { cmd: 'START_CRAWL' });
    if (!res2?.ok) {
      alert('Não consegui iniciar a extração. Recarregue a página do Idealista.');
    }
  } finally {
    itemsBtn.disabled = false;
    itemsBtn.textContent = prevText;
    setTimeout(refreshProxyStatus, 500);
  }
});

// Botão: Parar e baixar JSON parcial
const stopBtn = document.getElementById("stopExtract");
if (stopBtn) {
  stopBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
      await chrome.tabs.sendMessage(tab.id, { cmd: 'STOP_AND_DOWNLOAD' });
    } catch (e) {
      console.warn('Falha ao enviar STOP_AND_DOWNLOAD:', e);
    }

  });
}

// --- Status do proxy no popup ---
document.addEventListener("DOMContentLoaded", async () => {
  await refreshProxyStatus();
});

async function refreshProxyStatus() {
  try {
    const st = await chrome.runtime.sendMessage({ cmd: "PROXY_STATUS" });
    const el = document.getElementById("proxyState");
    if (el) el.textContent = st?.enabled ? "ativado" : "desativado";
    const tBtn = document.getElementById('toggleProxy');
    if (tBtn) tBtn.textContent = st?.enabled ? 'Desativar Proxy' : 'Ativar Proxy';
  } catch (e) {
    console.warn('Falha ao obter status do proxy:', e);
  }
}

// Botão de ativar/desativar proxy
const toggleBtn = document.getElementById('toggleProxy');
if (toggleBtn) {
  toggleBtn.addEventListener('click', async () => {
    const st = await chrome.runtime.sendMessage({ cmd: 'PROXY_STATUS' });
    if (st?.enabled) {
      await disableProxy();
    } else {
      await enableProxy();
    }
    await refreshProxyStatus();
  });
}

// --- Botão: Testar IP (requisição passa pelo proxy quando ativado) ---
const testBtn = document.getElementById("testProxyIp");
if (testBtn) {
  testBtn.addEventListener("click", async () => {
    const box = document.getElementById("proxyIpBox");
    if (box) box.textContent = "Testando IP público (na aba)...";
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!/^https:\/\/(?:www\.)?idealista\.pt\//.test(tab?.url || "")) {
        box.textContent = "Abra uma página do idealista.pt para testar.";
        return;
      }
      const res = await chrome.tabs.sendMessage(tab.id, { cmd: 'TEST_IP' });
      if (res?.ok) {
        box.textContent = "IP público detectado (aba): " + (res.ip || "desconhecido");
      } else {
        box.textContent = "Falha ao testar IP: " + (res?.error || "sem resposta");
      }
    } catch (e) {
      if (box) box.textContent = "Erro ao testar IP: " + String(e);
    }
  });
}

// Atualiza status ao parar
const stopBtn2 = document.getElementById("stopExtract");
if (stopBtn2) stopBtn2.addEventListener("click", () => setTimeout(refreshProxyStatus, 500));

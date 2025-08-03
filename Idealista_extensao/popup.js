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
  // Timeout de 5 segundos para evitar travamento
  return await Promise.race([
    (async () => {
      try {
        const res = await chrome.tabs.sendMessage(tabId, { cmd: 'TEST_IP' });
        if (res?.ok) return res.ip || null;
        console.warn('[ExtrairLinks] Falha ao obter IP: ' + (res?.error || 'sem resposta'));
      } catch (e) {
        console.warn('[ExtrairLinks] Erro ao obter IP da aba:', e);
      }
      return null;
    })(),
    new Promise(resolve => setTimeout(() => resolve(null), 5000))
  ]);
}

// ============== Extrair Links (JSON) ==============
const extractBtn = document.getElementById("extract");
const linksLog = document.getElementById("linksLog");
function logLinks(msg) {
  if (linksLog) linksLog.textContent = msg;
}
if (extractBtn) extractBtn.addEventListener("click", async () => {
  extractBtn.disabled = true;
  const prev = extractBtn.textContent;
  extractBtn.textContent = "Extraindo...";
  try {
    logLinks('Iniciando extração de links...');
    await ensureProxyPrompt();
    const proxySt = await chrome.runtime.sendMessage({ cmd: 'PROXY_STATUS' });
    logLinks('Proxy ' + (proxySt?.enabled ? 'ativado' : 'desativado'));

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const targetUrl = "https://www.idealista.pt/arrendar-casas/#municipality-search";
    if (tab.url !== targetUrl) {
      logLinks('Navegando para: ' + targetUrl);
      await chrome.tabs.update(tab.id, { url: targetUrl });
      logLinks('Aguardando carregamento da página...');
      try {
        await waitForTabComplete(tab.id);
      } catch (e) {
        logLinks('Timeout aguardando carregamento. Recarregue manualmente a página e tente novamente.');
        throw e;
      }
    } else {
      logLinks('Aba já está na página de busca.');
    }

    // Obter IP da aba antes da extração
    const ip = await getTabPublicIp(tab.id);
    const proxySt2 = await chrome.runtime.sendMessage({ cmd: 'PROXY_STATUS' });
    if (ip) {
      if (proxySt2?.enabled) {
        logLinks('IP do proxy usado: ' + ip);
      } else {
        logLinks('IP público usado: ' + ip);
      }
    } else {
      logLinks('Não foi possível obter o IP da aba.');
    }

    logLinks('Página pronta. Injetando extrator...');
    // Garante que linkExtractor.js está carregado
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['linkExtractor.js']
    });
    // Agora executa a função de extração
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extrairLinksESalvarJSONNaPagina,
      args: [ip]
    });
    logLinks('Extração de links concluída e arquivo salvo!');
  } catch (err) {
    console.error('Erro em Extrair Links:', err);
    alert('Erro ao extrair links. Veja o console para detalhes.');
  } finally {
    extractBtn.disabled = false;
    extractBtn.textContent = prev;
  }
});

// roda na página
function extrairLinksESalvarJSONNaPagina(ip) {
  console.log('[ExtrairLinks|Página] Iniciando coleta de links... IP usado:', ip);
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

// ============== Download JSON enviado pelo content script ==============
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.cmd === 'DOWNLOAD_JSON' && Array.isArray(msg.data)) {
    const blob = new Blob([JSON.stringify(msg.data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'itens_paginas_' + new Date().toISOString().slice(0,19).replace(/[:T]/g,'-') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
});

// ============== Extrair Itens (proxy + paginação) ==============
const extractItemsBtn = document.getElementById("extractItems");
const itemUrlBox = document.getElementById("itemUrlBox");
const itensLog = document.getElementById("itensLog");
function logItens(msg) {
  if (itensLog) itensLog.textContent = msg;
}
if (extractItemsBtn) extractItemsBtn.addEventListener("click", async () => {
  const url = itemUrlBox ? itemUrlBox.value.trim() : '';
  if (!url) {
    alert("Por favor, cole o link da página do Idealista no campo acima antes de extrair.");
    return;
  }
  extractItemsBtn.disabled = true;
  const prev = extractItemsBtn.textContent;
  extractItemsBtn.textContent = "Extraindo...";
  try {
    logItens('Iniciando extração de itens...');
    await ensureProxyPrompt();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.url !== url) {
      logItens('Navegando para: ' + url);
      await chrome.tabs.update(tab.id, { url });
      logItens('Aguardando carregamento da página...');
      await waitForTabComplete(tab.id);
    } else {
      logItens('Aba já está na página desejada.');
    }
    logItens('Injetando script de extração...');
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    logItens('Iniciando extração dos itens...');
    await chrome.tabs.sendMessage(tab.id, { cmd: "EXTRACT_ITEMS" });
    logItens('Itens extraídos e salvos!');
    alert("Itens extraídos e salvos!");
  } catch (err) {
    console.error("Erro em Extrair Itens:", err);
    logItens('Erro ao extrair itens: ' + String(err));
    alert("Erro ao extrair itens. Veja o console para detalhes.");
  } finally {
    extractItemsBtn.disabled = false;
    extractItemsBtn.textContent = prev;
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

// --- Proxy: Connect/Disconnect ---
const proxyConnectBtn = document.getElementById('proxyConnect');
const proxyDisconnectBtn = document.getElementById('proxyDisconnect');
const proxyStateEl = document.getElementById('proxyState');
const proxyIpBox = document.getElementById('proxyIpBox');

async function updateProxyIp() {
  if (!proxyIpBox) return;
  proxyIpBox.textContent = '...';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      proxyIpBox.textContent = '-';
      return;
    }
    // Garante content.js injetado
    try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }); } catch {}
    const ip = await getTabPublicIp(tab.id);
    proxyIpBox.textContent = ip || '-';
  } catch {
    proxyIpBox.textContent = '-';
  }
}

async function refreshProxyStatus() {
  try {
    const st = await chrome.runtime.sendMessage({ cmd: "PROXY_STATUS" });
    if (proxyStateEl) proxyStateEl.textContent = st?.enabled ? "conectado" : "desconectado";
    if (proxyConnectBtn) proxyConnectBtn.disabled = !!st?.enabled;
    if (proxyDisconnectBtn) proxyDisconnectBtn.disabled = !st?.enabled;
    await updateProxyIp();
  } catch (e) {
    if (proxyStateEl) proxyStateEl.textContent = "erro";
    if (proxyConnectBtn) proxyConnectBtn.disabled = false;
    if (proxyDisconnectBtn) proxyDisconnectBtn.disabled = false;
    if (proxyIpBox) proxyIpBox.textContent = '-';
  }
}

if (proxyConnectBtn) proxyConnectBtn.addEventListener('click', async () => {
  proxyConnectBtn.disabled = true;
  await enableProxy();
  await refreshProxyStatus();
});
if (proxyDisconnectBtn) proxyDisconnectBtn.addEventListener('click', async () => {
  proxyDisconnectBtn.disabled = true;
  await disableProxy();
  await refreshProxyStatus();
});

document.addEventListener("DOMContentLoaded", refreshProxyStatus);

// --- Botão: Testar IP (atualiza IP na interface) ---
const testBtn = document.getElementById("testProxyIp");
if (testBtn) {
  testBtn.addEventListener("click", updateProxyIp);
}

const stopBtn2 = document.getElementById("stopExtract");
if (stopBtn2) stopBtn2.addEventListener("click", () => setTimeout(refreshProxyStatus, 500));

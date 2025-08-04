// ============== Utils ==============
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const randDelay = () => 3000 + Math.floor(Math.random() * 7000);



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

// ============== Extrair Links (JSON) ==============
const extractBtn = document.getElementById("extract");
if (extractBtn) extractBtn.addEventListener("click", async () => {
  extractBtn.disabled = true;
  const prev = extractBtn.textContent;
  extractBtn.textContent = "Extraindo...";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const targetUrl = "https://www.idealista.pt/arrendar-casas/#municipality-search";
    await chrome.tabs.update(tab.id, { url: targetUrl });
    await waitForTabComplete(tab.id);
    await sleep(randDelay());
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extrairLinksESalvarJSONNaPagina
    });
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
  if (typeof extractLinks !== 'function') {
    alert('Função extractLinks não disponível.');
    return;
  }
  const rows = extractLinks(document);
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

  alert(`JSON gerado com ${rows.length} registros.`);
}

// ============== Extrair Itens (proxy + paginação) ==============
const itemsBtn = document.getElementById("extractItems");
const extractItemsLog = document.getElementById("extractItemsLog");
function appendExtractLog(msg) {
  if (!extractItemsLog) return;
  const li = document.createElement('li');
  li.textContent = msg;
  li.style.padding = '2px 0';
  li.style.borderBottom = '1px solid #e5e7eb';
  li.style.wordBreak = 'break-word';
  // Adiciona no topo (ordem decrescente)
  extractItemsLog.insertBefore(li, extractItemsLog.firstChild);
}
function clearExtractLog() {
  if (extractItemsLog) extractItemsLog.innerHTML = "";
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'CRAWLER_LOG' && typeof msg.message === 'string') {
    appendExtractLog(msg.message);
  }
});

const toggleProxy = document.getElementById("toggleProxy");
if (toggleProxy) {
  // Salva escolha do usuário no localStorage
  toggleProxy.addEventListener('change', () => {
    window.localStorage.setItem('usarProxy', toggleProxy.checked ? 'true' : 'false');
  });
}
if (itemsBtn) itemsBtn.addEventListener("click", async () => {
  clearExtractLog();
  itemsBtn.disabled = true;
  const prevText = itemsBtn.textContent;
  itemsBtn.textContent = "Extraindo...";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // NOVO: Verifica campo de URL
  const urlInput = document.getElementById("extractItemsUrl");
  const customUrl = urlInput && urlInput.value.trim();
  if (!customUrl) {
    alert('Por favor, preencha o campo de URL da página de resultados do idealista.pt antes de extrair os itens.');
    itemsBtn.disabled = false;
    itemsBtn.textContent = prevText;
    return;
  }
  let finalTabId = tab.id;
  // Navega para a URL informada
  await chrome.tabs.update(tab.id, { url: customUrl });
  await waitForTabComplete(tab.id);
  // Atualiza referência ao tab (caso necessário)
  finalTabId = tab.id;

  // Validação padrão (após possível navegação)
  const updatedTab = await chrome.tabs.get(finalTabId);
  if (!/^https:\/\/(?:www\.)?idealista\.pt\//.test(updatedTab?.url || "")) {
    alert('Abra uma página de resultados no idealista.pt (ou insira a URL correta) e depois clique em "Extrair Itens".');
    itemsBtn.disabled = false;
    itemsBtn.textContent = prevText;
    return;
  }

  const PROXY_HOST = "proxy-us.proxy-cheap.com";      // ex: gw.resnet.example.com
  const PROXY_PORT = 5959;             // ex: 12345
  const PROXY_USER = "pcOoqLBiLs-res-any";
  const PROXY_PASS = "PC_5djX4v5F9aXvIl5gn";

  // 1) Ativa proxy SE toggle estiver marcado
  let proxyEnabled = false;
  if (toggleProxy && toggleProxy.checked) {
    let en;
    try {
      en = await chrome.runtime.sendMessage({
        cmd: "ENABLE_PROXY",
        host: PROXY_HOST,
        port: PROXY_PORT,
        username: PROXY_USER,
        password: PROXY_PASS,
        extraDomains: []
      });
    } catch (err) {
      console.error('Erro ao enviar ENABLE_PROXY:', err);
      alert('Falha ao habilitar o proxy: ' + err);
      itemsBtn.disabled = false;
      itemsBtn.textContent = prevText;
      return;
    }
    if (!en?.ok) {
      console.warn("ENABLE_PROXY falhou:", en?.error);
      alert("Falha ao habilitar o proxy: " + (en?.error || "erro desconhecido"));
      itemsBtn.disabled = false;
      itemsBtn.textContent = prevText;
      return;
    }
    proxyEnabled = true;
  }

  // 2) Aguarda carregamento e dispara o crawler
  try {
    // garante que o content script já foi injetado
    await waitForTabComplete(finalTabId);
    const res = await chrome.tabs.sendMessage(finalTabId, { cmd: 'START_CRAWL' });
    if (!res?.ok) throw new Error(res?.error || 'Sem resposta OK do content.js');
  } catch (e) {
    console.warn('Falha ao iniciar a extração:', e);
    try {
      await chrome.scripting.executeScript({ target: { tabId: finalTabId }, files: ['content.js'] });
      await sleep(500);
    } catch (ee) {
      console.warn('Falha ao injetar content.js:', ee);
    }
    const res2 = await chrome.tabs.sendMessage(finalTabId, { cmd: 'START_CRAWL' });
    if (!res2?.ok) {
      alert('Não consegui iniciar a extração. Recarregue a página do Idealista.');
    }
  } finally {
    itemsBtn.disabled = false;
    itemsBtn.textContent = prevText;
    setTimeout(refreshProxyStatus, 500);
  }
});

// Botão: Parar e baixar JSON parcial + desabilitar proxy
const stopBtn = document.getElementById("stopExtract");
if (stopBtn) {
  stopBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
      await chrome.tabs.sendMessage(tab.id, { cmd: 'STOP_AND_DOWNLOAD' });
    } catch (e) {
      console.warn('Falha ao enviar STOP_AND_DOWNLOAD:', e);
    }

    // Desativa proxy
    try {
      await chrome.runtime.sendMessage({ cmd: "DISABLE_PROXY" });
    } catch (e) {
      console.warn('Falha ao desativar proxy:', e);
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
  } catch (e) {
    console.warn('Falha ao obter status do proxy:', e);
  }
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

// ============== Utils ==============
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
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

    chrome.tabs.onUpdated.addListener(onUpdated);
    // Checa se já está carregada
    chrome.tabs.get(tabId, (t) => {
      if (chrome.runtime.lastError) {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        return reject(chrome.runtime.lastError);
      }
      if (t.status === 'complete') {
        done = true;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    });
  });
}

// ============== Botão: Extrair Links (JSON) ==============
const extractBtn = document.getElementById('extract');
if (extractBtn) extractBtn.addEventListener('click', async () => {
  extractBtn.disabled = true;
  try {
    const url = chrome.runtime.getURL('localidades.html');
    const tabs = await chrome.tabs.query({ url });
    if (tabs.length) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      await chrome.windows.update(tabs[0].windowId, { focused: true });
    }
    else await chrome.tabs.create({ url, active: true });
  } catch (error) {
    alert('Não foi possível abrir a exportação de localidades.\n' + error.message);
  } finally { extractBtn.disabled = false; }
});
// ============== Extrair Itens (com proxy) ==============
const itemsBtn = document.getElementById("extractItems");
const extractItemsLog = document.getElementById("extractItemsLog");
const toggleProxy = document.getElementById("toggleProxy");

function appendExtractLog(msg) {
  if (!extractItemsLog) return;
  const li = document.createElement('li');
  li.textContent = msg;
  li.style.padding = '2px 0';
  li.style.borderBottom = '1px solid #e5e7eb';
  extractItemsLog.insertBefore(li, extractItemsLog.firstChild);
}
function clearExtractLog() {
  if (extractItemsLog) extractItemsLog.innerHTML = "";
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'CRAWLER_LOG') appendExtractLog(msg.message);
});

if (itemsBtn) {
  itemsBtn.addEventListener("click", async () => {
    clearExtractLog();
    itemsBtn.disabled = true;
    const prevText = itemsBtn.textContent;
    itemsBtn.textContent = "Extraindo...";

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const urlInput = document.getElementById("extractItemsUrl");
    const customUrl = urlInput?.value?.trim();

    if (!customUrl) {
      alert('Preencha a URL da página de resultados do idealista.pt');
      itemsBtn.disabled = false;
      itemsBtn.textContent = prevText;
      return;
    }

    await chrome.tabs.update(tab.id, { url: customUrl });
    await waitForTabComplete(tab.id);

    const updatedTab = await chrome.tabs.get(tab.id);
    if (!/^https:\/\/(?:www\.)?idealista\.pt\//.test(updatedTab?.url || "")) {
      alert('Você deve estar numa página do idealista.pt para extrair os itens.');
      itemsBtn.disabled = false;
      itemsBtn.textContent = prevText;
      return;
    }

    // Proxy (opcional)
    if (toggleProxy && toggleProxy.checked) {
      // Agora lê do chrome.storage.local!
      const proxyData = await new Promise((resolve) =>
        chrome.storage.local.get(['proxyHost', 'proxyPort', 'proxyUser', 'proxyPass'], resolve)
      );
      const host = proxyData.proxyHost || '';
      const port = parseInt(proxyData.proxyPort || '0', 10);
      const username = proxyData.proxyUser || '';
      const password = proxyData.proxyPass || '';

      try {
        const res = await chrome.runtime.sendMessage({
          cmd: "ENABLE_PROXY", host, port, username, password, extraDomains: []
        });
        if (!res?.ok) throw new Error(res?.error || "Erro desconhecido ao ativar proxy.");
      } catch (err) {
        // ...
      }
    }

    try {
      const res = await chrome.tabs.sendMessage(tab.id, { cmd: 'START_CRAWL' });
      if (!res?.ok) throw new Error(res?.error || 'Erro ao iniciar crawler');
    } catch (err) {
      console.warn("Falha ao iniciar extração:", err);
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['dist/content.bundle.js'] });
        await sleep(500);
        const res2 = await chrome.tabs.sendMessage(tab.id, { cmd: 'START_CRAWL' });
        if (!res2?.ok) throw new Error(res2?.error || 'Erro ao injetar script');
      } catch (e) {
        alert("Não consegui iniciar a extração. Recarregue a página do Idealista.");
      }
    } finally {
      itemsBtn.disabled = false;
      itemsBtn.textContent = prevText;
      setTimeout(refreshProxyStatus, 500);
    }
  });
}

// ============== Botão: Parar e baixar JSON parcial ==============
const stopBtn = document.getElementById("stopExtract");
if (stopBtn) stopBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    // Espera resposta do content script com { ok, dados, totalPaginas, url, dataString }
    const resposta = await chrome.tabs.sendMessage(tab.id, { cmd: 'STOP_AND_DOWNLOAD' });
    if (resposta?.ok) {
      const url = resposta.url || '';
      let slug = url.replace(/^https?:\/\/[^\/]+\/geo\//, '').replace(/[/?#].*$/, '').replace(/\//g, '-');
      if (!slug) slug = 'resultado';
      const paginas = resposta.totalPaginas || 1;
      const dataStr = resposta.dataString || (() => {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
      })();
      const nomeArquivo = `${slug}-Paginas${paginas}-${dataStr}.json`;
      const blob = new Blob([JSON.stringify(resposta.dados, null, 2)], { type: 'application/json;charset=utf-8' });
      const urlBlob = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlBlob;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(urlBlob);
      alert(`JSON gerado com ${paginas} páginas extraídas.`);
    }
    await chrome.runtime.sendMessage({ cmd: "DISABLE_PROXY" });
  } catch (e) {
    console.warn("Erro ao parar ou desativar proxy:", e);
  }
});

// ============== Proxy: painel e status ==============
function initProxyPanel() {
  const hostInput = document.getElementById('proxyHost');
  const portInput = document.getElementById('proxyPort');
  const userInput = document.getElementById('proxyUser');
  const passInput = document.getElementById('proxyPass');
  const saveBtn = document.getElementById('saveProxyConfig');
  const testBtn = document.getElementById('testProxyBtn');

  // Carregar campos do chrome.storage.local
  chrome.storage.local.get(['proxyHost', 'proxyPort', 'proxyUser', 'proxyPass'], function(items) {
    hostInput.value = items.proxyHost || '';
    portInput.value = items.proxyPort || '';
    userInput.value = items.proxyUser || '';
    passInput.value = items.proxyPass || '';
  });

  saveBtn.onclick = () => {
    chrome.storage.local.set({
      proxyHost: hostInput.value.trim(),
      proxyPort: portInput.value.trim(),
      proxyUser: userInput.value.trim(),
      proxyPass: passInput.value.trim()
    }, function() {
      alert("Proxy salvo.");
    });
  };

  testBtn.onclick = async () => {
    const resultLabel = document.getElementById('proxyTestResult');
    resultLabel.textContent = 'Testando proxy...';

    try {
      await chrome.runtime.sendMessage({
        cmd: "ENABLE_PROXY",
        host: hostInput.value.trim(),
        port: parseInt(portInput.value.trim(), 10),
        username: userInput.value.trim(),
        password: passInput.value.trim(),
        extraDomains: []
      });
      const resp = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
      const data = await resp.json();
      resultLabel.textContent = data?.ip ? `IP público: ${data.ip}` : 'Proxy ativado, mas IP não detectado.';
    } catch (err) {
      resultLabel.textContent = 'Erro ao testar proxy: ' + err;
    } finally {
      await chrome.runtime.sendMessage({ cmd: "DISABLE_PROXY" });
    }
  };
}

async function refreshProxyStatus() {
  try {
    const st = await chrome.runtime.sendMessage({ cmd: "PROXY_STATUS" });
    const el = document.getElementById("proxyState");
    if (el) el.textContent = st?.enabled ? "ativado" : "desativado";
  } catch (e) {
    console.warn('Falha ao obter status do proxy:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initProxyPanel();
  if (toggleProxy) {
    chrome.storage.local.get(['usarProxy'], items => { toggleProxy.checked = items.usarProxy === 'true'; });
    toggleProxy.addEventListener('change', () => chrome.storage.local.set({ usarProxy: toggleProxy.checked ? 'true' : 'false' }));
  }
  const open = document.getElementById('openLote');
  if (open) open.addEventListener('click', async () => {
    open.disabled = true;
    try {
      const base = chrome.runtime.getURL('lote.html');
      const existing = await chrome.tabs.query({ url: base + '*' });
      if (existing.length) {
        await chrome.tabs.update(existing[0].id, { active: true });
        await chrome.windows.update(existing[0].windowId, { focused: true });
      } else {
        const [source] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.create({ url: base + (source?.id ? '?sourceTabId=' + source.id : ''), active: true });
      }
    } catch { alert('Não foi possível abrir a extração em lote.'); }
    finally { open.disabled = false; }
  });
});

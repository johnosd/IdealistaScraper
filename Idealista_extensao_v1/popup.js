// ============== Utils ==============
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const randDelay = () => 3000 + Math.floor(Math.random() * 7000);

async function waitForElementInPage(tabId, selector, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout esperando elemento")), timeoutMs);

    chrome.scripting.executeScript({
      target: { tabId },
      func: (sel) => {
        return new Promise((resolve) => {
          const check = () => {
            if (document.querySelector(sel)) return resolve(true);
            setTimeout(check, 500);
          };
          check();
        });
      },
      args: [selector]
    }).then(() => {
      clearTimeout(timer);
      resolve();
    }).catch(err => {
      clearTimeout(timer);
      reject(err);
    });
  });
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
const extractBtn = document.getElementById("extract");
if (extractBtn) extractBtn.addEventListener("click", async () => {
  extractBtn.disabled = true;
  const prev = extractBtn.textContent;
  extractBtn.textContent = "Extraindo...";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const targetUrl = "https://www.idealista.pt/arrendar-casas/#municipality-search";
    await chrome.tabs.update(tab.id, { url: targetUrl });
    await waitForElementInPage(tab.id, 'nav.locations-list', 30000);
    await sleep(randDelay());

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // ----------- Função extractLinks embutida aqui -----------
        function extractLinks(doc = document) {
          const container = doc.querySelector('nav.locations-list');
          if (!container) return [];
        
          const base = location.origin;
          const seen = new Set();
          const rows = [];
        
          const norm = (t) => (t || '').replace(/\s+/g, ' ').trim();
          const abs = (href) => { try { return new URL(href, base).href; } catch { return null; } };
        
          container.querySelectorAll('ul.locations-list__links').forEach((col) => {
            const regionA = col.querySelector('a > h3.region-title')?.parentElement;
            const regiao = norm(regionA?.textContent);
        
            col.querySelectorAll(':scope > li').forEach((li) => {
              const subA = li.querySelector(':scope > a.subregion');
              const contagemEl = li.querySelector(':scope > p');
              const contagem = norm(contagemEl?.textContent);
              const subregiao = norm(subA?.textContent);
        
              if (subA) {
                const url = abs(subA.getAttribute('href'));
                if (url && !seen.has(url)) {
                  seen.add(url);
                  rows.push({
                    "Região": regiao || null,
                    "Sub-região": subregiao || null,
                    "Município": null,
                    "Tipo": "Sub-região",
                    "Texto": subregiao || null,
                    "URL": url,
                    "Contagem": contagem || null
                  });
                }
              }
        
              li.querySelectorAll(':scope ul.locations-list__municipalities > li > a').forEach((munA) => {
                const municipio = norm(munA.textContent);
                const url = abs(munA.getAttribute('href'));
                if (url && !seen.has(url)) {
                  seen.add(url);
                  rows.push({
                    "Região": regiao || null,
                    "Sub-região": subregiao || null,
                    "Município": municipio || null,
                    "Tipo": "Município",
                    "Texto": municipio || null,
                    "URL": url,
                    "Contagem": null
                  });
                }
              });
            });
        
            if (regionA) {
              const url = abs(regionA.getAttribute('href'));
              if (url && !seen.has(url)) {
                seen.add(url);
                rows.push({
                  "Região": regiao || null,
                  "Sub-região": null,
                  "Município": null,
                  "Tipo": "Região",
                  "Texto": regiao || null,
                  "URL": url,
                  "Contagem": null
                });
              }
            }
          });
        
          return rows;
        }
        // --------------------------------------------------------

        const rows = extractLinks(document);
        if (!rows.length) {
          alert('Nenhum link encontrado em <nav.locations-list>.');
          return;
        }
        const blob = new Blob([JSON.stringify(rows, null, 2)], {
          type: 'application/json;charset=utf-8'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `links_localidades_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        alert(`JSON gerado com ${rows.length} registros.`);
      }
    });
  } catch (err) {
    console.error('Erro em Extrair Links:', err);
    alert('Erro ao extrair links. Veja o console para detalhes.\n\n' + err.message);
  } finally {
    extractBtn.disabled = false;
    extractBtn.textContent = prev;
  }
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
      const host = localStorage.getItem('proxyHost') || '';
      const port = parseInt(localStorage.getItem('proxyPort') || '0', 10);
      const username = localStorage.getItem('proxyUser') || '';
      const password = localStorage.getItem('proxyPass') || '';

      try {
        const res = await chrome.runtime.sendMessage({
          cmd: "ENABLE_PROXY", host, port, username, password, extraDomains: []
        });
        if (!res?.ok) throw new Error(res?.error || "Erro desconhecido ao ativar proxy.");
      } catch (err) {
        console.error("Erro ativando proxy:", err);
        alert("Falha ao ativar proxy. Verifique os dados.");
        itemsBtn.disabled = false;
        itemsBtn.textContent = prevText;
        return;
      }
    }

    try {
      const res = await chrome.tabs.sendMessage(tab.id, { cmd: 'START_CRAWL' });
      if (!res?.ok) throw new Error(res?.error || 'Erro ao iniciar crawler');
    } catch (err) {
      console.warn("Falha ao iniciar extração:", err);
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
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
    await chrome.tabs.sendMessage(tab.id, { cmd: 'STOP_AND_DOWNLOAD' });
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

  // preencher campos
  hostInput.value = localStorage.getItem('proxyHost') || '';
  portInput.value = localStorage.getItem('proxyPort') || '';
  userInput.value = localStorage.getItem('proxyUser') || '';
  passInput.value = localStorage.getItem('proxyPass') || '';

  saveBtn.onclick = () => {
    localStorage.setItem('proxyHost', hostInput.value.trim());
    localStorage.setItem('proxyPort', portInput.value.trim());
    localStorage.setItem('proxyUser', userInput.value.trim());
    localStorage.setItem('proxyPass', passInput.value.trim());
    alert("Proxy salvo.");
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

document.addEventListener("DOMContentLoaded", () => {
  initProxyPanel();
  refreshProxyStatus();
  if (toggleProxy) {
    toggleProxy.checked = localStorage.getItem('usarProxy') === 'true';
    toggleProxy.addEventListener('change', () => {
      localStorage.setItem('usarProxy', toggleProxy.checked ? 'true' : 'false');
    });
  }
});

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

document.addEventListener("DOMContentLoaded", () => {
  initProxyPanel();

  // --- Lote: Carregar lista automaticamente ---
  const loteAutoLoadBtn = document.getElementById('loteAutoLoad');
  const loteUrlsTextarea = document.getElementById('loteUrls');
  const loteClearBtn = document.getElementById('loteClear');
  const loteLog = document.getElementById('loteLog');

  // --- Helpers de armazenamento ---
  async function saveLoteListToStorage(list) {
    await chrome.storage.local.set({ loteLista: list });
  }
  async function getLoteListFromStorage() {
    return new Promise(resolve => {
      chrome.storage.local.get(['loteLista'], items => {
        resolve(items.loteLista || null);
      });
    });
  }
  async function clearLoteListFromStorage() {
    await chrome.storage.local.remove(['loteLista']);
  }
  // Remove o primeiro item da lista (após processar)
  async function removeFirstLoteItem() {
    let lista = loteUrlsTextarea.value.trim();
    if (!lista) return;
    try {
      let arr = JSON.parse(lista);
      if (Array.isArray(arr) && arr.length > 0) {
        arr.shift();
        loteUrlsTextarea.value = arr.length > 0 ? JSON.stringify(arr, null, 2) : '';
        await saveLoteListToStorage(arr.length > 0 ? arr : '');
        loteLog.textContent = `Item processado e removido. Restam ${arr.length} itens.`;
      } else {
        loteUrlsTextarea.value = '';
        await clearLoteListFromStorage();
        loteLog.textContent = 'Todos os itens foram processados e removidos.';
      }
    } catch (e) {
      // fallback: tentar linha a linha
      let linhas = lista.split('\n').map(l => l.trim()).filter(Boolean);
      if (linhas.length > 0) {
        linhas.shift();
        loteUrlsTextarea.value = linhas.join('\n');
        await saveLoteListToStorage(linhas.length > 0 ? linhas.join('\n') : '');
        loteLog.textContent = `Item processado e removido. Restam ${linhas.length} linhas.`;
      } else {
        loteUrlsTextarea.value = '';
        await clearLoteListFromStorage();
        loteLog.textContent = 'Todos os itens foram processados e removidos.';
      }
    }
  }

  // --- Carregar lista do storage ao abrir ---
  (async () => {
    const listaSalva = await getLoteListFromStorage();
    if (listaSalva && loteUrlsTextarea) {
      loteUrlsTextarea.value = typeof listaSalva === 'string' ? listaSalva : JSON.stringify(listaSalva, null, 2);
      loteLog.textContent = `Lista restaurada do armazenamento (${Array.isArray(listaSalva) ? listaSalva.length : '?'} itens).`;
    }
  })();

  // --- Salvar sempre que textarea mudar ---
  if (loteUrlsTextarea) {
    loteUrlsTextarea.addEventListener('input', () => {
      saveLoteListToStorage(loteUrlsTextarea.value);
    });
  }

  // --- Limpar lista ---
  if (loteClearBtn && loteUrlsTextarea) {
    loteClearBtn.addEventListener('click', async () => {
      if (confirm("Tem certeza que deseja descartar o lote atual? Isso não poderá ser desfeito.")) {
        await clearLoteData();
      }
    });
  }

  // --- Lote: Processamento em lote ---
  const loteStartBtn = document.getElementById('loteStart');
  const lotePauseBtn = document.getElementById('lotePause');
  let loteIsPaused = false;
  let loteIsRunning = false;

  // --- Status detalhado do lote ---
  const loteStatusList = document.getElementById('loteStatusList');
  let loteStatusArr = [];

  function renderLoteStatusList() {
    if (!loteStatusList) return;
    loteStatusList.innerHTML = '';
    loteStatusArr.forEach((item, idx) => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.justifyContent = 'space-between';
      li.style.gap = '10px';
      li.style.padding = '2px 0';
      li.style.borderBottom = '1px solid #e5e7eb';
      const label = document.createElement('span');
      label.textContent = item.nome || item.link || item.url || item.texto || `Item ${idx+1}`;
      label.style.flex = '1';
      const status = document.createElement('span');
      status.textContent = item.status;
      status.className = 'badge ' + (item.status === 'Sucesso' ? 'on' : item.status === 'Erro' ? 'erro' : item.status === 'Processando' ? 'on' : '');
      status.style.marginLeft = '8px';
      li.appendChild(label);
      li.appendChild(status);
      loteStatusList.appendChild(li);
    });
  }
  async function saveLoteStatusToStorage() {
    await chrome.storage.local.set({ loteStatusArr });
  }
  async function loadLoteStatusFromStorage() {
    return new Promise(resolve => {
      chrome.storage.local.get(['loteStatusArr'], items => {
        loteStatusArr = Array.isArray(items.loteStatusArr) ? items.loteStatusArr : [];
        renderLoteStatusList();
        resolve();
      });
    });
  }
  // Carregar status ao abrir
  loadLoteStatusFromStorage();

  async function clearLoteData() {
    if (loteUrlsTextarea) {
      loteUrlsTextarea.value = '';
    }
    loteStatusArr = [];
    renderLoteStatusList();
    loteIsRunning = false;
    loteIsPaused = false;
    window.loteResultados = [];
    await chrome.storage.local.remove(['loteLista', 'loteStatusArr', 'loteProcessamento']);
    if (loteStartBtn) loteStartBtn.disabled = false;
    if (lotePauseBtn) lotePauseBtn.disabled = true;
    if (loteLog) loteLog.textContent = 'Lote descartado.';
  }

  if (loteStartBtn && loteUrlsTextarea) {
    loteStartBtn.addEventListener('click', async () => {
      if (loteIsRunning) return;
      const listaOriginal = loteUrlsTextarea.value;
      if (loteStatusArr.length > 0 || (window.loteResultados && window.loteResultados.length)) {
        await clearLoteData();
        loteUrlsTextarea.value = listaOriginal;
        await saveLoteListToStorage(listaOriginal);
      }
      loteIsRunning = true;
      loteIsPaused = false;
      loteLog.textContent = 'Processando lote...';
      loteStartBtn.disabled = true;
      lotePauseBtn.disabled = false;
      // Inicializa status
      let lista = loteUrlsTextarea.value.trim();
      let listaArr;
      try {
        listaArr = JSON.parse(lista);
      } catch {
        listaArr = lista.split('\n').map(l => l.trim()).filter(Boolean);
      }
      // Se status não bate com lista, reinicializa
      if (!Array.isArray(loteStatusArr) || loteStatusArr.length !== listaArr.length) {
        loteStatusArr = listaArr.map(item => ({
          nome: typeof item === 'string' ? item : (item.nome || item.link || item.url || item.texto || ''),
          link: typeof item === 'string' ? item : (item.link || item.url || ''),
          status: 'Pendente'
        }));
        await saveLoteStatusToStorage();
        renderLoteStatusList();
      }
      let idx = 0;
      while (true) {
        if (loteIsPaused) {
          loteLog.textContent = 'Lote pausado.';
          break;
        }
        let listaAtual = loteUrlsTextarea.value.trim();
        let listaArrAtual;
        try {
          listaArrAtual = JSON.parse(listaAtual);
        } catch {
          listaArrAtual = listaAtual.split('\n').map(l => l.trim()).filter(Boolean);
        }
        if (!listaArrAtual.length || idx >= loteStatusArr.length) {
          loteLog.textContent = 'Lote finalizado. Todos os itens processados.';
          break;
        }
        let itemAtual = listaArrAtual[0];
        let url = '';
        if (typeof itemAtual === 'string') {
          url = itemAtual;
        } else if (itemAtual && itemAtual.link) {
          url = itemAtual.link.startsWith('http') ? itemAtual.link : ('https://www.idealista.pt' + itemAtual.link);
        } else {
          url = '';
        }
        // Atualiza status visual
        loteStatusArr[idx].status = 'Processando';
        await saveLoteStatusToStorage();
        renderLoteStatusList();
        try {
          loteLog.textContent = `Navegando para: ${url}`;
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          await chrome.tabs.update(tab.id, { url });
          await waitForTabComplete(tab.id);
          // (Opcional) Ativar proxy se marcado
          if (typeof toggleProxy !== 'undefined' && toggleProxy && toggleProxy.checked) {
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
              if (!res?.ok) throw new Error(res?.error || 'Erro ao iniciar proxy');
            } catch (err) {
              console.warn("Falha ao ativar proxy para lote:", err);
            }
          }
          loteLog.textContent = 'Extraindo itens da página...';
          // --- Inicia extração paginada (START_CRAWL) igual ao modo individual ---
          try {
            let crawlRes = await chrome.tabs.sendMessage(tab.id, { cmd: 'START_CRAWL', silent: true });
            if (!crawlRes?.ok) throw new Error(crawlRes?.error || 'Erro ao iniciar crawler');
          } catch (err) {
            // Tenta reinjetar content.js e tentar de novo
            try {
              await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
              await new Promise(res => setTimeout(res, 500));
              let crawlRes2 = await chrome.tabs.sendMessage(tab.id, { cmd: 'START_CRAWL', silent: true });
              if (!crawlRes2?.ok) throw new Error(crawlRes2?.error || 'Erro ao injetar script');
            } catch (e) {
              loteLog.textContent = 'Não consegui iniciar a extração. Recarregue a página do Idealista.';
              throw e;
            }
          }
          // Aguarda e obtém resposta paginada
          let resposta = null;
          try {
            resposta = await chrome.tabs.sendMessage(tab.id, { cmd: 'STOP_AND_DOWNLOAD' });
          } catch (e) {
            loteLog.textContent = 'Erro ao comunicar com content script: ' + (e.message || e);
            resposta = null;
          }
          if (resposta?.ok) {
            if (!window.loteResultados) window.loteResultados = [];
            window.loteResultados.push({ url, dados: resposta.dados, totalPaginas: resposta.totalPaginas, nome: itemAtual.nome || url, data: new Date().toISOString() });
            loteLog.textContent = `Sucesso: ${url} (${resposta.dados.length || 0} itens)`;
            loteStatusArr[idx].status = 'Sucesso';
            // --- Exporta arquivo individual ao concluir item ---
            try {
              let nomeBase = (itemAtual.nome || (url.replace(/^https?:\/\/(www\.)?/, '').replace(/[/?#].*$/, '').replace(/\//g, '-')) || 'resultado');
              let paginas = resposta.totalPaginas || 1;
              const nomeArquivo = `${nomeBase}-Paginas${paginas}.json`;
              const blob = new Blob([JSON.stringify(resposta.dados, null, 2)], { type: 'application/json;charset=utf-8' });
              const urlBlob = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = urlBlob;
              a.download = nomeArquivo;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(urlBlob);
            } catch (e) { console.warn('Falha ao exportar arquivo individual:', e); }
          } else {
            loteLog.textContent = `Falha ao extrair: ${url}`;
            loteStatusArr[idx].status = 'Erro';
          }
        } catch (err) {
          loteLog.textContent = 'Erro: ' + (err.message || err);
          loteStatusArr[idx].status = 'Erro';
        }
        await saveLoteStatusToStorage();
        renderLoteStatusList();
        await removeFirstLoteItem();
        // Delay aleatório entre 1.5 e 4 segundos
        const delayMs = Math.floor(Math.random() * (4000 - 1500 + 1)) + 1500;
        await new Promise(res => setTimeout(res, delayMs));
        idx++;
      }
      loteIsRunning = false;
      loteStartBtn.disabled = false;
      lotePauseBtn.disabled = true;
    });
  }
  if (lotePauseBtn) {
    lotePauseBtn.disabled = true;
    lotePauseBtn.addEventListener('click', () => {
      loteIsPaused = true;
    });
  }

  // --- Lote: Carregar lista automaticamente ---

    loteAutoLoadBtn.addEventListener('click', async () => {
      loteAutoLoadBtn.disabled = true;
      loteLog.textContent = 'Extraindo lista da página ativa...';
      try {
        // Executa script na aba ativa para extrair bairros/cidades
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error('Não foi possível identificar a aba ativa.');
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // --- Código de extração fornecido pelo usuário ---
            const itens = document.querySelectorAll('.breadcrumb-dropdown-subitem-element-list, .breadcrumb-dropdown-element');
            const resultado = [];
            itens.forEach(item => {
              const linkElem = item.querySelector('a');
              const spanElem = item.querySelector('.breadcrumb-navigation-sidenote');
              if (linkElem && spanElem) {
                resultado.push({
                  nome: linkElem.innerText.trim(),
                  link: linkElem.getAttribute('href'),
                  quantidade: parseInt(spanElem.innerText.replace(/\D/g, ''), 10)
                });
              }
            });
            return resultado;
          },
        });
        if (!Array.isArray(result) || result.length === 0) {
          loteLog.textContent = 'Nenhum bairro/cidade encontrado na página ativa.';
        } else {
          result.sort((a, b) => b.quantidade - a.quantidade);
          loteUrlsTextarea.value = JSON.stringify(result, null, 2);
          loteLog.textContent = `Lista carregada automaticamente: ${result.length} itens.`;
        }
      } catch (err) {
        loteLog.textContent = 'Erro ao carregar lista automaticamente: ' + (err.message || err);
      } finally {
        loteAutoLoadBtn.disabled = false;
      }
    });

  if (toggleProxy) {
    chrome.storage.local.get(['usarProxy'], (items) => {
      toggleProxy.checked = items.usarProxy === 'true';
    });
    toggleProxy.addEventListener('change', () => {
      chrome.storage.local.set({ usarProxy: toggleProxy.checked ? 'true' : 'false' });
    });
  }
});

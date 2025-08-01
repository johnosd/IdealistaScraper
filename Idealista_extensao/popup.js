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
document.getElementById("extract").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const targetUrl = "https://www.idealista.pt/";
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
  }
});

// roda na página
function extrairLinksESalvarJSONNaPagina() {
  const container = document.querySelector('nav.locations-list');
  if (!container) {
    alert('Elemento <nav class="locations-list"> não encontrado na página inicial.');
    return;
  }

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
document.getElementById("extractItems").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!/^https:\/\/(?:www\.)?idealista\.pt\//.test(tab?.url || "")) {
    alert('Abra uma página de resultados no idealista.pt e depois clique em "Extrair Itens".');
    return;
  }

  // >>>> SUBSTITUA pelos dados REAIS do seu proxy:
  const PROXY_HOST = "proxy-us.proxy-cheap.com";      // ex: gw.resnet.example.com
  const PROXY_PORT = 5959;             // ex: 12345
  const PROXY_USER = "pcOoqLBiLs-res-any";
  const PROXY_PASS = "PC_5djX4v5F9aXvIl5gn";

  // 1) Ativa proxy
const en = await chrome.runtime.sendMessage({
  cmd: "ENABLE_PROXY",
  host: PROXY_HOST,
  port: PROXY_PORT,
  username: PROXY_USER,
  password: PROXY_PASS
});
if (!en?.ok) {
  console.warn("ENABLE_PROXY falhou:", en?.error);
  alert("Falha ao habilitar o proxy: " + (en?.error || "erro desconhecido"));
  return;
}

  // 2) Dispara o crawler
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { cmd: 'START_CRAWL' });
    if (!res?.ok) throw new Error(res?.error || 'Sem resposta OK do content.js');
  } catch (e) {
    console.warn('Sem receptor; recarregando a aba…', e);
    await chrome.tabs.reload(tab.id);
    await waitForTabComplete(tab.id);
    const res2 = await chrome.tabs.sendMessage(tab.id, { cmd: 'START_CRAWL' });
    if (!res2?.ok) {
      alert('Não consegui iniciar a extração. Recarregue a página do Idealista.');
    }
  }
});

// Botão: Parar e baixar JSON parcial + desabilitar proxy
const stopBtn = document.getElementById("stopExtract");
if (stopBtn) {
  stopBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
      await chrome.tabs.sendMessage(tab.id, { cmd: 'STOP_AND_DOWNLOAD' });
    } catch (_) {}

    // Desativa proxy
    try {
      await chrome.runtime.sendMessage({ cmd: "DISABLE_PROXY" });
    } catch (_) {}
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
  } catch {}
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

// Atualiza status ao clicar em iniciar/parar (opcional)
const itemsBtn = document.getElementById("extractItems");
if (itemsBtn) itemsBtn.addEventListener("click", () => setTimeout(refreshProxyStatus, 500));
const stopBtn2 = document.getElementById("stopExtract");
if (stopBtn2) stopBtn2.addEventListener("click", () => setTimeout(refreshProxyStatus, 500));

// ===================== content.js (com log de IP e crawler paginado) =====================

// ---------- Utils básicos ----------
const randDelay = () => 3000 + Math.floor(Math.random() * 7000); // 3–10s
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const limparTexto = (t) => (t || '').replace(/\s+/g,' ').trim();
const toAbs = (href) => href ? new URL(href, location.origin).href : null;
const parseIntSafe = (s) => {
  if (!s) return null;
  const n = parseInt(String(s).replace(/[^\d]/g,''), 10);
  return Number.isFinite(n) ? n : null;
};

function baixarJSON(obj, nomeBase) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nomeBase}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- LOG do IP público (via proxy) ----------
let __lastProxyIp = null;

async function getPublicIp() {
  const r = await fetch('https://api.ipify.org?format=json', { cache: 'no-store', credentials: 'omit' });
  const j = await r.json();
  return j?.ip || null;
}

async function logProxyIp(label = "") {
  try {
    const ip = await getPublicIp();
    const ts = new Date().toISOString();
    if (ip && ip !== __lastProxyIp) {
      console.log(`[ProxyIP] ${ts} ${label ? "["+label+"] " : ""}IP público: ${ip}`);
      __lastProxyIp = ip;
    } else if (ip) {
      console.log(`[ProxyIP] ${ts} ${label ? "["+label+"] " : ""}IP público (inalterado): ${ip}`);
    } else {
      console.warn(`[ProxyIP] ${ts} ${label ? "["+label+"] " : ""}Não foi possível obter IP público.`);
    }
  } catch (e) {
    console.warn(`[ProxyIP] Falha ao obter IP público: ${e}`);
  }
}

// ---------- Extrator de itens + paginação ----------
let stopRequested = false;
let _itensCrawled = [];
let _ultimaPagina = 1;
let _urlCrawl = '';
let _dataCrawl = '';

function extrairDaRaiz(rootDoc) {
  const lista = rootDoc.querySelector('section.items-container.items-list');
  if (!lista) return { itens: [], nextUrl: null };

  const artigos = Array.from(lista.querySelectorAll('article.item'))
    .filter(a => !a.classList.contains('adv'));

  const itens = artigos.map(art => {
    const aTitulo = art.querySelector('.item-info-container a.item-link');
    const titulo = limparTexto(aTitulo?.textContent);
    const linkAbs = toAbs(aTitulo?.getAttribute('href'));
    const preco = limparTexto(art.querySelector('.price-row .item-price')?.textContent);

    const detalhesEls = Array.from(art.querySelectorAll('.item-detail-char .item-detail'));
    const detalheDoItem = limparTexto(detalhesEls.map(d => d.textContent).join(' | '));
    const descricaoDoItem = limparTexto(art.querySelector('.item-description')?.textContent);

    const tags = Array.from(art.querySelectorAll('.listing-tags-container .listing-tags')).map(e => limparTexto(e.textContent));
    const id = art.getAttribute('data-element-id') || null;

    const agA = art.querySelector('.logo-branding a');
    const agenciaNome = limparTexto(agA?.getAttribute('title') || agA?.textContent || '');
    const agenciaLink = toAbs(agA?.getAttribute('href'));

    const precoOriginal = limparTexto(art.querySelector('.pricedown_price')?.textContent) || null;
    const descontoPercentual = limparTexto(art.querySelector('.pricedown_icon')?.textContent) || null;

    const estacionamento = limparTexto(art.querySelector('.price-row .item-parking')?.textContent) || null;
    const tempoDestaque = limparTexto(art.querySelector('.item-detail-char .txt-highlight-red')?.textContent) || null;

    let imagens = null;
    const picsOld = art.querySelector('.item-multimedia-pictures--old');
    if (picsOld) {
      const spans = picsOld.querySelectorAll('span');
      if (spans?.length >= 2) imagens = parseIntSafe(spans[1]?.textContent);
    }

    const tipologia = (detalhesEls.find(d => /T\d+/i.test(d.textContent))?.textContent.match(/T\d+/i) || [null])[0];
    const areaBrutaM2 = (() => {
      const d = detalhesEls.find(d => /m²/i.test(d.textContent));
      if (!d) return null;
      return parseIntSafe(d.textContent);
    })();
    const pisoResumo = limparTexto(detalhesEls.find(d => /(andar|Rés do chão|piso)/i.test(d.textContent))?.textContent) || null;

    return {
      Titulo: titulo || null,
      Link: linkAbs || null,
      Preco: preco || null,
      "detalhe do item": detalheDoItem || null,
      "Descricao do item": descricaoDoItem || null,
      id, tags,
      agenciaNome: agenciaNome || null,
      agenciaLink: agenciaLink || null,
      precoOriginal, descontoPercentual,
      estacionamento, tempoDestaque,
      imagens, tipologia: tipologia || null,
      areaBrutaM2, pisoResumo
    };
  });

  // Próxima página
  let nextUrl = null;
  const nextByIcon = rootDoc.querySelector('a.icon-arrow-right-after[href]');
  if (nextByIcon) {
    nextUrl = toAbs(nextByIcon.getAttribute('href'));
  } else {
    const nextLi = rootDoc.querySelector('.pagination li.next a[href]');
    nextUrl = nextLi ? toAbs(nextLi.getAttribute('href')) : null;
  }

  return { itens, nextUrl };
}

function logCrawler(msg) {
  console.log('[Crawler]', msg);
  try {
    chrome.runtime.sendMessage({ type: 'CRAWLER_LOG', message: msg });
  } catch {}
}

async function runCrawlFetchNext() {
  _itensCrawled = [];
  _ultimaPagina = 1;
  _urlCrawl = location.href;
  _dataCrawl = (() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  })();

  let usarProxy = false;
  try {
    usarProxy = window.localStorage.getItem('usarProxy') === 'true';
  } catch {}

  stopRequested = false;
  logCrawler('Iniciando na página: ' + location.href);
  await logProxyIp('início');
  const vistos = new Set();
  const todos = [];

  // Página atual
  let { itens, nextUrl } = extrairDaRaiz(document);
  for (const it of itens) {
    const key = it.id || it.Link || JSON.stringify(it);
    if (!vistos.has(key)) { vistos.add(key); todos.push(it); }
  }

  function extrairNumeroPagina(url) {
    const match = url.match(/\/pagina-(\d+)/);
    if (match) return parseInt(match[1], 10);
    return 1;
  }
  let pagina = extrairNumeroPagina(location.href);
  _ultimaPagina = pagina;

  let proxyReconnectCount = 0;
  while (nextUrl && !stopRequested) {
    pagina += 1;
    _ultimaPagina = pagina;

    await logProxyIp(`antes de buscar página ${pagina}`);
    const espera = randDelay();
    logCrawler(`Aguardando ${Math.round(espera/1000)}s antes da página ${pagina}…`);
    await sleep(espera);
    if (stopRequested) break;
    logCrawler('Buscando:', nextUrl);
    let resp;
    try {
      resp = await fetch(nextUrl, { credentials: 'same-origin' });
    } catch (e) {
      console.error('[Crawler] Erro ao buscar página:', e);
      break;
    }
    if (!resp.ok) {
      console.warn('[Crawler] Falha ao buscar:', nextUrl, resp.status);
      break;
    }
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const res = extrairDaRaiz(doc);
    for (const it of res.itens) {
      const key = it.id || it.Link || JSON.stringify(it);
      if (!vistos.has(key)) { vistos.add(key); todos.push(it); }
    }
    logCrawler(`Página ${pagina} coletada. Total até agora: ${todos.length}`);
    nextUrl = res.nextUrl || null;
    await logProxyIp(`após coletar página ${pagina}`);
    proxyReconnectCount++;
    if (usarProxy && proxyReconnectCount >= 10) {
      logCrawler('Reconectando proxy após 10 páginas...');
      try {
        await chrome.runtime.sendMessage({ cmd: 'DISABLE_PROXY' });
        await new Promise(r => setTimeout(r, 1000));
        await chrome.runtime.sendMessage({
          cmd: 'ENABLE_PROXY',
          host: 'proxy-us.proxy-cheap.com',
          port: 5959,
          username: 'pcOoqLBiLs-res-any',
          password: 'PC_5djX4v5F9aXvIl5gn',
          extraDomains: []
        });
        logCrawler('Proxy reconectado com sucesso!');
      } catch (e) {
        logCrawler('Erro ao reconectar proxy: ' + String(e));
      }
      proxyReconnectCount = 0;
    }
  }

  // Salva progresso global para o STOP
  _itensCrawled = todos.slice();
  _ultimaPagina = pagina;
  _urlCrawl = location.href;

  if (_itensCrawled.length > 0) {
    // Monta slug a partir da URL
    let slug = _urlCrawl
      .replace(/^https?:\/\/[^\/]+\/geo\//, '')     // tira até o /geo/
      .replace(/[?#].*$/, '')                       // remove params/fragmentos
      .replace(/\/$/, '')                           // remove barra final, se houver
      .replace(/\//g, '-');                         // troca todas as barras restantes por hífen
    if (!slug) slug = 'resultado';
    const paginas = _ultimaPagina || 1;
    const dataStr = _dataCrawl || (() => {
      const d = new Date();
      return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    })();
    const nomeArquivo = `${slug}-Paginas${paginas}-${dataStr}`;
    baixarJSON(_itensCrawled, nomeArquivo);
    alert(`JSON gerado com ${_itensCrawled.length} itens de ${_ultimaPagina} página(s).\nArquivo: ${nomeArquivo}.json`);
  } else {
    alert('Nenhum item encontrado.');
  }

  logCrawler(`Concluído. Total: ${_itensCrawled.length}`);
}

// ---------- Mensagens do popup ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.cmd === 'START_CRAWL') {
    (async () => {
      try {
        await runCrawlFetchNext();
        sendResponse({ ok: true, started: true });
      } catch (e) {
        console.error(e);
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }

  if (msg?.cmd === 'STOP_AND_DOWNLOAD') {
    stopRequested = true;
    sendResponse({
      ok: true,
      dados: _itensCrawled,
      totalPaginas: _ultimaPagina,
      url: _urlCrawl,
      dataString: _dataCrawl
    });
    return true;
  }

  if (msg?.cmd === 'TEST_IP') {
    (async () => {
      try {
        const ip = await getPublicIp();
        sendResponse({ ok: true, ip });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    })();
    return true;
  }
});

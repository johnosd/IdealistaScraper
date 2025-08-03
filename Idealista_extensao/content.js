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
  a.download = `${nomeBase}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- LOG do IP público (via proxy) ----------
let __lastProxyIp = null;

async function getPublicIp() {
  try {
    const proxySt = await chrome.runtime.sendMessage({ cmd: 'PROXY_STATUS' });
    if (proxySt?.enabled) {
      // Proxy está ativo, retornar IP do proxy
      const ip = await fetch('https://api.ipify.org?format=json', { cache: 'no-store', credentials: 'omit' });
      const j = await ip.json();
      return j?.ip || null;
    } else {
      // Proxy não está ativo, retornar IP público
      const ip = await fetch('https://api.ipify.org?format=json', { cache: 'no-store', credentials: 'omit' });
      const j = await ip.json();
      return j?.ip || null;
    }
  } catch (e) {
    console.warn(`[ProxyIP] Falha ao obter IP público: ${e}`);
  }
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
      // Campos pedidos
      Titulo: titulo || null,
      Link: linkAbs || null,
      Preco: preco || null,
      "detalhe do item": detalheDoItem || null,
      "Descricao do item": descricaoDoItem || null,
      // Extras úteis
      id, tags,
      agenciaNome: agenciaNome || null,
      agenciaLink: agenciaLink || null,
      precoOriginal, descontoPercentual,
      estacionamento, tempoDestaque,
      imagens, tipologia: tipologia || null,
      areaBrutaM2, pisoResumo
    };
  });

  // Próxima página priorizando o elemento solicitado
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

async function runCrawlFetchNext() {
  stopRequested = false;
  console.log('[Crawler] Iniciando na página:', location.href);

  // Loga IP no início
  await logProxyIp('início');

  const vistos = new Set();
  const todos = [];

  // Página atual
  let { itens, nextUrl } = extrairDaRaiz(document);
  for (const it of itens) {
    const key = it.id || it.Link || JSON.stringify(it);
    if (!vistos.has(key)) { vistos.add(key); todos.push(it); }
  }

  let pagina = 1;
  while (nextUrl && !stopRequested) {
    pagina += 1;

    // (opcional) logar IP antes de cada request
    await logProxyIp(`antes de buscar página ${pagina}`);

    const espera = randDelay();
    console.log(`[Crawler] Aguardando ${Math.round(espera/1000)}s antes da página ${pagina}…`);
    await sleep(espera);
    if (stopRequested) break;

    console.log('[Crawler] Buscando:', nextUrl);
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

    console.log(`[Crawler] Página ${pagina} coletada. Total até agora: ${todos.length}`);
    nextUrl = res.nextUrl || null;

    // (opcional) logar IP depois de cada página (para notar rotações)
    await logProxyIp(`após coletar página ${pagina}`);
  }

  if (todos.length > 0) {
    baixarJSON(todos, `itens_paginas`);
    alert(`JSON gerado com ${todos.length} itens de ${pagina} página(s).`);
  } else {
    alert('Nenhum item encontrado.');
  }

  console.log('[Crawler] Concluído. Total:', todos.length);
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
    return true; // async
  }

  if (msg?.cmd === 'STOP_AND_DOWNLOAD') {
    stopRequested = true;
    sendResponse({ ok: true, stopping: true });
    return true;
  }

  // Teste de IP público a partir do contexto da aba (para mostrar no popup)
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

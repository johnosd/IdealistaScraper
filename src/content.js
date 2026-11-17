// Extração de uma página; coordenação e exportação pertencem às telas duráveis.

// ---------- Utils básicos ----------
const limparTexto = (t) => (t || '').replace(/\s+/g,' ').trim();
const parseIntSafe = (s) => {
  if (!s) return null;
  const n = parseInt(String(s).replace(/[^\d]/g,''), 10);
  return Number.isFinite(n) ? n : null;
};

function extrairDaRaiz(rootDoc, baseURL = location.href) {
  const abs = href => href ? new URL(href, baseURL).href : null;
  const lista = rootDoc.querySelector('section.items-container.items-list');
  if (!lista) return { itens: [], nextUrl: null };

  const artigos = Array.from(lista.querySelectorAll('article.item'))
    .filter(a => !a.classList.contains('adv'));

  const itens = artigos.map(art => {
    const aTitulo = art.querySelector('.item-info-container a.item-link');
    const titulo = limparTexto(aTitulo?.textContent);
    const linkAbs = abs(aTitulo?.getAttribute('href'));
    const preco = limparTexto(art.querySelector('.price-row .item-price')?.textContent);

    const detalhesEls = Array.from(art.querySelectorAll('.item-detail-char .item-detail'));
    const detalheDoItem = limparTexto(detalhesEls.map(d => d.textContent).join(' | '));
    const descricaoDoItem = limparTexto(art.querySelector('.item-description')?.textContent);

    const tags = Array.from(art.querySelectorAll('.listing-tags-container .listing-tags')).map(e => limparTexto(e.textContent));
    const id = art.getAttribute('data-element-id') || null;

    const agA = art.querySelector('.logo-branding a');
    const agenciaNome = limparTexto(agA?.getAttribute('title') || agA?.textContent || '');
    const agenciaLink = abs(agA?.getAttribute('href'));

    const precoOriginal = limparTexto(art.querySelector('.pricedown_price')?.textContent) || null;
    const descontoPercentual = limparTexto(art.querySelector('.pricedown_icon')?.textContent) || null;

    const estacionamento = limparTexto(art.querySelector('.price-row .item-parking')?.textContent)
      || limparTexto(detalhesEls.find(d => /garagem|estacionamento/i.test(d.textContent))?.textContent) || null;
    const tempoDestaque = limparTexto(art.querySelector('.item-detail-char .txt-highlight-red')?.textContent) || null;

    function photoTotal(counter) {
      if (!counter) return null;
      const spans = counter.querySelectorAll('span');
      const text = limparTexto(spans.length >= 2 ? spans[spans.length - 1].textContent : counter.textContent.split('/')[1]);
      if (!/^\d+(?:[., ]\d{3})*$/.test(text)) return null;
      const count = Number(text.replace(/[., ]/g, ''));
      return Number.isSafeInteger(count) && count > 0 ? count : null;
    }
    const imagens = photoTotal(art.querySelector('.item-multimedia-pictures__counter'))
      ?? photoTotal(art.querySelector('.item-multimedia-pictures--old'));

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
    nextUrl = abs(nextByIcon.getAttribute('href'));
  } else {
    const nextLi = rootDoc.querySelector('.pagination li.next a[href]');
    nextUrl = nextLi ? abs(nextLi.getAttribute('href')) : null;
  }

  return { itens, nextUrl };
}

const { installCollectionExecutor } = require('./coleta-page');
const { extractLinks, inspectLocalities, nextExpansionUrl } = require('./linkExtractor');
installCollectionExecutor(chrome, { extractItems: extrairDaRaiz, extractLinks, inspectLocalities, nextExpansionUrl });

// Compatibilidade de leitura vazia do contrato001. Coletas produtivas são por página.
chrome.runtime.onMessage.addListener((message,sender,respond) => {
  if (message?.cmd === 'STOP_AND_DOWNLOAD') {
    respond({ok:true,complete:false,dados:[],totalPaginas:0,url:location.href,dataString:''});
    return;
  }
  if (message?.cmd === 'START_CRAWL') {
    respond({ok:false,error:'Inicie ou retome a coleta pela página de Itens ou Lote.'});
  }
});

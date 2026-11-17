// Extrator único de localidades (006, D1). Estratégias definidas pela inspeção real
// (.sdd/specs/006-revisao-links-lote-extracao/validation/site-inspection.md §1–2).
//
// extractLinks é SERIALIZADA por scripting.executeScript (localidades-collector.js): tudo o que ela usa
// precisa estar declarado dentro dela. Não mover helpers para fora.
function extractLinks(doc = document, full = false) {
  const base = doc.location?.origin || location.origin;
  const norm = (t) => (t || '').replace(/\s+/g, ' ').trim();
  const abs = (href) => { try { return new URL(href, base).href; } catch { return null; } };
  const row = (regiao, subregiao, municipio, tipo, texto, url, contagem) => ({
    "Região": regiao || null,
    "Sub-região": subregiao || null,
    "Município": municipio || null,
    "Tipo": tipo,
    "Texto": texto || null,
    "URL": url,
    "Contagem": contagem || null
  });
  let view;
  const container = doc.querySelector('nav.locations-list');
  if (container) {
    // Página nacional: nav.locations-list (formato histórico).
    const seen = new Set(), rows = [];
    container.querySelectorAll('ul.locations-list__links').forEach((col) => {
      const regionA = col.querySelector('a > h3.region-title')?.parentElement;
      const regiao = norm(regionA?.textContent);
      col.querySelectorAll(':scope > li').forEach((li) => {
        const subA = li.querySelector(':scope > a.subregion');
        const contagem = norm(li.querySelector(':scope > p')?.textContent);
        const subregiao = norm(subA?.textContent);
        if (subA) {
          const url = abs(subA.getAttribute('href'));
          if (url && !seen.has(url)) { seen.add(url); rows.push(row(regiao, subregiao, null, 'Sub-região', subregiao, url, contagem)); }
        }
        li.querySelectorAll(':scope ul.locations-list__municipalities > li > a').forEach((munA) => {
          const municipio = norm(munA.textContent);
          const url = abs(munA.getAttribute('href'));
          if (url && !seen.has(url)) { seen.add(url); rows.push(row(regiao, subregiao, municipio, 'Município', municipio, url, null)); }
        });
      });
      if (regionA) {
        const url = abs(regionA.getAttribute('href'));
        if (url && !seen.has(url)) { seen.add(url); rows.push(row(regiao, null, null, 'Região', regiao, url, null)); }
      }
    });
    const visible = new Set([...container.querySelectorAll('a[href]')].map(a => abs(a.getAttribute('href'))).filter(Boolean)).size;
    view = { strategy: 'nacional', records: rows, visible, excluded: { zonas: 0, vizinhos: 0 } };
  } else if (doc.querySelector('#location_list') || doc.querySelector('.breadcrumb-dropdown-element.highlighted ul.breadcrumb-dropdown-subitem-list')) {
    // Página de distrito/concelho: concelhos no breadcrumb destacado + freguesias em #location_list.
    const highlighted = doc.querySelector('.breadcrumb-dropdown-element.highlighted');
    const current = norm(highlighted?.querySelector('.breadcrumb-navigation-current-level')?.textContent);
    const subregiao = current.replace(/\s+distrito$/i, '') || null;
    const seen = new Set(), rows = [], slugs = new Map(), anchors = new Set();
    const slugOf = url => { try { return new URL(url).pathname.split('/').filter(Boolean)[1] || null; } catch { return null; } };
    highlighted?.querySelectorAll('ul.breadcrumb-dropdown-subitem-list > li').forEach((li) => {
      const a = li.querySelector('a[href]'); if (!a) return;
      const nome = norm(a.textContent), url = abs(a.getAttribute('href')); if (!url) return;
      anchors.add(url); slugs.set(slugOf(url), nome);
      if (!seen.has(url)) { seen.add(url); rows.push(row(null, subregiao, nome, 'Município', nome, url, norm(li.querySelector('.breadcrumb-navigation-sidenote')?.textContent))); }
    });
    doc.querySelectorAll('#location_list > li > ul > li').forEach((li) => {
      const a = li.querySelector('a[href]'); if (!a) return;
      const nome = norm(a.textContent), url = abs(a.getAttribute('href')); if (!url) return;
      anchors.add(url);
      if (!seen.has(url)) { seen.add(url); rows.push(row(null, subregiao, slugs.get(slugOf(url)) || null, 'Freguesia', nome, url, norm(li.querySelector(':scope > span')?.textContent))); }
    });
    view = { strategy: 'distrito', records: rows, visible: anchors.size,
      excluded: { zonas: doc.querySelectorAll('#zonesOfInterest a[href]').length, vizinhos: doc.querySelectorAll('#surroundings a[href]').length } };
  } else {
    view = { strategy: 'nenhuma', records: [], visible: 0, excluded: { zonas: 0, vizinhos: 0 } };
  }
  return full ? view : view.records;
}

// 006 D16/FR-029: próxima página de concelhos de um distrito acima do limite do site (1.800 anúncios).
// Encadeia os distritos grandes em ordem de URL, usando a contagem da própria página: nav nacional
// (contagem da sub-região) ou breadcrumb do distrito (contagem de cada distrito; o destacado é a página atual).
const SITE_LISTING_LIMIT = 1800;
// `current`: URL pedida (o site pode redirecionar a página de concelhos de áreas pequenas para a listagem).
function nextExpansionUrl(doc = document, limit = SITE_LISTING_LIMIT, current = null) {
  const base = doc.location?.origin || location.origin;
  const clean = (href) => { try { const u = new URL(href, base); u.hash = ''; u.search = ''; return u.href; } catch { return null; } };
  const count = (t) => { const d = String(t || '').replace(/[^\d]/g, ''); return d ? Number(d) : null; };
  const here = clean(current || doc.location?.href || location.href);
  const big = [];
  const nav = doc.querySelector('nav.locations-list');
  if (nav) {
    nav.querySelectorAll('ul.locations-list__links > li').forEach((li) => {
      const a = li.querySelector(':scope > a.subregion'), n = count(li.querySelector(':scope > p')?.textContent);
      if (a && n > limit) big.push(clean(a.getAttribute('href')));
    });
  } else {
    doc.querySelectorAll('.breadcrumb-dropdown-element').forEach((el) => {
      const n = count(el.querySelector(':scope > .breadcrumb-navigation-sidenote')?.textContent);
      const url = el.classList.contains('highlighted') ? here : clean(el.querySelector(':scope > a')?.getAttribute('href'));
      if (url && n > limit) big.push(url);
    });
  }
  const list = [...new Set(big.filter(u => u && /\/concelhos-freguesias$/.test(new URL(u).pathname)))].sort();
  return nav ? list[0] || null : list.find(u => u > here) || null;
}

// Visão completa (estratégia, contagem visível, excluídos). Não serializada.
function inspectLocalities(doc = document) { return extractLinks(doc, true); }
function extractLocalities(doc = document) { return extractLinks(doc); }

// Exposto no mundo isolado da extensão para scripting.executeScript (coleta-discovery.readPageLocalities).
if (typeof globalThis !== 'undefined') globalThis.__idealistaLocalities = { inspectLocalities, extractLocalities };

module.exports = { extractLinks, extractLocalities, inspectLocalities, nextExpansionUrl, SITE_LISTING_LIMIT };

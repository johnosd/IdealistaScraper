// Fila do Lote derivada dos links de localidades (006). Função pura: sem rede, DOM ou storage.
// Ver .sdd/specs/006-revisao-links-lote-extracao/logic/fila-e-listagem.md.
const {validateBatchURL}=require('./lote-input');

// Converte o link de uma localidade na URL da listagem completa (D2).
// '/x/concelhos-freguesias' -> '/x/'; demais URLs só perdem hash/query e ganham barra final.
function deriveListingURL(linkUrl) {
  const url = new URL(validateBatchURL(linkUrl));
  let path = url.pathname.replace(/\/concelhos-freguesias\/?$/, '/');
  if (!path.endsWith('/')) path += '/';
  return url.origin + path;
}

const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
function linkWithoutHash(value) { const url = new URL(validateBatchURL(value)); url.hash = ''; return url.href; }
function context(record) {
  const tipo = record.Tipo;
  return {
    'Região': text(record['Região']),
    'Sub-região': tipo === 'Região' ? null : text(record['Sub-região']),
    'Município': tipo === 'Município' || tipo === 'Freguesia' ? text(record['Município']) : null
  };
}
function quantity(value) {
  const digits = String(value ?? '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

// records: saída de extractLinks/extractLocalities ({Região, Sub-região, Município, Tipo, Texto, URL, Contagem}).
// Retorna {entries:[{nome,url,linkUrls,aliases,tipo,context,contagem,freguesia?}], rejected:[{record,reason}]}.
function buildBatchQueue(records) {
  if (!Array.isArray(records)) throw new TypeError('Lista de localidades inválida');
  const byListing = new Map(), rejected = [];
  for (const record of records) {
    if (!record || typeof record !== 'object') { rejected.push({ record, reason: 'invalid_record' }); continue; }
    let listing, link;
    try { listing = deriveListingURL(record.URL ?? record.url); link = linkWithoutHash(record.URL ?? record.url); }
    catch { rejected.push({ record, reason: 'invalid_url' }); continue; }
    const nome = text(record.Texto) || text(record['Município']) || text(record['Sub-região']) || text(record['Região']) || listing;
    const known = byListing.get(listing);
    if (known) {
      if (!known.linkUrls.includes(link)) known.linkUrls.push(link);
      if (nome !== known.nome && !known.aliases.includes(nome)) known.aliases.push(nome);
      continue; // primeira ocorrência vence (nome, tipo, contexto)
    }
    const tipo = text(record.Tipo) || 'Localidade';
    const entry = { nome, url: listing, linkUrls: [link], aliases: [], tipo, context: context(record), contagem: quantity(record.Contagem) };
    // Fora de `context` (3 chaves fixas): usado pela Freguesia do anúncio (R4, Fase 8).
    if (tipo === 'Freguesia') entry.freguesia = nome;
    byListing.set(listing, entry);
  }
  return { entries: [...byListing.values()], rejected };
}

// 006 D16/FR-029/030: fila de cobertura sem duplicar listagens, a partir dos registros da coleta de links
// (página nacional + concelhos das páginas de distritos grandes). Unidade = sub-região (distrito/ilha);
// distritos com contagem > limit são substituídos pelos seus concelhos; sem concelhos lidos, o distrito entra inteiro.
function planCoverageQueue(records, { limit = 1800 } = {}) {
  if (!Array.isArray(records)) throw new TypeError('Lista de localidades inválida');
  const valid = records.filter(r => r && typeof r === 'object');
  const rejected = records.filter(r => !r || typeof r !== 'object').map(record => ({ record, reason: 'invalid_record' }));
  const subregions = valid.filter(r => r.Tipo === 'Sub-região');
  const subregionNames = new Set(subregions.map(r => text(r['Sub-região'])).filter(Boolean));
  const regionsWithChildren = new Set(subregions.map(r => text(r['Região'])).filter(Boolean));
  const regionOf = new Map(subregions.map(r => [text(r['Sub-região']), text(r['Região'])]));
  const big = new Set(subregions.filter(r => (quantity(r.Contagem) ?? 0) > limit).map(r => text(r['Sub-região'])));
  // Concelhos lidos das páginas dos distritos grandes: Tipo Município cujo Sub-região é um distrito grande e cuja URL é …/concelhos-freguesias.
  const concelhos = valid.filter(r => r.Tipo === 'Município' && big.has(text(r['Sub-região'])) && /\/concelhos-freguesias\/?$/.test(String(r.URL || '')));
  const expanded = new Set(concelhos.map(r => text(r['Sub-região'])));
  const chosen = [];
  for (const r of valid) {
    const sub = text(r['Sub-região']);
    if (r.Tipo === 'Região') { if (!regionsWithChildren.has(text(r['Região']))) chosen.push({ record: r, path: [text(r['Região'])] }); continue; }
    if (r.Tipo === 'Sub-região') {
      if (!expanded.has(sub)) { chosen.push({ record: r, path: [text(r['Região']), sub], limited: big.has(sub) }); continue; }
      // Distrito grande: seus concelhos entram no lugar dele, preservando a ordem da página.
      for (const k of concelhos.filter(k => text(k['Sub-região']) === sub)) {
        const regiao = text(k['Região']) || regionOf.get(sub) || null;
        chosen.push({ record: { ...k, 'Região': regiao }, path: [regiao, sub, text(k.Texto)] });
      }
      continue;
    }
    if (r.Tipo === 'Município') {
      if (concelhos.includes(r)) continue; // já inseridos no lugar do distrito
      if (!sub || !subregionNames.has(sub)) chosen.push({ record: r, path: [text(r['Região']), sub, text(r.Texto)] }); // sem distrito pai: entra
      continue;
    }
    // Freguesias e outros níveis já estão contidos em distritos/concelhos.
  }
  const { entries, rejected: invalid } = buildBatchQueue(chosen.map(c => c.record));
  const pathOf = new Map(chosen.map(c => { try { return [deriveListingURL(c.record.URL), c]; } catch { return [null, c]; } }));
  for (const entry of entries) {
    const c = pathOf.get(entry.url);
    entry.path = (c?.path || [entry.nome]).filter(Boolean).join(' › ');
    if (c?.limited) entry.expectedLimited = true;
  }
  // R-020: freguesias lidas nas páginas de distrito, por sub-região, como lista de validação (não viram entradas).
  const freguesias = [...new Map(valid.filter(r => r.Tipo === 'Freguesia' && text(r.Texto) && text(r['Sub-região']))
    .map(r => [text(r['Sub-região']) + '|' + text(r.Texto), [text(r.Texto), text(r['Sub-região'])]])).values()];
  return { entries, rejected: [...rejected, ...invalid], freguesias, summary: { freguesias: freguesias.length, subregions: entries.filter(e => e.tipo === 'Sub-região').length, concelhos: concelhos.length, expandedDistricts: [...expanded], unexpandedBig: [...big].filter(d => !expanded.has(d)) } };
}

module.exports = { deriveListingURL, buildBatchQueue, planCoverageQueue };

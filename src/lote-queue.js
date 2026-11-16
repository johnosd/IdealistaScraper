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

module.exports = { deriveListingURL, buildBatchQueue };

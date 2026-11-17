// Classifica a completude de uma listagem concluída (006, FR-014/015).
// Ver .sdd/specs/006-revisao-links-lote-extracao/logic/fila-e-listagem.md §4–5.

// Anúncios entram/saem durante a paginação: pequena diferença não é truncamento.
const tolerance = declared => Math.max(2, Math.ceil(declared * 0.02));

// input: {declaredTotal: number|null, obtained: number, budgetReached: boolean}
// retorna {status:'complete'|'limited', declaredTotal, obtained, reason: null|'site_limit'|'item_budget'}
function assessListing({ declaredTotal = null, obtained = 0, budgetReached = false } = {}) {
  const declared = Number.isSafeInteger(declaredTotal) && declaredTotal >= 0 ? declaredTotal : null;
  const count = Number.isSafeInteger(obtained) && obtained >= 0 ? obtained : 0;
  const base = { declaredTotal: declared, obtained: count };
  if (budgetReached) return { status: 'limited', ...base, reason: 'item_budget' };
  if (declared !== null && count < declared - tolerance(declared)) return { status: 'limited', ...base, reason: 'site_limit' };
  return { status: 'complete', ...base, reason: null };
}

const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
// Contexto geográfico aditivo (US7). Campos existentes do anúncio nunca são alterados; os novos vêm ao final.
// freguesia: valor já validado pelo chamador (entrada do tipo Freguesia ou sufixo do título conferido — R4).
function withContext(record, context, freguesia = null) {
  return {
    ...record,
    'Região': text(context?.['Região']),
    'Sub-região': text(context?.['Sub-região']),
    'Município': text(context?.['Município']),
    'Freguesia': text(freguesia) ?? text(record?.Freguesia)
  };
}

// 006 R4/FR-027: Freguesia só de fonte verificável — a própria entrada (tipo Freguesia) ou o sufixo do
// título (após a última vírgula) quando coincide exatamente com uma freguesia conhecida da mesma fila.
// `known`: Set de nomes, ou Map nome → Set de sub-regiões (R-020: a freguesia precisa ser do distrito da entrada).
function matchFreguesia(item, record, known) {
  if (text(item?.freguesia)) return text(item.freguesia);
  if (!known?.size || typeof record?.Titulo !== 'string') return null;
  const tail = record.Titulo.split(',').pop().trim();
  if (known instanceof Map) {
    const subs = known.get(tail), sub = text(item?.context?.['Sub-região']);
    return subs && (!sub || subs.has(sub)) ? tail : null;
  }
  return known.has(tail) ? tail : null;
}
// Lista de validação por distrito: freguesias da fila (entradas) + pares [nome, sub-região] lidos nas páginas de distrito.
function knownFreguesias(items = [], pairs = []) {
  const map = new Map();
  const add = (nome, sub) => { const n = text(nome); if (!n) return; if (!map.has(n)) map.set(n, new Set()); if (text(sub)) map.get(n).add(text(sub)); };
  for (const item of items) if (text(item?.freguesia)) add(item.freguesia, item.context?.['Sub-região']);
  for (const pair of Array.isArray(pairs) ? pairs : []) if (Array.isArray(pair)) add(pair[0], pair[1]);
  return map;
}

module.exports = { assessListing, withContext, matchFreguesia, knownFreguesias };

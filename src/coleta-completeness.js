// Classifica a completude de uma listagem concluída (006, FR-014/015).
// Ver .sdd/specs/006-revisao-links-lote-extracao/logic/fila-e-listagem.md.

// input: {declaredTotal: number|null, obtained: number, budgetReached: boolean}
// retorna {status:'complete'|'limited', declaredTotal, obtained, reason: null|'site_limit'|'item_budget'}
function assessListing(input) {
  throw new Error('not implemented');
}

// Contexto geográfico aditivo (US7). Campos existentes do anúncio nunca são alterados.
function withContext(record, context) {
  throw new Error('not implemented');
}

module.exports = { assessListing, withContext };

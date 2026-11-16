// Decide a próxima ação automática após uma pausa por bloqueio/espera (006, US5).
// Nunca contorna o bloqueio: só espera o prazo e autoriza uma nova verificação limitada.
// Ver .sdd/specs/006-revisao-links-lote-extracao/logic/recuperacao-de-bloqueio.md.

// input: {state, reason, until, now, rechecks, maxRechecks}
// retorna {action:'renew', until} | {action:'wait', until} | {action:'recheck', until} | {action:'resume', until} | {action:'stop', reason}
function planBlockRecovery(input) {
  throw new Error('not implemented');
}

module.exports = { planBlockRecovery };

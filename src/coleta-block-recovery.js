// Decide a próxima ação automática após uma pausa por bloqueio/espera (006, US5).
// Nunca contorna o bloqueio: só espera o prazo e autoriza uma nova verificação limitada.
// Ver .sdd/specs/006-revisao-links-lote-extracao/logic/recuperacao-de-bloqueio.md.

const FREE_WAITS = new Set(['window_budget', 'server_wait', 'transient', 'interval']);
const NEW_CYCLE = new Set(['run_budget', 'session_duration']);

// input: {state, reason, until, now, rechecks, maxRechecks}
// retorna {action:'renew', until} | {action:'wait', until} | {action:'recheck', until, counts:true}
//       | {action:'resume', until, counts} | {action:'stop', reason}
function planBlockRecovery({ state, reason, until = null, now = Date.now(), rechecks = 0, maxRechecks = 3 } = {}) {
  if (['completed', 'finished-with-pending', 'saved', 'cancelled', 'discarded'].includes(state)) return { action: 'stop', reason: reason ?? null };
  if (state === 'pausing' || reason === 'paused' || reason === 'cancelled') return { action: 'stop', reason: reason ?? 'paused' };
  const at = Number.isFinite(until) && until > now ? until : now;
  if (reason === 'access_blocked') {
    return rechecks < maxRechecks ? { action: 'recheck', until: at, counts: true } : { action: 'stop', reason: 'access_blocked_persistent' };
  }
  if (reason === 'rate_limit') {
    return rechecks < maxRechecks ? { action: 'resume', until: at, counts: true } : { action: 'stop', reason: 'rate_limit_persistent' };
  }
  if (FREE_WAITS.has(reason)) return { action: 'resume', until: at, counts: false };
  if (NEW_CYCLE.has(reason)) return { action: 'renew', until: at, counts: false };
  return { action: 'stop', reason: reason ?? null };
}

module.exports = { planBlockRecovery };

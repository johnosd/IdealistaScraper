const { validateBatchURL } = require('./lote-input');
const UI_ACTIONS = new Set(['GET_POLICY','SET_POLICY','START','READ','LIST','PAUSE','CANCEL','RESUME','DISCARD','SAVE_RESULT','CONFIRM_SAVE_UNKNOWN','TEST_IP','REGISTER','REQUEST','REPORT','READ_HTTP','SAVE_INTENT','GET_INTENT','PROBE_IP']);
UI_ACTIONS.add('ACK_PROJECTION');
UI_ACTIONS.add('SAVE_FAILURE');
const PAGE_ACTIONS = new Set(['HANDSHAKE','PAGE_RESULT','ABORT_ACK','VALIDATE']);
function validateSender(api, message, sender) {
  if(api.runtime.id&&sender?.id!==api.runtime.id)throw new Error('Extensão de origem inválida');
  const base = api.runtime.getURL('');
  const trusted = typeof sender?.url === 'string' && sender.url.startsWith(base) &&
    ['itens.html','lote.html','localidades.html','popup.html','runner.html','configuracoes.html'].includes(new URL(sender.url).pathname.slice(1));
  const action = message?.cmd?.replace(/^COLETA_/, '');
  if (trusted && UI_ACTIONS.has(action)) return { action, owner: String(sender.tab?.id ?? 'popup'), trusted: true };
  if (!trusted && PAGE_ACTIONS.has(action) && sender?.tab?.id && sender.frameId === 0) {
    validateBatchURL(sender.url); return { action, owner: String(sender.tab.id), documentId: sender.documentId, trusted: false };
  }
  throw new Error('Remetente ou ação de coleta não autorizado');
}
function createCollectionClient(api = chrome) {
  return async (action, payload = {}) => {
    const response = await api.runtime.sendMessage({ cmd: `COLETA_${action}`, payload });
    if (!response?.ok) throw new Error(response?.message || 'Não foi possível comunicar com a coleta');
    return response.result;
  };
}
module.exports = { validateSender, createCollectionClient };

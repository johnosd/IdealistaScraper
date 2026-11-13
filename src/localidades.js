const { getMonthlyDestination, exportLocalities } = require('./localidades-export.js');
const { loadDirectory, saveDirectory } = require('./localidades-directory-store.js');
const { collectLocalities } = require('./localidades-collector.js');

const choose = document.getElementById('choose');
const reauthorize = document.getElementById('reauthorize');
const extract = document.getElementById('extract-save');
const save = document.getElementById('save');
const destination = document.getElementById('destination');
const status = document.getElementById('status');
let directory = null;
let permission = 'prompt';
let snapshot = null;
let busy = true;
const capable = typeof window.showDirectoryPicker === 'function' && !!navigator.locks;

function render() {
  choose.disabled = busy || !capable;
  reauthorize.disabled = busy || !directory || permission === 'granted';
  extract.disabled = busy || !directory || permission !== 'granted';
  save.disabled = busy || !snapshot?.records.length || !directory || permission !== 'granted';
  const { relativePath } = getMonthlyDestination(snapshot?.startedAt || new Date());
  destination.textContent = directory ? `Destino: ${directory.name}/${relativePath} · acesso: ${permission}` : 'Destino: nenhuma pasta escolhida';
}
function report(message, state) { status.textContent = message; status.dataset.state = state; render(); }
function failure(error) {
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') permission = 'prompt';
  const prefix = error.name === 'NotAllowedError' ? 'Acesso negado. Reautorize ou troque a pasta.' :
    error.name === 'QuotaExceededError' ? 'Sem espaço para concluir a gravação.' :
    error.name === 'NotFoundError' ? 'Pasta ou arquivo indisponível. Escolha a pasta novamente.' : 'Não foi possível concluir a operação.';
  report(`${prefix} ${error.message}${snapshot?.records.length ? ' Os registros coletados continuam disponíveis nesta página.' : ''}`, 'error');
}

// A chamada ao seletor ocorre diretamente no gesto, antes de qualquer await.
choose.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  try {
    const pending = window.showDirectoryPicker({ id: 'idealista-localidades', mode: 'readwrite' });
    render();
    const selected = await pending;
    const access = await selected.queryPermission({ mode: 'readwrite' });
    if (access !== 'granted') { report('Acesso à nova pasta não autorizado. Destino anterior mantido.', 'cancelled'); return; }
    directory = selected;
    permission = access;
    try {
      await saveDirectory(directory);
      report('Pasta autorizada e memorizada. Pronta para exportar.', 'ready');
    } catch (error) {
      report(`Pasta disponível nesta sessão, mas não foi memorizada: ${error.message}`, 'error');
    }
  } catch (error) {
    if (error.name === 'AbortError') report('Seleção cancelada. Destino anterior mantido.', 'cancelled');
    else failure(error);
  } finally { busy = false; render(); }
});

reauthorize.addEventListener('click', async () => {
  if (busy || !directory) return;
  busy = true;
  try {
    const pending = directory.requestPermission({ mode: 'readwrite' });
    render();
    permission = await pending;
    report(permission === 'granted' ? 'Pasta reautorizada. Você pode salvar os registros já coletados.' : 'Acesso não autorizado. Reautorize ou troque a pasta.', permission === 'granted' ? 'ready-to-save' : 'needs-permission');
  } catch (error) { failure(error); }
  finally { busy = false; render(); }
});

async function writeSnapshot() {
  const target = directory;
  report('Verificando destino e gravando…', 'saving');
  const result = await exportLocalities({ directory: target, records: snapshot.records,
    startedAt: snapshot.startedAt, locks: navigator.locks,
    confirmOverwrite: ({ directoryName, relativePath, total }) => {
      report('Aguardando confirmação de substituição…', 'confirming');
      return window.confirm(`Substituir ${directoryName}/${relativePath} por ${total} registros?\nO conteúdo anterior será substituído integralmente.`);
    } });
  const messages = {
    saved: `${result.total} registros gravados em ${target.name}/${result.relativePath}.`,
    cancelled: 'Substituição cancelada. Arquivo anterior preservado.',
    'permission-required': 'É necessário reautorizar ou trocar a pasta. Os registros coletados foram mantidos.',
    empty: 'Nenhum link encontrado. Nenhum arquivo foi alterado.',
    busy: 'Outra página está gravando. Tente Salvar JSON coletado após a conclusão.',
  };
  if (result.status === 'permission-required') permission = 'prompt';
  if (result.status === 'saved') snapshot = null;
  report(messages[result.status], result.status);
}
extract.addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  // Uma nova coleta só substitui os registros pendentes depois de terminar.
  const startedAt = new Date();
  report('Coletando localidades em uma aba própria…', 'collecting');
  try {
    const records = await collectLocalities();
    snapshot = { startedAt, records };
    await writeSnapshot();
  } catch (error) { failure(error); }
  finally { busy = false; render(); }
});
save.addEventListener('click', async () => {
  if (busy || !snapshot) return;
  busy = true; render();
  try { await writeSnapshot(); } catch (error) { failure(error); }
  finally { busy = false; render(); }
});
window.addEventListener('beforeunload', event => {
  if (busy || snapshot?.records.length) { event.preventDefault(); event.returnValue = ''; }
});

(async () => {
  try {
    if (!capable) throw new Error('Este Chrome não oferece seleção de pasta e Web Locks necessários');
    directory = await loadDirectory();
    if (directory) permission = await directory.queryPermission({ mode: 'readwrite' });
    report(directory ? (permission === 'granted' ? 'Pasta recuperada. Pronta para exportar.' : 'Reautorize ou troque a pasta para continuar.') : 'Escolha a pasta .data/localidades para começar.', directory ? (permission === 'granted' ? 'ready' : 'needs-permission') : 'needs-directory');
  } catch (error) { failure(error); }
  finally { busy = false; render(); }
})();

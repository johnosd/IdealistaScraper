const { parseBatchInput, validateBatchURL } = require('./lote-input');
const { createBatchSession } = require('./lote-session');
const { writeMunicipality } = require('./lote-export');
const { createBatchCollector } = require('./lote-collector');
const { loadDirectory, saveDirectory } = require('./lote-directory-store');

const el = id => document.getElementById(id);
let directory = null, permission = 'prompt', session = null, running = false, paused = false;
let owned = false, releaseOwner = null, ownerRequest = null, configuring = false, initialized = false;
let statuses = [], rawQueue = [], draftWrite = Promise.resolve();
const collect = createBatchCollector(chrome, { useProxy: () => el('loteProxy').checked });

function status(state, text) { el('loteLog').dataset.state = state; el('loteLog').textContent = text; render(); }
function render() {
  const pending = session?.getState().pending;
  el('destination').textContent = directory
    ? `Pasta: ${directory.name} / {YYYYMM} — ${permission === 'granted' ? 'acesso permitido' : 'autorização necessária'}`
    : 'Nenhuma pasta selecionada. Escolha a base .data/municipios.';
  el('loteUrls').disabled = !owned || running || !!session || configuring;
  for (const id of ['choose', 'reauthorize']) el(id).disabled = !owned || running || configuring;
  el('reauthorize').disabled ||= !directory;
  for (const id of ['loteAutoLoad', 'loteProxy']) el(id).disabled = !owned || running || !!session || configuring;
  el('loteClear').disabled = !owned || running || configuring;
  el('loteStart').disabled = !initialized || !owned || running || configuring || !!pending || !directory || permission !== 'granted';
  el('loteStart').textContent = session ? 'Continuar lote' : 'Iniciar lote';
  el('lotePause').disabled = !running;
  el('loteSave').disabled = !owned || running || configuring || !pending;
  el('loteClaim').hidden = owned;
  el('loteClaim').disabled = running || configuring;
  el('loteStatusList').replaceChildren(...statuses.map(item => {
    const li = document.createElement('li'); li.textContent = `${item.nome} — ${item.status}${item.savedAt ? ` — ${item.savedAt} (${item.total} anúncio(s))` : ''}`; return li;
  }));
}
async function acquireOwner() {
  if (owned) return true;
  if (ownerRequest) return false;
  return new Promise((resolve, reject) => {
    ownerRequest = navigator.locks.request('idealista-municipios:batch', { mode: 'exclusive', ifAvailable: true }, async lock => {
      if (!lock) { resolve(false); return; }
      owned = true;
      await new Promise(release => { releaseOwner = release; resolve(true); });
      owned = false; releaseOwner = null;
    }).catch(reject).finally(() => { ownerRequest = null; });
  });
}
async function restoreQueue() {
  const saved = await chrome.storage.local.get(['loteLista', 'loteStatusArr', 'usarProxy']);
  el('loteUrls').value = typeof saved.loteLista === 'string' ? saved.loteLista : saved.loteLista ? JSON.stringify(saved.loteLista, null, 2) : '';
  statuses = Array.isArray(saved.loteStatusArr) ? saved.loteStatusArr : [];
  el('loteProxy').checked = saved.usarProxy === 'true';
}
function originalItems(text) {
  try { return JSON.parse(text); } catch { return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean); }
}

el('loteClaim').addEventListener('click', async () => {
  try {
    if (!await acquireOwner()) return status('busy', 'Outra tela controla o lote. Volte à tela aberta ou feche-a para ativar esta.');
    await restoreQueue(); status('ready', 'Tela ativada. A fila foi atualizada.');
  } catch (error) { status('error', error.message); }
});
el('choose').addEventListener('click', async () => {
  if (!owned || running || configuring) return;
  // Chamar antes de qualquer await para manter a ativação transitória.
  const selection = window.showDirectoryPicker({ id: 'idealista-municipios', mode: 'readwrite' });
  configuring = true; render();
  try {
    const chosen = await selection;
    const access = await chosen.queryPermission({ mode: 'readwrite' });
    directory = chosen; permission = access;
    try { await saveDirectory(chosen); status(access === 'granted' ? 'ready' : 'permission-required', 'Pasta selecionada.'); }
    catch { status('error', 'Pasta disponível nesta tela, mas não foi memorizada. Escolha novamente ao reabrir.'); }
  } catch (error) { status(error.name === 'AbortError' ? 'cancelled' : 'error', error.name === 'AbortError' ? 'Seleção cancelada; pasta anterior mantida.' : error.message); }
  finally { configuring = false; render(); }
});
el('reauthorize').addEventListener('click', async () => {
  if (!owned || !directory || running || configuring) return;
  const request = directory.requestPermission({ mode: 'readwrite' });
  configuring = true; render();
  try { permission = await request; status(permission === 'granted' ? 'ready' : 'permission-required', permission === 'granted' ? 'Acesso recuperado. Pode salvar o resultado pendente.' : 'Acesso não concedido. Resultado mantido nesta tela.'); }
  catch (error) { status('error', error.message); }
  finally { configuring = false; render(); }
});
el('loteUrls').addEventListener('input', () => {
  if (!owned || session || running) return;
  const value = el('loteUrls').value;
  draftWrite = draftWrite.then(() => chrome.storage.local.set({ loteLista: value })).catch(() => status('error', 'Não foi possível memorizar a lista. O texto permanece nesta tela.'));
});
el('loteProxy').addEventListener('change', async () => {
  if (!owned || running || session) return;
  try { await chrome.storage.local.set({ usarProxy: el('loteProxy').checked ? 'true' : 'false' }); }
  catch { status('error', 'Não foi possível memorizar a preferência de proxy.'); }
});
el('loteClear').addEventListener('click', async () => {
  if (!owned || running || configuring) return;
  if (!confirm('Descartar a fila e os resultados ainda não salvos desta tela?')) return;
  try {
    await draftWrite;
    await chrome.storage.local.remove(['loteLista', 'loteStatusArr', 'loteProcessamento']);
    session = null; statuses = []; rawQueue = []; el('loteUrls').value = ''; status('ready', 'Lista limpa. Arquivos existentes foram preservados.');
  } catch { status('error', 'Falha ao limpar. Dados mantidos nesta tela.'); }
});
el('lotePause').addEventListener('click', () => { paused = true; status('pausing', 'Pausa solicitada; aguardando este item.'); });

async function run() {
  if (running || configuring) return;
  // Validar antes de adquirir controle ou modificar storage/status.
  let items;
  if (!session) {
    try { items = parseBatchInput(el('loteUrls').value); }
    catch (error) { status('error', `Lista inválida. ${error.message}`); return; }
  }
  running = true; render();
  try {
    if (!await acquireOwner()) return status('busy', 'Outra tela controla o lote. Volte à tela aberta.');
    if (!directory || await directory.queryPermission({ mode: 'readwrite' }) !== 'granted') {
      permission = 'prompt'; return status('permission-required', 'Autorize a pasta antes de iniciar ou continuar.');
    }
    await draftWrite;
    if (!session) {
      rawQueue = originalItems(el('loteUrls').value);
      statuses = items.map(item => ({ nome: item.nome, link: item.url, status: 'Pendente' }));
      const startedAt = new Date();
      await chrome.storage.local.set({ loteLista: rawQueue, loteStatusArr: statuses, loteProcessamento: true });
      session = createBatchSession({ items, startedAt, collect,
        save: async pending => {
          const target = directory;
          const result = await writeMunicipality({ directory: target, records: pending.records, startedAt: pending.startedAt, nome: pending.item.nome, totalPages: pending.totalPages, locks: navigator.locks });
          return { ...result, directoryName: target.name };
        },
        commit: async ({ remaining }) => {
          const nextQueue = rawQueue.slice(1);
          const index = statuses.length - rawQueue.length;
          const nextStatuses = statuses.map((row, i) => i === index ? { ...row, status: 'Sucesso' } : row);
          await chrome.storage.local.set({ loteLista: nextQueue, loteStatusArr: nextStatuses, loteProcessamento: remaining.length > 0 });
          rawQueue = nextQueue; statuses = nextStatuses;
          el('loteUrls').value = nextQueue.length ? JSON.stringify(nextQueue, null, 2) : '';
        },
      });
    }
    running = true; paused = false; render();
    while (session.getState().remaining.length) {
      const current = session.getState();
      const index = statuses.length - current.remaining.length;
      statuses[index].status = current.pending ? 'Salvando' : 'Processando';
      status('running', `${current.pending ? 'Salvando' : 'Coletando'}: ${current.remaining[0].nome}`);
      const result = await session.advance();
      if (result?.status !== 'saved') {
        statuses[index].status = 'Aguardando gravação';
        if (result?.status === 'permission-required') permission = 'prompt';
        status(result?.status || 'error', 'Resultado não salvo. A fila e os dados coletados foram mantidos. Autorize/troque a pasta e tente salvar novamente.');
        return;
      }
      statuses[index].savedAt = `${result.directoryName}/${result.relativePath}`;
      statuses[index].total = result.total;
      status('saved', `Salvo: ${result.directoryName}/${result.relativePath} — ${result.total} anúncio(s).`);
      if (paused && session.getState().remaining.length) { status('paused', 'Lote pausado. Continuar mantém o mês inicial.'); return; }
    }
    session = null;
    status('complete', 'Lote concluído. Todos os arquivos foram salvos.');
    // Liberar a propriedade da fila; nova ação pode reivindicar a tela.
    releaseOwner?.();
    owned = false;
  } catch (error) {
    const current = session?.getState();
    if (current?.remaining.length) statuses[statuses.length - current.remaining.length].status = current.pending ? 'Aguardando gravação' : 'Erro de coleta';
    status('error', `${error.message}\nItem mantido na fila. ${current?.pending ? 'Use Tentar salvar novamente.' : 'Use Continuar lote para tentar este item novamente.'}`);
  } finally { running = false; render(); }
}
el('loteStart').addEventListener('click', run);
el('loteSave').addEventListener('click', run);

el('loteAutoLoad').addEventListener('click', async () => {
  if (!owned || running || session) return;
  try {
    const sourceTabId = Number(new URL(location.href).searchParams.get('sourceTabId'));
    if (!Number.isInteger(sourceTabId) || sourceTabId <= 0) throw new Error('Abra esta tela pelo popup na página de localidades.');
    const source = await chrome.tabs.get(sourceTabId); validateBatchURL(source.url);
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: sourceTabId }, func: () => {
      return [...document.querySelectorAll('.breadcrumb-dropdown-element.highlighted ul.breadcrumb-dropdown-subitem-list > li')].flatMap(item => {
        const anchor = item.querySelector('a'), count = item.querySelector('.breadcrumb-navigation-sidenote');
        const quantidade = parseInt(count?.textContent.replace(/[^\d]/g, '') || '', 10);
        return anchor && Number.isFinite(quantidade) ? [{ nome: anchor.textContent.trim(), link: anchor.href, quantidade }] : [];
      }).sort((a, b) => b.quantidade - a.quantidade);
    } });
    if (!result?.length) throw new Error('Nenhuma localidade encontrada na página de origem.');
    await chrome.storage.local.set({ loteLista: result });
    el('loteUrls').value = JSON.stringify(result, null, 2); status('ready', `${result.length} localidades carregadas.`);
  } catch (error) { status('error', error.message); }
});
window.addEventListener('beforeunload', event => {
  if (running || session?.getState().pending) { event.preventDefault(); event.returnValue = ''; }
});
(async () => {
  try {
    await acquireOwner(); await restoreQueue();
    directory = await loadDirectory();
    if (directory) permission = await directory.queryPermission({ mode: 'readwrite' });
    status(owned ? (directory ? (permission === 'granted' ? 'ready' : 'permission-required') : 'needs-directory') : 'busy', owned ? 'Pronto. Selecione uma pasta e cole a lista.' : 'Outra tela controla a fila. Esta tela está somente para leitura.');
  } catch (error) { status('error', error.message); }
  finally { initialized = true; render(); }
})();

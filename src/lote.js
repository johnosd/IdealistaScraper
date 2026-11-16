const { parseBatchInput, validateBatchURL } = require('./lote-input');
const { writeMunicipality } = require('./lote-export');
const { mountCollectionUI } = require('./coleta-ui');
const { reconcileDirectory } = require('./coleta-runner');
const { getMunicipalityDestination } = require('./lote-export');
const { loadDirectory, saveDirectory } = require('./lote-directory-store');
const {readSourceLocalities}=require('./coleta-discovery');
document.getElementById('autonomousStart')?.addEventListener('click',async event=>{
  event.target.disabled=true;
  try{
    const tabId=Number(new URL(location.href).searchParams.get('sourceTabId'));
    const response=await chrome.runtime.sendMessage({cmd:'AUTONOMA_START',payload:{commandId:crypto.randomUUID(),source:{tabId}}});
    if(!response?.ok)throw new Error('Não foi possível iniciar. Confira a página e a pasta.');
    const r=response.result;status(r.status,r.status==='accepted'?'Coleta autônoma iniciada. Acompanhe pelo painel da extensão.':r.status==='busy'?'Outra coleta está ativa.':'Configure ou autorize a pasta de anúncios antes de iniciar.');
  }catch(error){status('error',error.message);}finally{event.target.disabled=false;}
});

const el = id => document.getElementById(id);
let directory = null, permission = 'prompt', session = null, running = false, paused = false;
let owned = false, releaseOwner = null, ownerRequest = null, configuring = false, initialized = false;
let statuses = [], rawQueue = [], draftWrite = Promise.resolve();
let panel, completedSessionId=null;

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
      owned = false; releaseOwner = null;panel?.refresh().catch(()=>{});
    }).catch(reject).finally(() => { ownerRequest = null; });
  });
}
async function restoreQueue() {
  const saved = await chrome.storage.local.get(['loteLista', 'loteStatusArr', 'usarProxy']);
  el('loteUrls').value = typeof saved.loteLista === 'string' ? saved.loteLista : saved.loteLista ? JSON.stringify(saved.loteLista, null, 2) : '';
  statuses = Array.isArray(saved.loteStatusArr) ? saved.loteStatusArr : [];
  el('loteProxy').checked = saved.usarProxy === 'true';
  const restartParams=new URL(location.href).searchParams;
  if(owned&&restartParams.has('restartRun')&&restartParams.has('restartItem')){
    const r=await chrome.runtime.sendMessage({cmd:'AUTONOMA_READ_ITEM',payload:{id:restartParams.get('restartRun'),itemId:restartParams.get('restartItem')}});
    if(!r?.ok||!r.result)throw Error('Não foi possível preparar esta localidade. O progresso anterior foi preservado.');
    el('loteUrls').value=JSON.stringify([{nome:r.result.nome,link:r.result.url}],null,2);statuses=[];
  }
}
function originalItems(text) {
  try { return JSON.parse(text); } catch { return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean); }
}

el('loteClaim').addEventListener('click', async () => {
  try {
    if (!await acquireOwner()) return status('busy', 'Outra tela controla o lote. Volte à tela aberta ou feche-a para ativar esta.');
    await restoreQueue();await panel.refresh();status('ready', 'Tela ativada. A fila foi atualizada.');
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
    if(panel.id){await panel.stop('DISCARD');panel.reset();}
    await chrome.storage.local.remove(['loteLista', 'loteStatusArr', 'loteProcessamento']);
    session = null; statuses = []; rawQueue = []; el('loteUrls').value = ''; status('ready', 'Lista limpa. Arquivos existentes foram preservados.');
  } catch { status('error', 'Falha ao limpar. Dados mantidos nesta tela.'); }
});
el('lotePause').addEventListener('click', () => panel.stop().catch(error=>status('error',error.message)));

function fixedDate(view) { const ym=view.exportContext.yearMonth;return new Date(Number(ym.slice(0,4)),Number(ym.slice(4))-1,1); }
panel=mountCollectionUI({mode:'lote',showSettings:false,canMutate:()=>owned,
  destination:view=>getMunicipalityDestination({startedAt:fixedDate(view),nome:view.items[view.itemIndex].nome,totalPages:view.checkpoint.confirmedPages}).relativePath,
  save:async view=>{
    if(!owned)throw new Error('Ative esta tela para adquirir o controle da fila.');
    const target=directory,item=view.items[view.itemIndex];
    const result=await writeMunicipality({directory:target,records:view.checkpoint.records,startedAt:fixedDate(view),nome:item.nome,totalPages:view.checkpoint.confirmedPages,locks:navigator.locks});
    if(result.status==='permission-required')permission='prompt';
    return {...result,directoryName:target?.name};
  },
  reconcile:(view,intent)=>reconcileDirectory(directory,intent),
  async onSaved(view,result){
    if(!owned)throw new Error('Ative esta tela para adquirir o controle da fila.');
    let queue;try{queue=originalItems(el('loteUrls').value);}catch{queue=[];}
    const remaining=view.items.slice(view.itemIndex+1);
    try{const parsed=parseBatchInput(JSON.stringify(queue));queue=parsed[0]?.url===view.items[view.itemIndex].url?queue.slice(1):remaining;}catch{queue=remaining;}
    statuses=view.items.map((item,i)=>({nome:item.nome,link:item.url,status:i<=view.itemIndex?'Sucesso':'Pendente',...(i===view.itemIndex?{savedAt:result.directoryName?`${result.directoryName}/${result.relativePath}`:result.relativePath,total:view.checkpoint.recordCount}:{})}));
    await chrome.storage.local.set({loteLista:queue,loteStatusArr:statuses,loteProcessamento:remaining.length>0});
    completedSessionId=view.id;
    rawQueue=queue;el('loteUrls').value=queue.length?JSON.stringify(queue,null,2):'';render();
  },
  onState(view,extra){
    if(!panel)return;
    running=panel.running;
    session=view&&(view.pendingProjection||!['saved','discarded','cancelled'].includes(view.state))?{getState:()=>({pending:view.state==='awaiting-save'||view.pendingProjection?{}:null})}:null;
    if(view?.pendingProjection)status('pending','Arquivo confirmado; atualização da fila pendente. Use Salvar para concluir sem recoletar.');
    else if(view?.state==='saved'){status('complete','Lote concluído. Todos os arquivos foram confirmados.');if(completedSessionId===view.id){completedSessionId=null;releaseOwner?.();}}
    else if(view?.state==='awaiting-save')status('permission-required','Resultado completo preservado. Salve ou confira a gravação anterior.');
    else if(view)status(view.state,`Item ${Math.min(view.itemIndex+1,view.items.length)} de ${view.items.length}. Páginas confirmadas: ${view.checkpoint.confirmedPages}. Consulte o controle de coleta abaixo.`);
    render();
  }
});
async function run(){
  if(!owned||running||configuring)return;
  try{
    if(!directory||await directory.queryPermission({mode:'readwrite'})!=='granted'){permission='prompt';status('permission-required','Autorize a pasta antes de continuar.');return;}
    await draftWrite;
    if(panel.id&&session){
      if(session.getState().pending)await panel.save(true);else await panel.resume(panel.id);
    }else{
      const items=parseBatchInput(el('loteUrls').value);rawQueue=originalItems(el('loteUrls').value);
      await panel.start(items,el('loteProxy').checked);
    }
    await panel.refreshSessions();
  }catch(error){status('error',error.message);}finally{running=false;render();}
}
el('loteStart').addEventListener('click', run);
el('loteSave').addEventListener('click', run);

el('loteAutoLoad').addEventListener('click', async () => {
  if (!owned || running || session) return;
  try {
    const sourceTabId = Number(new URL(location.href).searchParams.get('sourceTabId'));
    if (!Number.isInteger(sourceTabId) || sourceTabId <= 0) throw new Error('Abra esta tela pelo popup na página de localidades.');
    const source = await chrome.tabs.get(sourceTabId); validateBatchURL(source.url);
    const found = (await readSourceLocalities(chrome, sourceTabId))?.result?.items;
    const result=found?.map(item=>({nome:item.nome,link:item.url,quantidade:item.quantidade})).sort((a,b)=>(b.quantidade??-1)-(a.quantidade??-1));
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
  finally { initialized = true;render();await panel.refresh().catch(()=>{}); }
})();

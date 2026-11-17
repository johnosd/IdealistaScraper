const {buildCollectionView}=require('./coleta-view-model');
const {REASONS,STATES}=require('./coleta-labels');
const {loadDirectory,saveDirectory:storeDirectory}=require('./lote-directory-store');
// 006 (pedido do usuário): resumo da fila final que o Lote vai coletar.
function queueText(view){
 const p=view?.prepared;if(!p||!Number.isInteger(p.entries))return '';
 const s=p.summary,n=p.entries;
 return n+(n===1?' localidade pronta':' localidades prontas')+' para o Lote'+(s?' ('+s.subregions+' distritos/ilhas'+(s.concelhos?' + '+s.concelhos+' concelhos':'')+')':'')+', sem repetir listagens.';
}
// 006 FR-004/FR-028: origem usada e contagem visível × coletada, com aviso explícito quando diferir.
function linksAuditText(view){
 const audit=view?.audit,parts=[];
 if(view?.origin?.nome)parts.push(' Origem: '+view.origin.nome+'.');
 if(audit&&Number.isInteger(audit.visible)){
  parts.push(' '+(audit.collected??view.total)+' de '+audit.visible+' links de localidades da página.');
  if((audit.collected??view.total)!==audit.visible)parts.push(' Atenção: a quantidade coletada difere da exibida na página.');
  const extra=Number.isInteger(view.total)&&Number.isInteger(audit.collected)?view.total-audit.collected:0;
  if(extra>0)parts.push(' + '+extra+' concelhos e freguesias lidos nas páginas dos distritos (concelhos dividem os distritos acima de 1.800 anúncios; freguesias validam o campo Freguesia).');
  const out=[audit.excluded?.zonas?audit.excluded.zonas+' zonas de interesse':null,audit.excluded?.vizinhos?audit.excluded.vizinhos+' distritos vizinhos':null].filter(Boolean);
  if(out.length)parts.push(' Não incluídos: '+out.join(' e ')+'.');
 }
 return parts.join('');
}
// 006 FR-014/015/016: completude por localidade; nunca "captura integral" para listagem limitada.
function completenessText(item){
 const c=item?.completeness;if(!c)return '';
 if(c.status==='limited'){
  const of=Number.isInteger(c.declaredTotal)?' ('+c.obtained+' de '+c.declaredTotal+' anúncios declarados)':' ('+c.obtained+' anúncios)';
  return c.reason==='item_budget'?' · Limitada pelo limite de páginas por localidade'+of:' · Limitada pelo site'+of;
 }
 return Number.isInteger(c.declaredTotal)?' · Completa ('+c.obtained+' de '+c.declaredTotal+' declarados)':' · Completa';
}
function runExtrasText(run){
 const parts=[];
 if(run?.dedup?.unique)parts.push(run.dedup.unique+' anúncios únicos'+(()=>{const r=Object.values(run.dedup.items||{}).reduce((n,d)=>n+(d.repeated||0),0);return r?' · '+r+' repetidos entre localidades':'';})());
 if(run?.limitedCount)parts.push(run.limitedCount+(run.limitedCount===1?' listagem limitada':' listagens limitadas'));
 // 006 R-011: com ciclos automáticos, mostrar o ciclo atual e o total de páginas da execução.
 if(run?.cycle)parts.push('ciclo '+(run.cycle+1)+' · '+(run.counters?.confirmed??0)+' páginas confirmadas no total');
 return parts.length?' · '+parts.join(' · '):'';
}
// 006 (pedido do usuário): contador regressivo para qualquer espera com prazo conhecido (atualizado a cada 1 s).
function remainingText(until,now=Date.now()){
 const s=Math.max(0,Math.ceil((until-now)/1000));if(!s)return 'instantes';
 if(s<60)return s+' s';
 const m=Math.floor(s/60),r=s%60;if(m<60)return m+' min '+String(r).padStart(2,'0')+' s';
 return Math.floor(m/60)+' h '+String(m%60).padStart(2,'0')+' min';
}
// 006 US5: espera automática agendada pelo runQueue (motivo + horário; sem contagem inventada).
const AUTO_REASONS={access_blocked:'Nova verificação automática do acesso',rate_limit:'Nova tentativa automática',window_budget:'Retomada automática (limite por hora)',server_wait:'Retomada automática',transient:'Nova tentativa automática',interval:'Retomada automática',run_budget:'Novo ciclo automático',session_duration:'Novo ciclo automático'};
function autoWaitText(run,now=Date.now()){
 const a=run?.autoRecovery;if(!a||!(a.until>now)||!AUTO_REASONS[run.reason]||!['paused','interrupted','blocked','waiting'].includes(run.state))return '';
 return AUTO_REASONS[run.reason]+' em '+remainingText(a.until,now)+' (às '+new Date(a.until).toLocaleTimeString('pt-BR')+'). A coleta seguirá sozinha; nenhuma ação é necessária.';
}
function summaryText(counts){return (counts.saved+counts.empty)+' de '+counts.total+' concluídas · '+counts.inProgress+' em andamento · '+counts.queued+' a iniciar · '+counts.pending+' pendentes';}
function mountSidePanel({api=chrome,doc=document,readDirectory=loadDirectory,saveDirectory=storeDirectory}={}){
 const el=id=>doc.getElementById(id),rows=new Map(),context={selectedId:null,filter:'all',query:'',expanded:[],ready:false,tab:'lote'};let runs=[],run=null,source=null,prepared=null,ready={configured:false},active=null,busy=false,disposed=false,refreshing=false,timer=null,saveTimer=null,linksStarting=false,linksWorking=false,linksSignature='';
 const tabs=['links','itens','lote'];
 let linksRead=0,linksRecovery=null,linksWaitUntil=0,linksResumable=false,linksResumeReason=null;
 function activateTab(key,focus=false){if(!tabs.includes(key))key='lote';context.tab=key;for(const name of tabs){el('tab-'+name).setAttribute('aria-selected',String(name===key));el('tab-'+name).setAttribute('tabindex',name===key?'0':'-1');el('panel-'+name).hidden=name!==key;}el('global-run-indicator').hidden=key==='lote'||!active;if(focus)el('tab-'+key).focus();}
 async function rpc(action,payload={}){const r=await api.runtime.sendMessage({cmd:'AUTONOMA_'+action,payload});if(!r?.ok)throw Error('Não foi possível atualizar a coleta. Tente novamente.');return r.result;}
 function feedback(text){el('feedback').textContent=text;el('feedback').hidden=!text;}
 async function flushContext(){clearTimeout(saveTimer);try{await api.storage.local.set({autonomousUI:{...context,scroll:doc.defaultView.scrollY}});return true;}catch{feedback('O progresso segue salvo; o contexto visual não pôde ser memorizado.');return false;}}
 function saveContext(){clearTimeout(saveTimer);saveTimer=setTimeout(flushContext,150);}
 async function refreshLinks(){
  if(context.tab!=='links')return;
  const read=++linksRead,view=await rpc('LINKS_READ');if(read!==linksRead)return;
  const working=['preparing','running','waiting'].includes(view.state);
  linksRecovery=view.recovery==='confirm-access'&&!view.id?'confirm-access':null;linksWaitUntil=Number.isFinite(view.until)?view.until:0;
  const recoveringWait=linksRecovery&&linksWaitUntil>Date.now();
  linksWorking=working;el('tool-links-open').disabled=linksStarting||working||!!recoveringWait;
  // 006: coleta de links pausada é retomada pelo próprio botão (sem abrir a tela de exportação/pastas).
  linksResumable=!!view.id&&['paused','blocked','interrupted'].includes(view.state)&&!view.auto;linksResumeReason=view.reason;
  const resumeWait=linksResumable&&Number.isFinite(view.until)&&view.until>Date.now();
  if(resumeWait)el('tool-links-open').disabled=true;
  el('tool-links-open').textContent=linksRecovery?(recoveringWait?'Aguarde o período de espera':'Conferir acesso e coletar links'):linksResumable?(resumeWait?'Retomar coleta de links (aguarde '+remainingText(view.until)+')':'Retomar coleta de links'):'Coletar links de localidades';
  const reason=REASONS[view.reason]||'Coleta pausada. Confira os detalhes antes de continuar.';
  const labels={idle:'Pronto para coletar.',preparing:'Preparando a coleta…',running:'Navegando no Idealista e coletando localidades…',waiting:Number.isFinite(view.until)&&view.until>Date.now()?'Aguardando o intervalo permitido: próxima página em '+remainingText(view.until)+'. A coleta continuará sozinha.':'Aguardando o intervalo permitido; a coleta continuará.',collected:queueText(view)||view.total+' localidades coletadas. O resultado está preservado.',saved:'Resultado salvo.',paused:reason,blocked:reason,interrupted:'Coleta interrompida. O progresso foi preservado.',cancelled:'Coleta cancelada. O progresso foi preservado.',error:REASONS[view.reason]||REASONS.collector_start_failed};
  let text=labels[view.state]||'Confira a coleta antes de continuar.';
  if(view.state==='collected'||view.state==='saved')text+=linksAuditText(view);
  if(linksRecovery)text=recoveringWait?'Uma tentativa anterior foi bloqueada. Aguarde o período de espera antes de tentar novamente.':'Uma tentativa anterior foi bloqueada. Se a página já abre normalmente, clique em “Conferir acesso e coletar links” e confirme para iniciar uma nova tentativa.';
  if(['paused','blocked','interrupted'].includes(view.state)){
   if(view.status)text+=' HTTP '+view.status+'.';
   if(Number.isFinite(view.until)&&view.until>Date.now())text+=view.auto?' Nova tentativa automática em '+remainingText(view.until)+' (às '+new Date(view.until).toLocaleTimeString('pt-BR')+'); não é preciso clicar.':' Retomada disponível em '+remainingText(view.until)+' (às '+new Date(view.until).toLocaleString()+').';
  }
  if(el('links-status').textContent!==text)el('links-status').textContent=text;
  el('links-save').hidden=!view.id||!['collected','saved'].includes(view.state);
  el('links-details').hidden=view.reason!=='session_capacity';
  el('links-details').textContent=view.id?'Ver detalhes e retomar':'Gerenciar sessões de Links';
  // 006 (pedido do usuário): mostrar a fila final (a mesma do Lote, com caminho); a leitura bruta fica só como fallback.
  const queue=view.prepared?.queue;
  const rows=queue?queue.map(q=>({label:q.path,url:q.url,hint:(()=>{try{return new URL(q.url).pathname;}catch{return q.url;}})()})):(view.records||[]).map(r=>({label:r.nome,url:r.url,hint:r.tipo}));
  const signature=JSON.stringify(rows);if(signature!==linksSignature){linksSignature=signature;el('links-results').replaceChildren(...rows.map(row=>{const li=doc.createElement('li'),a=doc.createElement('a');a.href=row.url;a.target='_blank';a.rel='noopener';a.textContent=row.label;const type=doc.createElement('span');type.className='hint';type.textContent=' '+row.hint;li.append(a,type);return li;}));}
 }
 async function chooseAdsFolder(){
  if(busy)return;busy=true;
  try{
   const current=await readDirectory().catch(()=>null);
   if(current&&await current.queryPermission({mode:'readwrite'})!=='granted'&&await current.requestPermission({mode:'readwrite'})==='granted'){feedback('Acesso à pasta '+current.name+' autorizado. Agora clique em Iniciar coleta.');return;}
   const picker=doc.defaultView.showDirectoryPicker;if(typeof picker!=='function'){feedback('O seletor de pasta não está disponível aqui. Use Configurações (no topo do painel).');return;}
   const dir=await picker.call(doc.defaultView,{id:'idealista-municipios',mode:'readwrite'});
   if(await dir.queryPermission({mode:'readwrite'})!=='granted'&&await dir.requestPermission({mode:'readwrite'})!=='granted'){feedback('Sem permissão de escrita na pasta escolhida. Tente de novo e permita salvar.');return;}
   await saveDirectory(dir);feedback('Pasta de anúncios: '+dir.name+'. Agora clique em Iniciar coleta.');
  }catch(error){feedback(error?.name==='AbortError'?'Nenhuma pasta escolhida. Clique em Configurar pasta quando quiser.':'Não foi possível escolher a pasta aqui. Use Configurações (no topo do painel).');}
  finally{busy=false;await refresh();}
 }
 async function configure(itemId){if(!await flushContext())return;const q=new URLSearchParams();if(run?.id&&itemId)q.set('runId',run.id);if(itemId)q.set('itemId',itemId);doc.defaultView.location.href=api.runtime.getURL('configuracoes.html')+(q.size?'?'+q:'');}
 async function ask(title,message,label='Confirmar'){
  const dialog=el('confirm-dialog'),previous=doc.activeElement;el('confirm-title').textContent=title;el('confirm-message').textContent=message;el('confirm-ok').textContent=label;
  return new Promise(resolve=>{dialog.addEventListener('close',()=>{previous?.focus();resolve(dialog.returnValue==='confirm');},{once:true});dialog.showModal();});
 }
 async function command(action,payload={}){
  if(busy)return;busy=true;el('primary-action').disabled=true;feedback(action==='PAUSE'?'Pausando com segurança…':'Preparando coleta…');
  try{
   const result=await rpc(action,payload);
   if(result.id){context.selectedId=result.id;context.ready=false;}
   if(['accepted','started','pausing','paused','discarded','saved'].includes(result.status))feedback('');
   else if(result.status==='wait')feedback('Aguarde até '+new Date(result.until).toLocaleTimeString('pt-BR')+' e retome manualmente.');
   else if(result.status==='busy')feedback('Outra coleta ainda está ativa. Pause ou aguarde antes de continuar.');
   // 006 FR-005/007: orientar sem abrir Configurações sozinho; a ação "Configurar pasta" fica em destaque.
   else if(result.status==='needs-configuration'){ready={...ready,configured:false};feedback('Falta autorizar a pasta de anúncios. Use “Configurar pasta” para fazer a configuração inicial; nenhuma página foi coletada.');}
   else if(result.status==='incompatible')feedback('O progresso salvo não pode ser retomado neste contexto. Confira os detalhes ou descarte explicitamente.');
   else feedback(REASONS[result.reason]||'Não foi possível concluir esta ação. O progresso confirmado foi preservado.');
  }catch(error){feedback(error.message);}finally{busy=false;saveContext();await refresh();}
 }
 async function resume(selection,retrySave=false){
  if(active&&active.id!==run?.id){feedback('Outra coleta está ativa. Pause ou aguarde antes de retomar esta.');return;}
  // 006: retomar durante uma espera (janela/limite) é permitido; o executor espera o prazo sozinho, com contador.
  if(run?.eligibility?.until>Date.now()&&['rate_limit','window_budget'].includes(run.reason))feedback('Retomando: a coleta aguarda '+remainingText(run.eligibility.until)+' e continua sozinha.');
  const accessConfirmed=run?.reason==='access_blocked'?await ask('Conferir acesso','Você abriu a página e conferiu que pode continuar? A espera obrigatória será respeitada.','Já conferi; retomar'):false;
  if(run?.reason==='access_blocked'&&!accessConfirmed)return;
  await command('RESUME',{id:run.id,selection,retrySave,accessConfirmed});
 }
 function createRow(item){
  const li=doc.createElement('li');li.className='locality';li.dataset.itemId=item.id;
  const details=doc.createElement('details'),summary=doc.createElement('summary'),heading=doc.createElement('span'),name=doc.createElement('span'),state=doc.createElement('span'),count=doc.createElement('span'),body=doc.createElement('div'),reason=doc.createElement('p'),progress=doc.createElement('p'),origin=doc.createElement('p'),file=doc.createElement('p'),buttons=doc.createElement('div'),resumeButton=doc.createElement('button'),folder=doc.createElement('button'),discard=doc.createElement('button');
  heading.className='item-heading';name.className='item-name';state.className='item-status';count.className='item-count';body.className='item-body';buttons.className='item-actions';
  heading.append(name,state);summary.append(heading,count);details.append(summary,body);body.append(reason,progress,origin,file,buttons);buttons.append(resumeButton,folder,discard);li.append(details);
  resumeButton.addEventListener('click',()=>{const latest=run?.items.find(i=>i.id===item.id);resume({itemId:item.id},latest?.stage==='save');});
  folder.textContent='Resolver destino';folder.addEventListener('click',()=>configure(item.id));
  discard.textContent='Descartar dados';discard.addEventListener('click',async()=>{if(await ask('Descartar dados de '+item.nome+'?','Os dados recuperáveis desta localidade serão removidos. Arquivos já salvos serão preservados.','Descartar dados'))await command('DISCARD',{id:run.id,itemId:item.id,confirmed:true});});
  const restart=doc.createElement('button');restart.textContent='Preparar nova coleta';buttons.append(restart);
  restart.addEventListener('click',async()=>{if(active)return;if(await ask('Nova coleta de '+item.nome+'?','Será preparada uma nova fila somente para esta localidade, com mês e destino atuais. O progresso anterior será preservado. Arquivo de mesmo nome no destino será substituído ao salvar.','Preparar nova coleta'))await api.tabs.create({url:api.runtime.getURL('lote.html')+'?restartRun='+encodeURIComponent(run.id)+'&restartItem='+encodeURIComponent(item.id),active:true});});
  details.open=context.expanded.includes(item.id);
  details.addEventListener('toggle',()=>{context.expanded=[...rows.entries()].filter(([,r])=>r.details.open).map(([id])=>id);saveContext();});
  const record={li,details,name,state,count,reason,progress,origin,file,resumeButton,folder,discard,restart};rows.set(item.id,record);return record;
 }
 function render(){
  const model=buildCollectionView({run,filter:context.filter,query:context.query,ready});
  activateTab(context.tab);el('collection-intro').hidden=!!run;
  el('ready-card').hidden=!!run;el('run-card').hidden=!run;el('localities-section').hidden=!run||!run.items.length;
  el('ready-source').textContent=prepared?'Fila preparada pelos Links':source?new URL(source.url).pathname:'Abra no Idealista uma página que liste localidades, ou colete os links na aba Links.';
  el('ready-destination').textContent=ready.name?ready.name+' / mês da coleta':'Nenhuma pasta autorizada';
  el('ready-help').textContent=!ready.configured?'Configure uma vez a pasta de anúncios para começar.':prepared?'Serão coletadas as localidades da fila abaixo.':'Serão coletadas as localidades diretamente listadas nesta página.';
  renderPrepared();
  el('primary-action').textContent=model.primaryAction.label;
  el('primary-action').disabled=busy||!model.primaryAction.enabled||!run&&ready.configured&&!source&&!prepared;
  el('active-banner').hidden=!active||active.id===run?.id;
  el('settings-link').href=api.runtime.getURL('configuracoes.html');
  const origin=source||run?.source;if(origin?.tabId)el('legacy-lote').href='lote.html?sourceTabId='+origin.tabId;
  if(!run)return;
  el('run-state').textContent=run.state==='completed'&&run.limitedCount?'Coleta concluída com '+run.limitedCount+(run.limitedCount===1?' listagem limitada':' listagens limitadas'):model.stateLabel;el('run-date').textContent=new Date(run.createdAt).toLocaleDateString('pt-BR');
  el('run-origin').textContent=run.source?.url?new URL(run.source.url).pathname:'Lote importado';el('run-origin').title=run.source?.url||'Lote importado';
  const current=run.items.find(i=>i.id===run.currentItemId);
  const status=run.state==='running'&&current?(current.checkpoint.complete?'Salvando resultado em ':'Coletando em ')+current.nome:model.stateLabel;
  if(el('run-status').textContent!==status)el('run-status').textContent=status;
  el('run-status').hidden=status===model.stateLabel;
  el('run-counts').textContent=summaryText(model.counts)+runExtrasText(run);
  if(model.progress.indeterminate)el('run-progress').removeAttribute('value');else{el('run-progress').max=model.progress.max;el('run-progress').value=model.progress.value;}
  el('current').hidden=!current||['completed','finished-with-pending'].includes(run.state);
  el('current-name').textContent=current?.nome||'';
  el('current-position').textContent=current?'Item '+(run.items.indexOf(current)+1)+' de '+run.items.length+' · '+({waiting:'Aguardando',paused:'Pausado',interrupted:'Interrompido',pausing:'Pausando'}[run.state]||(current.checkpoint.complete?'Salvando':'Processando')):'';
  el('current-progress').textContent=current?(current.checkpoint.confirmedPages+' páginas confirmadas · '+current.checkpoint.recordCount+' anúncios coletados'):'';
  el('run-reason').hidden=!run.reason||!!autoWaitText(run)||run.state==='waiting'&&['interval','transient','server_wait'].includes(run.reason);el('run-reason').textContent=REASONS[run.reason]||'O progresso está preservado. Confira a localidade e suas configurações.';
  el('wait-time').textContent=autoWaitText(run)||run.eligibility?.until>Date.now()&&(run.state==='waiting'||['paused','interrupted'].includes(run.state)&&['rate_limit','access_blocked','window_budget'].includes(run.reason))?(run.state==='waiting'?'Próxima página em ':'Retomada disponível em ')+remainingText(run.eligibility.until)+' (às '+new Date(run.eligibility.until).toLocaleTimeString('pt-BR')+')'+(run.state==='waiting'?(run.reason==='window_budget'?'. Limite de 60 páginas por hora; a coleta seguirá automaticamente.':'. A coleta seguirá automaticamente.'):'. Retome manualmente.'):'';
  el('scope-help').textContent=run.state==='finished-with-pending'?model.recoverable+' pendências recuperáveis · '+model.blocked+' impedidas. Itens concluídos não serão repetidos.':run.state==='paused'||run.state==='interrupted'?model.counts.queued+' localidades a iniciar. Retomar coleta continua a fila restante.':'';
  el('inspect-page').hidden=!current?.url||!['paused','interrupted'].includes(run.state);if(current?.url)el('inspect-page').href=current.url;
  el('list-total').textContent=model.rows.length+' de '+model.counts.total;
  const projectedItems=new Map(model.rows.map(i=>[i.id,i])),visible=new Set(projectedItems.keys()),valid=new Set(run.items.map(i=>i.id));
  for(const item of run.items){
   const r=rows.get(item.id)||createRow(item);if(!r.li.isConnected)el('localities').append(r.li);
   const projected=projectedItems.get(item.id);r.li.hidden=!visible.has(item.id);r.name.textContent=item.nome;r.state.textContent=current?.id===item.id&&run.state==='waiting'?'Aguardando próxima solicitação':STATES[item.state]||'Pendente';
   r.li.dataset.state=item.state;if(current?.id===item.id&&!['completed','finished-with-pending'].includes(run.state))r.li.setAttribute('aria-current','step');else r.li.removeAttribute('aria-current');
   r.count.textContent=item.checkpoint.confirmedPages+' pág. · '+item.checkpoint.recordCount+' anúncios';r.reason.textContent=REASONS[item.reason]||'';r.reason.hidden=!r.reason.textContent;
   r.progress.textContent=item.checkpoint.recordCount+' anúncios coletados · '+item.checkpoint.confirmedPages+' páginas confirmadas'+completenessText(item);
   r.origin.textContent=item.url;r.file.textContent=item.receipt?'Salvo: '+item.receipt.relativePath:item.stage==='save'?'Resultado completo preservado; arquivo ainda não confirmado.':'';
   r.resumeButton.hidden=!projected?.action;r.resumeButton.textContent=projected?.action?.label||'Retomar coleta';r.resumeButton.disabled=busy||!!active;
   r.folder.hidden=item.state!=='pending'||item.stage!=='save';r.folder.disabled=!!active;
   r.discard.hidden=item.state!=='pending'||item.recoverable===false;r.discard.disabled=!!active;
   r.restart.hidden=!['pending','discarded'].includes(item.state);r.restart.disabled=!!active;
  }
  for(const [id,r]of rows)if(!valid.has(id)){r.li.remove();rows.delete(id);}
  el('empty-list').hidden=!!model.rows.length;
 }
 async function detectSource(){
  try{const tabId=Number(new URL(doc.defaultView.location.href).searchParams.get('sourceTabId'));const tab=Number.isInteger(tabId)&&tabId>0?await api.tabs.get(tabId):(await api.tabs.query({active:true,currentWindow:true}))[0];const url=new URL(tab.url);source=url.protocol==='https:'&&(url.hostname==='idealista.pt'||url.hostname.endsWith('.idealista.pt'))?{tabId:tab.id,url:tab.url}:null;}catch{source=null;}
  try{const dir=await readDirectory();ready={configured:!!dir&&await dir.queryPermission({mode:'readwrite'})==='granted',name:dir?.name};}catch{ready={configured:false};}
  // 006 FR-008: fila preparada pelos Links (uma entrada por listagem derivada).
  try{const value=(await api.storage.local.get(['lote:prepared']))['lote:prepared'];prepared=Array.isArray(value?.entries)&&value.entries.length?value:null;}catch{prepared=null;}
 }
 function renderPrepared(){
  el('prepared-card').hidden=!prepared;if(!prepared)return;
  const s=prepared.summary;
  el('prepared-summary').textContent=prepared.entries.length+' localidades prontas a partir dos Links'+(prepared.origin?.nome?' ('+prepared.origin.nome+')':'')+'. '+
   (s?s.subregions+' distritos/ilhas'+(s.concelhos?' + '+s.concelhos+' concelhos ('+s.expandedDistricts.join(', ')+' passam de 1.800 anúncios e foram divididos)':'')+'. '+(s.unexpandedBig?.length?s.unexpandedBig.join(', ')+': concelhos indisponíveis; coletados inteiros e limitados pelo site. ':''):'')+
   'Cada uma é coletada pela listagem completa, uma de cada vez, sem repetir listagens.';
  const signature=prepared.linksSessionId+':'+prepared.entries.length;
  if(el('prepared-list').dataset.signature!==signature){el('prepared-list').dataset.signature=signature;el('prepared-list').replaceChildren(...prepared.entries.map(entry=>{const li=doc.createElement('li'),name=doc.createElement('span'),url=doc.createElement('span');name.textContent=(entry.path||entry.nome)+(entry.aliases?.length?' (também: '+entry.aliases.join(', ')+')':'');url.className='hint';try{url.textContent=new URL(entry.url).pathname;}catch{url.textContent=entry.url;}li.append(name,' ',url);return li;}));}
  el('prepared-rejected').hidden=!prepared.rejected?.length;el('prepared-rejected').textContent=prepared.rejected?.length?prepared.rejected.length+' links ignorados por endereço inválido.':'';
 }
 async function refresh(){
  if(disposed||refreshing)return;refreshing=true;
  try{
   runs=await rpc('LIST');active=runs.find(r=>['running','waiting','discovering','pausing'].includes(r.state));
   if(!context.ready){if(!context.selectedId||!runs.some(r=>r.id===context.selectedId))context.selectedId=active?.id||runs.at(-1)?.id||null;run=context.selectedId?await rpc('READ',{id:context.selectedId}):null;}else run=null;
   if(!run)await detectSource();
   const currentSelection=el('run-select').value,keys=runs.map(r=>r.id).join(',');
   if(el('run-select').dataset.keys!==keys){el('run-select').replaceChildren(...runs.map(r=>{const o=doc.createElement('option');o.value=r.id;o.textContent=new Date(r.createdAt).toLocaleString('pt-BR')+' · '+(r.source?.url?new URL(r.source.url).pathname:'Lote importado');return o;}));el('run-select').dataset.keys=keys;}
   el('run-select').value=context.selectedId||currentSelection;render();await refreshLinks();
  }catch(error){feedback(error.message);}finally{refreshing=false;}
 }
 el('primary-action').addEventListener('click',async()=>{
  if(busy)return;const action=buildCollectionView({run,ready}).primaryAction.id;
  // 006 (pedido do usuário): sem pasta de anúncios, escolher a pasta aqui mesmo (seletor do sistema), sem abrir Configurações.
  if(action==='configure'&&!run){await chooseAdsFolder();return;}
  if(action==='configure'||action==='resolve'){configure(action==='resolve'?run?.currentItemId:undefined);return;}
  if(action==='new'){context.ready=true;run=null;saveContext();await refresh();return;}
  if(action==='start'){
   if(prepared){await command('START',{commandId:crypto.randomUUID(),fromPrepared:true});return;}
   if(!source)return;await command('START',{commandId:crypto.randomUUID(),source:{...source}});return;}
  if(action==='pause'){await command('PAUSE',{id:run.id});return;}
  if(action==='resume'||action==='resume-pending')await resume(action==='resume-pending'?'pending':'remaining');
 });
 el('prepared-clear').addEventListener('click',async()=>{if(!prepared||busy)return;if(!await ask('Descartar a fila preparada?','A lista de '+prepared.entries.length+' localidades vinda dos Links deixará de ser usada. Os links coletados continuam salvos na aba Links.','Descartar fila'))return;try{await api.storage.local.remove('lote:prepared');}catch{}prepared=null;await refresh();});
 el('follow-active').addEventListener('click',()=>{context.selectedId=active?.id;context.ready=false;saveContext();refresh();});
 for(const key of tabs){el('tab-'+key).addEventListener('click',async()=>{activateTab(key);await flushContext();refreshLinks().catch(()=>{});});el('tab-'+key).addEventListener('keydown',async event=>{const index=tabs.indexOf(key),next=event.key==='ArrowRight'?tabs[(index+1)%tabs.length]:event.key==='ArrowLeft'?tabs[(index+tabs.length-1)%tabs.length]:event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):null;if(next){event.preventDefault();activateTab(next,true);await flushContext();refreshLinks().catch(()=>{});}});}
 el('tool-links-open').addEventListener('click',async()=>{
  if(linksStarting)return;const accessConfirmed=linksRecovery==='confirm-access'||linksResumable&&linksResumeReason==='access_blocked';
  if(accessConfirmed&&!await ask('Conferir acesso ao Idealista','Uma coleta anterior foi bloqueada. Confira se o site abre normalmente no navegador antes de confirmar uma nova tentativa. O prazo de espera continua obrigatório.','Conferi o acesso'))return;
  linksRead++;linksStarting=true;linksWorking=true;el('tool-links-open').disabled=true;el('links-status').textContent='Preparando a coleta…';
  try{const result=await rpc('LINKS_START',{accessConfirmed});if(result.status==='busy'){linksWorking=false;el('links-status').textContent=REASONS.active_session;}else await refreshLinks();}
  catch{linksWorking=false;el('links-status').textContent='Não foi possível comunicar com o coletor. Recarregue a extensão em chrome://extensions e tente novamente.';}
  finally{linksStarting=false;el('tool-links-open').disabled=linksWorking||!!(linksRecovery&&linksWaitUntil>Date.now());}
 });
 el('links-save').addEventListener('click',async()=>{try{await rpc('LINKS_EXPORT');}catch{el('links-status').textContent='Não foi possível abrir o resultado. A coleta permanece preservada.';}});
 el('links-details').addEventListener('click',async()=>{try{await rpc('LINKS_DETAILS');}catch{el('links-status').textContent='Não foi possível abrir os detalhes. O progresso permanece preservado.';}});
 el('follow-run').addEventListener('click',()=>{context.selectedId=active?.id;context.ready=false;activateTab('lote');saveContext();refresh();});
 el('show-current').addEventListener('click',()=>{if(!run?.currentItemId)return;context.filter='all';context.query='';el('filter').value='all';el('search').value='';render();const row=rows.get(run.currentItemId);if(row){row.details.open=true;row.li.scrollIntoView({block:'nearest',behavior:'auto'});row.details.children[0].focus();}saveContext();});
 el('tool-items-open').addEventListener('click',async()=>{const button=el('tool-items-open');button.disabled=true;try{if(!source)await detectSource();const url=el('tool-items-url').value.trim()||source?.url;if(!url)throw Error('Cole a URL de uma página de anúncios do Idealista.');require('./lote-input').validateBatchURL(url);await api.storage.local.set({collectionItemsURL:url});const base=api.runtime.getURL('itens.html'),existing=await api.tabs.query({url:base+'*'});if(existing.length)await api.tabs.update(existing[0].id,{active:true});else await api.tabs.create({url:base,active:true});el('tool-items-feedback').textContent='Acompanhamento de itens aberto. Inicie a coleta nessa tela.';}catch{el('tool-items-feedback').textContent='Não foi possível abrir. Informe uma URL HTTPS válida de anúncios do Idealista.';}finally{button.disabled=false;}});
 el('settings-link').addEventListener('click',event=>{event.preventDefault();configure();});
 el('search').addEventListener('input',()=>{context.query=el('search').value;saveContext();render();});
 el('filter').addEventListener('change',()=>{context.filter=el('filter').value;saveContext();render();});
 el('run-select').addEventListener('change',()=>{context.selectedId=el('run-select').value;context.ready=false;saveContext();refresh();});
 el('collapse').addEventListener('click',async()=>{try{const w=await api.windows.getCurrent();await api.sidePanel.close({windowId:w.id});}catch{feedback('Use o botão de fechar do painel do Chrome para recolher. A coleta continuará.');}});
 const changed=message=>{if(message.type==='AUTONOMA_CHANGED')refresh();};api.runtime.onMessage.addListener(changed);
 const visibility=()=>{if(!doc.hidden)refresh();};doc.addEventListener('visibilitychange',visibility);
 api.storage.local.get(['autonomousUI']).then(data=>{if(data.autonomousUI)Object.assign(context,data.autonomousUI);el('search').value=context.query;el('filter').value=context.filter;refresh().then(()=>{if(context.scroll)doc.defaultView.scrollTo(0,context.scroll);});}).catch(()=>refresh());
 timer=setInterval(()=>{if(!doc.hidden)refresh();},1000);
 const scroll=()=>saveContext();doc.defaultView.addEventListener('scroll',scroll,{passive:true});
 return {refresh,getState:()=>({run,source,context}),destroy(){disposed=true;clearInterval(timer);clearTimeout(saveTimer);api.runtime.onMessage.removeListener(changed);doc.removeEventListener('visibilitychange',visibility);doc.defaultView.removeEventListener('scroll',scroll);}};
}
if(typeof document!=='undefined'&&document.getElementById('collection-app'))mountSidePanel();
module.exports={mountSidePanel,summaryText,linksAuditText,completenessText,runExtrasText,autoWaitText,queueText,remainingText};

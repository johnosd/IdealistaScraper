const { createCollectionWorkflow } = require('./coleta-runner');
const { DEFAULT_POLICY, RANGES } = require('./coleta-policy');
const {SAVE_FAILURES}=require('./coleta-save-failure');
const LABELS={minIntervalMs:'Intervalo mínimo (segundos)',windowMs:'Janela de consumo (segundos)',maxPagesPerWindow:'Solicitações por janela',maxPagesPerRun:'Solicitações por sessão',maxPagesPerItem:'Páginas por item',maxAttempts:'Tentativas totais por página',requestTimeoutMs:'Tempo máximo de uma solicitação (segundos)',maxSessionMs:'Duração máxima da sessão (segundos)',backoffBaseMs:'Espera inicial para nova tentativa (segundos)',maxNoNewPages:'Páginas consecutivas sem anúncios novos'};
const REASONS={access_blocked:'Acesso recusado ou verificação apresentada. Confira o acesso e retome manualmente após a espera.',rate_limit:'O servidor limitou o acesso. Aguarde e retome manualmente.',server_wait:'Aguardando prazo indicado pelo servidor.',interval:'Aguardando intervalo entre solicitações.',window_budget:'Orçamento da janela atingido.',attempts_exhausted:'Limite de tentativas atingido.',proxy_changed:'A configuração de proxy mudou. Confira antes de reiniciar.',interrupted:'Sessão interrompida. Você pode retomar.',incompatible_context:'Contexto incompatível para retomada. Dados preservados.',pagination_cycle:'Paginação repetida detectada.',no_new_records:'Limite de páginas sem anúncios novos.',unexpected_content:'A página não apresentou o conteúdo esperado.',clock_inconsistent:'Relógio mudou. Confira data e hora antes de continuar.',run_budget:'Limite de solicitações da sessão atingido.',session_duration:'Duração máxima da sessão atingida.',item_budget:'Limite de páginas do item atingido.'};
const STATES={running:'Coletando',waiting:'Aguardando',paused:'Pausada',blocked:'Acesso bloqueado',interrupted:'Interrompida',saved:'Concluída',cancelled:'Cancelada',discarded:'Descartada','awaiting-save':'Resultado completo aguardando gravação'};
REASONS.connection_setup_failed=require('./coleta-labels').REASONS.connection_setup_failed;
REASONS.save_failed='Falha na gravação do arquivo. Dados coletados preservados; confira o diagnóstico e o destino antes de salvar novamente.';
Object.assign(REASONS,{invalid_destination:'Destino fora da origem permitida. Confira a página antes de reiniciar.',proxy_error:'Não foi possível confirmar o proxy solicitado. Confira a configuração.',checkpoint_failed:'Não foi possível preservar a próxima página. O último checkpoint válido foi mantido.',authentication_required:'A página exige autenticação. Confira o acesso antes de retomar.',http_error:'A resposta HTTP não permite confirmar a página.',session_capacity:'Limite de sessões recuperáveis atingido. Salve ou descarte uma sessão.',active_session:'Outra sessão está coletando neste domínio.',owner_alive:'Outra tela ainda controla esta sessão.',unconfirmed_request:'Uma operação ainda precisa ser encerrada antes de retomar.'});
function mountCollectionUI(options){
  const api=options.api||chrome,root=document.createElement('section');root.id='collection-panel';root.setAttribute('aria-label','Controle de coleta');
  const heading=document.createElement('h2');heading.textContent='Controle de coleta';root.append(heading);
  const summary=document.createElement('p');summary.id='collection-status';summary.setAttribute('role','status');summary.setAttribute('aria-live','polite');root.append(summary);
  const form=document.createElement('form');form.id='collection-policy';const fields={};
  for(const [key,value] of Object.entries(DEFAULT_POLICY)){
    const label=document.createElement('label'),input=document.createElement('input');input.type='number';input.name=key;input.id=`collection-${key}`;
    const ms=key.endsWith('Ms');input.min=RANGES[key][0]/(ms?1000:1);input.max=RANGES[key][1]/(ms?1000:1);input.step=1;input.value=value/(ms?1000:1);
    label.textContent=LABELS[key];label.htmlFor=input.id;label.append(input);form.append(label,document.createElement('br'));fields[key]=input;
  }
  const ip=document.createElement('input');ip.type='checkbox';ip.id='collection-auto-ip';const ipLabel=document.createElement('label');ipLabel.textContent='Verificar IP no início e quando a configuração mudar';ipLabel.htmlFor=ip.id;form.append(ipLabel,ip);
  const apply=document.createElement('button');apply.type='submit';apply.textContent='Aplicar limites';form.append(apply);if(options.showSettings!==false)root.append(form);
  const settingsLink=document.createElement('a');settingsLink.href='configuracoes.html';settingsLink.textContent='Configurações de pastas, conexão e limites';root.append(settingsLink);
  function authorize(){if(options.canMutate?.()===false)throw new Error('Ative esta tela para adquirir o controle da fila.');}
  function button(label,fn,mutating=true){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',()=>Promise.resolve().then(()=>{if(mutating)authorize();return fn();}).catch(failure));root.append(b);return b;}
  const restore=button('Restaurar perfil conservador',async()=>{await workflow.client('SET_POLICY',{limits:DEFAULT_POLICY,ipEnabled:false});await loadPolicy();});
  const pause=button('Pausar coleta',()=>workflow.stop());pause.id='collection-pause';
  const cancel=button('Cancelar coleta',()=>workflow.stop('CANCEL'));cancel.id='collection-cancel';
  const resume=button('Retomar sessão',()=>workflow.id?workflow.resume(workflow.id,lastView?.reason==='access_blocked'&&confirm('Você conferiu o acesso? A espera obrigatória continuará sendo respeitada.')):null);resume.id='collection-resume';
  const save=button('Tentar salvar novamente',()=>workflow.save(true));save.id='collection-save';
  const check=button('Conferir gravação anterior',()=>workflow.save(false));check.id='collection-check-save';
  const downloaded=button('Já baixei este resultado',()=>confirm('Você confirmou que o arquivo foi baixado?')?workflow.save(false,true):null);downloaded.hidden=options.mode!=='itens';
  const discard=button('Descartar sessão selecionada',async()=>{if(confirm('Descartar os dados recuperáveis desta sessão? Arquivos existentes serão preservados.')){await workflow.stop('DISCARD');await refresh();}});
  const probe=button('Verificar IP agora',()=>workflow.client('TEST_IP',{id:workflow.id}).then(r=>{summary.textContent=r.ip?`IP observado: ${r.ip}`:'IP não verificado';}));probe.id='collection-test-ip';
  if(options.showSettings===false){restore.hidden=true;probe.hidden=true;}
  const inspect=button('Abrir página de coleta',async()=>{if(lastView?.executor)await api.tabs.update(lastView.executor.tabId,{active:true});},false);
  const list=document.createElement('ul');list.id='collection-sessions';root.append(list);
  const diagnostic=document.createElement('pre');diagnostic.id='collection-diagnostics';root.append(diagnostic);
  let lastView=null;
  function failure(error){summary.textContent=error.message||'Não foi possível concluir a operação.';options.onError?.(error);}
  function render(view,extra={}){
    lastView=view;root.dataset.state=['error','save-unknown'].includes(extra.status)?extra.status:view?.state||extra.status||'ready';
    const until=extra.until||view?.eligibility?.until;
    summary.textContent=extra.message||(extra.status==='save-unknown'?'Não foi possível confirmar a gravação anterior. Confira ou escolha tentar salvar novamente.':`${STATES[view?.state]||(extra.reason?'Coleta não iniciada':'Pronta para coletar')}. ${REASONS[extra.reason||view?.reason]||''}${until?' Próxima elegibilidade: '+new Date(until).toLocaleString():''}${view?' Solicitadas: '+view.counters.requested+'; confirmadas: '+view.counters.confirmed+'.':''}`);
    if(extra.reason==='active_session'&&extra.activeSession){const s=extra.activeSession;summary.textContent=`Outra sessão está coletando neste domínio. Execução ativa: ${{links:'Links',itens:'Itens',lote:'Lote'}[s.mode]||'Coleta'} — ${new Date(s.createdAt).toLocaleString()}.`;}
    const active=workflow.running,editable=options.canMutate?.()!==false;pause.disabled=!editable||!active;cancel.disabled=!editable||!view;resume.disabled=!editable||!view||active||['saved','discarded'].includes(view.state);
    save.disabled=check.disabled=!editable||!view||view.state!=='awaiting-save'||active;downloaded.disabled=save.disabled;
    discard.disabled=!editable||!view||active;inspect.disabled=!view?.executor;apply.disabled=restore.disabled=probe.disabled=!editable||active;
    for(const field of Object.values(fields))field.disabled=!editable||active;ip.disabled=!editable||active;
    diagnostic.textContent=(view?.diagnostics||[]).slice(-30).map(e=>`${new Date(e.time).toLocaleTimeString()} ${e.code==='save_failed'?'Falha de gravação: '+(SAVE_FAILURES[e.reason]||SAVE_FAILURES.write_error):e.code}${e.status?' HTTP '+e.status:''}${e.path?' '+e.path:''}${Number.isInteger(e.attempt)?' · Tentativa: '+e.attempt:''}${Number.isFinite(e.durationMs)?' · Duração: '+e.durationMs+' ms':''}${Number.isInteger(e.newRecords)?' · Novos anúncios: '+e.newRecords:''}`).join('\n');
    options.onState?.(view,extra);
  }
  const workflow=createCollectionWorkflow({...options,api,onState:render});
  form.addEventListener('submit',async event=>{event.preventDefault();try{authorize();const limits=Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,Number(input.value)*(key.endsWith('Ms')?1000:1)]));await workflow.client('SET_POLICY',{limits,ipEnabled:ip.checked});summary.textContent='Limites aplicados. Consumo e pausas vigentes foram preservados.';}catch(error){failure(error);}});
  async function loadPolicy(){const p=await workflow.client('GET_POLICY');for(const [key,input] of Object.entries(fields))input.value=p.limits[key]/(key.endsWith('Ms')?1000:1);ip.checked=p.ipEnabled;}
  async function refresh(){
    list.replaceChildren();const sessions=await workflow.client('LIST');
    for(const s of sessions.filter(s=>s.mode===options.mode&&s.state!=='discarded'&&!s.autonomous)){
      const li=document.createElement('li'),b=document.createElement('button');b.type='button';b.textContent=`Selecionar ${STATES[s.state]||s.state} — ${new Date(s.createdAt).toLocaleString()}`;b.dataset.session=s.id;
      b.addEventListener('click',()=>workflow.adopt(s.id).catch(failure));li.append(b);list.append(li);
    }
  }
  button('Atualizar sessões',refresh,false);
  (document.querySelector('main')||document.body).append(root);
  Promise.all([loadPolicy(),refresh()]).then(()=>render(null)).catch(failure);
  workflow.refreshSessions=refresh;return workflow;
}
module.exports={mountCollectionUI};

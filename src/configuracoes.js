const ads=require('./lote-directory-store'),localities=require('./localidades-directory-store');
const {DEFAULT_POLICY,RANGES}=require('./coleta-policy');
const LABELS={minIntervalMs:'Intervalo mínimo (segundos)',windowMs:'Janela de consumo (segundos)',maxPagesPerWindow:'Solicitações por janela',maxPagesPerRun:'Solicitações por sessão',maxPagesPerItem:'Páginas por localidade',maxAttempts:'Tentativas totais por página',requestTimeoutMs:'Tempo máximo de uma solicitação (segundos)',maxSessionMs:'Duração máxima da sessão (segundos)',backoffBaseMs:'Espera inicial para nova tentativa (segundos)',maxNoNewPages:'Páginas consecutivas sem anúncios novos'};
function createSettingsDraft(initial){
 let original=structuredClone(initial),current=structuredClone(initial);
 const comparable=v=>JSON.stringify([v.limits,v.useProxy,v.ipEnabled,v.proxy?.host,v.proxy?.port,v.proxy?.user,v.proxy?.password||'']);
 return {get values(){return structuredClone(current);},get dirty(){return comparable(current)!==comparable(original);},edit(values){current=structuredClone(values);},reset(values){original=structuredClone(values);current=structuredClone(values);}};
}
function mountSettings({api=chrome,doc=document,adsStore=ads,localityStore=localities}={}){
 const el=id=>doc.getElementById(id),fields={};let draft=null,revision=null,active=false,busy=false,disposed=false,invalidField=null,passwordEdited=false,passwordConfigured=false;
 const handles={ads:null,localities:null};const params=new URL(doc.defaultView.location.href).searchParams,runId=params.get('runId'),itemId=params.get('itemId');
 async function rpc(action,payload={}){const r=await api.runtime.sendMessage({cmd:'AUTONOMA_'+action,payload});if(!r?.ok)throw Error('Ação indisponível. Tente novamente.');return r.result;}
 function status(text){el('settings-status').textContent=text;}
 function connectionFeedback(state,title,detail,reveal=false){const box=el('connection-feedback');box.hidden=false;box.dataset.state=state;el('connection-feedback-title').textContent=title;el('connection-feedback-detail').textContent=detail;if(reveal)box.scrollIntoView({block:'nearest',behavior:'auto'});}
 function syncControls(){
  el('settings-save').disabled=active||busy;el('save-test-connection').disabled=active||busy||!draft;el('apply-connection').disabled=active||busy||!draft||draft.dirty;el('test-ip').disabled=busy;
  el('toggle-password').disabled=busy||!draft;
  for(const id of ['choose-ads','choose-localities','reauthorize-ads','reauthorize-localities','disable-proxy'])el(id).disabled=active||busy;
  for(const input of [...Object.values(fields),...['connection','host','port','user','password','ip-enabled','restore-profile','reload-settings'].map(el)])input.disabled=busy;
 }
 function readForm(){return {limits:Object.fromEntries(Object.entries(fields).map(([k,n])=>[k,Number(n.value)*(k.endsWith('Ms')?1000:1)])),useProxy:el('connection').value==='proxy',ipEnabled:el('ip-enabled').checked,proxy:{host:el('host').value.trim(),port:el('port').value.trim(),user:el('user').value,password:passwordEdited?el('password').value:''}};}
 function passwordVisibility(visible){el('password').type=visible?'text':'password';const label=visible?'Ocultar senha':'Mostrar senha';el('toggle-password').setAttribute('aria-label',label);el('toggle-password').title=label;el('toggle-password').setAttribute('aria-pressed',String(visible));el('password-eye-slash').toggleAttribute('hidden',!visible);if(!visible&&!passwordEdited)el('password').value='';}
 function edited(){if(!draft)return;draft.edit(readForm());el('dirty').textContent=draft.dirty?'Alterações não salvas — salve antes de aplicar a conexão':'';el('proxy-fields').hidden=el('connection').value!=='proxy';if(draft.dirty&&!busy)connectionFeedback('info','Alterações não salvas','Use Salvar e testar conexão para confirmar estes valores.');syncControls();}
 for(const [key,n]of Object.entries(DEFAULT_POLICY)){
  const label=doc.createElement('label'),input=doc.createElement('input'),error=doc.createElement('span');input.id=key;input.type='number';input.step=1;const ms=key.endsWith('Ms')?1000:1;input.min=RANGES[key][0]/ms;input.max=RANGES[key][1]/ms;label.htmlFor=key;label.textContent=LABELS[key];error.id='error-'+key;error.className='field-error';input.setAttribute('aria-describedby',error.id);label.append(input,error);el(['minIntervalMs','maxPagesPerWindow','maxPagesPerRun'].includes(key)?'basic-limits':'advanced-limits').append(label);fields[key]=input;
 }
 async function load(){
  const view=await rpc('GET_SETTINGS');revision=view.revision;
  for(const [k,input]of Object.entries(fields))input.value=view.limits[k]/(k.endsWith('Ms')?1000:1);
  el('connection').value=view.useProxy?'proxy':'direct';el('ip-enabled').checked=view.ipEnabled;
  for(const k of ['host','port','user'])el(k).value=view.proxy[k]||'';el('password').value='';passwordEdited=false;passwordConfigured=view.proxy.passwordConfigured;passwordVisibility(false);el('password').placeholder=passwordConfigured?'••••••••':'';
  el('password-help').textContent=passwordConfigured?'Senha salva neste navegador. Use o olho para conferir; deixe vazio para conservá-la.':'A senha será salva neste navegador. Preencha se o proxy exigir.';
  draft=createSettingsDraft(readForm());edited();el('reload-settings').hidden=true;
 }
 async function checkActive(){active=(await rpc('ACTIVITY')).active;el('activity-notice').hidden=!active;syncControls();}
 async function showFolders(){
  for(const kind of ['ads','localities']){
   const h=handles[kind];const permission=h?await h.queryPermission({mode:'readwrite'}):'prompt';el(kind==='ads'?'ads-destination':'localities-destination').textContent=h?h.name+' · '+(permission==='granted'?'acesso permitido':'autorização necessária'):'Nenhuma pasta escolhida';
   el('reauthorize-'+kind).disabled=active||busy||!h||permission==='granted';
  }
 }
 async function choose(kind,reauthorize=false){
  if(active||busy)return;const current=handles[kind];if(reauthorize&&!current)return;
  // Native picker/permission must begin in the direct click before any await.
  let pending;try{pending=reauthorize?current.requestPermission({mode:'readwrite'}):doc.defaultView.showDirectoryPicker({id:kind==='ads'?'idealista-municipios':'idealista-localidades',mode:'readwrite'});}catch{status('O seletor não está disponível. Abra Configurações no Chrome.');return;}
  busy=true;
  try{
   const selected=reauthorize?current:await pending;const permission=reauthorize?await pending:await selected.queryPermission({mode:'readwrite'});
   if(permission!=='granted'){status('Acesso não concedido. Pasta anterior e progresso preservados.');return;}
   await checkActive();if(active){status('Uma coleta iniciou. Pause-a antes de alterar o destino.');return;}
   if(kind==='ads'&&runId){
    const view=await rpc('READ',{id:runId}),item=view.items.find(i=>i.id===itemId);
    if(item?.checkpoint.complete){
      const ym=view.exportContext.yearMonth,relativePath=require('./lote-export').getMunicipalityDestination({startedAt:new Date(Number(ym.slice(0,4)),Number(ym.slice(4))-1,1),nome:item.nome,totalPages:item.checkpoint.confirmedPages}).relativePath;
      if(!await require('./coleta-destinations').distinctDestination({directory:selected,items:view.items,itemId,relativePath,load:key=>adsStore.loadRunDirectory(runId,key)})){status('Essa pasta já contém o resultado de outra localidade com o mesmo nome. Escolha uma pasta diferente.');return;}
    }
    // Stage an immutable handle first. Only a fenced idle commit can publish its key.
    const binding=await rpc('BEGIN_DESTINATION',{id:runId,itemId});if(binding.status!=='ready'){status('Destino não alterado. Pause a coleta antes de continuar.');return;}
    try{await adsStore.saveRunDirectory(runId,selected,binding.token);const done=await rpc('BIND_DESTINATION',{id:runId,itemId,token:binding.token});if(done.status!=='saved')throw Error('Destino não confirmado.');}
    catch(error){await rpc('CANCEL_DESTINATION',{id:runId,token:binding.token});throw error;}
   }else await (kind==='ads'?adsStore:localityStore).saveDirectory(selected);
   handles[kind]=selected;status('Pasta autorizada e memorizada. O formulário e o progresso foram preservados.');
  }catch(error){status(error.name==='AbortError'?'Seleção cancelada. Pasta anterior e edições preservadas.':'Não foi possível memorizar a pasta. O progresso e as edições foram preservados.');}
  finally{busy=false;await checkActive();await showFolders();}
 }
 el('settings-form').addEventListener('input',event=>{if(event.target===el('password'))passwordEdited=true;edited();});el('settings-form').addEventListener('change',edited);
 el('toggle-password').addEventListener('click',async()=>{
  if(busy||!draft)return;if(el('password').type==='text'){passwordVisibility(false);return;}
  if(passwordEdited||!passwordConfigured){passwordVisibility(true);return;}
  busy=true;syncControls();
  try{const r=await rpc('REVEAL_PROXY_PASSWORD',{expectedRevision:revision});if(r.status==='revealed'){el('password').value=r.password;passwordVisibility(true);}
   else{el('password-help').textContent='Outra tela alterou a senha. Recarregue os valores salvos para conferir.';el('reload-settings').hidden=false;}}
  catch{el('password-help').textContent='Não foi possível mostrar a senha salva. Tente novamente.';}
  finally{await finishAction();}
 });
 async function saveForm(){
  for(const key of [...Object.keys(fields),'host','port']){el('error-'+key).textContent='';(fields[key]||el(key)).removeAttribute('aria-invalid');}
   const result=await rpc('SAVE_SETTINGS',{expectedRevision:revision,values:draft.values});
   if(result.status==='saved'){await load();await proxyStatus();status('Configurações salvas. Nenhuma coleta foi iniciada.');return true;}
   if(result.status==='invalid'){let first;for(const [key,message]of Object.entries(result.errors||{})){const field=fields[key]||doc.getElementById(key),error=doc.getElementById('error-'+key);if(error)error.textContent=message;if(field){field.setAttribute('aria-invalid','true');first??=field;}}connectionFeedback('error','Confira os campos indicados','Os valores não foram salvos e a conexão não foi alterada.',true);invalidField=first;status('Confira os campos indicados. As edições foram mantidas.');}
   else if(result.status==='conflict'){el('reload-settings').hidden=false;const message='Outra tela salvou configurações. Suas edições foram mantidas; recarregue para revisar os valores atuais.';status(message);connectionFeedback('error','Outra tela alterou as configurações',message,true);}
   else{const message=result.status==='busy'?'Há uma coleta ativa. Pause ou aguarde antes de salvar.':'Não foi possível salvar. Suas edições foram preservadas.';status(message);connectionFeedback('error','Configurações não salvas',message,true);}
   return false;
 }
 async function finishAction(){busy=false;syncControls();if(invalidField){invalidField.closest?.('details')?.setAttribute('open','');invalidField.focus();invalidField=null;}await checkActive().catch(()=>status('Não foi possível atualizar o estado. Reabra Configurações.'));}
 el('settings-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!draft)return;edited();busy=true;syncControls();connectionFeedback('pending','Salvando configurações…','Aguarde a confirmação.',true);
  try{if(await saveForm())connectionFeedback('info','Configurações salvas','A conexão ainda não foi testada. Use Salvar e testar conexão para confirmar o acesso.',true);}
  catch{status('Não foi possível salvar. Suas edições foram preservadas.');connectionFeedback('error','Não foi possível salvar','Suas edições foram preservadas. Tente novamente.',true);}
  finally{await finishAction();}
 });
 el('restore-profile').addEventListener('click',()=>{for(const[k,input]of Object.entries(fields))input.value=DEFAULT_POLICY[k]/(k.endsWith('Ms')?1000:1);edited();status('Perfil conservador colocado no formulário. Salve para aplicar.');});
 async function confirmLeave(){if(!draft?.dirty)return true;const dialog=el('leave-dialog'),previous=doc.activeElement;return new Promise(resolve=>{dialog.addEventListener('close',()=>{previous?.focus();resolve(dialog.returnValue==='discard');},{once:true});dialog.showModal();});}
 el('reload-settings').addEventListener('click',async()=>{if(await confirmLeave())try{await load();status('Valores salvos recarregados.');}catch{status('Não foi possível recarregar.');}});
 el('back').addEventListener('click',async event=>{event.preventDefault();if(await confirmLeave()){el('password').value='';draft=null;doc.defaultView.location.href=api.runtime.getURL('sidepanel.html');}});
 const unload=event=>{if(draft?.dirty){event.preventDefault();event.returnValue='';}};doc.defaultView.addEventListener('beforeunload',unload);
 for(const kind of ['ads','localities']){el('choose-'+kind).addEventListener('click',()=>choose(kind));el('reauthorize-'+kind).addEventListener('click',()=>choose(kind,true));}
 async function proxyStatus(){const s=await api.runtime.sendMessage({cmd:'PROXY_STATUS'});if(!s||s.ok===false)throw Error('Estado indisponível');el('proxy-status').textContent=s.external?'Outra política/extensão controla a conexão. Confira-a antes de coletar.':s.requested&&s.matchesSaved===false?s.enabled?'Há um proxy ativo diferente do salvo. Salve e teste para usar os novos valores.':'Proxy salvo, ainda não aplicado. Use Salvar e testar conexão.':s.enabled?s.requested===false?'O proxy anterior ainda está ativo. Salve e teste para usar a conexão do sistema.':'Proxy salvo aplicado à conexão atual.':'Conexão do sistema ativa, sem proxy deste app.';return s;}
 async function verifyConnection(){
  connectionFeedback('pending','Testando conexão…','Consultando o IP de saída. Isso pode levar até 5 segundos.',true);
  const before=await proxyStatus(),r=await rpc('TEST_IP'),after=await proxyStatus();
  if(JSON.stringify(before)!==JSON.stringify(after)){connectionFeedback('error','A conexão mudou durante o teste','Verifique o IP novamente para confirmar a conexão atual.',true);return;}
  if(r.status!=='verified'||!r.ip){connectionFeedback('error','Não foi possível confirmar a conexão',after.enabled?'O teste de IP não respondeu. Confira host, porta, usuário e senha, além do acesso à rede, e tente novamente.':'O teste de IP não respondeu. Confira o acesso à rede e tente novamente.',true);status('IP não verificado. Conexão preservada.');return;}
  const title=draft?.dirty?'IP da conexão ativa verificado':after.enabled?(after.matchesSaved?'Proxy conectado':'Proxy ativo conectado'):after.external||after.requested?'IP da conexão atual verificado':'Conexão do sistema confirmada';
  const note=draft?.dirty?' Suas alterações ainda não foram salvas nem testadas. Use Salvar e testar conexão.':after.external?' Outra política ou extensão controla esta conexão.':after.matchesSaved===false?' A conexão ativa difere dos valores salvos. Use Salvar e testar conexão.':'';
  connectionFeedback(draft?.dirty||after.matchesSaved===false||after.external?'info':'success',title,'IP de saída: '+r.ip+'.'+note,true);status('IP observado na conexão ativa: '+r.ip);
 }
 async function applyConnection(verify=false){
  await checkActive();if(active){connectionFeedback('error','Há uma coleta ativa','Pause ou aguarde a coleta antes de alterar a conexão.',true);return;}
  connectionFeedback('pending','Aplicando conexão…','Usando os valores salvos. Nenhuma coleta será iniciada.',true);
  const r=await api.runtime.sendMessage({cmd:'APPLY_SAVED_CONNECTION',expectedRevision:revision});
  if(!r?.ok){const message=r?.code==='SETTINGS_CHANGED'?'Outra tela salvou configurações. Recarregue os valores antes de aplicar.':'Não foi possível aplicar a conexão. Pause a coleta e confira os valores salvos.';if(r?.code==='SETTINGS_CHANGED')el('reload-settings').hidden=false;status(message);connectionFeedback('error','Conexão não aplicada',message,true);return;}
  await proxyStatus();if(verify){await verifyConnection();return;}
  const message=r.connection==='proxy'?'Proxy salvo aplicado. Verifique o IP para confirmar a conexão.':'Conexão do sistema aplicada, sem proxy deste app.';status(message);connectionFeedback('info','Conexão aplicada; teste pendente',message,true);
 }
 el('save-test-connection').addEventListener('click',async()=>{
  if(busy||!draft)return;if(active){connectionFeedback('error','Há uma coleta ativa','Pause ou aguarde antes de salvar e testar.',true);return;}
  edited();busy=true;syncControls();connectionFeedback('pending','Salvando configurações…','Depois de salvar, vamos aplicar e testar a conexão.',true);
  try{if(await saveForm())await applyConnection(true);}
  catch{connectionFeedback('error','Não foi possível concluir o teste','Confira a conexão e tente novamente. Os valores já salvos foram preservados.',true);}
  finally{await finishAction();}
 });
 el('apply-connection').addEventListener('click',async()=>{
  if(busy||active||!draft||draft.dirty){status('Salve as edições e pause a coleta antes de aplicar a conexão.');return;}
  busy=true;syncControls();connectionFeedback('pending','Aplicando conexão…','Aguarde a confirmação.',true);
  try{await applyConnection();}
  catch{connectionFeedback('error','Conexão não aplicada','Os valores salvos foram preservados. Confira a conexão e tente novamente.',true);}
  finally{await finishAction();}
 });
 el('test-ip').addEventListener('click',async()=>{if(busy)return;busy=true;syncControls();try{await verifyConnection();}catch{connectionFeedback('error','Não foi possível confirmar a conexão','Confira o acesso à rede e tente novamente. A conexão foi preservada.',true);}finally{await finishAction();}});
 el('disable-proxy').addEventListener('click',async()=>{if(busy||active)return;busy=true;syncControls();connectionFeedback('pending','Desativando proxy…','Aguarde a confirmação.',true);try{const r=await api.runtime.sendMessage({cmd:'DISABLE_PROXY'});if(!r?.ok)throw Error();await proxyStatus();status('Proxy aplicado desativado. O formulário foi preservado.');connectionFeedback('info','Proxy desativado','O formulário foi preservado. Para voltar a usá-lo, salve e teste a conexão.',true);}catch{connectionFeedback('error','Não foi possível desativar','Pause a coleta e confira a conexão.',true);}finally{await finishAction();}});
 const ready=Promise.all([load(),checkActive(),proxyStatus(),(async()=>{const view=runId?await rpc('READ',{id:runId}):null,key=view?.items.find(i=>i.id===itemId)?.destinationHandleKey||view?.destinationHandleKey;handles.ads=runId?await adsStore.loadRunDirectory(runId,key||undefined):await adsStore.loadDirectory();handles.localities=await localityStore.loadDirectory();await showFolders();if(runId){el('run-destination').hidden=false;el('run-destination').textContent=itemId?'Recuperação de uma localidade: a pasta escolhida será vinculada somente a esse resultado.':'Recuperação desta execução: mantém mês e páginas confirmadas. Nova pasta será vinculada somente a esta execução.';}})()]).catch(()=>status('Não foi possível carregar. Reabra Configurações para tentar novamente.'));
 const timer=setInterval(()=>{if(!disposed&&!doc.hidden)checkActive().catch(()=>{});},1000);
 return {ready,choose,getDraft:()=>draft,destroy(){disposed=true;clearInterval(timer);doc.defaultView.removeEventListener('beforeunload',unload);}};
}
if(typeof document!=='undefined'&&document.getElementById('settings-app'))mountSettings();
module.exports={mountSettings,createSettingsDraft,LABELS};

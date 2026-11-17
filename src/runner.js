const {createCollectionStore}=require('./coleta-store');
const {createAutonomousCollection}=require('./coleta-autonoma');
const {createPageTransport,reconcileDirectory,abortableDelay}=require('./coleta-runner');
const {discoverSource}=require('./coleta-discovery');
const {buildBatchQueue}=require('./lote-queue');
const {loadDirectory,loadRunDirectory,saveRunDirectory}=require('./lote-directory-store');
const {writeMunicipality}=require('./lote-export');
const params=new URL(location.href).searchParams,id=params.get('id'),token=params.get('token');
const api=chrome,store=createCollectionStore();let binding=null,service=null,work=null;
// 006 D4: entradas da fila (preparada pelos Links ou derivada da página atual) mantêm a ordem do DOM (quantidade:null, R-007).
const toItem=entry=>({nome:entry.nome,url:entry.url,quantidade:null,context:entry.context,...(entry.freguesia?{freguesia:entry.freguesia}:{})});
async function discoverBatch(source){
  if(source.linksSessionId){
    const prepared=(await api.storage.local.get(['lote:prepared']))['lote:prepared'];
    if(prepared?.linksSessionId!==source.linksSessionId)throw new Error('A página de origem mudou.');
    return {source:structuredClone(source),items:prepared.entries.map(toItem)};
  }
  const found=await discoverSource(api,source);
  const records=found.items.map(item=>item.record).filter(Boolean);
  return {source:found.source,items:records.length?buildBatchQueue(records).entries.map(toItem):found.items};
}
// Ações do runner idempotentes (leitura de conexão, vínculo, aviso, encerramento): repetem também se o worker cair no meio.
const RUNNER_IDEMPOTENT=new Set(['ATTACH','PROXY_SNAPSHOT','CHANGED','FINISHED']);
async function request(action,payload={}){const r=await require('./coleta-protocol').sendWithRetry(api,{cmd:'AUTONOMA_'+action,payload:{id,token,...payload}},{idempotent:RUNNER_IDEMPOTENT.has(action)});if(!r?.ok)throw Error('Executor indisponível');return r.result;}
async function destination(itemId){const s=(await store.read(['session:'+id]))['session:'+id],key=s?.itemStates?.[itemId]?.destinationHandleKey||s?.destinationHandleKey;return loadRunDirectory(id,key||undefined);}
function launch(){if(work)return;
 service.coordinator.metadata({id}).then(s=>api.runtime.sendMessage({cmd:'COLETA_PROBE_IP',payload:{id,epoch:s.epoch}})).catch(()=>{});
 // 006: runQueue percorre a fila inteira (esperas/recuperação na Fase 7); FINISHED só depois que ele termina.
 work=service.runQueue({id,owner:binding.owner}).catch(()=>{}).finally(async()=>{work=null;await request('FINISHED').catch(()=>{});});}
api.runtime.onMessage.addListener((message,sender,respond)=>{
  if(!binding||sender.id!==api.runtime.id||sender.tab||message.token!==token)return;
  if(message.cmd==='AUTONOMA_OWNER_PROOF'){respond({id,token,runId:binding.runId});return;}
  if(message.cmd!=='AUTONOMA_COMMAND')return;
  (async()=>{if(message.action==='PAUSE')return service.pause({id,owner:binding.owner});if(message.action==='RESUME'){if(work)return {status:'busy'};const result=await service.resume({...message.payload,id,owner:binding.owner,connectionConfirmed:true});if(result.status==='accepted'||result.status==='wait'||result.status==='paused'&&result.reason==='session_duration')launch();return result;}return {status:'invalid'};})().then(respond,()=>respond({status:'error'}));return true;
});
(async()=>{
  const linksToken=params.get('links');
  if(linksToken)return require('./links-runner').runLinksRunner({api,token:linksToken,onStatus:text=>{document.getElementById('runner-status').textContent=text;}});
  if(!id||!token)return;
  for(let n=0;n<50;n++){const r=await request('ATTACH');if(r.status==='ready'){binding=r;break;}await abortableDelay(100);}
  if(!binding){document.getElementById('runner-status').textContent='Execução inativa. Retome manualmente pelo painel.';return;}
  // 006 D5: aba Idealista visível, em foco só ao criar, navegação real em toda página.
  const transport=createPageTransport(api,{foreground:true});let initialDirectory=null;
  // 006 US5/D8: espera e reverificação automáticas, no máximo 3 verificações por bloqueio; sem evasão.
  service=createAutonomousCollection({store,runId:binding.runId,managedRunner:true,autoRecovery:{maxRechecks:3},
    // Espera em blocos de até 5 s relendo a elegibilidade do domínio: segue assim que o prazo real vence.
    async waitUntil(until,signal){for(;;){const left=until-Date.now();if(left<=0)return;const e=await service.coordinator.eligibility();if(!e||!(e.until>Date.now()))return;await abortableDelay(Math.min(5000,left,Math.max(1,e.until-Date.now())),signal);}},
    async preflight(){const dir=await loadDirectory();if(!dir||await dir.queryPermission({mode:'readwrite'})!=='granted')return {status:'needs-configuration'};initialDirectory=dir;const snapshot=await request('PROXY_SNAPSHOT');return {status:'ready',destination:{name:dir.name},proxyRevision:snapshot.revision};},
    discover:source=>discoverBatch(source),
    async onStarted(){if(!await loadRunDirectory(id))await saveRunDirectory(id,initialDirectory);},
    preparePage:input=>transport.prepare(input),executePage:input=>transport.execute(input),closeTransport:options=>transport.dispose(options),
    async validateDestination(input){const dir=await destination(input.itemId),view=await service.read({id});return require('./coleta-destinations').distinctDestination({directory:dir,items:view.items,itemId:input.itemId,relativePath:input.relativePath,load:key=>loadRunDirectory(id,key)});},
    async write(input){const dir=await destination(input.itemId),view=await service.read({id}),relativePath=require('./lote-export').getMunicipalityDestination(input).relativePath;
      if(!await require('./coleta-destinations').distinctDestination({directory:dir,items:view.items,itemId:input.itemId,relativePath,load:key=>loadRunDirectory(id,key)}))return {status:'destination_collision'};
      return {...await writeMunicipality({...input,directory:dir,locks:navigator.locks}),directoryName:dir?.name};},
    async reconcile(intent,context){return reconcileDirectory(await destination(context.itemId),intent);},
    proxySnapshot:()=>request('PROXY_SNAPSHOT'),onChange:()=>request('CHANGED')
  });
  let result;
  if(binding.operation==='start')result=await service.start({commandId:binding.commandId,source:binding.source,useProxy:binding.useProxy,owner:binding.owner,launchId:id});
  // Retomada pedida pelo usuário no painel: confirma a conexão atual (006 T076).
  else result=await service.resume({id,owner:binding.owner,selection:binding.selection,accessConfirmed:binding.accessConfirmed,retrySave:binding.retrySave,connectionConfirmed:true});
  // 006: retomada dentro de uma espera (janela/limite) segue com o runQueue, que aguarda o prazo sozinho.
  if(['started','accepted'].includes(result.status)||binding.operation==='resume'&&(result.status==='wait'||result.status==='paused'&&result.reason==='session_duration')){document.getElementById('runner-status').textContent='Coleta ativa. O painel pode ser fechado.';launch();}
  else{const s=await service.coordinator.metadata({id});if(s.state==='discovering')await service.coordinator.control({id,owner:binding.owner,epoch:s.epoch,action:'pause',reason:result.reason||'permission_required'});document.getElementById('runner-status').textContent='Coleta aguardando ação no painel: '+result.status+(result.reason?' — '+result.reason:'');await request('CHANGED');await request('FINISHED');}
})().catch(()=>{document.getElementById('runner-status').textContent='Não foi possível continuar. Confira o painel da extensão.';});

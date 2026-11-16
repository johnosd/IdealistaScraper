const { createCollectionStore } = require('./coleta-store');
const { validateSender } = require('./coleta-protocol');
const { createCollectionCoordinator } = require('./coleta-coordinator');
const { localExportContext } = require('./coleta-download');
const {probePublicIP}=require('./coleta-ip');
const {hashText}=require('./coleta-digest');
// Registro sem I/O. Adaptador será ligado às ações do coordenador nas próximas fases.
function registerCollectionRuntime(api, handle) {
  api.runtime.onMessage.addListener((message, sender, respond) => {
    if (!message?.cmd?.startsWith('COLETA_')) return;
    Promise.resolve().then(() => validateSender(api, message, sender))
      .then(identity => handle(identity, message.payload || {}, sender))
      .then(result => respond({ ok: true, result }), () => respond({ ok: false, code: 'COLLECTION_ERROR', message: 'Ação de coleta recusada ou indisponível.' }));
    return true;
  });
}
function installCollectionBackground(api, proxy, {store=createCollectionStore(), now=Date.now, probeIP=probePublicIP}={}) {
  const coordinator=createCollectionCoordinator({store,now});
  let settings=null;
  let mutations=Promise.resolve(), observations=Promise.resolve();
  const ipControllers=new Map();
  async function runId(){
    const data=await api.storage.session.get(['collectionRunId']);
    if(data.collectionRunId)return data.collectionRunId;
    const id=crypto.randomUUID();await api.storage.session.set({collectionRunId:id});return id;
  }
  async function state(id){return coordinator.read({id});}
  async function owns(s,identity){if(!s||s.owner!==identity.owner)throw new Error('Outra tela controla esta sessão');}
  async function writeSession(id, mutate, extra=[]){
    return store.transact([`session:${id}`,...extra],rows=>{const s=rows[`session:${id}`];if(!s)throw new Error('Sessão ausente');const writes={};const output=mutate(s,writes,rows);s.revision++;writes[`session:${id}`]=s;return {writes,result:output};});
  }
  async function stopExecutor(s){
    const ex=s.executor;if(!ex||ex.runId!==await runId())return;
    try{
      const tab=await api.tabs.get(ex.tabId);
      // O handshake do executor confirma o token antes de remover a aba própria.
      if(tab.url==='about:blank')await api.tabs.remove(ex.tabId);
      else{
        const proof=await api.tabs.sendMessage(ex.tabId,{cmd:'COLETA_EXECUTOR_PROOF',sessionId:s.id,epoch:s.epoch,requestId:s.inFlight});
        if(proof?.sessionId!==s.id||proof.epoch!==s.epoch)throw new Error('Aba não confirmou propriedade; não foi encerrada');
        await api.tabs.sendMessage(ex.tabId,{cmd:'COLETA_ABORT',sessionId:s.id,epoch:s.epoch});
        await api.tabs.remove(ex.tabId);
      }
    }catch(error){
      try{await api.tabs.get(ex.tabId);}catch{return;}
      throw error;
    }
  }
  async function alive(s){
    if(s.runId!==await runId())return {ownerAlive:false,executorAlive:false};
    let ownerAlive=false,executorAlive=false;
    try{const t=await api.tabs.get(Number(s.owner));ownerAlive=(t.pendingUrl||t.url)?.startsWith(api.runtime.getURL(''));if(s.schemaVersion===2&&ownerAlive){const proof=await api.tabs.sendMessage(Number(s.owner),{cmd:'AUTONOMA_OWNER_PROOF',id:s.id,token:s.ownerToken});ownerAlive=proof?.token===s.ownerToken&&proof.runId===s.runId;}}catch{if(s.schemaVersion===2)try{const t=await api.tabs.get(Number(s.owner));ownerAlive=(t.pendingUrl||t.url)?.startsWith(api.runtime.getURL('runner.html'));}catch{}}
    if(s.executor?.runId===await runId())try{
      const proof=await api.tabs.sendMessage(s.executor.tabId,{cmd:'COLETA_EXECUTOR_PROOF',sessionId:s.id,epoch:s.epoch,requestId:s.inFlight});executorAlive=proof?.sessionId===s.id&&proof.epoch===s.epoch;
    }catch{ // Falha de handshake com aba existente não prova que um fetch terminou.
      try{await api.tabs.get(s.executor.tabId);executorAlive=!!s.inFlight;}catch{}
    }
    return {ownerAlive,executorAlive};
  }
  function observe(details){
    if(details.type!=='main_frame')return;
    observations=observations.catch(()=>{}).then(async()=>{
      const key=`tab:${details.tabId}`,binding=(await store.read([key]))[key];
      if(!binding||binding.runId!==await runId())return;
      const s=await state(binding.id);if(!s?.inFlight)return;
      const a=s.attempts[s.inFlight];if(!a)return;
      const httpKey=`http:${binding.id}:${s.inFlight}`,old=(await store.read([httpKey]))[httpKey];
      if(old?.supersededRequestIds?.includes(details.requestId))return;
      const replaced=old?.networkRequestId&&old.networkRequestId!==details.requestId;
      if(replaced){
        const normalize=value=>{try{const url=new URL(value);url.hash='';return url.href;}catch{return null;}};
        // A site-owned reload creates another request/document inside the same pending navigation.
        if(a.kind!=='navigation'||!Number.isInteger(details.statusCode)||![a.url,old.finalUrl].some(url=>normalize(url)===normalize(details.url))||(old.supersededRequestIds?.length||0)>=8)return;
      }
      if(!old && details.url!==a.url)return;
      const headers={};for(const h of details.responseHeaders||[]){const n=h.name.toLowerCase();if(['retry-after','content-type','cf-mitigated','date'].includes(n))headers[n]=h.value;}
      const limited=old?.status===429;
      const data={networkRequestId:details.requestId,documentId:details.documentId??(!replaced?old?.documentId:undefined),supersededRequestIds:replaced?[...(old.supersededRequestIds||[]),old.networkRequestId]:old?.supersededRequestIds||[],status:limited?429:details.statusCode??old?.status??null,finalUrl:details.url,retryAfter:limited?old.retryAfter:headers['retry-after']??(!replaced?old?.retryAfter:undefined),serverDate:limited?old.serverDate:headers.date,mitigated:headers['cf-mitigated'],transportError:!!details.error};
      await store.transact([httpKey],()=>({writes:{[httpKey]:data},result:null}));
    });
  }
  for(const event of ['onHeadersReceived','onBeforeRedirect','onErrorOccurred']){
    const e=api.webRequest?.[event];if(e)e.addListener(observe,{urls:['https://*.idealista.pt/*'],types:['main_frame']},event==='onHeadersReceived'||event==='onBeforeRedirect'?['responseHeaders']:[]);
  }
  async function handle(identity,payload,sender){
    const action=identity.action;
    if(action==='TEST_IP'){
      await store.transact(['ip-probes'],rows=>({writes:{'ip-probes':{manual:(rows['ip-probes']?.manual||0)+1}},result:null}));
      return probeIP();
    }
    if(action==='GET_POLICY'){if(settings){const v=await settings.load();return {limits:v.limits,ipEnabled:v.ipEnabled};}return {limits:await coordinator.policy(),ipEnabled:(await api.storage.local.get(['collectionIpEnabled'])).collectionIpEnabled===true};}
    if(action==='SET_POLICY'){
      if(settings){const v=await settings.load(),r=await settings.save({expectedRevision:v.revision,values:{...v,limits:payload.limits,ipEnabled:payload.ipEnabled===true}});if(r.status!=='saved')throw Error('Configuração não salva; pause a coleta ou confira os valores.');return {limits:r.settings.limits};}
      const limits=await coordinator.updatePolicy(payload.limits);await api.storage.local.set({collectionIpEnabled:payload.ipEnabled===true});return {limits};
    }
    if(action==='LIST'){
      const sessions=await coordinator.list();for(const row of sessions){if(['running','waiting'].includes(row.state)){const s=await coordinator.metadata({id:row.id}),life=await alive(s);if(!life.ownerAlive&&!life.executorAlive)await coordinator.recover({id:s.id,...life});}}
      return coordinator.list();
    }
    if(action==='START'){
      if(!sender.tab?.id)throw new Error('Abra uma página durável de coleta');
      const conflict=s=>({status:'busy',reason:'active_session',id:s.id,activeSession:{id:s.id,mode:s.mode,createdAt:s.createdAt}});
      const active=(await coordinator.list()).find(s=>['running','waiting'].includes(s.state));if(active)return conflict(active);
      let preparing=true;
      const create=async snapshot=>{preparing=false;const date=new Date();return coordinator.start({id:crypto.randomUUID(),mode:payload.mode,owner:identity.owner,domain:'idealista.pt',startedAt:date.toISOString(),items:payload.items,
        proxyRevision:snapshot.revision,runId:await runId(),exportContext:localExportContext(date)});};
      let result;
      try{result=proxy.begin?await proxy.begin(payload.useProxy===true,create):await (async()=>{await proxy.prepare(payload.useProxy===true);return create(await proxy.snapshot());})();}
      catch(error){if(preparing)return {status:'paused',reason:'connection_setup_failed'};throw error;}
      if(result.status==='started')await writeSession(result.id,s=>{s.useProxy=payload.useProxy===true;});
      if(result.status==='busy'&&result.id){const active=await coordinator.metadata({id:result.id});if(active)return conflict(active);}
      return result;
    }
    const s=(action==='DISCARD'||action==='READ'&&!payload.full)?await coordinator.metadata({id:payload.id}):await state(payload.id);if(!s)throw new Error('Sessão ausente');
    if(s.schemaVersion===2&&identity.trusted&&(action!=='READ'||payload.full)){
      if(!sender.url?.startsWith(api.runtime.getURL('runner.html'))||s.owner!==identity.owner||s.runId!==await runId()||s.ownerDocumentId&&s.ownerDocumentId!==sender.documentId)throw new Error('Executor autônomo não autorizado');
    }
    if(!identity.trusted){
      if(action!=='VALIDATE'||s.executor?.tabId!==sender.tab.id||s.executor.runId!==await runId()||s.epoch!==payload.epoch||s.inFlight!==payload.requestId)throw new Error('Executor não associado');
      const a=s.attempts[s.inFlight];if(!a||a.reported)return {valid:false};
      if((await proxy.snapshot()).revision!==s.proxyRevision){
        await coordinator.reportPage({id:s.id,owner:s.owner,epoch:s.epoch,requestId:s.inFlight,url:a.url,proxyError:true,records:[]});return {valid:false};
      }
      if(payload.network && Date.now()>a.expiresAt)return {valid:false};
      await observations;
      const observed=(await store.read([`http:${s.id}:${payload.requestId}`]))[`http:${s.id}:${payload.requestId}`];
      const finalDocument=!payload.network&&s.attempts[payload.requestId]?.kind==='navigation'&&typeof sender.documentId==='string'&&observed?.documentId===sender.documentId;
      const valid=await writeSession(s.id,v=>{
        if(v.inFlight!==payload.requestId||v.epoch!==payload.epoch||v.executor.documentId&&v.executor.documentId!==sender.documentId&&!finalDocument)return false;
        if(!payload.network&&observed?.documentId&&observed.documentId!==sender.documentId)return false;
        const attempt=v.attempts[v.inFlight];if(payload.network&&attempt.networkDispatched)return false;
        if(payload.network)attempt.networkDispatched=true;
        v.executor.documentId=sender.documentId;return true;
      });return {valid,mode:s.mode,documentId:sender.documentId};
    }
    if(action==='READ')return payload.full?s:{id:s.id,state:s.state,reason:s.reason,epoch:s.epoch,owner:s.owner,itemIndex:s.itemIndex,items:s.items,counters:s.counters,checkpoint:{...s.checkpoint,records:undefined},exportContext:s.exportContext,diagnostics:s.events,executor:s.executor,proxyRevision:s.proxyRevision,pendingProjection:s.pendingProjection,eligibility:await coordinator.eligibility()};
    if(action==='PROBE_IP'){
      await owns(s,identity);if(s.epoch!==payload.epoch)throw new Error('Sessão antiga');
      if(settings?!(await settings.load()).ipEnabled:(await api.storage.local.get(['collectionIpEnabled'])).collectionIpEnabled!==true)return {status:'disabled'};
      const snapshot=await proxy.snapshot(),reserved=await coordinator.reserveIP({...payload,owner:identity.owner,proxyRevision:snapshot.revision});
      if(reserved.status!=='ready')return reserved;
      const controller=new AbortController();ipControllers.set(s.id,controller);
      try{return await probeIP({signal:controller.signal});}finally{if(ipControllers.get(s.id)===controller)ipControllers.delete(s.id);}
    }
    if(action==='RESUME'){
      const life=await alive(s);
      if(s.owner!==identity.owner&&life.ownerAlive)return {status:'busy',reason:'owner_alive'};
      if(life.executorAlive)await stopExecutor(s);
      if(!s.pendingProjection)await coordinator.recover({id:s.id,ownerAlive:false,executorAlive:false});
      const snapshot=await proxy.snapshot();
      const resumed=await coordinator.control({id:s.id,owner:identity.owner,epoch:s.epoch,action:'resume',proxyRevision:snapshot.revision,accessConfirmed:payload.accessConfirmed===true});
      const currentRun=await runId();
      if(resumed.status==='running')await writeSession(s.id,v=>{v.runId=currentRun;v.executor=null;});
      return resumed;
    }
    if(s.epoch!==payload.epoch)throw new Error('Sessão pertence a outra execução');
    if(action==='DISCARD'&&s.owner!==identity.owner){
      const life=await alive(s);if(life.ownerAlive)return {status:'busy',reason:'owner_alive'};
      await stopExecutor(s);const recovered=await coordinator.recover({id:s.id,ownerAlive:false,executorAlive:false,owner:identity.owner});
      return coordinator.control({id:s.id,owner:identity.owner,epoch:recovered.epoch,action:'discard'});
    }
    await owns(s,identity);
    if(['PAUSE','CANCEL','DISCARD'].includes(action)){
      ipControllers.get(s.id)?.abort();
      await stopExecutor(s);await coordinator.recover({id:s.id,ownerAlive:false,executorAlive:false});
      return coordinator.control({id:s.id,epoch:s.epoch,owner:identity.owner,action:action.toLowerCase()});
    }
    if(action==='REGISTER'){
      const tab=await api.tabs.get(payload.tabId);if(tab.url!=='about:blank')throw new Error('Aba inicial deve estar vazia');const run=await runId();
      return writeSession(s.id,(v,w)=>{v.executor={tabId:tab.id,runId:run,epoch:s.epoch};v.runId=run;w[`tab:${tab.id}`]={id:s.id,epoch:s.epoch,runId:run};return v.executor;},[`tab:${tab.id}`]);
    }
    if(action==='REQUEST'){
      if((await proxy.snapshot()).revision!==s.proxyRevision)return coordinator.control({id:s.id,epoch:s.epoch,owner:identity.owner,action:'pause',reason:'proxy_changed'});
      return coordinator.requestPage({...payload,owner:identity.owner});
    }
    if(action==='READ_HTTP'){await observations;return (await store.read([`http:${s.id}:${payload.requestId}`]))[`http:${s.id}:${payload.requestId}`]||{};}
    if(action==='REPORT'){
      try{return await coordinator.reportPage({...payload,owner:identity.owner});}
      catch{
        // A operação de rede terminou; não existe autorização para pedir a próxima página.
        try{await coordinator.recover({id:s.id,ownerAlive:false,executorAlive:false});await coordinator.control({id:s.id,owner:s.owner,epoch:s.epoch,action:'pause',reason:'checkpoint_failed'});}catch{}
        return {status:'paused',reason:'checkpoint_failed'};
      }
    }
    if(action==='SAVE_INTENT'){
      const intent=payload.intent,text=JSON.stringify(s.checkpoint.records,null,2),parts=intent?.relativePath?.split('/');
      if(!intent||!/^[\w-]{1,128}$/.test(intent.id)||!parts||intent.relativePath.length>512||parts.some(p=>!p||p==='.'||p==='..'||p.includes('\\'))||parts.length!==(s.mode==='itens'?1:2)||intent.bytes!==new TextEncoder().encode(text).length||intent.digest!==await hashText(text))throw new Error('Gravação preparada inválida');
      return writeSession(s.id,v=>{if(v.state!=='awaiting-save')throw new Error('Coleta incompleta');v.saveIntent={id:intent.id,relativePath:intent.relativePath,digest:intent.digest,bytes:intent.bytes};return v.saveIntent;});
    }
    if(action==='GET_INTENT')return s.saveIntent||null;
    if(action==='SAVE_FAILURE')return coordinator.recordSaveFailure({id:s.id,owner:identity.owner,epoch:payload.epoch,intentId:payload.intentId,reason:payload.reason});
    if(action==='ACK_PROJECTION')return writeSession(s.id,v=>{if(v.pendingProjection?.id!==payload.receiptId)throw new Error('Projeção desatualizada');v.pendingProjection=null;return {status:v.state};});
    if(action==='SAVE_RESULT'){
      if(!s.receipts[payload.receipt?.id]&&(!s.saveIntent||s.saveIntent.id!==payload.receipt?.id||s.saveIntent.relativePath!==payload.receipt?.relativePath))throw new Error('Confirmação não corresponde à gravação preparada');
      return coordinator.markSaved({...payload,owner:identity.owner});
    }
    throw new Error('Ação ainda não disponível');
  }
  registerCollectionRuntime(api,(identity,payload,sender)=>{
    const operation=()=>handle(identity,payload,sender);
    if(['READ','GET_POLICY','READ_HTTP','VALIDATE','TEST_IP','PROBE_IP'].includes(identity.action))return operation();
    const pending=mutations.catch(()=>{}).then(operation);mutations=pending.catch(()=>{});return pending;
  });
  return { coordinator, store, setSettings(value){settings=value;},
    async recoverAutonomous(id,replacedDocument){const s=await coordinator.metadata({id});if(!s)return {status:'missing'};const life=await alive(s);const replaced=s.schemaVersion===2&&replacedDocument&&s.ownerDocumentId&&replacedDocument!==s.ownerDocumentId;if(life.ownerAlive&&!replaced)return {status:'busy',reason:'owner_alive'};if(life.executorAlive)await stopExecutor(s);return coordinator.recover({id,ownerAlive:false,executorAlive:false});},
    proxyChanged(revision){
      const pending=mutations.catch(()=>{}).then(async()=>{
        for(const row of await coordinator.list())if(['running','waiting'].includes(row.state)){
          const s=await coordinator.metadata({id:row.id});if(s.proxyRevision===revision)continue;
          await stopExecutor(s);await coordinator.recover({id:s.id,ownerAlive:false,executorAlive:false});
          await coordinator.control({id:s.id,owner:s.owner,epoch:s.epoch,action:'pause',reason:'proxy_changed'});
        }
      });mutations=pending.catch(()=>{});return pending;
    },
    async busy(){return !!(await store.read(['domain:idealista.pt']))['domain:idealista.pt']?.active;}
  };
}
module.exports = { registerCollectionRuntime, createCollectionStore, installCollectionBackground };

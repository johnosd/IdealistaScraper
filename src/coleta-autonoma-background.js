const {createAutonomousCollection}=require('./coleta-autonoma');
const {identifySource}=require('./coleta-discovery');
const {loadDirectory}=require('./lote-directory-store');
const {localExportContext}=require('./coleta-download');
const UI=new Set(['sidepanel.html','configuracoes.html','lote.html','popup.html','itens.html','localidades.html']);
function installAutonomousBackground(api,{runtime,proxy,settings=null,directory=loadDirectory}){
  const {store,coordinator}=runtime,launching=new Set();let queue=Promise.resolve();
  const observer=createAutonomousCollection({store});
  const links=require('./links-collection').createLinksCollection({api,runtime,settings});
  const path=sender=>{if(sender?.id!==api.runtime.id||!sender.url?.startsWith(api.runtime.getURL('')))throw Error('Remetente recusado');return new URL(sender.url).pathname.slice(1);};
  async function runId(){const data=await api.storage.session.get(['collectionRunId']);if(data.collectionRunId)return data.collectionRunId;const id=crypto.randomUUID();await api.storage.session.set({collectionRunId:id});return id;}
  async function binding(id){return (await api.storage.session.get(['autonomous:'+id]))['autonomous:'+id];}
  async function notify(id){
    await api.runtime.sendMessage?.({type:'AUTONOMA_CHANGED',id}).catch(()=>{});
    try{const rows=await observer.list(),active=rows.find(r=>['running','waiting','discovering','pausing'].includes(r.state)),last=active||rows.at(-1);
      const text=!last?'':active?'•':last.summary.pending?String(last.summary.pending):last.state==='completed'?'✓':'!';
      await api.action?.setBadgeText({text});await api.action?.setTitle?.({title:last?'IdealistaScraper — '+(active?'Coleta em andamento':last.state==='completed'?'Captura concluída':'Coleta com pendências'):'IdealistaScraper'});
    }catch{}
  }
  async function cleanupDead(){
    for(const row of await coordinator.list()){
      if(launching.has(row.id))continue;
      const s=await coordinator.metadata({id:row.id});
      if(s.schemaVersion!==2)continue;
      // 006 T074: sessão parada (ex.: limite por hora) ainda marcada com executor vivo também é verificada —
      // executor encerrado (extensão recarregada, aba fechada) não pode deixar o painel preso em "Pausando…".
      if(!['running','waiting','awaiting-save','discovering'].includes(s.state)&&!(s.runnerLive&&!['saved','discarded','completed'].includes(s.state)))continue;
      let alive=false;
      if(s.runId===await runId())try{const tab=await api.tabs.get(Number(s.owner));alive=(tab.pendingUrl||tab.url)?.startsWith(api.runtime.getURL('runner.html'));}catch{}
      if(!alive)await runtime.recoverAutonomous(s.id);
    }
  }
  async function createRunner(id,operation,extra={}){
    const s=await coordinator.metadata({id}),browser=await runId(),token=crypto.randomUUID();
    launching.add(id);
    try{
      const tab=await api.tabs.create({url:api.runtime.getURL('runner.html')+'?id='+encodeURIComponent(id)+'&token='+token,active:false});
      await api.tabs.update(tab.id,{autoDiscardable:false});
      const bound=await coordinator.bindOwner({id,owner:s.owner,epoch:s.epoch,newOwner:String(tab.id),runId:browser});
      if(bound.status!=='ready'){await api.tabs.remove(tab.id);return bound;}
      await api.storage.session.set({['autonomous:'+id]:{id,tabId:tab.id,token,runId:browser,operation,source:s.source,commandId:s.commandId,...extra}});
      return {status:'accepted',id};
    }catch{
      await coordinator.recover({id,ownerAlive:false,executorAlive:false});return {status:'interrupted',id,reason:'runner_unavailable'};
    }finally{launching.delete(id);}
  }
  async function runnerIdentity(sender,payload,attach=false){
    if(path(sender)!=='runner.html'||!sender.tab?.id||sender.frameId&&sender.frameId!==0)throw Error('Runner inválido');
    const b=await binding(payload.id);
    if(!b||b.tabId!==sender.tab.id||b.token!==payload.token||b.runId!==await runId())return null;
    const s=await coordinator.metadata({id:b.id});
    if(!s||s.owner!==String(sender.tab.id)||s.runId!==b.runId)return null;
    if(s.ownerDocumentId&&s.ownerDocumentId!==sender.documentId){
      if(attach&&sender.documentId){const recovered=await runtime.recoverAutonomous(s.id,sender.documentId);if(recovered.status!=='busy'){await store.transact(['session:'+s.id],rows=>{const v=rows['session:'+s.id];v.owner='unbound';v.epoch++;v.ownerDocumentId=null;v.ownerToken=null;return {writes:rows,result:null};});await api.storage.session.set({['autonomous:'+s.id]:null});await notify(s.id);}}
      return null;
    }
    return {b,s};
  }
  async function handle(action,payload,sender){
    const senderPath=path(sender);
    if(['LINKS_CLAIM','LINKS_FAILED','LINKS_FINISHED'].includes(action)){
      if(senderPath!=='runner.html'||!sender.tab?.id||sender.frameId&&sender.frameId!==0)throw Error('Executor recusado');
      return links.handle(action,payload,sender);
    }
    if(['ATTACH','PROXY_SNAPSHOT','CHANGED','FINISHED'].includes(action)){
      const identity=await runnerIdentity(sender,payload,action==='ATTACH');if(!identity)return {status:'inactive'};
      const {b,s}=identity;
      if(action==='ATTACH'){
        await store.transact(['session:'+s.id],rows=>{const v=rows['session:'+s.id];v.ownerDocumentId=sender.documentId||null;v.ownerToken=b.token;return {writes:rows,result:null};});
        return {status:'ready',...b,owner:String(b.tabId)};
      }
      if(action==='PROXY_SNAPSHOT')return proxy.snapshot();
      await notify(s.id);
      if(action==='FINISHED'&&!s.driveToken&&!s.inFlight&&!['running','waiting','discovering'].includes(s.state)){
        await store.transact(['session:'+s.id],rows=>{const v=rows['session:'+s.id];v.runnerLive=false;v.revision++;return {writes:rows,result:null};});
        // Só a aba técnica autenticada, nunca o painel ou a origem.
        await api.tabs.remove(b.tabId).catch(()=>{});
        await api.storage.session.set({['autonomous:'+s.id]:null});
        await notify(s.id);
      }
      return {status:'ok'};
    }
    if(!UI.has(senderPath)||sender.frameId&&sender.frameId!==0)throw Error('Superfície não autorizada');
    if(action.startsWith('LINKS_'))return links.handle(action,payload,sender);
    if(action==='LIST'){await cleanupDead();return observer.list();}
    if(action==='READ'){await cleanupDead();return observer.read({id:payload.id});}
    if(action==='READ_ITEM'){
      const view=await observer.read({id:payload.id});return view.items.find(i=>i.id===payload.itemId)||null;
    }
    if(action==='GET_SETTINGS')return settings?settings.load():{revision:0,limits:await coordinator.policy(),useProxy:(await api.storage.local.get(['usarProxy'])).usarProxy==='true',ipEnabled:false,proxy:{host:'',port:'',user:'',passwordConfigured:false}};
    if(action==='REVEAL_PROXY_PASSWORD'){if(senderPath!=='configuracoes.html'||!settings)throw Error('Superfície não autorizada');return settings.revealPassword({expectedRevision:payload.expectedRevision});}
    if(action==='ACTIVITY')return {active:await runtime.busy()};
    if(action==='SAVE_SETTINGS'){if(!settings)throw Error('Configurações indisponíveis');return settings.save(payload);}
    if(action==='TEST_IP'){await store.transact(['ip-probes'],rows=>({writes:{'ip-probes':{manual:(rows['ip-probes']?.manual||0)+1}},result:null}));return require('./coleta-ip').probePublicIP();}
    if(action==='START'){
      await cleanupDead();
      let source;
      if(payload.fromPrepared===true){
        // 006 D4: fila preparada pelos Links; origem = coleta de links, sem exigir a aba original.
        const prepared=(await api.storage.local.get(['lote:prepared']))['lote:prepared'];
        if(!prepared?.linksSessionId||!Array.isArray(prepared.entries)||!prepared.entries.length)return {status:'interrupted',reason:'prepared_missing'};
        // R-020: freguesias por distrito (lista de validação da Freguesia), até 5.000 pares curtos.
        const freguesias=(Array.isArray(prepared.freguesias)?prepared.freguesias:[]).filter(p=>Array.isArray(p)&&p.length===2&&p.every(v=>typeof v==='string'&&v.length<=200)).slice(0,5000);
        source={linksSessionId:prepared.linksSessionId,url:prepared.origin?.url||prepared.entries[0].url,freguesias};
      }else{
        source=await identifySource(api,payload.source?.tabId);
        if(payload.source?.url&&source.url!==payload.source.url)return {status:'interrupted',reason:'source_changed'};
      }
      const selected=await directory();if(!selected||await selected.queryPermission({mode:'readwrite'})!=='granted')return {status:'needs-configuration',reason:'permission_required'};
      const config=settings?await settings.load():{useProxy:(await api.storage.local.get(['usarProxy'])).usarProxy==='true'};
      const known=(await store.read(['launch:'+payload.commandId]))['launch:'+payload.commandId];
      if(known){const fingerprint=JSON.stringify({source:{tabId:source.tabId,url:source.url,documentId:source.documentId||null},useProxy:config.useProxy===true});return known.fingerprint===fingerprint?{status:'accepted',id:known.id}:{status:'rejected',reason:'command_conflict'};}
      const active=(await store.read(['domain:idealista.pt']))['domain:idealista.pt']?.active;if(active)return {status:'busy',id:active,reason:'active_session'};
      const id=crypto.randomUUID(),date=new Date(),browser=await runId();
      const reserve=async snapshot=>coordinator.reserveLaunch({id,owner:'launch',commandId:payload.commandId,source,useProxy:config.useProxy,domain:'idealista.pt',startedAt:date.toISOString(),exportContext:localExportContext(date),runId:browser,proxyRevision:snapshot.revision});
      const result=proxy.begin?await proxy.begin(config.useProxy,reserve):await reserve(await proxy.snapshot());
      if(!['reserved','duplicate'].includes(result.status))return result;
      return createRunner(result.id,'start',{useProxy:config.useProxy});
    }
    if(['PAUSE','RESUME'].includes(action)){
      await cleanupDead();const s=await coordinator.metadata({id:payload.id});if(!s)throw Error('Execução inexistente');
      const b=await binding(s.id);
      if(b&&b.runId===await runId()){
        try{const proof=await api.tabs.sendMessage(b.tabId,{cmd:'AUTONOMA_OWNER_PROOF',id:s.id,token:b.token});
          if(proof?.token===b.token&&proof.runId===b.runId){return await api.tabs.sendMessage(b.tabId,{cmd:'AUTONOMA_COMMAND',token:b.token,action,payload:{id:s.id,selection:payload.selection,accessConfirmed:payload.accessConfirmed===true,retrySave:payload.retrySave===true}});}
        }catch{}
      }
      if(action==='PAUSE'){const r=await runtime.recoverAutonomous(s.id);await notify(s.id);return r;}
      const recovered=await runtime.recoverAutonomous(s.id);if(recovered.status==='busy')return recovered;
      return createRunner(s.id,'resume',{selection:payload.selection||'remaining',accessConfirmed:payload.accessConfirmed===true,retrySave:payload.retrySave===true});
    }
    if(action==='BEGIN_DESTINATION'){
      const token=crypto.randomUUID();return store.transact(['session:'+payload.id,'domain:idealista.pt'],rows=>{const s=rows['session:'+payload.id];if(!s||rows['domain:idealista.pt']?.active||s.driveToken||s.inFlight)return {writes:{},result:{status:'busy'}};if(payload.itemId&&!s.itemStates?.[payload.itemId]?.recoverable)return {writes:{},result:{status:'invalid'}};s.revision++;s.destinationDraft={token,itemId:payload.itemId||null,documentId:sender.documentId||null,revision:s.revision};return {writes:{['session:'+s.id]:s},result:{status:'ready',token}};});
    }
    if(action==='CANCEL_DESTINATION')return {status:'cancelled'};
    if(action==='BIND_DESTINATION'){
      const s=await coordinator.metadata({id:payload.id});if(!s||s.driveToken||s.inFlight)return {status:'busy'};
      return store.transact(['session:'+s.id,'domain:idealista.pt'],rows=>{if(rows['domain:idealista.pt']?.active)return {writes:{},result:{status:'busy'}};const v=rows['session:'+s.id],draft=v.destinationDraft;if(!draft||draft.token!==payload.token||draft.itemId!==(payload.itemId||null)||draft.documentId!==(sender.documentId||null)||draft.revision!==v.revision)return {writes:{},result:{status:'conflict'}};if(payload.itemId){const item=v.itemStates?.[payload.itemId];if(!item?.recoverable)return {writes:{},result:{status:'invalid'}};item.destinationKey=payload.token;item.destinationHandleKey=payload.token;}else v.destinationHandleKey=payload.token;v.destinationDraft=null;v.revision++;return {writes:{['session:'+s.id]:v},result:{status:'saved'}};});
    }
    if(action==='DISCARD'){
      const s=await coordinator.metadata({id:payload.id});if(!s||payload.confirmed!==true)return {status:'confirmation-required'};
      const recovered=await runtime.recoverAutonomous(s.id);if(recovered.status==='busy')return recovered;
      const current=await coordinator.metadata({id:s.id});
      if(payload.itemId){const result=await coordinator.discardItem({id:s.id,owner:current.owner,epoch:current.epoch,itemId:payload.itemId,confirmed:true});await notify(s.id);return result;}
      const result=await coordinator.control({id:s.id,owner:current.owner,epoch:current.epoch,action:'discard'});await notify(s.id);return result;
    }
    throw Error('Comando desconhecido');
  }
  api.runtime.onMessage.addListener((message,sender,respond)=>{
    if(!message?.cmd?.startsWith('AUTONOMA_'))return;
    const action=message.cmd.slice(9);
    // Observação/handshake não entram na fila de intents longa.
    const operation=()=>handle(action,message.payload||{},sender);
    const pending=['ATTACH','PROXY_SNAPSHOT','CHANGED','FINISHED','READ','READ_ITEM','LIST','GET_SETTINGS'].includes(action)?Promise.resolve().then(operation):queue.catch(()=>{}).then(operation);
    if(!['ATTACH','PROXY_SNAPSHOT','CHANGED','FINISHED','READ','READ_ITEM','LIST','GET_SETTINGS'].includes(action))queue=pending.catch(()=>{});
    pending.then(result=>respond({ok:true,result}),()=>respond({ok:false,code:'AUTONOMOUS_ERROR',message:'Ação indisponível. Confira a execução e suas configurações.'}));return true;
  });
  api.runtime.onStartup?.addListener(()=>{cleanupDead().then(()=>notify()).catch(()=>{});});
  api.tabs.onRemoved?.addListener(id=>{
    Promise.resolve().then(async()=>{for(const row of await coordinator.list()){const s=await coordinator.metadata({id:row.id});if(s.schemaVersion!==2)continue;
      if(s.executor?.tabId===id)await store.transact(['session:'+s.id],rows=>{rows['session:'+s.id].executor=null;return {writes:rows,result:null};});
      if(s.owner===String(id)&&!['saved','discarded'].includes(s.state)){await runtime.recoverAutonomous(s.id);await notify(s.id);}
    }}).catch(()=>{});
  });
  return {notify,handle,cleanupDead};
}
module.exports={installAutonomousBackground};

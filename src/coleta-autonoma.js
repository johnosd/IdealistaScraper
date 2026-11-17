const {createCollectionCoordinator,normalizedURL}=require('./coleta-coordinator');
const {counts}=require('./coleta-items');
const {getMunicipalityDestination}=require('./lote-export');
const {hashText,abortableDelay}=require('./coleta-runner');
const {classifySaveFailure}=require('./coleta-save-failure');
const {assessListing,withContext,matchFreguesia,knownFreguesias}=require('./coleta-completeness');
const {planBlockRecovery}=require('./coleta-block-recovery');
const live=new WeakMap();
function normalizeItems(rows){
  if(!Array.isArray(rows)||!rows.length)throw new Error('Nenhuma localidade encontrada na página.');
  const seen=new Set();return rows.map((row,index)=>{const url=normalizedURL(row.url||row.link||row.URL);return {nome:String(row.nome||row.Texto||row['Município']||url).trim(),url,quantidade:Number.isFinite(row.quantidade)?row.quantidade:null,index,
    // 006 FR-026: contexto geográfico da entrada (validado em coordinator.start).
    ...(row.context&&typeof row.context==='object'?{context:row.context}:{}),...(typeof row.freguesia==='string'?{freguesia:row.freguesia}:{})};})
    .filter(row=>{if(seen.has(row.url))return false;seen.add(row.url);return true;})
    .sort((a,b)=>(b.quantidade??-1)-(a.quantidade??-1)||a.index-b.index);
}
// 006: executor vivo numa espera automática do runQueue (janela/limite/bloqueio) é uma espera, não uma pausa em andamento.
function autoWaiting(s,now=Date.now()){return !!(s.runnerLive&&s.autoRecovery&&s.autoRecovery.until>now&&['paused','blocked','interrupted'].includes(s.state)&&s.reason!=='paused');}
function publicRun(s,now=Date.now()){
  if(!s)return null;
  const summary=counts(s);
  const items=s.items.map(item=>{const v=s.itemStates[item.id];return {...item,state:v.state,reason:v.reason,stage:v.checkpoint?.complete?'save':'collection',recoverable:v.recoverable!==false,
    destinationHandleKey:v.destinationHandleKey||null,completeness:v.completeness||null,dedup:v.dedup||null,checkpoint:{confirmedPages:v.checkpoint?.confirmedPages||0,recordCount:v.checkpoint?.recordCount||0,nextUrl:v.checkpoint?.nextUrl||null,complete:v.checkpoint?.complete||false},receipt:v.receipt?{relativePath:v.receipt.relativePath,directoryName:v.receipt.directoryName,directoryKey:v.receipt.directoryKey||null}:null};});
  // 006: dedup e listagens limitadas ficam fora de `summary` (D10).
  const dedupItems={};for(const item of s.items){const d=s.itemStates[item.id]?.dedup;if(d)dedupItems[item.id]={new:d.new,repeated:d.repeated};}
  const limitedCount=Object.values(s.itemStates).filter(v=>v.completeness?.status==='limited').length;
  return {dedup:{unique:s.dedupUnique||0,items:dedupItems},limitedCount,autoRecovery:s.autoRecovery?{rechecks:s.autoRecovery.rechecks,until:s.autoRecovery.until,action:s.autoRecovery.action}:null,cycle:s.cycle?.n||0,id:s.id,source:s.source||null,createdAt:s.createdAt,state:autoWaiting(s,now)?'waiting':s.runnerLive&&!['running','waiting','discovering'].includes(s.state)?'pausing':s.runState||s.state,reason:s.reason,epoch:s.epoch,revision:s.revision,items,summary,exportContext:s.exportContext,counters:s.counters,destinationHandleKey:s.destinationHandleKey||null,currentItemId:s.items[s.itemIndex]?.id,diagnostics:(s.events||[]).slice(-30)};
}
function createAutonomousCollection(options){
  const {store,now=Date.now,nextId=()=>crypto.randomUUID()}=options;
  if(!store)throw new TypeError('Persistência obrigatória');
  const c=createCollectionCoordinator({store,now});
  if(!live.has(store))live.set(store,new Map());const controllers=live.get(store);const queues=new Set();
  const notify=id=>Promise.resolve(options.onChange?.({id})).catch(()=>{});
  // 006 FR-016/014: dedup por id entre entradas (chave seen:<id>) e completude da listagem; idempotente por item.
  async function resolveItem(id,itemId,records,checkpoint){
    const keys=[...new Set(records.map(r=>String(r?.id||r?.Link||JSON.stringify(r))))];
    await store.transact(['session:'+id,'seen:'+id],rows=>{
      const s=rows['session:'+id],v=s?.itemStates?.[itemId];if(!v||v.dedup)return {writes:{},result:null};
      const seen=new Set(rows['seen:'+id]?.ids||[]);let fresh=0,repeated=0;
      for(const key of keys){if(seen.has(key))repeated++;else{seen.add(key);fresh++;}}
      v.dedup={new:fresh,repeated};v.completeness=assessListing({declaredTotal:checkpoint?.declaredTotal??null,obtained:records.length,budgetReached:checkpoint?.budgetReached===true});
      s.dedupUnique=seen.size;s.revision++;
      return {writes:{['session:'+id]:s,['seen:'+id]:{ids:[...seen]}},result:null};
    });
  }
  // 006 R4: Freguesia só de fonte verificável — a própria entrada, ou o sufixo do título se for freguesia conhecida da fila.
  // R-020: lista por distrito = freguesias da fila + as lidas nas páginas de distrito na coleta de links (source.freguesias).
  const freguesiaCache=new WeakMap();
  function freguesiaFor(item,record,s){if(!freguesiaCache.has(s))freguesiaCache.set(s,knownFreguesias(s.items,s.source?.freguesias));return matchFreguesia(item,record,freguesiaCache.get(s));}
  const identity=s=>({id:s.id,owner:s.owner,epoch:s.epoch});
  async function metadata(id){const s=await c.metadata({id});if(!s)throw new Error('Execução não encontrada.');return s;}
  async function finishPause(s,reason){
    // Só após transporte encerrado/abort confirmado, nunca por lease.
    await c.recover({id:s.id,ownerAlive:false,executorAlive:false,keepRunner:options.managedRunner===true});
    const current=await metadata(s.id);return c.control({...identity(current),action:'pause',reason});
  }
  const service={
    coordinator:c,
    async start(input){
      const source=structuredClone(input.source);normalizedURL(source?.url);
      // Fila preparada a partir de Links (006 D4) não depende de uma aba aberta.
      if(!source.linksSessionId&&(!Number.isInteger(source.tabId)||source.tabId<=0))throw new TypeError('Página de origem inválida.');
      if(options.policy)await store.transact(['policy'],rows=>({writes:rows.policy?{}:{policy:require('./coleta-policy').validatePolicy(options.policy)},result:null}));
      const preflight=await options.preflight({source,useProxy:input.useProxy===true});
      if(preflight.status!=='ready')return {...preflight,status:preflight.status||'needs-configuration'};
      const startedAt=new Date(now()).toISOString(),date=new Date(startedAt);
      const exportContext={yearMonth:String(date.getFullYear()).padStart(4,'0')+String(date.getMonth()+1).padStart(2,'0')};
      let id=nextId();const owner=input.owner;
      const reservation=await c.reserveLaunch({id,commandId:input.commandId,source,useProxy:input.useProxy,owner,startedAt,exportContext,runId:options.runId,proxyRevision:preflight.proxyRevision});
      if(reservation.status==='duplicate'){const old=await metadata(reservation.id);if(input.launchId===old.id&&old.owner===owner&&old.state==='discovering')id=old.id;else return {status:['discovering','running','waiting','awaiting-save'].includes(old.state)?'started':'interrupted',id:old.id};}
      else if(reservation.status!=='reserved')return reservation;
      await notify(id);
      try{
        const found=await options.discover(source);
        if(!found?.source||found.source.url!==source.url||source.documentId&&found.source.documentId!==source.documentId)throw new Error('A página de origem mudou. Tente novamente.');
        const items=normalizeItems(found.items);
        const current=await metadata(id);if(current.state!=='discovering')return {status:'interrupted',id};
        if(current.proxyRevision&&current.proxyRevision!==preflight.proxyRevision)throw new Error('Configuração de conexão mudou.');
        const result=await c.start({id,mode:'lote',autonomous:true,commandId:input.commandId,source,items,owner,domain:'idealista.pt',startedAt:current.createdAt,exportContext:current.exportContext,proxyRevision:preflight.proxyRevision,runId:options.runId});
        await options.onStarted?.({id,source});await notify(id);return result;
      }catch(error){const current=await metadata(id);if(current.owner===owner)await c.control({id,owner,epoch:current.epoch,action:'pause',reason:'discovery_failed'});await notify(id);return {status:'interrupted',id,reason:'discovery_failed',message:error?.message==='Nenhuma localidade encontrada na página.'?error.message:'Não foi possível obter a lista desta página. Confira a origem e tente novamente.'};}
    },
    async read({id}){const s=await metadata(id);if(s.schemaVersion!==2)return publicRun(await c.read({id}).then(old=>{const copy=structuredClone(old);require('./coleta-items').initializeItems(copy);return copy;}));const out=publicRun(s,now());out.eligibility=await c.eligibility();return out;},
    async list(){const sessions=await c.list();const out=[];for(const row of sessions.filter(s=>s.mode==='lote'))try{out.push(await service.read({id:row.id}));}catch{}return out;},
    async resume(input){
      let s=await metadata(input.id);if(s.schemaVersion===1){const promoted=await c.promote({...identity(s)});if(promoted.status!=='ready')return promoted;s=await metadata(s.id);}
      try{for(const item of s.items){const v=s.itemStates[item.id],selection=input.selection||'remaining';if(v.recoverable!==false&&(typeof selection==='object'?item.id===selection.itemId:selection==='pending'?v.state==='pending':v.state==='queued'||v.state==='pending'&&!v.localFailure))await c.readItem({id:s.id,itemId:item.id});}}
      catch{return {status:'incompatible',reason:'incompatible_context'};}
      const proxy=await options.proxySnapshot();
      const result=await c.selectItems({id:s.id,owner:input.owner,epoch:s.epoch,selection:input.selection||'remaining',proxyRevision:proxy.revision,accessConfirmed:input.accessConfirmed===true,connectionConfirmed:input.connectionConfirmed===true,runId:options.runId});
      // 006 T075: retomada recusada só por espera (limite por hora, prazo do site) ou fim do ciclo troca o motivo
      // (ex.: "paused" do usuário) pelo motivo real, para o runQueue aguardar/renovar sozinho em vez de parar.
      const autoReason=result.status==='wait'?result.reason:result.status==='paused'&&result.reason==='session_duration'?result.reason:null;
      if(autoReason&&autoReason!=='interval')await store.transact(['session:'+s.id],rows=>{const row=rows['session:'+s.id];if(row&&row.owner===input.owner&&['paused','interrupted'].includes(row.state)&&row.reason!==autoReason){row.reason=autoReason;row.revision++;}return {writes:rows,result:null};});
      // 006 T076: recusa da retomada fica visível no painel (antes só aparecia na aba técnica do executor).
      if(!autoReason&&!['accepted','busy'].includes(result.status)&&result.reason&&input.connectionConfirmed===true)await store.transact(['session:'+s.id],rows=>{const row=rows['session:'+s.id];if(row&&['paused','interrupted'].includes(row.state)){row.reason=result.reason;row.revision++;}return {writes:rows,result:null};});
      if(result.status==='accepted'&&input.retrySave)await store.transact(['session:'+s.id],rows=>{const row=rows['session:'+s.id];row.explicitSaveRetry=true;return {writes:rows,result:null};});
      await notify(s.id);return result;
    },
    async pause({id,owner}){
      const s=await metadata(id);if(s.owner!==owner)return {status:'busy',reason:'owner_alive'};
      const active=controllers.get(id);if(active){active.abort();await store.transact(['session:'+id],rows=>{rows['session:'+id].runState='pausing';return {writes:rows,result:null};});await notify(id);return {status:'pausing'};}
      const result=await c.control({...identity(s),action:'pause'});await notify(id);return result;
    },
    async drive({id,owner}){
      let s=await metadata(id);if(s.owner!==owner)return {status:'busy',reason:'owner_alive'};
      const token=nextId(),claim=await c.claimDrive({...identity(s),token});if(claim.status!=='ready')return claim;
      const controller=new AbortController();controllers.set(id,controller);
      try{
        while(!controller.signal.aborted){
          s=await metadata(id);if(!['running','waiting','awaiting-save'].includes(s.state))break;
          const item=s.items[s.itemIndex],state=s.itemStates[item.id];
          if(state.state==='pending'&&state.localFailure){await c.advanceItem({...identity(s),itemId:item.id,outcome:'local-failure'});await notify(id);continue;}
          if(s.checkpoint.complete){
            if(s.checkpoint.recordCount===0){await resolveItem(id,item.id,[],s.checkpoint);await c.advanceItem({...identity(s),itemId:item.id,outcome:'empty'});await notify(id);continue;}
            const view=await c.read({id});const ym=s.exportContext.yearMonth,startedAt=new Date(Number(ym.slice(0,4)),Number(ym.slice(4))-1,1);
            // 006 FR-016/014: deduplicação no resumo e completude antes da gravação (idempotente).
            await resolveItem(id,item.id,view.checkpoint.records,s.checkpoint);
            // 006 FR-026/027 (D11): contexto só no arquivo; páginas no store continuam como extraídas.
            const records=view.checkpoint.records.map(record=>withContext(record,item.context,freguesiaFor(item,record,s)));
            const target=getMunicipalityDestination({startedAt,nome:item.nome,totalPages:s.checkpoint.confirmedPages});
            const collision=Object.values(s.itemStates).some(v=>v.id!==item.id&&v.receipt?.relativePath===target.relativePath&&(v.destinationKey||'default')===(state.destinationKey||'default'));
            if(collision||options.validateDestination&&!await options.validateDestination({id,itemId:item.id,relativePath:target.relativePath})){await c.pendingSave({...identity(s),reason:'destination_collision',local:true});await notify(id);continue;}
            let intent=s.saveIntent,result;
            if(intent&&!s.explicitSaveRetry){result=await options.reconcile(intent,{id,itemId:item.id});if(result?.status!=='saved'){await c.pendingSave({...identity(s),reason:'write_error'});break;}}
            else{
              const text=JSON.stringify(records,null,2);
              intent={id:nextId(),relativePath:target.relativePath,digest:await hashText(text),bytes:new TextEncoder().encode(text).length};
              await c.prepareSave({...identity(s),intent});
              try{result=await options.write({id,itemId:item.id,records,startedAt,nome:item.nome,totalPages:s.checkpoint.confirmedPages,destinationKey:state.destinationKey});}
              catch(error){await c.pendingSave({...identity(s),reason:classifySaveFailure(error)});break;}
              if(result?.status==='destination_collision'){await c.pendingSave({...identity(s),reason:'destination_collision',local:true});await notify(id);continue;}
              if(result?.status!=='saved'){await c.pendingSave({...identity(s),reason:classifySaveFailure(result)});break;}
            }
            const saved=await c.markSaved({...identity(s),receipt:{id:intent.id,relativePath:result.relativePath||intent.relativePath,directoryName:result.directoryName}});
            if(saved.status==='rejected')throw new Error('Gravação não confirmada');
            await notify(id);continue;
          }
          const proxy=await options.proxySnapshot();if(proxy.revision!==s.proxyRevision){await finishPause(s,'proxy_changed');break;}
          const prepared=await options.preparePage?.({...identity(s),itemId:item.id,url:s.checkpoint.nextUrl});
          const command={...identity(s),itemId:item.id,requestId:nextId(),url:s.checkpoint.nextUrl,kind:prepared?.kind||(s.checkpoint.confirmedPages?'pagination':'navigation')};
          const permit=await c.requestPage(command);
          // 006 D9: limite por localidade concluiu o item; o próximo ciclo grava e segue a fila.
          if(permit.status==='awaiting-save'){await notify(id);continue;}
          if(permit.status==='wait'){
            await notify(id);if(permit.reason==='window_budget'){await finishPause(s,'window_budget');break;}
            if(options.waitUntil)await options.waitUntil(permit.until,controller.signal);else await abortableDelay(Math.min(60000,Math.max(1,permit.until-now())),controller.signal);continue;
          }
          if(permit.status!=='ready')break;
          if(controller.signal.aborted)break;
          let facts;
          try{facts=await options.executePage({...command,...permit,signal:controller.signal});}catch(error){if(controller.signal.aborted)break;facts={transportError:true,records:[],finalUrl:command.url};}
          if(controller.signal.aborted)break;
          try{await c.reportPage({...command,...facts});}catch{await finishPause(s,'checkpoint_failed');break;}
          await notify(id);
        }
        if(controller.signal.aborted)await finishPause(await metadata(id),'paused');
      }catch(error){
        // Diagnóstico sanitizado (sem URL/credenciais): tipo e começo da mensagem do erro que interrompeu a execução.
        const detail=String(error?.message||error).replace(/https?:\/\/\S+/g,'<url>').slice(0,160);
        await store.transact(['session:'+id],rows=>{const v=rows['session:'+id];if(v){(v.events||(v.events=[])).push({time:now(),code:'execution_error',detail});v.revision++;}return {writes:rows,result:null};}).catch(()=>{});
        await finishPause(await metadata(id),controller.signal.aborted?'paused':error?.code==='COLLECTION_TAB_CLOSED'?'collection_tab_closed':'execution_failed');}
      finally{controllers.delete(id);await c.releaseDrive({id,token});if(!queues.has(id))await options.closeTransport?.({id,keep:(await metadata(id)).reason==='access_blocked'});await notify(id);}
      return service.read({id});
    },
    // 006: drive + esperas/verificações automáticas conforme options.autoRecovery
    // ({maxRechecks}). Sem autoRecovery, deve equivaler a drive(). Ver logic/recuperacao-de-bloqueio.md.
    // 006 US5/D8/D13: drive + esperas/verificações automáticas (opt-in por options.autoRecovery).
    // Ver logic/recuperacao-de-bloqueio.md. Sem autoRecovery equivale a drive().
    async runQueue({id,owner}){
      if(!options.autoRecovery)return service.drive({id,owner});
      const maxRechecks=Number.isInteger(options.autoRecovery.maxRechecks)?options.autoRecovery.maxRechecks:3;
      queues.add(id);
      try{
        let skipDrive=false;
        for(let guard=0;guard<100000;guard++){
          if(!skipDrive)await service.drive({id,owner});skipDrive=false;
          let s=await metadata(id);
          const memo=s.autoRecovery||{rechecks:0,confirmed:0};
          // Página confirmada depois da última verificação: o bloqueio passou; zera o contador.
          const rechecks=(s.counters?.confirmed||0)>(memo.confirmed||0)?0:memo.rechecks||0;
          // O limite de tentativas por página (004) pode chegar antes do de verificações: se a parada veio de
          // uma reverificação/espera contada sem página confirmada, o motivo real é o bloqueio persistente.
          if(s.reason==='attempts_exhausted'&&rechecks>0&&['recheck','resume'].includes(memo.action)){
            const reason=memo.action==='recheck'?'access_blocked_persistent':'rate_limit_persistent';
            if(s.owner===owner)await c.control({...identity(s),action:'pause',reason});await notify(id);return service.read({id});
          }
          const plan=planBlockRecovery({state:s.runState||s.state,reason:s.reason,until:(await c.eligibility())?.until??null,now:now(),rechecks,maxRechecks});
          if(plan.action==='stop'){
            if(plan.reason&&plan.reason!==s.reason&&s.owner===owner)await c.control({...identity(s),action:'pause',reason:plan.reason});
            await notify(id);return service.read({id});
          }
          await store.transact(['session:'+id],rows=>{const v=rows['session:'+id];v.autoRecovery={rechecks:rechecks+(plan.counts?1:0),confirmed:s.counters?.confirmed||0,until:plan.until,action:plan.action};v.revision++;return {writes:rows,result:null};});
          await notify(id);
          const waiter=new AbortController();controllers.set(id,waiter);
          try{if(options.waitUntil)await options.waitUntil(plan.until,waiter.signal);else await abortableDelay(Math.max(1,plan.until-now()),waiter.signal);}
          catch{if(waiter.signal.aborted){s=await metadata(id);if(s.owner===owner)await c.control({...identity(s),action:'pause',reason:'paused'});await notify(id);return service.read({id});}}
          finally{if(controllers.get(id)===waiter)controllers.delete(id);}
          s=await metadata(id);if(s.owner!==owner||s.reason==='paused')return service.read({id});
          if(plan.action==='renew'){const renewed=await c.renewCycle({...identity(s)});if(renewed.status!=='ready')return service.read({id});}
          const r=await service.resume({id,owner,selection:'remaining',accessConfirmed:plan.action==='recheck'});
          if(r.status==='wait'){skipDrive=true;continue;}
          if(r.status!=='accepted')return service.read({id});
        }
        return service.read({id});
      }finally{queues.delete(id);const last=await metadata(id).catch(()=>null);await options.closeTransport?.({id,keep:['access_blocked','access_blocked_persistent'].includes(last?.reason)});}
    }
  };return service;
}
module.exports={createAutonomousCollection,normalizeItems,publicRun};

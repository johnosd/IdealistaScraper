const {createCollectionCoordinator,normalizedURL}=require('./coleta-coordinator');
const {counts}=require('./coleta-items');
const {getMunicipalityDestination}=require('./lote-export');
const {hashText,abortableDelay}=require('./coleta-runner');
const {classifySaveFailure}=require('./coleta-save-failure');
const live=new WeakMap();
function normalizeItems(rows){
  if(!Array.isArray(rows)||!rows.length)throw new Error('Nenhuma localidade encontrada na página.');
  const seen=new Set();return rows.map((row,index)=>{const url=normalizedURL(row.url||row.link||row.URL);return {nome:String(row.nome||row.Texto||row['Município']||url).trim(),url,quantidade:Number.isFinite(row.quantidade)?row.quantidade:null,index,
    // 006 FR-026: contexto geográfico da entrada (validado em coordinator.start).
    ...(row.context&&typeof row.context==='object'?{context:row.context}:{}),...(typeof row.freguesia==='string'?{freguesia:row.freguesia}:{})};})
    .filter(row=>{if(seen.has(row.url))return false;seen.add(row.url);return true;})
    .sort((a,b)=>(b.quantidade??-1)-(a.quantidade??-1)||a.index-b.index);
}
function publicRun(s){
  if(!s)return null;
  const summary=counts(s);
  const items=s.items.map(item=>{const v=s.itemStates[item.id];return {...item,state:v.state,reason:v.reason,stage:v.checkpoint?.complete?'save':'collection',recoverable:v.recoverable!==false,
    destinationHandleKey:v.destinationHandleKey||null,checkpoint:{confirmedPages:v.checkpoint?.confirmedPages||0,recordCount:v.checkpoint?.recordCount||0,nextUrl:v.checkpoint?.nextUrl||null,complete:v.checkpoint?.complete||false},receipt:v.receipt?{relativePath:v.receipt.relativePath,directoryName:v.receipt.directoryName,directoryKey:v.receipt.directoryKey||null}:null};});
  return {id:s.id,source:s.source||null,createdAt:s.createdAt,state:s.runnerLive&&!['running','waiting','discovering'].includes(s.state)?'pausing':s.runState||s.state,reason:s.reason,epoch:s.epoch,revision:s.revision,items,summary,exportContext:s.exportContext,counters:s.counters,destinationHandleKey:s.destinationHandleKey||null,currentItemId:s.items[s.itemIndex]?.id,diagnostics:(s.events||[]).slice(-30)};
}
function createAutonomousCollection(options){
  const {store,now=Date.now,nextId=()=>crypto.randomUUID()}=options;
  if(!store)throw new TypeError('Persistência obrigatória');
  const c=createCollectionCoordinator({store,now});
  if(!live.has(store))live.set(store,new Map());const controllers=live.get(store);
  const notify=id=>Promise.resolve(options.onChange?.({id})).catch(()=>{});
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
    async read({id}){const s=await metadata(id);if(s.schemaVersion!==2)return publicRun(await c.read({id}).then(old=>{const copy=structuredClone(old);require('./coleta-items').initializeItems(copy);return copy;}));const out=publicRun(s);out.eligibility=await c.eligibility();return out;},
    async list(){const sessions=await c.list();const out=[];for(const row of sessions.filter(s=>s.mode==='lote'))try{out.push(await service.read({id:row.id}));}catch{}return out;},
    async resume(input){
      let s=await metadata(input.id);if(s.schemaVersion===1){const promoted=await c.promote({...identity(s)});if(promoted.status!=='ready')return promoted;s=await metadata(s.id);}
      try{for(const item of s.items){const v=s.itemStates[item.id],selection=input.selection||'remaining';if(v.recoverable!==false&&(typeof selection==='object'?item.id===selection.itemId:selection==='pending'?v.state==='pending':v.state==='queued'||v.state==='pending'&&!v.localFailure))await c.readItem({id:s.id,itemId:item.id});}}
      catch{return {status:'incompatible',reason:'incompatible_context'};}
      const proxy=await options.proxySnapshot();
      const result=await c.selectItems({id:s.id,owner:input.owner,epoch:s.epoch,selection:input.selection||'remaining',proxyRevision:proxy.revision,accessConfirmed:input.accessConfirmed===true,runId:options.runId});
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
            if(s.checkpoint.recordCount===0){await c.advanceItem({...identity(s),itemId:item.id,outcome:'empty'});await notify(id);continue;}
            const view=await c.read({id});const ym=s.exportContext.yearMonth,startedAt=new Date(Number(ym.slice(0,4)),Number(ym.slice(4))-1,1);
            const target=getMunicipalityDestination({startedAt,nome:item.nome,totalPages:s.checkpoint.confirmedPages});
            const collision=Object.values(s.itemStates).some(v=>v.id!==item.id&&v.receipt?.relativePath===target.relativePath&&(v.destinationKey||'default')===(state.destinationKey||'default'));
            if(collision||options.validateDestination&&!await options.validateDestination({id,itemId:item.id,relativePath:target.relativePath})){await c.pendingSave({...identity(s),reason:'destination_collision',local:true});await notify(id);continue;}
            let intent=s.saveIntent,result;
            if(intent&&!s.explicitSaveRetry){result=await options.reconcile(intent,{id,itemId:item.id});if(result?.status!=='saved'){await c.pendingSave({...identity(s),reason:'write_error'});break;}}
            else{
              const text=JSON.stringify(view.checkpoint.records,null,2);
              intent={id:nextId(),relativePath:target.relativePath,digest:await hashText(text),bytes:new TextEncoder().encode(text).length};
              await c.prepareSave({...identity(s),intent});
              try{result=await options.write({id,itemId:item.id,records:view.checkpoint.records,startedAt,nome:item.nome,totalPages:s.checkpoint.confirmedPages,destinationKey:state.destinationKey});}
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
      }catch(error){await finishPause(await metadata(id),controller.signal.aborted?'paused':'execution_failed');}
      finally{controllers.delete(id);await c.releaseDrive({id,token});await options.closeTransport?.({id,keep:(await metadata(id)).reason==='access_blocked'});await notify(id);}
      return service.read({id});
    },
    // 006: drive + esperas/verificações automáticas conforme options.autoRecovery
    // ({maxRechecks}). Sem autoRecovery, deve equivaler a drive(). Ver logic/recuperacao-de-bloqueio.md.
    async runQueue({id,owner}){
      throw new Error('not implemented');
    }
  };return service;
}
module.exports={createAutonomousCollection,normalizeItems,publicRun};

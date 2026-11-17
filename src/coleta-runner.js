function abortableDelay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Coleta interrompida'));
    const timer = setTimeout(done, ms);
    function done() { signal?.removeEventListener('abort', abort); resolve(); }
    function abort() { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new Error('Coleta interrompida')); }
    signal?.addEventListener('abort', abort, { once: true });
  });
}
async function runPage({ reserve, collect, commit, signal }) {
  const permission = await reserve();
  if (permission.status !== 'ready') return permission;
  if (signal?.aborted) return { status: 'paused', reason: 'cancelled' };
  const result = await collect(permission, signal);
  if (signal?.aborted) return { status: 'paused', reason: 'cancelled' };
  return commit(result);
}
const { createCollectionClient } = require('./coleta-protocol');
function waitForNavigationTo(api,tabId,url,timeout){
  return new Promise((resolve,reject)=>{
    let settled=false;const timer=setTimeout(()=>done(new Error('Timeout de navegação')),timeout);
    function done(error){if(settled)return;settled=true;clearTimeout(timer);api.tabs.onUpdated.removeListener(update);error?reject(error):resolve();}
    function check(tab){if(tab.url===url&&tab.status==='complete'&&!tab.pendingUrl)done();}
    function update(id){if(id===tabId)api.tabs.get(tabId).then(check,done);}
    api.tabs.onUpdated.addListener(update);api.tabs.get(tabId).then(check,done);
  });
}
function waitForNavigation(api,tabId,url,timeout,signal){
  return new Promise((resolve,reject)=>{
    let settled=false;const timer=setTimeout(()=>done(new Error('Timeout de navegação')),timeout);
    function done(error){if(settled)return;settled=true;clearTimeout(timer);api.tabs.onUpdated.removeListener(update);api.tabs.onRemoved.removeListener(removed);signal?.removeEventListener('abort',abort);error?reject(error):resolve();}
    function completed(tab){if(tab.status==='complete'&&tab.url!=='about:blank'&&!tab.pendingUrl)done();}
    function update(id,info){if(id===tabId&&info.status==='complete')api.tabs.get(tabId).then(completed,done);}
    function removed(id){if(id===tabId)done(new Error('Aba de coleta fechada'));}
    function abort(){done(new Error('Coleta interrompida'));}
    api.tabs.onUpdated.addListener(update);api.tabs.onRemoved.addListener(removed);signal?.addEventListener('abort',abort,{once:true});
    api.tabs.get(tabId).then(completed,done);
  });
}
const {hashText}=require('./coleta-digest');
const {SAVE_FAILURES,classifySaveFailure}=require('./coleta-save-failure');
async function sendPageMessage(api,tabId,message){
  try{return await api.tabs.sendMessage(tabId,message);}
  catch(error){if(!/receiving end does not exist|could not establish connection/i.test(error.message))throw error;await api.scripting.executeScript({target:{tabId},files:['dist/content.bundle.js']});return api.tabs.sendMessage(tabId,message);}
}
async function readNavigatedPage(api,tabId,command,signal){
  // 006 (validação real): desafio transitório do site ("Just a moment…"/"Um momento…", cf-mitigated) leva alguns
  // segundos para liberar (cerca de 5 s no Chrome real); só nesse caso a observação passiva vai até 12 s. Outros 403 mantêm 10 s.
  const client=createCollectionClient(api),start=Date.now(),limit=command.timeoutMs||30000;let deadline=start+Math.min(10000,limit);
  let facts;
  // Observe the page's own transition only. Never navigate, fetch or solve a challenge here.
  do{
    if(signal?.aborted)throw new Error('Coleta interrompida');
    try{
      const tab=await api.tabs.get(tabId);
      if(tab.pendingUrl||tab.status==='loading')await waitForNavigation(api,tabId,command.url,Math.max(1,deadline-Date.now()),signal);
      const response=await sendPageMessage(api,tabId,{cmd:'COLLECT_PAGE',sessionId:command.id,epoch:command.epoch,requestId:command.requestId,url:command.url,fetch:false,timeoutMs:Math.max(1,deadline-Date.now())});
      const http=await client('READ_HTTP',command);
      const sameDocument=!response?.documentId||!http.documentId||response.documentId===http.documentId;
      facts=response?.ok&&sameDocument?{...response,...http,status:response.status??http.status??null}:{...http,finalUrl:http.finalUrl||command.url,records:[],functionalError:!http.status};
      if(response?.transientChallenge||http?.mitigated==='challenge')deadline=Math.max(deadline,start+Math.min(12000,limit));
      if(http.status===429)return {...facts,status:429,retryAfter:http.retryAfter};
      if(response?.ok&&sameDocument&&facts.status!==403&&!facts.challenge&&facts.mitigated!=='challenge')return facts;
    }catch(error){
      if(signal?.aborted)throw error;
      const http=await client('READ_HTTP',command);facts={...http,transportError:!http.status,finalUrl:http.finalUrl||command.url,records:[]};
      if(http.status===429)return facts;
    }
    const remaining=deadline-Date.now();if(remaining<=0)break;
    await abortableDelay(Math.min(100,remaining),signal);
  }while(Date.now()<deadline);
  return facts;
}
function createPageTransport(api=chrome,{foreground=false}={}){
  const client=createCollectionClient(api);let tab=null,itemId=null,identity=null,registeredEpoch=null,userClosed=false;
  const removed=id=>{if(tab?.id===id){tab=null;if(foreground)userClosed=true;}};api.tabs.onRemoved.addListener(removed);
  if(foreground){
    // 006 D5: uma aba Idealista visível por execução, em foco só ao criar; toda página por navegação real.
    const waitBlank=id=>waitForNavigationTo(api,id,'about:blank',10000);
    const prepare=async input=>{
      if(userClosed){const error=new Error('Aba de coleta fechada');error.code='COLLECTION_TAB_CLOSED';throw error;}
      if(!tab){
        tab=await api.tabs.create({url:'about:blank',active:true});await api.tabs.update(tab.id,{autoDiscardable:false});
        await client('REGISTER',{id:input.id,epoch:input.epoch,tabId:tab.id});registeredEpoch=input.epoch;
      }else if(registeredEpoch!==input.epoch){
        await api.tabs.update(tab.id,{url:'about:blank'});await waitBlank(tab.id);
        await client('REGISTER',{id:input.id,epoch:input.epoch,tabId:tab.id});registeredEpoch=input.epoch;
      }
      itemId=input.itemId;identity=input;return {kind:'navigation'};
    };
    return {prepare,execute:command=>execute(command),close,dispose:async options=>{await close(options);api.tabs.onRemoved.removeListener(removed);}};
  }
  async function close({keep=false}={}){
    const owned=tab;tab=null;itemId=null;if(!owned||keep)return;
    try{const current=await api.tabs.get(owned.id);if(current.url!=='about:blank'){
      const proof=await api.tabs.sendMessage(owned.id,{cmd:'COLETA_EXECUTOR_PROOF',sessionId:identity.id,epoch:identity.epoch,requestId:identity.requestId});
      if(proof?.sessionId!==identity.id||proof.epoch!==identity.epoch)return;
    }await api.tabs.remove(owned.id);}catch{}
  }
  async function prepare(input){
    if(!tab||itemId!==input.itemId){await close();tab=await api.tabs.create({url:'about:blank',active:false});itemId=input.itemId;identity=input;await api.tabs.update(tab.id,{autoDiscardable:false});await client('REGISTER',{id:input.id,epoch:input.epoch,tabId:tab.id});}
    const current=await api.tabs.get(tab.id);return {kind:current.url==='about:blank'||new URL(current.url).origin!==new URL(input.url).origin?'navigation':'pagination'};
  }
  async function execute(command){
    identity=command;const id=tab?.id;if(!id)throw new Error('Aba de coleta indisponível');
    if(Date.now()>command.expiresAt)throw new Error('Permissão expirou antes do envio');
    const abort=()=>api.tabs.sendMessage(id,{cmd:'COLETA_ABORT',sessionId:command.id,epoch:command.epoch}).catch(()=>{});
    command.signal?.addEventListener('abort',abort,{once:true});
    try{
      const navigate=command.kind==='navigation';
      if(navigate){await api.tabs.update(id,{url:command.url});await waitForNavigation(api,id,command.url,command.timeoutMs,command.signal);return await readNavigatedPage(api,id,command,command.signal);}
      const response=await sendPageMessage(api,id,{cmd:'COLLECT_PAGE',sessionId:command.id,epoch:command.epoch,requestId:command.requestId,url:command.url,fetch:!navigate,timeoutMs:command.timeoutMs});
      const http=navigate?await client('READ_HTTP',{id:command.id,epoch:command.epoch,requestId:command.requestId}):{};
      return response?.ok?{...response,...http,status:response.status??http.status??null}:{...http,records:[],finalUrl:command.url,functionalError:!http.status};
    }catch(error){if(command.signal?.aborted)throw error;const http=await client('READ_HTTP',{id:command.id,epoch:command.epoch,requestId:command.requestId});return {...http,transportError:!http.status,finalUrl:http.finalUrl||command.url,records:[]};}
    finally{command.signal?.removeEventListener('abort',abort);}
  }
  return {prepare,execute,close,dispose:async options=>{await close(options);api.tabs.onRemoved.removeListener(removed);}};
}
function createCollectionWorkflow({api=chrome,mode,save,destination,reconcile,onState=()=>{},onSaved=async()=>{},canMutate=()=>true,autoSave=true,foreground=false,keepPage=false}){
  const client=createCollectionClient(api);let id=null,epoch=null,abort=null,running=false,tab=null,lastItem=null;
  const identity=()=>({id,epoch});
  function authorize(){if(!canMutate())throw new Error('Ative esta tela para adquirir o controle da fila.');}
  function probe(){const probingId=id;client('PROBE_IP',identity()).then(r=>{if(id===probingId&&(r.status==='verified'||r.status==='unknown'))return publish({message:r.ip?`IP observado: ${r.ip}`:'IP não verificado.'});}).catch(()=>{});}
  async function publish(extra={}){const view=id?await client('READ',{id}):null;onState(view,extra);return view;}
  async function flushProjection(full){
    const acquired=await client('RESUME',identity());if(acquired.status!=='projection-pending')return acquired;epoch=acquired.epoch;
    full=await client('READ',{id,full:true});const p=full.pendingProjection;
    await onSaved({...full,itemIndex:p.itemIndex,checkpoint:{...full.checkpoint,recordCount:p.total}},p);
    const result=await client('ACK_PROJECTION',{...identity(),receiptId:p.id});await publish();return result;
  }
  async function savePending(retry=false,downloadConfirmed=false){
    let full=await client('READ',{id,full:true});if(full.pendingProjection)return flushProjection(full);if(full.state!=='awaiting-save')return {status:full.state};
    const acquired=await client('RESUME',{...identity()});if(acquired.status!=='awaiting-save')return acquired;epoch=acquired.epoch;
    full=await client('READ',{id,full:true});
    let intent=await client('GET_INTENT',identity()),written;
    if(intent&&!retry){
      written=downloadConfirmed?{status:'saved',relativePath:intent.relativePath}:await reconcile?.(full,intent);
      if(written?.status!=='saved'){await publish({status:'save-unknown'});return {status:'save-unknown'};}
    }else{
      const relativePath=destination(full),text=JSON.stringify(full.checkpoint.records,null,2);
      intent={id:crypto.randomUUID(),relativePath,digest:await hashText(text),bytes:new TextEncoder().encode(text).length};
      await client('SAVE_INTENT',{...identity(),intent});
      async function recordFailure(value){
        const reason=classifySaveFailure(value);if(!reason)return null;
        await client('SAVE_FAILURE',{...identity(),intentId:intent.id,reason});return SAVE_FAILURES[reason];
      }
      try{written=await save(full);}
      catch(error){
        const message=await recordFailure(error);await publish({status:'error',message});
        const sanitized=new Error(message);if(['NotAllowedError','SecurityError','QuotaExceededError','NotFoundError','AbortError'].includes(error?.name))sanitized.name=error.name;throw sanitized;
      }
      if(written?.status!=='saved'){const message=await recordFailure(written);await publish({...written,...(message?{message}:{})});return written;}
    }
    const receipt={id:intent.id,relativePath:written.relativePath||intent.relativePath,directoryName:written.directoryName};
    const result=await client('SAVE_RESULT',{...identity(),receipt});
    if(mode==='lote')return flushProjection(await client('READ',{id,full:true}));
    await onSaved(full,written);await publish();return result;
  }
  async function message(pageMessage){
    return sendPageMessage(api,tab.id,pageMessage);
  }
  async function drive(){
    if(running)return {status:'busy'};running=true;abort=new AbortController();let failure=null;
    try{
      while(!abort.signal.aborted){
        const view=await publish();epoch=view.epoch;
        if(view.pendingProjection){await flushProjection(view);continue;}
        if(view.state==='awaiting-save'){
          if(!autoSave){onState(view,{status:'collected'});return {status:'collected'};}
          const saved=await savePending();if(!['running','saved'].includes(saved?.status)){failure=saved;return saved;}
          if(saved.status==='saved')return saved;continue;
        }
        if(!['running','waiting'].includes(view.state))return {status:view.state,reason:view.reason};
        const url=view.checkpoint.nextUrl;if(!url)return {status:'paused',reason:'missing_destination'};
        if(!tab||lastItem!==view.itemIndex){
          if(tab){try{await api.tabs.remove(tab.id);}catch{}}
          tab=await api.tabs.create({url:'about:blank',active:foreground});lastItem=view.itemIndex;
          await client('REGISTER',{...identity(),tabId:tab.id});
        }
        const current=await api.tabs.get(tab.id);
        // 006 D5/D16: coleta visível (Links) navega toda página na aba; as demais telas mantêm o comportamento.
        const navigate=foreground||current.url==='about:blank'||new URL(current.url).origin!==new URL(url).origin;
        const command={...identity(),requestId:crypto.randomUUID(),url,kind:navigate?'navigation':'pagination'};
        const permit=await client('REQUEST',command);
        if(permit.status==='wait'){
          onState(view,permit);
          // Janela/orçamento são pausas explícitas; intervalo/backoff em execução consentida podem aguardar.
          if(permit.reason==='window_budget'){await client('PAUSE',identity());return permit;}
          await abortableDelay(Math.min(60000,Math.max(1,permit.until-Date.now())),abort.signal);continue;
        }
        if(permit.status!=='ready'){failure=permit;return permit;}
        if(Date.now()>permit.expiresAt)throw new Error('Permissão expirou antes do envio');
        let facts;
        try{
          if(navigate){await api.tabs.update(tab.id,{url});await waitForNavigation(api,tab.id,url,permit.timeoutMs,abort.signal);facts=await readNavigatedPage(api,tab.id,{...command,timeoutMs:permit.timeoutMs},abort.signal);}
          else{const response=await message({cmd:'COLLECT_PAGE',sessionId:id,epoch,requestId:command.requestId,url,fetch:true,timeoutMs:permit.timeoutMs});facts=response?.ok?response:{finalUrl:url,records:[],functionalError:true};}
        }catch(error){
          if(abort.signal.aborted)throw error;
          const http=navigate?await client('READ_HTTP',command):{};
          facts={...http,status:http.status??null,transportError:!http.status,finalUrl:http.finalUrl||url,records:[]};
        }
        const report=await client('REPORT',{...command,...facts});
        if(!['running','waiting','awaiting-save'].includes(report.status)){failure=report;return report;}
      }
    }catch(error){failure={status:'error',message:error.message};onState(await client('READ',{id}).catch(()=>null),failure);throw error;}
    finally{running=false;const latest=await client('READ',{id}).catch(()=>null);if(tab){if(!keepPage&&latest?.reason!=='access_blocked'){try{await api.tabs.remove(tab.id);}catch{}}tab=null;}await publish(failure||{}).catch(()=>{});}
  }
  return {
    get id(){return id;},get running(){return running;},client,
    async start(items,useProxy=false){authorize();const s=await client('START',{mode,items,useProxy});if(s.status!=='started'){onState(null,s);return s;}id=s.id;epoch=s.epoch;probe();return drive();},
    async resume(sessionId,accessConfirmed=false){
      authorize();
      id=sessionId;const view=await client('READ',{id});epoch=view.epoch;
      if(view.state==='awaiting-save'||view.pendingProjection){const saved=await savePending();return saved.status==='running'?drive():saved;}
      // Retomar dentro do intervalo mínimo entre páginas: aguardar o prazo e seguir, como o início já faz
      // (desvio registrado na 006, R-015). Pausar durante a espera cancela; demais esperas seguem manuais.
      let r=await client('RESUME',{...identity(),accessConfirmed});
      for(let n=0;r.status==='wait'&&r.reason==='interval'&&n<5;n++){
        onState(view,r);const wait=abort=new AbortController();
        try{await abortableDelay(Math.min(60000,Math.max(1,r.until-Date.now())),wait.signal);}catch{return {status:'paused',reason:'paused'};}
        r=await client('RESUME',{...identity(),accessConfirmed});
      }
      if(r.status!=='running'){onState(view,r);return r;}epoch=r.epoch;probe();return drive();
    },
    async stop(action='PAUSE'){authorize();abort?.abort();if(!id)return;const result=await client(action,identity());if(action==='DISCARD'&&result.status==='discarded'){id=null;epoch=null;onState(null);}else await publish();return result;},
    async adopt(sessionId){id=sessionId;epoch=(await client('READ',{id})).epoch;return publish();},
    async save(retry=false,confirmed=false){authorize();const r=await savePending(retry,confirmed);if(r?.status==='running')return drive();return r;},
    refresh:publish,
    reset(){if(running)throw new Error('Pause antes de descartar a seleção');id=null;epoch=null;onState(null);},
  };
}
async function reconcileDirectory(directory,intent){
  if(!directory||await directory.queryPermission({mode:'readwrite'})!=='granted')return {status:'permission-required'};
  const parts=intent.relativePath.split('/');if(parts.length!==2||parts.some(p=>!p||p==='.'||p==='..'))throw new Error('Destino inválido');
  try{const month=await directory.getDirectoryHandle(parts[0]),handle=await month.getFileHandle(parts[1]),file=await handle.getFile();
    if(file.size===intent.bytes&&await hashText(await file.text())===intent.digest)return {status:'saved',relativePath:intent.relativePath,total:JSON.parse(await file.text()).length};
  }catch(error){if(error.name!=='NotFoundError')throw error;}
  return {status:'save-unknown'};
}
module.exports = { abortableDelay, runPage, createCollectionWorkflow, hashText, reconcileDirectory, createPageTransport, waitForNavigation };

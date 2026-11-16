const { DEFAULT_POLICY, validatePolicy } = require('./coleta-policy');
const { validateBatchURL } = require('./lote-input');
const { classifyResponse, retryAfterUntil } = require('./coleta-classification');
const {SAVE_FAILURES}=require('./coleta-save-failure');
const {initializeItems,currentItem,syncItem,advance}=require('./coleta-items');
const DOMAIN='domain:idealista.pt', INDEX='sessions', MAX_BYTES=50*1024*1024;
const clone=value=>structuredClone(value), sessionKey=id=>`session:${id}`;
function normalizedURL(value){const u=new URL(validateBatchURL(value));u.hash='';return u.href;}
const byteLength=value=>new TextEncoder().encode(JSON.stringify(value)).length;
async function digest(value){const b=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');}
const emptyCheckpoint=url=>({confirmedPages:0,nextUrl:url,visited:[],routes:[],pageKeys:[],complete:false,bytes:0,recordCount:0,noNew:0});
const domainState=()=>({active:null,events:[],lastStarted:null,serverUntil:0,blockedUntil:0,accessBlocked:false,highWaterClock:0});
const validOwner=(s,c)=>s&&s.epoch===c.epoch&&s.owner===c.owner;
// 006 FR-026: contexto geográfico opcional do item — somente 3 chaves fixas, string curta ou null.
function itemContext(item){
  const out={},short=v=>typeof v==='string'&&v.trim()&&v.length<=200?v.trim():null;
  if(item?.context&&typeof item.context==='object'&&!Array.isArray(item.context)){
    const keys=Object.keys(item.context);
    if(keys.some(k=>!['Região','Sub-região','Município'].includes(k)))throw new TypeError('Contexto de localidade inválido');
    out.context={'Região':short(item.context['Região']),'Sub-região':short(item.context['Sub-região']),'Município':short(item.context['Município'])};
  }
  if(short(item?.freguesia))out.freguesia=short(item.freguesia);
  return out;
}
const result=(status,reason,extra={})=>({status,reason,...extra});
function log(s,time,code,url,extra={}){let path;try{const u=new URL(url);path=u.origin+u.pathname;}catch{} s.events.push({time,code,path,...extra});while(s.events.length>1000||byteLength(s.events)>1048576)s.events.shift();}
function waitLimit(d,p,time){
  const events=d.events.filter(t=>t>time-p.windowMs);
  const budget=events.length>=p.maxPagesPerWindow?events[events.length-p.maxPagesPerWindow]+p.windowMs:0;
  const [until,reason]=[[d.serverUntil,'server_wait'],[d.blockedUntil,'access_blocked'],[budget,'window_budget'],[d.lastStarted===null?0:d.lastStarted+p.minIntervalMs,'interval']].sort((a,b)=>b[0]-a[0])[0];
  return until>time?result('wait',reason,{until}):null;
}
function createCollectionCoordinator({store,now=Date.now}){
  const root=async id=>(await store.read([sessionKey(id)]))[sessionKey(id)];
  async function change(id,fn,extra=[]){const key=sessionKey(id);return store.transact(['policy',DOMAIN,key,INDEX,...extra],rows=>{
    const s=rows[key],d=rows[DOMAIN]||domainState(),p=rows.policy||clone(DEFAULT_POLICY);
    if(!s)return {writes:{},result:result('rejected','session_missing')};
    const writes={},value=fn(s,d,p,now(),writes,rows);if(s.schemaVersion===2)syncItem(s);s.revision++;
    while(byteLength(s)>1048576&&s.events.length)s.events.shift();
    if(byteLength(s)>1048576)throw new Error('Limite de metadados da sessão');
    writes[key]=s;writes[DOMAIN]=d;return {writes,result:value};
  });}
  async function pruneTerminalLogs(id){
    const s=await root(id),cutoff=now()-604800000;
    if(s&&['saved','cancelled'].includes(s.state)&&s.events.some(e=>e.time<cutoff))await change(id,v=>{v.events=v.events.filter(e=>e.time>=cutoff);});
  }
  const api={
    async updatePolicy(input){const p=validatePolicy(input);return store.transact(['policy'],()=>({writes:{policy:p},result:p}));},
    async policy(){return (await store.read(['policy'])).policy||clone(DEFAULT_POLICY);},
    async eligibility(){const rows=await store.read(['policy',DOMAIN]);return waitLimit(rows[DOMAIN]||domainState(),rows.policy||DEFAULT_POLICY,now());},
    async confirmDomainAccess({confirmed=false}={}){
      return store.transact(['policy',DOMAIN],rows=>{
        const d=rows[DOMAIN]||domainState(),p=rows.policy||DEFAULT_POLICY,time=now();
        if(confirmed!==true)return {writes:{},result:result('confirmation-required','access_blocked')};
        if(d.active)return {writes:{},result:result('busy','active_session')};
        if(time<d.highWaterClock)return {writes:{},result:result('paused','clock_inconsistent')};
        const wait=waitLimit(d,p,time);if(wait)return {writes:{},result:wait};
        d.accessBlocked=false;d.accessConfirmedAt=time;d.highWaterClock=time;
        return {writes:{[DOMAIN]:d},result:result('ready')};
      });
    },
    async metadata({id}){await pruneTerminalLogs(id);return root(id);},
    async reserveIP(c){return change(c.id,(s,d,p,time)=>{
      if(!validOwner(s,c)||s.proxyRevision!==c.proxyRevision)return result('rejected','incompatible_context');
      if(!['running','waiting'].includes(s.state)||d.accessBlocked||time<Math.max(d.serverUntil,d.blockedUntil))return result('paused','ip_unavailable');
      if(s.ipMarkers[c.proxyRevision])return result('duplicate','ip_known');
      s.ipMarkers[c.proxyRevision]={reservedAt:time};s.counters.ipProbes=(s.counters.ipProbes||0)+1;log(s,time,'ip_probe');return result('ready');
    });},
    async list(){const ids=(await store.read([INDEX]))[INDEX]||[];const rows=await store.read(ids.length?ids.map(sessionKey):[INDEX]);return ids.map(id=>rows[sessionKey(id)]).filter(Boolean).map(s=>({id:s.id,mode:s.mode,autonomous:s.schemaVersion===2,state:s.state,reason:s.reason,epoch:s.epoch,owner:s.owner,runId:s.runId,executor:s.executor,createdAt:s.createdAt,itemIndex:s.itemIndex,requested:s.counters.requested,confirmed:s.counters.confirmed}));},
    async start(o){
      if(!o||!/^[\w-]{1,128}$/.test(o.id)||!['links','itens','lote'].includes(o.mode)||o.domain!=='idealista.pt'||!Array.isArray(o.items)||!o.items.length||!Number.isFinite(Date.parse(o.startedAt))||typeof o.owner!=='string')throw new TypeError('Sessão inválida');
      const items=o.items.map(i=>({nome:typeof i.nome==='string'?i.nome:'',url:normalizedURL(i.url),...itemContext(i)})),key=sessionKey(o.id);
      return store.transact(['policy',DOMAIN,key,INDEX],rows=>{
        const d=rows[DOMAIN]||domainState(),ids=rows[INDEX]||[];
        const reserved=o.autonomous&&rows[key]?.state==='discovering'&&rows[key].owner===o.owner&&rows[key].commandId===o.commandId;
        if(d.active&&!(reserved&&d.active===o.id))return {writes:{},result:result('busy','active_session',{id:d.active})};
        if(rows[key]&&!reserved)return {writes:{},result:result('rejected','session_exists')};
        if(ids.length>=10&&!reserved)return {writes:{},result:result('paused','session_capacity')};
        if(d.accessBlocked)return {writes:{},result:result('paused','access_blocked')};
        if(d.rateLimited&&now()<d.serverUntil)return {writes:{},result:result('wait','rate_limit',{until:d.serverUntil})};
        d.rateLimited=false;
        const s={schemaVersion:1,id:o.id,mode:o.mode,owner:o.owner,runId:o.runId||null,epoch:1,revision:0,domain:o.domain,
          createdAt:o.startedAt,createdMs:Date.parse(o.startedAt),lastCheckpointAt:null,state:'running',reason:null,items,itemIndex:0,
          exportContext:clone(o.exportContext||{}),proxyRevision:o.proxyRevision,counters:{requested:0,confirmed:0},checkpoint:emptyCheckpoint(items[0].url),archivedCheckpoints:[],totalBytes:0,totalRecords:0,attempts:{},receipts:{},inFlight:null,events:[],ipMarkers:{}};
        if(o.autonomous){s.source=clone(o.source);s.commandId=o.commandId||null;initializeItems(s);for(const item of s.items){const v=s.itemStates[item.id];if(!v.checkpoint)v.checkpoint=emptyCheckpoint(item.url);}s.epoch=reserved?rows[key].epoch:s.epoch;if(reserved){s.ownerDocumentId=rows[key].ownerDocumentId;s.ownerToken=rows[key].ownerToken;s.runnerLive=rows[key].runnerLive;}}
        d.active=s.id;log(s,now(),'started');if(byteLength(s)>1048576)throw new Error('Limite de metadados da sessão');return {writes:{[key]:s,[DOMAIN]:d,[INDEX]:ids.includes(s.id)?ids:[...ids,s.id]},result:result('started',null,{id:s.id,epoch:s.epoch})};
      });
    },
    async requestPage(c){
      const url=normalizedURL(c.url);if(!/^[\w-]{1,128}$/.test(c.requestId)||!['navigation','pagination','destination'].includes(c.kind))throw new TypeError('Requisição inválida');
      return change(c.id,(s,d,p,time)=>{
        if(!validOwner(s,c))return result('rejected','stale_owner');
        if(!['running','waiting'].includes(s.state))return result('paused',s.reason||s.state);
        const existing=s.attempts[c.requestId];if(existing)return existing.url===url&&existing.kind===c.kind?result('duplicate','request_known'):result('rejected','request_conflict');
        if(s.inFlight)return result('busy','unconfirmed_request');if(d.active&&d.active!==s.id)return result('busy','active_session');
        if(time<d.highWaterClock){s.state='paused';s.reason='clock_inconsistent';if(d.active===s.id)d.active=null;return result('paused',s.reason);}
        d.highWaterClock=time;d.events=d.events.filter(t=>t>time-86400000);
        if(d.accessBlocked){s.state='blocked';s.reason='access_blocked';if(d.active===s.id)d.active=null;return result('paused',s.reason);}
        if(d.rateLimited){s.state='paused';s.reason='rate_limit';if(d.active===s.id)d.active=null;return result('paused',s.reason);}
        const wait=waitLimit(d,p,time);if(wait){s.state='waiting';s.reason=wait.reason;return wait;}
        const cp=s.checkpoint,reason=s.counters.requested>=p.maxPagesPerRun?'run_budget':cp.confirmedPages>=p.maxPagesPerItem?'item_budget':time-s.createdMs>=p.maxSessionMs?'session_duration':cp.visited.includes(url)?'pagination_cycle':Object.values(s.attempts).filter(a=>a.url===url&&a.itemIndex===s.itemIndex).length>=p.maxAttempts?'attempts_exhausted':null;
        if(reason){s.state='paused';s.reason=reason;if(d.active===s.id)d.active=null;return result('paused',reason);}
        const a={url,kind:c.kind,epoch:s.epoch,owner:s.owner,itemIndex:s.itemIndex,startedAt:time,reported:false,expiresAt:time+2000};
        s.attempts[c.requestId]=a;s.inFlight=c.requestId;s.state='running';s.reason=null;s.counters.requested++;d.events.push(time);d.lastStarted=time;d.active=s.id;
        if(s.schemaVersion===2){const item=currentItem(s);if(item){item.started=true;item.state='running';item.reason=null;}}
        log(s,time,'request',url,{attempt:Object.values(s.attempts).filter(a=>a.url===url&&a.itemIndex===s.itemIndex).length});return result('ready',null,{token:c.requestId,expiresAt:a.expiresAt,epoch:s.epoch,timeoutMs:p.requestTimeoutMs});
      });
    },
    async reportPage(c){
      const view=await api.read({id:c.id});if(!view?.checkpoint)return result('rejected','session_missing');
      let finalUrl,nextUrl=null,destinationUrl=null,invalid=false;
      try{
        finalUrl=normalizedURL(c.finalUrl||c.url);if(c.nextUrl)nextUrl=normalizedURL(c.nextUrl);if(c.destinationUrl)destinationUrl=normalizedURL(c.destinationUrl);
        const origin=new URL(c.url).origin;
        invalid=[finalUrl,nextUrl,destinationUrl].filter(Boolean).some(url=>new URL(url).origin!==origin);
      }catch{invalid=true;finalUrl=c.url;}
      const classification=classifyResponse(c),category=invalid&&!['access-blocked','rate-limit','proxy-error'].includes(classification)?'invalid-destination':classification;let data=[];
      if(['success','empty'].includes(category)){
        if(!Array.isArray(c.records)||c.records.some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw new TypeError('Registros inválidos');
        const seen=new Set(view.checkpoint.records.map(r=>String(r.id||r.Link||JSON.stringify(r))));
        data=clone(c.records.filter(r=>{const k=String(r.id||r.Link||JSON.stringify(r));if(seen.has(k))return false;seen.add(k);return true;}));
      }
      const hash=await digest(data),bytes=byteLength(data),pageKey=`page:${c.id}:${view.itemIndex}:${view.checkpoint.confirmedPages+1}`;
      return change(c.id,(s,d,p,time,writes,rows)=>{
        if(!validOwner(s,c))return result('rejected','stale_owner');
        const a=s.attempts[c.requestId];if(!a||a.epoch!==c.epoch||a.url!==normalizedURL(c.url))return result('rejected','unknown_request');
        if(a.reported)return result('duplicate','report_known');if(s.inFlight!==c.requestId)return result('rejected','request_not_active');
        if(s.checkpoint.confirmedPages!==view.checkpoint.confirmedPages)return result('rejected','checkpoint_changed');
        a.reported=true;a.category=category;s.inFlight=null;d.highWaterClock=Math.max(d.highWaterClock,time);
        // Fim da operação é uma referência conservadora quando o início de rede não está disponível.
        d.lastStarted=Math.max(d.lastStarted||0,time);
        const eventIndex=d.events.lastIndexOf(a.startedAt);if(eventIndex>=0)d.events[eventIndex]=Math.max(d.events[eventIndex],time);
        log(s,time,category,finalUrl,{status:Number.isInteger(c.status)?c.status:null,durationMs:Math.max(0,time-a.startedAt),attempt:Object.values(s.attempts).filter(x=>x.url===a.url&&x.itemIndex===s.itemIndex).length,...(['success','empty'].includes(category)?{newRecords:s.checkpoint.visited.includes(finalUrl)?0:data.length}:{})});
        if(c.retryAfter&&[503,301,302,303,307,308].includes(c.status))d.serverUntil=Math.max(d.serverUntil,retryAfterUntil(c.retryAfter,time,c.serverDate));
        if(['success','empty'].includes(category)&&s.checkpoint.visited.includes(finalUrl)){s.state='paused';s.reason='pagination_cycle';}
        else if(category==='access-blocked'){d.accessBlocked=true;d.blockedUntil=Math.max(d.blockedUntil,time+1800000);s.state='blocked';s.reason='access_blocked';}
        else if(category==='rate-limit'){d.rateLimited=true;d.serverUntil=Math.max(d.serverUntil,retryAfterUntil(c.retryAfter,time,c.serverDate));s.state='paused';s.reason='rate_limit';}
        else if(category==='transient'){
          const n=Object.values(s.attempts).filter(x=>x.url===a.url&&x.itemIndex===s.itemIndex).length;
          if(n>=p.maxAttempts){s.state='paused';s.reason='attempts_exhausted';}else{d.serverUntil=Math.max(d.serverUntil,time+p.backoffBaseMs*2**(n-1));s.state='waiting';s.reason='transient';}
        }else if(category==='destination'){
          if(destinationUrl===a.url||s.checkpoint.routes.includes(destinationUrl)){s.state='paused';s.reason='pagination_cycle';}
          else{s.checkpoint.routes.push(a.url);s.checkpoint.nextUrl=destinationUrl;}
        }
        else if(!['success','empty'].includes(category)){s.state='paused';s.reason=category.replaceAll('-','_');}
        else{
          const usage=rows['storage-usage']||{bytes:0};
          if(s.totalBytes+bytes>MAX_BYTES||s.totalRecords+data.length>100000||usage.bytes+bytes>MAX_BYTES*2)throw new Error('Limite de armazenamento da sessão');
          s.totalBytes+=bytes;s.totalRecords+=data.length;writes['storage-usage']={bytes:usage.bytes+bytes};
          writes[pageKey]={records:data,hash,url:finalUrl,seq:s.checkpoint.confirmedPages+1};s.checkpoint.pageKeys.push(pageKey);s.checkpoint.visited.push(finalUrl);
          s.checkpoint.confirmedPages++;s.counters.confirmed++;s.checkpoint.bytes+=bytes;s.checkpoint.recordCount+=data.length;s.checkpoint.noNew=data.length?0:s.checkpoint.noNew+1;
          s.checkpoint.nextUrl=nextUrl;s.checkpoint.complete=!nextUrl;s.lastCheckpointAt=time;
          if(s.mode==='links'&&c.linksAudit&&typeof c.linksAudit==='object'){const a=c.linksAudit,n=v=>Number.isSafeInteger(v)&&v>=0?v:null;s.linksAudit={strategy:['nacional','distrito','nenhuma'].includes(a.strategy)?a.strategy:null,visible:n(a.visible),collected:s.checkpoint.recordCount,excluded:a.excluded?{zonas:n(a.excluded.zonas),vizinhos:n(a.excluded.vizinhos)}:null};}
          if(!nextUrl){s.state='awaiting-save';s.reason=null;}else if(s.checkpoint.visited.includes(nextUrl)){s.state='paused';s.reason='pagination_cycle';}
          else if(s.checkpoint.noNew>=p.maxNoNewPages){s.state='paused';s.reason='no_new_records';}else{s.state='running';s.reason=null;}
        }
        if(s.schemaVersion===2&&category==='http-error'&&[404,410].includes(c.status)&&!c.retryAfter&&!invalid){const item=currentItem(s);item.state='pending';item.reason='http_error';item.localFailure=true;item.recoverable=true;s.state='running';s.reason='local_failure';}
        if(!['running','waiting'].includes(s.state)&&!(s.schemaVersion===2&&s.state==='awaiting-save')&&d.active===s.id)d.active=null;
        return result(s.state,s.reason);
      },[pageKey,'storage-usage']);
    },
    async control(c){
      if(c.action==='discard'){
        const s=await root(c.id);if(!s)return result('rejected','session_missing');
        const pages=[...new Set([...s.checkpoint.pageKeys,...(s.archivedCheckpoints||[]).flatMap(cp=>cp.pageKeys),...Object.values(s.itemStates||{}).flatMap(i=>i.checkpoint?.pageKeys||[])])];
        const http=Object.keys(s.attempts).map(id=>`http:${s.id}:${id}`),tabKey=s.executor?`tab:${s.executor.tabId}`:null,key=sessionKey(s.id);
        return store.transact([key,DOMAIN,INDEX,'storage-usage',...pages,...http,...(tabKey?[tabKey]:[])],rows=>{
          const current=rows[key];if(!validOwner(current,c))return {writes:{},result:result('rejected','stale_owner')};
          if(current.inFlight)return {writes:{},result:result('busy','unconfirmed_request')};
          const d=rows[DOMAIN]||domainState();if(d.active===s.id)d.active=null;
          const writes={[key]:null,[DOMAIN]:d,[INDEX]:(rows[INDEX]||[]).filter(id=>id!==s.id),'storage-usage':{bytes:Math.max(0,(rows['storage-usage']?.bytes||0)-(s.totalBytes||0))}};
          for(const k of [...pages,...http,...(tabKey?[tabKey]:[])])writes[k]=null;
          return {writes,result:result('discarded','discarded')};
        });
      }
      return change(c.id,(s,d,p,time)=>{
      if(c.action==='resume'){
        if(c.epoch!==s.epoch)return result('rejected','stale_owner');
        if(![1,2].includes(s.schemaVersion))return result('paused','incompatible_context');
        if(s.state==='awaiting-save'||s.pendingProjection){if(s.owner!==c.owner){s.owner=c.owner;s.epoch++;}return result(s.pendingProjection?'projection-pending':'awaiting-save',null,{epoch:s.epoch});}
        if((s.lastCheckpointAt&&time-s.lastCheckpointAt>604800000)||s.proxyRevision!==c.proxyRevision)return result('paused','incompatible_context');
        if(['saved','discarded'].includes(s.state))return result('rejected',s.state);
        if(d.active&&d.active!==s.id)return result('busy','active_session');if(s.inFlight)return result('busy','unconfirmed_request');
        if(time<d.highWaterClock)return result('paused','clock_inconsistent');const wait=waitLimit(d,p,time);if(wait)return wait;
        if(d.accessBlocked&&!c.accessConfirmed)return result('paused','access_blocked');if(time-s.createdMs>=p.maxSessionMs)return result('paused','session_duration');
        if(d.accessBlocked)d.accessBlocked=false;d.rateLimited=false;s.owner=c.owner;s.epoch++;s.state='running';s.reason=null;d.active=s.id;log(s,time,'resumed');return result('running',null,{epoch:s.epoch});
      }
      if(!validOwner(s,c))return result('rejected','stale_owner');if(!['pause','cancel','discard'].includes(c.action))return result('rejected','invalid_action');
      if(s.state==='awaiting-save'){s.afterSave=c.action==='cancel'?'cancelled':'paused';s.reason=s.afterSave;return result(s.state,s.reason,{epoch:s.epoch});}
      if(s.inFlight)return result('busy','unconfirmed_request');s.state=c.action==='cancel'?'cancelled':c.action==='discard'?'discarded':'paused';s.reason=c.reason||s.state;
      if(d.active===s.id)d.active=null;log(s,time,s.state);return result(s.state,s.reason,{epoch:s.epoch});
    });},
    async recover({id,ownerAlive,executorAlive,owner,keepRunner=false}){return change(id,(s,d,p,time)=>{
      if(ownerAlive||executorAlive)return result('busy','executor_alive');
      if(s.schemaVersion===2){const interrupted=!!s.driveToken||!!s.inFlight||['running','waiting','discovering','awaiting-save'].includes(s.state);s.driveToken=null;if(!keepRunner)s.runnerLive=false;if(d.active===s.id)d.active=null;if(interrupted){s.state='interrupted';s.runState='interrupted';s.reason=s.reason||'interrupted';}s.inFlight=null;return result(s.state,s.reason,{epoch:s.epoch});}
      if(owner&&owner!==s.owner){s.owner=owner;s.epoch++;}
      if(['saved','discarded','awaiting-save'].includes(s.state))return result(s.state,s.reason,{epoch:s.epoch});
      s.inFlight=null;if(!['blocked','paused'].includes(s.state)){s.state='interrupted';s.reason='interrupted';}if(d.active===s.id)d.active=null;log(s,time,'recovered');return result(s.state,s.reason,{epoch:s.epoch});
    });},
    async read({id,itemId}){
      await pruneTerminalLogs(id);
      for(let n=0;n<3;n++){
        const s=await root(id);if(!s)return null;
        if(s.schemaVersion===2&&s.runState==='discovering')return {...s,checkpoint:{...s.checkpoint,records:[]}};
        if(itemId){const item=s.itemStates?.[itemId];if(!item)throw new Error('Localidade inexistente');s.itemIndex=item.index;s.checkpoint=clone(item.checkpoint);s.saveIntent=item.saveIntent||null;}
        const cp=s.checkpoint;
        if(![1,2].includes(s.schemaVersion)||!['links','itens','lote'].includes(s.mode)||!Array.isArray(s.items)||!s.items.length||!cp||!Array.isArray(cp.pageKeys)||!Array.isArray(cp.visited)||cp.pageKeys.length!==cp.confirmedPages||cp.visited.length!==cp.confirmedPages)throw new Error('Checkpoint incompatível');
        for(const item of s.items)normalizedURL(item.url);if(cp.nextUrl)normalizedURL(cp.nextUrl);
        const keys=cp.pageKeys,rows=keys.length?await store.read(keys):{};let records=[];
        for(let i=0;i<keys.length;i++){
          const key=keys[i],b=rows[key],itemIndex=Math.min(s.itemIndex,s.items.length-1);
          if(key!==`page:${s.id}:${itemIndex}:${i+1}`||!b||b.seq!==i+1||b.url!==cp.visited[i]||!Array.isArray(b.records)||await digest(b.records)!==b.hash)throw new Error('Checkpoint incompatível');
          normalizedURL(b.url);records.push(...b.records);
        }
        if((await root(id)).revision!==s.revision)continue;return {...s,checkpoint:{...s.checkpoint,records},diagnostics:s.events};
      }throw new Error('Checkpoint em alteração; tente novamente');
    },
    async recordSaveFailure(c){return change(c.id,(s,d,p,time)=>{
      if(!validOwner(s,c))return result('rejected','stale_owner');
      if(s.state!=='awaiting-save'||s.saveIntent?.id!==c.intentId||!Object.hasOwn(SAVE_FAILURES,c.reason))return result('rejected','invalid_save_failure');
      s.reason='save_failed';log(s,time,'save_failed',undefined,{reason:c.reason});return result(s.state,s.reason);
    });},
    async markSaved(c){return change(c.id,(s,d,p,time)=>{
      if(!validOwner(s,c))return result('rejected','stale_owner');if(s.receipts[c.receipt?.id])return result('duplicate','save_known');
      if(s.state!=='awaiting-save'||!c.receipt?.id)return result('rejected','no_complete_result');
      const receipt={...clone(c.receipt),itemIndex:s.itemIndex,total:s.checkpoint.recordCount};
      if(s.schemaVersion===2){
        if(s.saveIntent?.id!==receipt.id||s.saveIntent.relativePath!==receipt.relativePath)return result('rejected','invalid_receipt');
        const item=currentItem(s);receipt.directoryKey=item.destinationHandleKey||s.destinationHandleKey||null;s.receipts[receipt.id]=receipt;item.receipt=receipt;item.state='saved';item.reason=null;item.recoverable=false;s.saveIntent=null;item.saveIntent=null;
        const after=s.afterSave;s.afterSave=null;advance(s,d);if(after&&s.state!=='saved'){s.state='paused';s.runState='paused';s.reason='paused';if(d.active===s.id)d.active=null;}
        log(s,time,'saved');return result(s.state,null,{epoch:s.epoch});
      }
      s.receipts[c.receipt.id]=receipt;if(s.mode==='lote')s.pendingProjection=receipt;s.saveIntent=null;s.itemIndex++;s.reason=null;
      if(s.itemIndex<s.items.length){s.archivedCheckpoints.push(s.checkpoint);s.checkpoint=emptyCheckpoint(s.items[s.itemIndex].url);if(s.afterSave||d.active&&d.active!==s.id){s.state=s.afterSave||'paused';s.reason=s.afterSave||'active_session';if(d.active===s.id)d.active=null;}else{s.state='running';d.active=s.id;}}else{s.state='saved';if(d.active===s.id)d.active=null;}
      s.afterSave=null;
      log(s,time,'saved');return result(s.state,null,{epoch:s.epoch});
    });},
  };
  api.reserveLaunch=async o=>{
    if(!o||!/^[\w-]{1,128}$/.test(o.commandId)||!/^[\w-]{1,128}$/.test(o.id)||typeof o.owner!=='string')throw new TypeError('Comando inválido');
    const key=sessionKey(o.id),launch=`launch:${o.commandId}`,source=clone(o.source),fingerprint=JSON.stringify({source:{tabId:source.tabId,url:source.url,documentId:source.documentId||null},useProxy:o.useProxy===true});
    return store.transact([DOMAIN,INDEX,key,launch],rows=>{
      const known=rows[launch],d=rows[DOMAIN]||domainState(),ids=rows[INDEX]||[];
      if(known)return {writes:{},result:known.fingerprint===fingerprint?{status:'duplicate',id:known.id}:{status:'rejected',reason:'command_conflict'}};
      if(d.active)return {writes:{},result:{status:'busy',id:d.active,reason:'active_session'}};
      if(d.accessBlocked)return {writes:{},result:{status:'paused',reason:'access_blocked'}};
      if(d.rateLimited&&now()<d.serverUntil)return {writes:{},result:{status:'wait',reason:'rate_limit',until:d.serverUntil}};
      d.rateLimited=false;
      if(ids.length>=10)return {writes:{},result:{status:'paused',reason:'session_capacity'}};
      const s={schemaVersion:2,autonomous:true,id:o.id,mode:'lote',owner:o.owner,epoch:1,revision:0,runId:o.runId||null,commandId:o.commandId,source,domain:'idealista.pt',state:'discovering',runState:'discovering',reason:null,createdAt:o.startedAt,createdMs:Date.parse(o.startedAt),items:[],itemStates:{},itemIndex:0,checkpoint:emptyCheckpoint(null),counters:{requested:0,confirmed:0},events:[],attempts:{},receipts:{},archivedCheckpoints:[],totalBytes:0,totalRecords:0,exportContext:clone(o.exportContext||{})};
      s.proxyRevision=o.proxyRevision||null;d.active=s.id;return {writes:{[key]:s,[DOMAIN]:d,[INDEX]:[...ids,s.id],[launch]:{id:s.id,fingerprint}},result:{status:'reserved',id:s.id,epoch:1}};
    });
  };
  api.promote=async c=>{
    const full=await api.read({id:c.id});if(full?.schemaVersion===2)return {status:'ready'};
    if(!full)throw new Error('Sessão inexistente');
    // Revalidar todos os blocos arquivados antes de promover metadados.
    for(let index=0;index<(full.archivedCheckpoints||[]).length;index++){const cp=full.archivedCheckpoints[index];const rows=await store.read(cp.pageKeys.length?cp.pageKeys:[INDEX]);for(let n=0;n<cp.pageKeys.length;n++){const block=rows[cp.pageKeys[n]];if(!block||block.seq!==n+1||await digest(block.records)!==block.hash)throw new Error('Checkpoint incompatível');}}
    return change(c.id,(s,d)=>{if(!validOwner(s,c)||s.revision!==full.revision||s.inFlight||d.active===s.id)return result('busy','active_session');initializeItems(s);for(const item of s.items)if(!s.itemStates[item.id].checkpoint)s.itemStates[item.id].checkpoint=emptyCheckpoint(item.url);return result('ready');});
  };
  api.readItem=async c=>api.read(c);
  api.selectItems=async c=>change(c.id,(s,d,p,time)=>{
    if(s.schemaVersion!==2||s.epoch!==c.epoch)return result('rejected','incompatible_context');
    if(s.driveToken||s.inFlight||d.active&&d.active!==s.id)return result('busy','active_session');
    if(s.proxyRevision!==c.proxyRevision||(s.lastCheckpointAt&&time-s.lastCheckpointAt>604800000))return result('incompatible','incompatible_context');
    if(time<d.highWaterClock)return result('paused','clock_inconsistent');
    const selection=c.selection||'remaining';let selected=s.items.filter(item=>{const v=s.itemStates[item.id];return v.recoverable!==false&&(typeof selection==='object'?item.id===selection.itemId:selection==='pending'?v.state==='pending':v.state==='queued'||v.state==='pending'&&!v.localFailure);});
    if(!selected.length)return result('rejected','no_recoverable_items');
    const saveOnly=selected.every(i=>s.itemStates[i.id].checkpoint.complete);
    if(!saveOnly){const wait=waitLimit(d,p,time);if(wait&&wait.reason!=='interval')return wait;if(d.accessBlocked&&!c.accessConfirmed)return result('paused','access_blocked');if(time-s.createdMs>=p.maxSessionMs)return result('paused','session_duration');}
    if(d.accessBlocked&&c.accessConfirmed&&!saveOnly)d.accessBlocked=false;
    if(!saveOnly)d.rateLimited=false;
    s.owner=c.owner;s.epoch++;if(c.runId)s.runId=c.runId;s.selection={ids:selected.map(i=>i.id),cursor:0};s.itemIndex=selected[0].originalIndex;const item=currentItem(s);s.checkpoint=clone(item.checkpoint);s.saveIntent=item.saveIntent?clone(item.saveIntent):null;item.state='running';item.reason=null;item.localFailure=false;s.state=s.checkpoint.complete?'awaiting-save':'running';s.runState='running';s.reason=null;d.active=s.id;
    return result('accepted',null,{epoch:s.epoch,count:selected.length});
  });
  api.advanceItem=async c=>change(c.id,(s,d)=>{
    if(!validOwner(s,c)||s.schemaVersion!==2||s.inFlight)return result('rejected','stale_owner');
    const item=currentItem(s);if(!item||item.id!==c.itemId)return result('rejected','item_changed');
    if(c.outcome==='empty'){if(!s.checkpoint.complete||s.checkpoint.recordCount!==0)return result('rejected','not_empty');item.state='empty';item.recoverable=false;}
    else if(c.outcome!=='local-failure'||item.state!=='pending'||!item.localFailure)return result('rejected','invalid_advance');
    advance(s,d);return result(s.state,s.reason,{epoch:s.epoch});
  });
  api.prepareSave=async c=>change(c.id,(s)=>{
    if(!validOwner(s,c)||s.state!=='awaiting-save'||!s.checkpoint.complete)return result('rejected','no_complete_result');
    s.saveIntent=clone(c.intent);s.explicitSaveRetry=false;syncItem(s);return result('ready');
  });
  api.pendingSave=async c=>change(c.id,(s,d,p,time)=>{
    if(!validOwner(s,c)||!s.checkpoint.complete)return result('rejected','stale_owner');
    const item=currentItem(s);item.state='pending';item.stage='save';item.reason=Object.hasOwn(SAVE_FAILURES,c.reason)?c.reason:c.reason==='destination_collision'?'destination_collision':'write_error';item.recoverable=true;item.localFailure=!!c.local;s.reason=item.reason;
    log(s,time,'save_failed',undefined,{reason:item.reason});
    if(c.local){advance(s,d);}else{s.state='paused';s.runState='paused';if(d.active===s.id)d.active=null;}
    return result(s.state,s.reason);
  });
  api.claimDrive=async c=>change(c.id,(s)=>{
    if(!validOwner(s,c)||s.driveToken)return result('busy','drive_alive');
    if(!['running','waiting','awaiting-save'].includes(s.state))return result('paused',s.reason);
    s.driveToken=c.token;return result('ready');
  });
  api.releaseDrive=async c=>change(c.id,s=>{if(s.driveToken===c.token)s.driveToken=null;return result(s.state,s.reason);});
  api.bindOwner=async c=>change(c.id,s=>{if(!validOwner(s,c)||s.inFlight||s.driveToken)return result('busy','owner_alive');s.owner=c.newOwner;s.runId=c.runId;s.ownerDocumentId=null;s.ownerToken=null;s.runnerLive=true;s.epoch++;return result('ready',null,{epoch:s.epoch});});
  api.discardItem=async c=>{
    const before=await root(c.id),item=before?.itemStates?.[c.itemId];if(!item||!c.confirmed)return result('rejected','confirmation_required');
    const pages=item.checkpoint?.pageKeys||[];
    return change(c.id,(s,d,p,time,writes,rows)=>{
      const v=s.itemStates[c.itemId];if(!validOwner(s,c)||s.driveToken||s.inFlight||d.active)return result('busy','active_session');
      if(v.state!=='pending'||!v.recoverable)return result('rejected','not_recoverable');
      const bytes=v.checkpoint?.bytes||0,records=v.checkpoint?.recordCount||0;
      for(const key of pages)writes[key]=null;const usage=rows['storage-usage']||{bytes:0};writes['storage-usage']={bytes:Math.max(0,usage.bytes-bytes)};
      s.totalBytes=Math.max(0,s.totalBytes-bytes);s.totalRecords=Math.max(0,s.totalRecords-records);v.state='discarded';v.recoverable=false;v.reason='discarded';v.checkpoint=emptyCheckpoint(s.items[v.index].url);v.saveIntent=null;
      if(v.index===s.itemIndex){s.checkpoint=clone(v.checkpoint);s.saveIntent=null;}log(s,time,'item_discarded');return result('discarded');
    },[...pages,'storage-usage']);
  };
  return api;
}
module.exports={createCollectionCoordinator,digest,normalizedURL};

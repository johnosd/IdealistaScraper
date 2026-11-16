// Launch the existing durable links collector without navigating the side panel.
const KEY='linksLaunch:005';
const {REASONS}=require('./coleta-labels');
const NATIONAL={url:'https://www.idealista.pt/arrendar-casas/#municipality-search',nome:'Localidades principais',current:false};
// 006 D7/FR-028: a página atual é a origem quando tem lista de localidades reconhecível pelo caminho
// (raiz de arrendamento ou …/concelhos-freguesias); senão, a página nacional.
function chooseLinksOrigin(value){
  let url;try{url=new URL(value);}catch{return {...NATIONAL};}
  if(url.protocol!=='https:'||!(url.hostname==='idealista.pt'||url.hostname.endsWith('.idealista.pt'))||url.username||url.password||url.port)return {...NATIONAL};
  const path=url.pathname.replace(/\/+$/,'/');
  if(path==='/arrendar-casas/')return {...NATIONAL};
  if(/^\/arrendar-casas\/[a-z0-9-]+(?:\/[a-z0-9-]+)?\/concelhos-freguesias\/?$/.test(url.pathname)){
    const slug=url.pathname.split('/').filter(Boolean)[1];
    return {url:url.origin+url.pathname,nome:slug.replace(/-distrito$/,'').replace(/-/g,' ').replace(/\b\p{L}/gu,c=>c.toUpperCase()),current:true};
  }
  return {...NATIONAL};
}
const PREPARED='lote:prepared';
// 006 FR-008/D4: links concluídos viram a fila preparada do Lote (uma entrada por listagem derivada).
async function prepareBatchFromLinks(api,view,now=Date.now){
  if(!view?.id||!['awaiting-save','saved'].includes(view.state))return null;
  const current=(await api.storage.local.get([PREPARED]))[PREPARED];
  if(current?.linksSessionId===view.id)return current;
  const {buildBatchQueue}=require('./lote-queue');
  const queue=buildBatchQueue(view.checkpoint?.records||[]);
  const prepared={linksSessionId:view.id,createdAt:now(),origin:{url:view.items?.[0]?.url||null,nome:view.items?.[0]?.nome||null},
    entries:queue.entries,rejected:queue.rejected.map(r=>({url:typeof r.record?.URL==='string'?r.record.URL:null,reason:r.reason}))};
  await api.storage.local.set({[PREPARED]:prepared});return prepared;
}
function createLinksCollection({api,runtime,settings=null,now=Date.now}){
 const {coordinator}=runtime,base=api.runtime.getURL('localidades.html'),runner=api.runtime.getURL('runner.html');
 const load=async()=>(await api.storage.session.get([KEY]))[KEY];
 async function controller(launch,exportOnly=false){try{const tab=await api.tabs.get(launch.tabId),url=tab.pendingUrl||tab.url;return url===base||url?.startsWith(base+'?')||!exportOnly&&url?.startsWith(runner+'?links=')?tab:null;}catch{return null;}}
 async function session(launch){
  const rows=(await coordinator.list()).filter(s=>s.mode==='links'&&!s.autonomous);
  return rows.findLast(s=>String(s.owner)===String(launch?.tabId))||(!launch?rows.at(-1):launch.error&&!launch.failure?rows.findLast(s=>['paused','blocked','interrupted'].includes(s.state)):null);
 }
 function ownsLaunch(launch,sender){return launch&&sender.tab?.id===launch.tabId&&new URL(sender.url).pathname==='/runner.html';}
 async function showExistingPage(row){
  const browser=(await api.storage.session.get(['collectionRunId'])).collectionRunId;
  if(!browser||row.runId!==browser||row.executor?.runId!==browser)return;
  try{const tab=await api.tabs.get(row.executor.tabId),url=new URL(tab.pendingUrl||tab.url);if(url.protocol==='https:'&&(url.hostname==='idealista.pt'||url.hostname.endsWith('.idealista.pt')))await api.tabs.update(tab.id,{active:true});}catch{}
 }
 return {async handle(action,payload,sender){
  const launch=await load();
  if(action==='LINKS_START'){
   if(await runtime.busy())return {status:'busy'};
   const existing=await session(launch);
   if(existing&&['paused','blocked','interrupted','cancelled'].includes(existing.state)){await showExistingPage(existing);return {status:'attention',id:existing.id,reason:existing.reason};}
   if(payload.accessConfirmed===true){const confirmed=await coordinator.confirmDomainAccess({confirmed:true});if(confirmed.status!=='ready')return confirmed;}
   if(launch&&!existing&&!launch.error&&now()-launch.createdAt<120000&&await controller(launch))return {status:'accepted'};
   const next={token:crypto.randomUUID(),createdAt:now(),consumed:false,origin:chooseLinksOrigin(payload.source?.url)};
   const tab=await api.tabs.create({url:runner+'?links='+encodeURIComponent(next.token),active:false});
   next.tabId=tab.id;await api.storage.session.set({[KEY]:next});return {status:'accepted'};
  }
  if(action==='LINKS_CLAIM'){
   if(!ownsLaunch(launch,sender)||launch.token!==payload.token||launch.consumed||now()-launch.createdAt>=120000)return {status:'inactive'};
   await api.storage.session.set({[KEY]:{...launch,consumed:true}});
   try{const useProxy=settings?(await settings.load()).useProxy===true:(await api.storage.local.get(['usarProxy'])).usarProxy==='true';return {status:'ready',useProxy,origin:launch.origin||{...NATIONAL}};}
   catch{await api.storage.session.set({[KEY]:{...launch,consumed:true,error:true,failure:{reason:'settings_unavailable',stage:'settings'}}});return {status:'failed',reason:'settings_unavailable'};}
  }
  if(action==='LINKS_FAILED'){
   if(!ownsLaunch(launch,sender))throw Error('Executor recusado');
   const reason=Object.hasOwn(REASONS,payload.reason)?payload.reason:'collector_start_failed';
   const stage=['claim','settings','start'].includes(payload.stage)?payload.stage:'start';
   const until=Number.isFinite(payload.until)&&payload.until>now()?payload.until:null;
   await api.storage.session.set({[KEY]:{...launch,error:true,failure:{reason,stage,until}}});return {status:'recorded'};
  }
  const row=await session(launch);
  if(action==='LINKS_FINISHED'){
   if(!ownsLaunch(launch,sender))throw Error('Executor recusado');
   const current=row&&await coordinator.metadata({id:row.id});
   if(current&&(current.inFlight||['running','waiting'].includes(current.state))||!current&&!launch.error)return {status:'busy'};
   if(current)try{await prepareBatchFromLinks(api,await coordinator.read({id:row.id}),now);}catch{/* A leitura seguinte tenta de novo. */}
   await api.tabs.remove(launch.tabId);return {status:'closed'};
  }
  if(action==='LINKS_READ'){
   if(!row){
    let failure=launch?.failure;
    if(!failure&&launch){if(launch.error)failure={reason:'collector_start_failed'};else if(!await controller(launch))failure={reason:'controller_closed'};else if(now()-launch.createdAt>=120000)failure={reason:'controller_timeout'};}
    const recovery=failure?.reason==='access_blocked'?{recovery:'confirm-access',until:(await coordinator.eligibility())?.until||null}:{};
    return {state:failure?(['collector_start_failed','settings_unavailable','controller_closed','controller_timeout'].includes(failure.reason)?'error':'paused'):launch?'preparing':'idle',...failure,...recovery,records:[],total:0};
   }
   const view=await coordinator.read({id:row.id}),records=[];
   for(const record of (view.checkpoint.records||[]).slice(0,1000)){
    const url=record.URL;try{const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='idealista.pt'&&!u.hostname.endsWith('.idealista.pt'))continue;}catch{continue;}
    records.push({nome:String(record['Município']||record.Texto||record['Sub-região']||record['Região']||url),url,tipo:String(record.Tipo||'Localidade')});
   }
   const eligibility=await coordinator.eligibility(),status=(view.diagnostics||[]).findLast(event=>Number.isInteger(event.status)&&event.status>=100&&event.status<=599)?.status;
   const audit=view.linksAudit||null,origin={url:view.items?.[0]?.url||null,nome:view.items?.[0]?.nome||null};
   let prepared=null;try{prepared=await prepareBatchFromLinks(api,view,now);}catch{}
   return {id:row.id,state:view.state==='awaiting-save'?'collected':view.state,reason:view.reason,until:eligibility?.until,status,total:view.checkpoint.recordCount,records,origin,audit,prepared:prepared?{entries:prepared.entries.length,rejected:prepared.rejected.length}:null};
  }
  if(action==='LINKS_EXPORT'||action==='LINKS_DETAILS'){
   if(!row){if(action==='LINKS_EXPORT')return {status:'missing'};await api.tabs.create({url:base,active:true});return {status:'opened'};}
   const browser=(await api.storage.session.get(['collectionRunId'])).collectionRunId;
   let tab=(String(launch?.tabId)===String(row.owner)||row.runId&&row.runId===browser)?await controller({tabId:Number(row.owner)},true):null;
   if(!tab)tab=await api.tabs.create({url:base+'?session='+encodeURIComponent(row.id),active:true});
   else await api.tabs.update(tab.id,{url:base+'?session='+encodeURIComponent(row.id),active:true});return {status:'opened'};
  }
  throw Error('Comando indisponível');
 }};
}
module.exports={createLinksCollection,chooseLinksOrigin,prepareBatchFromLinks,PREPARED_KEY:PREPARED,NATIONAL_LINKS_ORIGIN:NATIONAL};

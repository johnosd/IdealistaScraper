// 006 US5 com a extensão real e rede local: 403 "Um momento…" → espera o prazo → reverifica sozinho.
// Variante temporária (403 → 200) conclui sem clique; variante persistente para em access_blocked_persistent
// após 3 verificações. O prazo de 30 min é vencido SOMENTE no IndexedDB do perfil temporário (fixture de
// elegibilidade, como em links-inherited-block.smoke): não prova a espera real inteira.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {openBrowser,poll}=require('../fixtures/coleta-browser.cjs');
const origin='https://www.idealista.pt',source=origin+'/arrendar-casas/fixture-distrito/concelhos-freguesias',alpha=origin+'/arrendar-casas/alpha/';
const districtHTML='<ul><li class="breadcrumb-dropdown-element highlighted"><span class="breadcrumb-navigation-current-level">Fixture distrito</span><ul class="breadcrumb-dropdown-subitem-list"><li><a href="/arrendar-casas/alpha/concelhos-freguesias">alpha</a><span class="breadcrumb-navigation-sidenote">1</span></li></ul></li></ul>';
const listingHTML='<h1>1 casas e apartamentos para arrendar em alpha</h1><section class="items-container items-list"><article class="item" data-element-id="a1"><div class="item-info-container"><a class="item-link" href="/imovel/a1/">Casa a1</a></div></article></section>';
const challengeHTML='<title>Um momento…</title><h1>www.idealista.pt</h1>';
async function scenario(name,blockedResponses){
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista006-block-'));let b;const calls=[];
 try{
  b=await openBrowser(profile,r=>{const url=r.request().url();if(!url.startsWith(origin))return r.abort();
   if(url===source)return r.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html><body>'+districtHTML+'</body></html>'});
   calls.push(url);const blocked=calls.length<=blockedResponses;
   return r.fulfill({status:blocked?403:200,contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8">'+(blocked?challengeHTML:'<title>alpha</title>')+'</head><body>'+(blocked?'':listingHTML)+'</body></html>'});});
  const setup=await b.page('lote.html');
  await setup.evaluate(async()=>{const r=await chrome.runtime.sendMessage({cmd:'COLETA_GET_POLICY'});await chrome.runtime.sendMessage({cmd:'COLETA_SET_POLICY',payload:{limits:{...r.result.limits,minIntervalMs:1000,maxPagesPerWindow:1000},ipEnabled:false}});});
  await setup.locator('#choose').click();await setup.waitForFunction(()=>document.querySelector('#destination').textContent.includes('acesso permitido'));
  const tabId=await setup.evaluate(async url=>{const t=await chrome.tabs.create({url:'about:blank',active:false});await chrome.tabs.update(t.id,{url});return t.id;},source);
  await poll(()=>setup.evaluate(id=>chrome.tabs.get(id),tabId),t=>t.status==='complete');
  const response=await setup.evaluate(async tabId=>chrome.runtime.sendMessage({cmd:'AUTONOMA_START',payload:{commandId:crypto.randomUUID(),source:{tabId}}}),tabId);if(!response?.ok)console.error(JSON.stringify(response));const started=response.result;
  assert.equal(started.status,'accepted');const id=started.id;await setup.close();
  const watch=await b.context.newPage();await watch.goto(b.base+'popup.html');
  const read=()=>watch.evaluate(async id=>(await chrome.runtime.sendMessage({cmd:'AUTONOMA_READ',payload:{id}})).result,id);
  const seedElapsed=()=>watch.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('idealista-coleta-v1',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('records','readwrite'),store=tx.objectStore('records'),get=store.get('domain:idealista.pt');get.onsuccess=()=>{const d=get.result,elapsed=1800001;d.blockedUntil-=elapsed;d.serverUntil=Math.max(0,(d.serverUntil||0)-elapsed);d.highWaterClock-=elapsed;d.lastStarted-=elapsed;d.events=d.events.map(t=>t-elapsed);store.put(d,'domain:idealista.pt');};tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(tx.error);};};}));
  let seeded=0,last=null;const terminal=['completed','finished-with-pending'];
  const run=await poll(async()=>{const r=await read();last=r;
   // Cada bloqueio observado com espera automática agendada: vencer o prazo apenas no perfil temporário.
   if(r?.autoRecovery?.action==='recheck'&&r.autoRecovery.rechecks>seeded&&r.autoRecovery.until>Date.now()){seeded=r.autoRecovery.rechecks;await seedElapsed();}
   return r;},r=>terminal.includes(r?.state)||r?.reason==='access_blocked_persistent',{timeout:120000}).catch(error=>{console.error(JSON.stringify({name,calls:calls.length,seeded,state:last?.state,reason:last?.reason,auto:last?.autoRecovery,diag:(last?.diagnostics||[]).slice(-8).map(e=>e.code+':'+(e.status??''))}));throw error;});
  const pages=b.context.pages().map(p=>p.url()).filter(u=>u.startsWith(b.base)).map(u=>new URL(u).pathname);
  assert.equal(pages.some(p=>['/configuracoes.html','/localidades.html'].includes(p)),false);assert.deepEqual(b.errors,[]);
  return {run,calls:calls.length,seeded};
 }finally{await b?.context.close();const resolved=path.resolve(profile);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'idealista006-block-'));await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
}
(async()=>{
 const temp=await scenario('temporario',1);
 assert.equal(temp.run.state,'completed','403 temporário: retoma sozinho e conclui');assert.equal(temp.calls,2);assert.equal(temp.seeded,1);
 const stuck=await scenario('persistente',99);
 assert.equal(stuck.run.reason,'access_blocked_persistent');assert.notEqual(stuck.run.state,'completed');
 assert.equal(stuck.calls,3,'1 tentativa + 2 verificações: o limite de 3 tentativas por página (004) chega antes do de 3 verificações');assert.equal(stuck.run.items[0].checkpoint.confirmedPages,0);
 console.log(JSON.stringify({pass:true,proof:'real extension; HTTP 403 "Um momento…" local; elapsed deadline seeded only in temp profile',cases:['403→200 retoma sem clique','403 persistente para no limite de verificações/tentativas','progresso preservado','nenhuma tela da extensão'],temp:{calls:temp.calls},stuck:{calls:stuck.calls}}));
})().catch(error=>{console.error(error);process.exitCode=1;});

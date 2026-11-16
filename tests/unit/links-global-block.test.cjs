const test=require('node:test'),assert=require('node:assert/strict');
const {runtimeFixture}=require('../fixtures/coleta-runtime.cjs');
const {createLinksCollection}=require('../../src/links-collection');
async function blocked(){
 let tick=Date.now();const f=runtimeFixture({now:()=>tick}),c=f.runtime.coordinator;
 const s=await c.start({id:'old-batch',mode:'lote',owner:'1',domain:'idealista.pt',startedAt:new Date(tick).toISOString(),items:[{url:'https://www.idealista.pt/arrendar-casas/fixture/'}],proxyRevision:'proxy-1'});
 const request={id:s.id,epoch:s.epoch,owner:'1',requestId:'denied',url:'https://www.idealista.pt/arrendar-casas/fixture/',kind:'navigation'};
 await c.requestPage(request);await c.reportPage({...request,status:403,records:[]});
 const links=createLinksCollection({api:f.api,runtime:f.runtime,now:()=>tick});f.api.tabs.create=async data=>{const tab={id:30,...data};f.tabs.set(30,tab);return tab;};
 return {...f,c,links,advance:ms=>tick+=ms};
}
test('bloqueio anterior de Lote permite recuperação manual em Links sem apagar a sessão anterior',async()=>{
 const f=await blocked();assert.equal((await f.c.confirmDomainAccess({confirmed:true})).status,'wait');
 assert.equal((await f.store.read(['domain:idealista.pt']))['domain:idealista.pt'].accessBlocked,true);
 f.advance(3600001);assert.equal((await f.c.confirmDomainAccess({confirmed:false})).status,'confirmation-required');
 assert.equal((await f.c.confirmDomainAccess({confirmed:true})).status,'ready');
 assert.equal((await f.c.metadata({id:'old-batch'})).state,'blocked');
 assert.equal((await f.store.read(['domain:idealista.pt']))['domain:idealista.pt'].accessBlocked,false);
});
test('confirmação não libera domínio com operação ativa ou relógio incompatível',async()=>{
 const f=await blocked();f.advance(3600001);
 await f.store.transact(['domain:idealista.pt'],rows=>{rows['domain:idealista.pt'].active='still-working';return {writes:rows};});
 assert.equal((await f.c.confirmDomainAccess({confirmed:true})).status,'busy');
 assert.equal((await f.store.read(['domain:idealista.pt']))['domain:idealista.pt'].accessBlocked,true);
 await f.store.transact(['domain:idealista.pt'],rows=>{rows['domain:idealista.pt'].active=null;return {writes:rows};});f.advance(-7200002);
 assert.equal((await f.c.confirmDomainAccess({confirmed:true})).reason,'clock_inconsistent');
});
test('Links apresenta ação de confirmação sem sessão própria e inicia após confirmação explícita elegível',async()=>{
 const f=await blocked();await f.links.handle('LINKS_START',{},{});const launch=f.session['linksLaunch:005'],sender={id:'fixture',url:f.api.runtime.getURL('runner.html')+'?links='+launch.token,tab:{id:30},frameId:0};
 await f.links.handle('LINKS_FAILED',{reason:'access_blocked',stage:'start'},sender);
 const view=await f.links.handle('LINKS_READ',{},{});assert.equal(view.recovery,'confirm-access');assert.ok(view.until>Date.now());assert.equal(view.id,undefined);
 f.advance(3600001);await f.links.handle('LINKS_START',{accessConfirmed:true},{});
 assert.equal((await f.store.read(['domain:idealista.pt']))['domain:idealista.pt'].accessBlocked,false);
 const started=await f.send('START',{mode:'links',items:[{url:'https://www.idealista.pt/arrendar-casas/'}]},sender);assert.equal(started.result.status,'started');
 assert.equal((await f.send('REQUEST',{id:started.result.id,epoch:started.result.epoch,requestId:'new-links-request',url:'https://www.idealista.pt/arrendar-casas/',kind:'navigation'},sender)).result.status,'ready');
 assert.equal((await f.c.metadata({id:'old-batch'})).state,'blocked');
});

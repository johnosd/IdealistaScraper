const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,deferred}=require('../fixtures/autonoma.cjs');
test('falha de descoberta após bindOwner libera o domínio com epoch real',async()=>{
 const f=fixture({discover:async()=>({source:f.source,items:[]})}),service=f.service(),c=service.coordinator;
 await c.reserveLaunch({id:'bound',commandId:'bound-empty',owner:'launch',source:f.source,domain:'idealista.pt',startedAt:new Date(f.now()).toISOString(),exportContext:{yearMonth:'202611'},proxyRevision:'proxy-1'});
 await c.bindOwner({id:'bound',owner:'launch',epoch:1,newOwner:'runner',runId:'browser'});
 const result=await service.start({commandId:'bound-empty',launchId:'bound',source:f.source,owner:'runner'});
 assert.equal(result.status,'interrupted');assert.notEqual((await c.metadata({id:'bound'})).state,'discovering');assert.equal((await f.store.read(['domain:idealista.pt']))['domain:idealista.pt'].active,null);
});
test('pré-requisito ausente impede descoberta e anúncios',async()=>{const f=fixture();f.ports.preflight=async()=>({status:'needs-configuration'});const r=await f.service().start({commandId:'setup',source:f.source,owner:'runner'});assert.equal(r.status,'needs-configuration');assert.equal(f.discoveries.length,0);assert.equal(f.calls.length,0);});
test('pausa na descoberta impede publicação tardia da fila',async()=>{const entered=deferred(),release=deferred();const f=fixture({discover:async source=>{entered.resolve();await release.promise;return {source,items:[{nome:'A',url:'https://www.idealista.pt/a/'}]};}});const s=f.service(),work=s.start({commandId:'late',source:f.source,owner:'runner'});await entered.promise;const rows=await s.coordinator.list();await s.pause({id:rows[0].id,owner:'runner'});release.resolve();assert.equal((await work).status,'interrupted');assert.equal((await s.read({id:rows[0].id})).items.length,0);});
test('descoberta vazia não produz falsa conclusão nem deixa domínio ocupado',async()=>{const f=fixture({discover:async source=>({source,items:[]})});const s=f.service(),r=await s.start({commandId:'empty',source:f.source,owner:'runner'});assert.equal(r.status,'interrupted');assert.equal(f.calls.length,0);assert.equal((await s.coordinator.eligibility()),null);const d=(await f.store.read(['domain:idealista.pt']))['domain:idealista.pt'];assert.equal(d.active,null);});

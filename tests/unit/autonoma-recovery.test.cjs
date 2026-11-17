const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,deferred,url}=require('../fixtures/autonoma.cjs');

test('encerrar runner já pausado conserva motivo e estado em leituras seguintes',async()=>{
 const f=fixture();f.ports.policy.maxPagesPerRun=1;const service=f.service(),r=await service.start({commandId:'budget-finished',source:f.source,owner:'runner'});await service.drive({id:r.id,owner:'runner'});
 await service.coordinator.recover({id:r.id,ownerAlive:false,executorAlive:false});const run=await service.read({id:r.id});assert.equal(run.state,'paused');assert.equal(run.reason,'run_budget');assert.equal(run.summary.saved,1);
});

test('checkpoint corrompido impede retomada antes de nova solicitação',async()=>{
 const f=fixture({names:['A'],response:async input=>input.url===url('A')?{status:200,listing:true,finalUrl:input.url,records:[{id:'first'}],nextUrl:url('A')+'pagina-2/'}:{status:404,finalUrl:input.url,records:[]}});
 const s=f.service(),r=await s.start({commandId:'corrupt',source:f.source,owner:'runner'});await s.drive({id:r.id,owner:'runner'});const run=await s.read({id:r.id});const key='page:'+r.id+':0:1';
 await f.store.transact([key],rows=>{rows[key].hash='invalid';return {writes:rows};});
 const before=f.calls.length;const resumed=await s.resume({id:r.id,owner:'runner',selection:{itemId:run.items[0].id}});assert.equal(resumed.status,'incompatible');assert.equal(f.calls.length,before);
});
test('pausa durante transporte aguarda saída e não inicia próximo item',async()=>{
 const entered=deferred(),release=deferred(),f=fixture({response:async input=>{entered.resolve();await release.promise;return {status:200,listing:true,finalUrl:input.url,records:[{id:'one'}],nextUrl:null};}});
 const s=f.service(),r=await s.start({commandId:'pause',source:f.source,owner:'runner'});const work=s.drive({id:r.id,owner:'runner'});await entered.promise;assert.equal((await s.pause({id:r.id,owner:'runner'})).status,'pausing');release.resolve();await work;
 const run=await s.read({id:r.id});assert.equal(run.state,'paused');assert.equal(f.calls.length,1);assert.equal(run.summary.saved,0);assert.equal(run.summary.queued,2);
});
test('item não tentado continua a iniciar ao atingir orçamento global',async()=>{
 const f=fixture();f.ports.policy.maxPagesPerRun=1;const s=f.service(),r=await s.start({commandId:'budget',source:f.source,owner:'runner'});await s.drive({id:r.id,owner:'runner'});
 const run=await s.read({id:r.id});assert.equal(run.state,'paused');assert.equal(run.reason,'run_budget');assert.equal(run.summary.queued,2);assert.equal(run.summary.saved,1);
});

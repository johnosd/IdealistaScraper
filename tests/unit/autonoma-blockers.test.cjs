const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('../fixtures/autonoma.cjs');

test('novo clique durante Retry-After não agenda retomada automática; exige novo gesto elegível',async()=>{
 const f=fixture({names:['A'],response:async input=>({status:429,retryAfter:'120',finalUrl:input.url,records:[]})});const service=f.service();const started=await service.start({commandId:'first',source:f.source,owner:'runner',useProxy:false});await service.drive({id:started.id,owner:'runner'});
 const second=await service.start({commandId:'second',source:f.source,owner:'other',useProxy:false});assert.equal(second.status,'wait');assert.equal(f.calls.length,1);assert.equal((await service.list()).length,1);
 f.advance(120001);await service.read({id:started.id});assert.equal(f.calls.length,1);
 assert.equal((await service.start({commandId:'third',source:f.source,owner:'other',useProxy:false})).status,'started');
});

// 006 (pedido do usuário): {status:200,listing:false} (conteúdo inesperado) deixou de ser condição global:
// tenta 3×, vai para o fim da fila e a fila segue — coberto por tests/unit/unexpected-retry-006.test.cjs.
for(const facts of [{status:403},{status:429,retryAfter:'120'},{status:401},{status:407},{status:404,challenge:true},{transportError:true}]){
 test('condição global não avança outro município: '+JSON.stringify(facts),async()=>{const f=fixture({response:async input=>({...facts,finalUrl:input.url,records:[]})}),s=f.service(),r=await s.start({commandId:'blocker',source:f.source,owner:'runner'});await s.drive({id:r.id,owner:'runner'});const run=await s.read({id:r.id});assert.equal(run.state,'paused');assert.equal(new Set(f.calls.map(c=>c.itemId)).size,1);assert.equal(run.summary.queued,2);});
}
test('falha de persistência preserva custo e não pede outra página',async()=>{
 const f=fixture({response:async input=>{f.store.failNextCommit=true;return {status:200,listing:true,finalUrl:input.url,records:[{id:'one'}],nextUrl:null};}}),s=f.service(),r=await s.start({commandId:'quota',source:f.source,owner:'runner'});await s.drive({id:r.id,owner:'runner'});const run=await s.read({id:r.id});assert.equal(f.calls.length,1);assert.equal(run.counters.requested,1);assert.equal(run.counters.confirmed,0);assert.equal(run.reason,'checkpoint_failed');assert.equal(run.summary.saved,0);
});

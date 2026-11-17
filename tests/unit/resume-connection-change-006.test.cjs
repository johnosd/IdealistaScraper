const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('../fixtures/autonoma.cjs');
const {createAutonomousCollection}=require('../../src/coleta-autonoma');

async function pausedAfterConnectionChange(){
  const f=fixture({names:['A','B']});let revision='proxy-1';
  const ports={...f.ports,autoRecovery:{maxRechecks:3},async proxySnapshot(){return {revision};}};
  const service=createAutonomousCollection(ports);
  const start=await service.start({commandId:'c',source:f.source,useProxy:true,owner:'runner'});
  const s=await service.coordinator.metadata({id:start.id});await service.coordinator.control({id:s.id,owner:s.owner,epoch:s.epoch,action:'pause'});
  revision='direct-2';// usuário troca o proxy esgotado pela conexão direta
  return {f,service,id:start.id};
}

test('006 T076 (tela do usuário): retomada pedida pelo usuário depois de trocar a conexão aceita a conexão atual e continua',async()=>{
  const {f,service,id}=await pausedAfterConnectionChange();
  const r=await service.resume({id,owner:'runner',connectionConfirmed:true});
  assert.equal(r.status,'accepted');
  const s=await service.coordinator.metadata({id});assert.equal(s.proxyRevision,'direct-2');
  assert.ok(s.events.some(e=>e.code==='connection_confirmed'));
  const done=await service.runQueue({id,owner:'runner'});assert.equal(done.summary.saved,2);assert.equal(f.writes.length,2);
});

test('006 T076: retomada automática nunca adota sozinha uma conexão diferente',async()=>{
  const {service,id}=await pausedAfterConnectionChange();
  const r=await service.resume({id,owner:'runner'});
  assert.equal(r.status,'incompatible');
  assert.equal((await service.coordinator.metadata({id})).proxyRevision,'proxy-1');
});

test('006 T076: recusa da retomada do usuário fica registrada como motivo visível no painel',async()=>{
  const {f,service,id}=await pausedAfterConnectionChange();
  await f.store.transact(['session:'+id],rows=>{const v=rows['session:'+id];for(const k of Object.keys(v.itemStates))v.itemStates[k].recoverable=false;return {writes:rows,result:null};});
  const r=await service.resume({id,owner:'runner',connectionConfirmed:true});
  assert.notEqual(r.status,'accepted');
  const view=await service.read({id});assert.equal(view.reason,r.reason);assert.notEqual(view.reason,'paused');
});

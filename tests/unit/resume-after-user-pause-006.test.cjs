const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('../fixtures/autonoma.cjs');
const {createAutonomousCollection}=require('../../src/coleta-autonoma');
const {DEFAULT_POLICY}=require('../../src/coleta-policy');

test('006 T075 (tela do usuário): pausa do usuário durante o limite por hora → Retomar aguarda a janela e continua sozinho',async()=>{
  const f=fixture({names:['A','B']});
  const service=createAutonomousCollection({...f.ports,policy:{...DEFAULT_POLICY,maxSessionMs:172800000,maxPagesPerWindow:1},autoRecovery:{maxRechecks:3}});
  const start=await service.start({commandId:'u',source:f.source,useProxy:false,owner:'runner'});
  await service.drive({id:start.id,owner:'runner'});
  let s=await service.coordinator.metadata({id:start.id});assert.equal(s.reason,'window_budget');
  // Usuário clica em Pausar durante a espera: motivo vira "paused".
  await f.store.transact(['session:'+start.id],rows=>{rows['session:'+start.id].reason='paused';return {writes:rows,result:null};});
  const r=await service.resume({id:start.id,owner:'runner'});
  assert.equal(r.status,'wait');
  s=await service.coordinator.metadata({id:start.id});assert.equal(s.reason,'window_budget');
  const done=await service.runQueue({id:start.id,owner:'runner'});
  assert.equal(done.summary.saved,2);assert.equal(f.writes.length,2);
});

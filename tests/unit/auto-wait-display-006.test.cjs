const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('../fixtures/autonoma.cjs');
const {autoWaitText}=require('../../src/sidepanel');

async function pausedBy(reason,{runnerLive=true,until}={}){
  const f=fixture({names:['A']}),service=f.service(),start=await service.start({commandId:'w-'+reason,source:f.source,useProxy:false,owner:'runner'});
  await f.store.transact(['session:'+start.id],rows=>{const v=rows['session:'+start.id];v.state='paused';v.reason=reason;v.runState='paused';v.runnerLive=runnerLive;v.autoRecovery={rechecks:0,until:until??f.now()+600000,action:'resume'};return {writes:rows,result:null};});
  return {f,run:await service.read({id:start.id})};
}

test('006 (tela do usuário): limite por hora com executor vivo aguardando aparece como espera automática, não "Pausando…"',async()=>{
  const {run}=await pausedBy('window_budget');
  assert.equal(run.state,'waiting');
  assert.match(autoWaitText(run,run.autoRecovery.until-600000),/Retomada automática \(limite por hora\) em 10 min 00 s/);
});

test('006: pausa pedida pelo usuário, prazo vencido ou executor encerrado não viram espera automática',async()=>{
  assert.notEqual((await pausedBy('paused')).run.state,'waiting');
  assert.notEqual((await pausedBy('window_budget',{runnerLive:false})).run.state,'waiting');
  const {f,run}=await pausedBy('window_budget',{until:1});assert.notEqual(run.state,'waiting');void f;
});

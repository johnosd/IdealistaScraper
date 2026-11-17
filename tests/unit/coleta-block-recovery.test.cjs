const test=require('node:test'),assert=require('node:assert/strict');
const {planBlockRecovery}=require('../../src/coleta-block-recovery');
const {autoWaitText}=require('../../src/sidepanel');
const now=1000;

test('006 US5: tabela de decisão — bloqueio e limite contam verificações; esperas livres e novo ciclo não contam',()=>{
  assert.deepEqual(planBlockRecovery({state:'blocked',reason:'access_blocked',until:5000,now,rechecks:0,maxRechecks:3}),{action:'recheck',until:5000,counts:true});
  assert.deepEqual(planBlockRecovery({state:'blocked',reason:'access_blocked',until:5000,now,rechecks:3,maxRechecks:3}),{action:'stop',reason:'access_blocked_persistent'});
  assert.deepEqual(planBlockRecovery({state:'paused',reason:'rate_limit',until:5000,now,rechecks:1}),{action:'resume',until:5000,counts:true});
  assert.deepEqual(planBlockRecovery({state:'paused',reason:'rate_limit',until:5000,now,rechecks:3,maxRechecks:3}),{action:'stop',reason:'rate_limit_persistent'});
  for(const reason of ['window_budget','server_wait','transient','interval'])assert.deepEqual(planBlockRecovery({state:'paused',reason,until:5000,now,rechecks:99}),{action:'resume',until:5000,counts:false},reason);
  for(const reason of ['run_budget','session_duration'])assert.deepEqual(planBlockRecovery({state:'paused',reason,until:null,now}),{action:'renew',until:now,counts:false},reason);
});

test('006 US5: pausa do usuário, estados finais e motivos não recuperáveis sempre param; prazo no passado vira agora',()=>{
  assert.equal(planBlockRecovery({state:'paused',reason:'paused',now}).action,'stop');
  assert.equal(planBlockRecovery({state:'pausing',reason:'access_blocked',now}).action,'stop');
  for(const state of ['completed','finished-with-pending'])assert.equal(planBlockRecovery({state,reason:'access_blocked',now}).action,'stop');
  for(const reason of ['checkpoint_failed','write_error','proxy_changed','pagination_cycle','collection_tab_closed','unexpected_content','proxy_error'])
    assert.deepEqual(planBlockRecovery({state:'paused',reason,now}),{action:'stop',reason},reason);
  assert.equal(planBlockRecovery({state:'blocked',reason:'access_blocked',until:10,now}).until,now);
});

test('006 US5: limite de tentativas por página (004) antes do de verificações ainda é reportado como bloqueio persistente',async()=>{
  const {fixture}=require('../fixtures/autonoma.cjs');
  const f=fixture({names:['A'],response:async input=>({status:200,challenge:true,finalUrl:input.url,records:[]})});
  const service=require('../../src/coleta-autonoma').createAutonomousCollection({...f.ports,autoRecovery:{maxRechecks:5}});
  const start=await service.start({commandId:'cap',source:f.source,useProxy:false,owner:'runner'});
  const run=await service.runQueue({id:start.id,owner:'runner'});
  assert.equal(f.calls.length,3,'maxAttempts padrão = 3 por página');
  assert.equal(run.reason,'access_blocked_persistent');assert.equal(run.items[0].checkpoint.confirmedPages,0);
});

test('006 (pedido do usuário): contador regressivo legível para qualquer espera',()=>{
  const {remainingText}=require('../../src/sidepanel');const t=1_000_000;
  assert.equal(remainingText(t+7000,t),'7 s');
  assert.equal(remainingText(t+65000,t),'1 min 05 s');
  assert.equal(remainingText(t+29*60000+40000,t),'29 min 40 s');
  assert.equal(remainingText(t+2*3600000+5*60000,t),'2 h 05 min');
  assert.equal(remainingText(t-1,t),'instantes');assert.equal(remainingText(t+1,t),'1 s');
});

test('006 US5: painel informa a próxima verificação automática somente quando agendada e futura',()=>{
  const run={state:'paused',reason:'access_blocked',autoRecovery:{until:Date.now()+60000,rechecks:1}};
  assert.match(autoWaitText(run),/Nova verificação automática do acesso em (59|60) s|1 min 00 s/);assert.match(autoWaitText(run),/\(às .+\)\. A coleta seguirá sozinha/);
  assert.equal(autoWaitText({...run,autoRecovery:{until:Date.now()-1}}),'');
  assert.equal(autoWaitText({...run,reason:'access_blocked_persistent'}),'');
  assert.equal(autoWaitText({...run,autoRecovery:null}),'');
});

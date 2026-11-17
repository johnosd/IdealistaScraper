const test=require('node:test'),assert=require('node:assert/strict');
const {createCollectionWorkflow}=require('../../src/coleta-runner');

function workflow(answers){
  const calls=[],states=[];
  const api={runtime:{async sendMessage(m){const action=m.cmd.replace('COLETA_','');calls.push(action);
    if(action==='READ')return {ok:true,result:{id:'s1',epoch:1,state:'interrupted',checkpoint:{}}};
    if(action==='RESUME')return {ok:true,result:answers.shift()};return {ok:true,result:{}};}}};
  return {calls,states,w:createCollectionWorkflow({api,mode:'itens',onState:(view,extra)=>states.push(extra)})};
}

test('006 R-015: Retomar dentro do intervalo mínimo aguarda o prazo e tenta de novo',async()=>{
  const f=workflow([{status:'wait',reason:'interval',until:Date.now()+30},{status:'paused',reason:'parar-aqui'}]);
  const result=await f.w.resume('s1');
  assert.deepEqual(f.calls.filter(c=>c==='RESUME').length,2);
  assert.equal(f.states[0].reason,'interval');assert.equal(result.reason,'parar-aqui');
});

test('006 R-015: esperas que não são de intervalo continuam manuais (bloqueio, janela, limite)',async()=>{
  for(const reason of ['access_blocked','window_budget','rate_limit','server_wait']){
    const f=workflow([{status:'wait',reason,until:Date.now()+30}]);
    const result=await f.w.resume('s1');
    assert.equal(f.calls.filter(c=>c==='RESUME').length,1,reason);assert.equal(result.reason,reason);
  }
});

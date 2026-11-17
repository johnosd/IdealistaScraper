const test=require('node:test'),assert=require('node:assert/strict');
const {runtimeFixture}=require('../fixtures/coleta-runtime.cjs');
const {installAutonomousBackground}=require('../../src/coleta-autonoma-background');
function setup(){const f=runtimeFixture();installAutonomousBackground(f.api,{runtime:f.runtime,proxy:f.proxy});const send=(action,payload={},sender={id:'fixture',url:f.api.runtime.getURL('sidepanel.html')})=>new Promise(resolve=>f.api.runtime.onMessage.listeners.at(-1)({cmd:'AUTONOMA_'+action,payload},sender,resolve));return {...f,send};}
async function pausedWithRunner(f,runId){
  await f.runtime.coordinator.reserveLaunch({id:'w',commandId:'w-command',owner:'launch',source:{tabId:9,url:'https://www.idealista.pt/a/'},runId:'browser',startedAt:new Date().toISOString(),exportContext:{yearMonth:'202611'}});
  const bound=await f.runtime.coordinator.bindOwner({id:'w',owner:'launch',epoch:1,newOwner:'8',runId});
  await f.runtime.coordinator.control({id:'w',owner:'8',epoch:bound.epoch,action:'pause',reason:'window_budget'});
}

test('006 (tela do usuário): pausa por limite com executor morto (extensão recarregada) não fica presa em "Pausando…"',async()=>{
  const f=setup();f.session.collectionRunId='browser-novo';await pausedWithRunner(f,'browser-antigo');
  const read=(await f.send('READ',{id:'w'})).result;
  assert.equal(read.state,'paused');assert.equal(read.reason,'window_budget');
  assert.equal((await f.runtime.coordinator.metadata({id:'w'})).runnerLive,false);
});

test('006: pausa por limite com aba do executor fechada também é liberada',async()=>{
  const f=setup();f.session.collectionRunId='browser';await pausedWithRunner(f,'browser');
  assert.equal((await f.send('LIST')).result[0].state,'paused');
});

test('006: executor vivo concluindo a pausa continua "Pausando…" até FINISHED',async()=>{
  const f=setup();f.session.collectionRunId='browser';await pausedWithRunner(f,'browser');
  f.tabs.set(8,{id:8,url:f.api.runtime.getURL('runner.html')+'?id=w&token=t'});
  assert.equal((await f.send('READ',{id:'w'})).result.state,'pausing');
});

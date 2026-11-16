const test=require('node:test'),assert=require('node:assert/strict');
const {runtimeFixture}=require('../fixtures/coleta-runtime.cjs');
const {installAutonomousBackground}=require('../../src/coleta-autonoma-background');
function setup(){const f=runtimeFixture();installAutonomousBackground(f.api,{runtime:f.runtime,proxy:f.proxy});const send=(action,payload={},sender={id:'fixture',url:f.api.runtime.getURL('configuracoes.html'),documentId:'settings-doc'})=>new Promise(resolve=>f.api.runtime.onMessage.listeners.at(-1)({cmd:'AUTONOMA_'+action,payload},sender,resolve));return {...f,send};}
test('token de runner forjado e iframe não leem conexão nem assumem trabalho',async()=>{
 const f=setup();for(const sender of [{id:'other',url:f.api.runtime.getURL('configuracoes.html')},{id:'fixture',url:f.api.runtime.getURL('sidepanel.html'),frameId:1}])assert.equal((await f.send('GET_SETTINGS',{},sender)).ok,false);
 const r=await f.send('ATTACH',{id:'unknown',token:'forged'},{id:'fixture',url:f.api.runtime.getURL('runner.html'),tab:{id:4},frameId:0,documentId:'forged'});assert.equal(r.result.status,'inactive');assert.equal((await f.runtime.coordinator.list()).length,0);
});
test('nova pasta só publica binding em revisão inativa e documento que preparou',async()=>{
 const f=setup();await f.runtime.coordinator.reserveLaunch({id:'r',commandId:'gesture',owner:'8',source:{tabId:9,url:'https://www.idealista.pt/a/'},runId:'old',startedAt:new Date().toISOString(),exportContext:{yearMonth:'202611'}});
 await f.runtime.coordinator.recover({id:'r',ownerAlive:false,executorAlive:false});
 const begin=await f.send('BEGIN_DESTINATION',{id:'r'});assert.equal(begin.result.status,'ready');
 const wrong=await f.send('BIND_DESTINATION',{id:'r',token:begin.result.token},{id:'fixture',url:f.api.runtime.getURL('configuracoes.html'),documentId:'different'});assert.equal(wrong.result.status,'conflict');assert.equal((await f.runtime.coordinator.metadata({id:'r'})).destinationHandleKey,undefined);
 const done=await f.send('BIND_DESTINATION',{id:'r',token:begin.result.token});assert.equal(done.result.status,'saved');assert.equal((await f.runtime.coordinator.metadata({id:'r'})).destinationHandleKey,begin.result.token);
 const again=await f.send('BEGIN_DESTINATION',{id:'r'});await f.store.transact(['domain:idealista.pt'],()=>({writes:{'domain:idealista.pt':{active:'other'}}}));assert.equal((await f.send('BIND_DESTINATION',{id:'r',token:again.result.token})).result.status,'busy');assert.equal((await f.runtime.coordinator.metadata({id:'r'})).destinationHandleKey,begin.result.token);
});


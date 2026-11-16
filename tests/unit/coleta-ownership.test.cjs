const test=require('node:test'),assert=require('node:assert/strict');const {scenario}=require('../fixtures/coleta-scenario.cjs');
test('executor vivo não perde propriedade por tela fechada ou relógio avançado',async()=>{
 const f=await scenario();const command=f.command();await f.c.requestPage(command);f.advance(300000);
 assert.equal((await f.c.recover({id:'scenario',ownerAlive:false,executorAlive:true})).status,'busy');
 assert.equal((await f.c.requestPage(f.command())).reason,'unconfirmed_request');
 assert.equal((await f.c.read({id:'scenario'})).counters.requested,1);
});
test('workflow somente leitura impede start/resume/save/descarte antes de qualquer mensagem',async()=>{
 const {createCollectionWorkflow}=require('../../src/coleta-runner');let calls=0;
 const flow=createCollectionWorkflow({mode:'lote',canMutate:()=>false,api:{runtime:{sendMessage:async()=>{calls++;return {ok:true,result:{state:'saved'}};}}}});
 for(const action of [()=>flow.start([]),()=>flow.resume('old'),()=>flow.save(),()=>flow.stop('DISCARD')])await assert.rejects(action,/controle|Ative/);
 assert.equal(calls,0);
});

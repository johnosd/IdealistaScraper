const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,deferred,url}=require('../fixtures/autonoma.cjs');
const {createCollectionCoordinator}=require('../../src/coleta-coordinator');
test('falha de gravação retoma somente save com dados duráveis e ação explícita',async()=>{
 const f=fixture({names:['A']}),write=f.ports.write;let failures=1;f.ports.write=async input=>{if(failures-- >0)throw new DOMException('Denied','NotAllowedError');return write(input);};
 let s=f.service();const r=await s.start({commandId:'save',source:f.source,owner:'runner'});await s.drive({id:r.id,owner:'runner'});const before=f.calls.length;s=f.service();
 assert.equal((await s.resume({id:r.id,owner:'new-runner',selection:'pending',retrySave:true})).status,'accepted');await s.drive({id:r.id,owner:'new-runner'});assert.equal(f.calls.length,before);assert.equal((await s.read({id:r.id})).state,'completed');
});
test('writer em curso conserva exclusividade do domínio',async()=>{
 const entered=deferred(),release=deferred(),f=fixture({names:['A']}),write=f.ports.write;f.ports.write=async input=>{entered.resolve();await release.promise;return write(input);};
 const s=f.service(),r=await s.start({commandId:'writing',source:f.source,owner:'runner'}),work=s.drive({id:r.id,owner:'runner'});await entered.promise;
 try{const c=createCollectionCoordinator({store:f.store,now:f.now});assert.equal((await c.start({id:'other',mode:'itens',owner:'other',domain:'idealista.pt',startedAt:new Date(f.now()).toISOString(),items:[{url:url('other')}]})).status,'busy');}finally{release.resolve();}
 await work;assert.equal((await s.read({id:r.id})).summary.saved,1);
});
test('listagem vazia confirmada finaliza sem inventar arquivo salvo',async()=>{
 const f=fixture({names:['A'],response:async input=>({status:200,empty:true,finalUrl:input.url,records:[],nextUrl:null})});
 const s=f.service(),r=await s.start({commandId:'empty-listing',source:f.source,owner:'runner'});await s.drive({id:r.id,owner:'runner'});const run=await s.read({id:r.id});
 assert.equal(run.state,'completed');assert.equal(run.summary.empty,1);assert.equal(run.summary.saved,0);assert.equal(f.writes.length,0);
});
test('colisão entre homônimos preserva segundo resultado pendente',async()=>{
 const f=fixture({discover:async source=>({source,items:[{nome:'Mesmo',url:url('A')},{nome:'Mesmo',url:url('B')}]})});
 const s=f.service(),r=await s.start({commandId:'collision',source:f.source,owner:'runner'});await s.drive({id:r.id,owner:'runner'});const run=await s.read({id:r.id});assert.equal(run.summary.saved,1);assert.equal(run.summary.pending,1);assert.equal(f.writes.length,1);assert.equal(run.items[1].reason,'destination_collision');
});

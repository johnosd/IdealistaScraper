const test=require('node:test'),assert=require('node:assert/strict');
const {createProxyRevision}=require('../../src/coleta-proxy');
const {runtimeFixture}=require('../fixtures/coleta-runtime.cjs');
test('revisão opaca distingue PAC externo de mesmo modo, credenciais e reinício',async()=>{
 const data={},storage={async get(keys){return Object.fromEntries(keys.map(k=>[k,data[k]]));},async set(v){Object.assign(data,v);}};
 const actual={levelOfControl:'controlled_by_this_extension',value:{mode:'pac_script',pacScript:{data:'fixture-a'}}};
 let observe=createProxyRevision(storage);const a=await observe(actual,'proxy-1');
 for(let i=0;i<100;i++)assert.equal(await observe(actual,'proxy-1'),a);
 observe=createProxyRevision(storage);assert.equal(await observe(actual,'proxy-1'),a);
 actual.value.pacScript.data='fixture-b';const b=await observe(actual,'proxy-1');assert.notEqual(b,a);
 assert.notEqual(await observe(actual,'proxy-2'),b);assert.match(a,/^context-\d+$/);
});
test('mudança entre reserva e dispatch recusa rede e preserva checkpoint',async()=>{
 const f=runtimeFixture(),s=(await f.send('START',{mode:'itens',items:[{url:'https://www.idealista.pt/a/'}]})).result;
 f.tabs.set(2,{id:2,url:'about:blank'});await f.send('REGISTER',{id:s.id,epoch:s.epoch,tabId:2});
 const r={id:s.id,epoch:s.epoch,requestId:'one',url:'https://www.idealista.pt/a/',kind:'pagination'};await f.send('REQUEST',r);f.proxy.revision='changed';
 const v=await f.send('VALIDATE',{...r,network:true},{id:'fixture',url:r.url,tab:{id:2},frameId:0,documentId:'one'});
 assert.equal(v.result.valid,false);const view=(await f.send('READ',{id:s.id})).result;
 assert.equal(view.state,'paused');assert.equal(view.checkpoint.confirmedPages,0);assert.equal(view.counters.requested,1);
});

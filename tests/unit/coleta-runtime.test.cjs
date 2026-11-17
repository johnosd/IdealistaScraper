const test=require('node:test'),assert=require('node:assert/strict');
const {runtimeFixture}=require('../fixtures/coleta-runtime.cjs');
async function started(f){const r=(await f.send('START',{mode:'itens',items:[{url:'https://www.idealista.pt/a/'}]})).result;assert.equal(r.status,'started');return {id:r.id,epoch:r.epoch};}
test('falha ao aplicar conexão retorna causa sanitizada antes de criar sessão',async()=>{
 const f=runtimeFixture();f.proxy.prepare=async()=>{throw Error('private credential must not escape');};
 const response=await f.send('START',{mode:'links',items:[{url:'https://www.idealista.pt/a/'}],useProxy:true});
 assert.equal(response.ok,true);assert.equal(response.result.reason,'connection_setup_failed');assert.equal(response.result.status,'paused');
 assert.doesNotMatch(JSON.stringify(response),/private credential/);assert.equal((await f.runtime.coordinator.list()).length,0);
});
test('worker reconstruído conserva executor vivo; aba reciclada não é encerrada sem prova',async()=>{
 const f=runtimeFixture(),s=await started(f);f.tabs.set(2,{id:2,url:'about:blank'});await f.send('REGISTER',{...s,tabId:2});
 const request={...s,requestId:'one',url:'https://www.idealista.pt/a/',kind:'navigation'};await f.send('REQUEST',request);
 f.tabs.set(2,{id:2,url:request.url});f.proofs.set(2,()=>({sessionId:s.id,epoch:s.epoch}));f.tabs.delete(1);f.boot();
 assert.equal((await f.send('LIST')).result[0].state,'running');
 f.tabs.set(1,{id:1,url:f.api.runtime.getURL('itens.html')});f.proofs.delete(2);f.tabs.set(2,{id:2,url:'https://user.invalid/'});
 assert.equal((await f.send('PAUSE',s)).ok,false);assert.equal(f.removed.length,0);
 f.tabs.delete(2);assert.equal((await f.send('PAUSE',s)).result.status,'paused');
});
test('permit de fetch é consumido uma vez e documento/epoch antigos são rejeitados',async()=>{
 const f=runtimeFixture(),s=await started(f);f.tabs.set(2,{id:2,url:'about:blank'});await f.send('REGISTER',{...s,tabId:2});
 const r={...s,requestId:'one',url:'https://www.idealista.pt/a/',kind:'pagination'};await f.send('REQUEST',r);
 const sender={id:'fixture',url:r.url,tab:{id:2},frameId:0,documentId:'doc-a'};
 const payload={...r,network:true};assert.equal((await f.send('VALIDATE',payload,sender)).result.valid,true);
 assert.equal((await f.send('VALIDATE',payload,sender)).result.valid,false);
 assert.equal((await f.send('VALIDATE',{...payload,network:false},{...sender,documentId:'doc-b'})).result.valid,false);
 assert.equal((await f.send('VALIDATE',{...payload,epoch:0},sender)).ok,false);
});
test('resumo de 429 já informa elegibilidade persistente sem tentar retomar',async()=>{
 const f=runtimeFixture(),s=await started(f),r={...s,requestId:'limited',url:'https://www.idealista.pt/a/',kind:'navigation'};
 await f.send('REQUEST',r);await f.send('REPORT',{...r,status:429,retryAfter:'120',records:[]});
 const view=(await f.send('READ',{id:s.id})).result;assert.ok(view.eligibility.until>=Date.now()+119000);assert.equal(view.eligibility.reason,'server_wait');
});
test('descarte manual de proprietário encerrado não exige retomar nem proxy compatível',async()=>{
 const f=runtimeFixture(),s=await started(f),sender={id:'fixture',url:f.api.runtime.getURL('itens.html'),tab:{id:3}};f.tabs.set(3,{id:3,url:sender.url});
 assert.equal((await f.send('DISCARD',s,sender)).result?.status,'busy');f.tabs.delete(1);f.proxy.revision='changed';
 const discarded=await f.send('DISCARD',s,sender);assert.equal(discarded.result?.status,'discarded');assert.equal((await f.send('LIST')).result.length,0);
});

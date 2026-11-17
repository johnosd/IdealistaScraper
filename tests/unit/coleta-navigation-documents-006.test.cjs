const test=require('node:test'),assert=require('node:assert/strict');
const {runtimeFixture}=require('../fixtures/coleta-runtime.cjs');

test('006 D5: nova requisição de navegação na mesma aba vincula o novo documento; documento anterior segue recusado',async()=>{
  const f=runtimeFixture(),p1='https://www.idealista.pt/arrendar-casas/alpha/',p2=p1+'pagina-2';
  const {DEFAULT_POLICY}=require('../../src/coleta-policy');
  assert.ok((await f.send('SET_POLICY',{limits:{...DEFAULT_POLICY,minIntervalMs:1000},ipEnabled:false})).ok);
  const s=(await f.send('START',{mode:'itens',items:[{url:p1}]})).result;
  f.tabs.set(2,{id:2,url:'about:blank'});await f.send('REGISTER',{id:s.id,epoch:s.epoch,tabId:2});
  const sender=(url,documentId)=>({id:'fixture',url,tab:{id:2},frameId:0,documentId});
  const r1={id:s.id,epoch:s.epoch,requestId:'nav-1',url:p1,kind:'navigation'};
  await f.send('REQUEST',r1);
  assert.equal((await f.send('VALIDATE',{...r1,network:false},sender(p1,'doc-1'))).result.valid,true);
  const report=await f.send('REPORT',{...r1,status:200,finalUrl:p1,listing:true,records:[{id:'1'}],nextUrl:p2});
  assert.ok(report.ok,'página 1 confirmada');
  const r2={id:s.id,epoch:s.epoch,requestId:'nav-2',url:p2,kind:'navigation'};
  await new Promise(resolve=>setTimeout(resolve,1100));
  assert.equal((await f.send('REQUEST',r2)).result.status,'ready');
  assert.equal((await f.send('VALIDATE',{...r2,network:false},sender(p2,'doc-2'))).result.valid,true,'novo documento da página 2');
  assert.equal((await f.send('VALIDATE',{...r2,network:false},sender(p1,'doc-1'))).result.valid,false,'documento da página 1 não vale para a página 2');
});

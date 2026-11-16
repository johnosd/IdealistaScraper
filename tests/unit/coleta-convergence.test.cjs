const test=require('node:test'),assert=require('node:assert/strict');
const {runtimeFixture}=require('../fixtures/coleta-runtime.cjs');
const {mountCollectionUI}=require('../../src/coleta-ui');
const {createCollectionWorkflow}=require('../../src/coleta-runner');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.handlers={};this.dataset={};this.textContent='';}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}
 setAttribute(name,value){this[name]=value;}addEventListener(name,fn){this.handlers[name]=fn;}
}
function dom(){
 const previous=global.document,main=new Element('main');
 global.document={body:main,createElement:tag=>new Element(tag),querySelector:()=>main};
 function find(id,node=main){if(node.id===id)return node;for(const child of node.children){const r=find(id,child);if(r)return r;}}
 return {find,restore(){global.document=previous;}};
}
test('C-001 duas telas: conflito identifica execução sem navegar nem alterar sessão ativa',async()=>{
 const f=runtimeFixture(),ui=dom();
 try{
  const first=(await f.send('START',{mode:'itens',items:[{url:'https://www.idealista.pt/a/'}]})).result;
  const before=await f.runtime.coordinator.metadata({id:first.id});
  const sender={id:'fixture',url:f.api.runtime.getURL('localidades.html'),tab:{id:2}};
  f.tabs.set(2,{id:2,url:sender.url});f.api.runtime.sendMessage=m=>f.send(m.cmd.slice(7),m.payload,sender);
  const panel=mountCollectionUI({api:f.api,mode:'links'});await new Promise(setImmediate);
  const conflict=await panel.start([{url:'https://www.idealista.pt/b/'}]);
  assert.equal(conflict.reason,'active_session');assert.equal(conflict.activeSession.id,first.id);
  assert.equal(conflict.activeSession.mode,'itens');assert.equal(conflict.activeSession.createdAt,before.createdAt);
  assert.match(ui.find('collection-status').textContent,/Outra sessão.*Execução ativa: Itens/);
  assert.doesNotMatch(ui.find('collection-status').textContent,/Pronta para coletar/);
  assert.deepEqual(await f.runtime.coordinator.metadata({id:first.id}),before);
  assert.equal((await f.runtime.coordinator.list()).length,1);assert.equal(f.tabs.size,2);
 }finally{ui.restore();}
});
for(const kind of ['throw','result'])test(`C-003 ${kind}: falha de gravação sanitizada sobrevive à reabertura e reconcilia sem regravar`,async()=>{
 const f=runtimeFixture(),ui=dom();f.api.runtime.sendMessage=m=>f.send(m.cmd.slice(7),m.payload);let writes=0;
 try{
  const started=(await f.send('START',{mode:'itens',items:[{url:'https://www.idealista.pt/a/'}]})).result;
  const request={...started,requestId:'save-page',url:'https://www.idealista.pt/a/',kind:'navigation'};
  await f.send('REQUEST',request);await f.send('REPORT',{...request,status:200,listing:true,records:[{id:'one'}],nextUrl:null});
  const workflow=createCollectionWorkflow({api:f.api,mode:'itens',destination:()=> 'result.json',save:async()=>{writes++;if(kind==='result')return {status:'permission-required',message:'SECRET_ERROR'};const e=new Error('SECRET_ERROR');e.name='QuotaExceededError';throw e;}});
  await workflow.adopt(started.id);if(kind==='throw')await assert.rejects(workflow.save(true));else await workflow.save(true);
  const before=(await f.send('READ',{id:started.id,full:true})).result;
  assert.equal(before.state,'awaiting-save');assert.equal(before.reason,'save_failed');
  const event=before.diagnostics.find(e=>e.code==='save_failed');assert.equal(event.reason,kind==='throw'?'quota_exceeded':'permission_required');
  assert.doesNotMatch(JSON.stringify(before.diagnostics),/SECRET_ERROR/);assert.equal(before.checkpoint.records.length,1);assert.ok(before.saveIntent);
  assert.equal((await f.send('SAVE_FAILURE',{id:started.id,epoch:started.epoch,intentId:before.saveIntent.id,reason:'SECRET_FORGED'})).result.status,'rejected');
  assert.equal((await f.send('SAVE_FAILURE',{id:started.id,epoch:started.epoch,intentId:before.saveIntent.id,reason:'write_error'},{id:'fixture',url:f.api.runtime.getURL('itens.html'),tab:{id:99}})).ok,false);
  assert.equal((await f.send('SAVE_FAILURE',{id:started.id,epoch:started.epoch-1,intentId:before.saveIntent.id,reason:'write_error'})).ok,false);
  f.boot();const panel=mountCollectionUI({api:f.api,mode:'itens'});await new Promise(setImmediate);await panel.adopt(started.id);
  assert.match(ui.find('collection-status').textContent,/gravação do arquivo/);assert.match(ui.find('collection-diagnostics').textContent,/Falha de gravação/);
  const reconstructed=createCollectionWorkflow({api:f.api,mode:'itens',destination:()=> 'result.json',save:()=>assert.fail('Não deve regravar'),reconcile:async()=>({status:'saved',relativePath:'result.json'})});
  await reconstructed.adopt(started.id);assert.equal((await reconstructed.save(false)).status,'saved');assert.equal(writes,1);
  const after=(await f.send('READ',{id:started.id,full:true})).result;assert.equal(after.state,'saved');assert.equal(after.reason,null);assert.equal(after.counters.requested,1);assert.equal(after.checkpoint.records.length,1);
 }finally{ui.restore();}
});
test('C-003 recusa lançada mantém categoria DOM necessária à reautorização, sem mensagem bruta',async()=>{
 const f=runtimeFixture();f.api.runtime.sendMessage=m=>f.send(m.cmd.slice(7),m.payload);
 const started=(await f.send('START',{mode:'links',items:[{url:'https://www.idealista.pt/a/'}]})).result;
 const r={...started,requestId:'permission-page',url:'https://www.idealista.pt/a/',kind:'navigation'};
 await f.send('REQUEST',r);await f.send('REPORT',{...r,status:200,listing:true,records:[{nome:'One',link:r.url}],nextUrl:null});
 const workflow=createCollectionWorkflow({api:f.api,mode:'links',destination:()=> '202611/links.json',save:async()=>{throw new DOMException('SECRET_PERMISSION','NotAllowedError');}});
 await workflow.adopt(started.id);await assert.rejects(workflow.save(true),error=>{assert.equal(error.name,'NotAllowedError');assert.doesNotMatch(error.message,/SECRET_PERMISSION/);return true;});
});
test('C-002 retry e deduplicação: métricas persistem e aparecem no painel reaberto',async()=>{
 let time=Date.now();const f=runtimeFixture({now:()=>time}),ui=dom();f.api.runtime.sendMessage=m=>f.send(m.cmd.slice(7),m.payload);
 try{
  const started=(await f.send('START',{mode:'itens',items:[{url:'https://www.idealista.pt/a/'}]})).result;
  const request=(requestId,url)=>({...started,requestId,url,kind:'pagination'});
  const a=request('a1','https://www.idealista.pt/a/');await f.send('REQUEST',a);time+=1500;
  await f.send('REPORT',{...a,status:503,records:[]});time+=30000;
  const retry=request('a2',a.url);await f.send('REQUEST',retry);time+=2500;
  await f.send('REPORT',{...retry,status:200,listing:true,records:[{id:'one'}],nextUrl:'https://www.idealista.pt/b/'});time+=10000;
  const b=request('b1','https://www.idealista.pt/b/');await f.send('REQUEST',b);time+=1750;
  await f.send('REPORT',{...b,status:200,listing:true,records:[{id:'one'},{id:'two'}],nextUrl:null});
  f.boot();const full=(await f.send('READ',{id:started.id,full:true})).result;
  const successes=full.diagnostics.filter(e=>e.code==='success');
  assert.deepEqual(successes.map(e=>({attempt:e.attempt,duration:e.durationMs,newRecords:e.newRecords})),[{attempt:2,duration:2500,newRecords:1},{attempt:1,duration:1750,newRecords:1}]);
  assert.equal(full.checkpoint.records.length,2);
  const panel=mountCollectionUI({api:f.api,mode:'itens'});await new Promise(setImmediate);await panel.adopt(started.id);
  const rendered=ui.find('collection-diagnostics').textContent;
  assert.match(rendered,/Tentativa: 2/);assert.match(rendered,/Duração: 2500 ms/);assert.match(rendered,/Novos anúncios: 1/);
 }finally{ui.restore();}
});

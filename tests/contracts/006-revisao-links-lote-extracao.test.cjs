const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture,url,origin}=require('../fixtures/autonoma.cjs');
const {buildBatchQueue,deriveListingURL}=require('../../src/lote-queue');
const {createPageTransport}=require('../../src/coleta-runner');

const link=(Tipo,Texto,path,extra={})=>({'Região':null,'Sub-região':null,'Município':null,Tipo,Texto,URL:origin+path,Contagem:null,...extra});

test('C1 US3 FR-008/009/010 US7 FR-026: links viram uma entrada por listagem, sem sufixo concelhos-freguesias e com contexto',()=>{
  assert.equal(deriveListingURL(origin+'/arrendar-casas/braga-distrito/concelhos-freguesias'),origin+'/arrendar-casas/braga-distrito/');
  assert.equal(deriveListingURL(origin+'/arrendar-casas/braga-distrito/concelhos-freguesias/?ordem=1#municipality-search'),origin+'/arrendar-casas/braga-distrito/');
  assert.equal(deriveListingURL(origin+'/geo/arrendar-casas/acores/'),origin+'/geo/arrendar-casas/acores/');
  const {entries,rejected}=buildBatchQueue([
    link('Sub-região','Faro','/arrendar-casas/faro-distrito/concelhos-freguesias',{'Região':'Algarve','Sub-região':'Faro',Contagem:'2.389'}),
    link('Município','Albufeira','/arrendar-casas/albufeira/',{'Região':'Algarve','Sub-região':'Faro','Município':'Albufeira'}),
    link('Região','Algarve','/arrendar-casas/faro-distrito/',{'Região':'Algarve'}),
    link('Sub-região','Braga','/arrendar-casas/braga-distrito/concelhos-freguesias',{'Região':'Norte','Sub-região':'Braga'}),
    link('Município','Albufeira','/arrendar-casas/albufeira/#x',{'Região':'Algarve','Sub-região':'Faro','Município':'Albufeira'}),
    link('Município','Santa Maria','/arrendar-casas/santa-maria-a/',{'Região':'Norte','Sub-região':'Braga','Município':'Santa Maria'}),
    link('Município','Santa Maria','/arrendar-casas/santa-maria-b/',{'Região':'Centro','Sub-região':'Leiria','Município':'Santa Maria'}),
    link('Região','Açores','/geo/arrendar-casas/acores/',{'Região':'Açores'}),
    {...link('Município','Fora','/x/'),URL:'https://example.com/arrendar-casas/fora/'}
  ]);
  assert.deepEqual(entries.map(e=>e.url),[
    origin+'/arrendar-casas/faro-distrito/',origin+'/arrendar-casas/albufeira/',origin+'/arrendar-casas/braga-distrito/',
    origin+'/arrendar-casas/santa-maria-a/',origin+'/arrendar-casas/santa-maria-b/',origin+'/geo/arrendar-casas/acores/']);
  const faro=entries[0];
  assert.equal(faro.nome,'Faro');assert.deepEqual(faro.aliases,['Algarve']);
  assert.deepEqual(faro.linkUrls,[origin+'/arrendar-casas/faro-distrito/concelhos-freguesias',origin+'/arrendar-casas/faro-distrito/']);
  assert.deepEqual(faro.context,{'Região':'Algarve','Sub-região':'Faro','Município':null});
  assert.deepEqual(entries[1].context,{'Região':'Algarve','Sub-região':'Faro','Município':'Albufeira'});
  assert.deepEqual(entries[2].context,{'Região':'Norte','Sub-região':'Braga','Município':null});
  assert.deepEqual(entries[5].context,{'Região':'Açores','Sub-região':null,'Município':null});
  assert.equal(rejected.length,1);
});

test('C2 US4 FR-011/012/014/015 US7 FR-026: cada entrada percorre todas as páginas, grava antes da próxima e sinaliza listagem limitada',async()=>{
  const A=url('braga-distrito'),B=url('lisboa-distrito');let writesAtB=null;
  const f=fixture({
    discover:async input=>({source:structuredClone(input),items:[
      {nome:'Braga',url:A,context:{'Região':'Norte','Sub-região':'Braga','Município':null}},
      {nome:'Lisboa',url:B,context:{'Região':'Centro','Sub-região':'Lisboa','Município':null}}]}),
    response:async input=>{
      if(input.url===A)return {status:200,listing:true,finalUrl:A,declaredTotal:3,records:[{id:'a1'}],nextUrl:A+'pagina-2/'};
      if(input.url===A+'pagina-2/')return {status:200,listing:true,finalUrl:input.url,declaredTotal:3,records:[{id:'a2'},{id:'a3'}],nextUrl:null};
      writesAtB=f.writes.length;
      return {status:200,listing:true,finalUrl:B,declaredTotal:500,records:[{id:'b1'}],nextUrl:null};
    }});
  const service=f.service(),start=await service.start({commandId:'seq',source:f.source,useProxy:false,owner:'runner'});
  await service.runQueue({id:start.id,owner:'runner'});
  const run=await service.read({id:start.id});
  assert.deepEqual(f.calls.map(c=>c.url),[A,A+'pagina-2/',B]);
  assert.equal(writesAtB,1);
  assert.equal(run.state,'completed');assert.equal(run.summary.saved,2);
  assert.equal(run.items[0].completeness.status,'complete');
  assert.deepEqual(run.items[1].completeness,{status:'limited',declaredTotal:500,obtained:1,reason:'site_limit'});
  assert.deepEqual(f.writes[0].records,['a1','a2','a3'].map(id=>({id,'Região':'Norte','Sub-região':'Braga','Município':null,'Freguesia':null})));
  assert.equal(f.writes[0].totalPages,2);
});

test('C3 US5 FR-017/018/019/020: bloqueio temporário retoma sozinho após o prazo; persistente termina em intervenção',async()=>{
  let blockedAt=null;const times=[];
  const temp=fixture({names:['A'],response:async input=>{times.push(temp.now());
    if(times.length===1){blockedAt=temp.now();return {status:200,challenge:true,finalUrl:input.url,records:[]};}
    return {status:200,listing:true,finalUrl:input.url,records:[{id:'a1'}],nextUrl:null};}});
  const s1=createService(temp,2),r1=await s1.start({commandId:'temp',source:temp.source,useProxy:false,owner:'runner'});
  await s1.runQueue({id:r1.id,owner:'runner'});
  assert.equal((await s1.read({id:r1.id})).state,'completed');
  assert.equal(temp.calls.length,2);assert.ok(times[1]-blockedAt>=1800000,'nenhuma solicitação antes do prazo');

  const stuck=fixture({names:['A'],response:async input=>({status:200,challenge:true,finalUrl:input.url,records:[]})});
  const s2=createService(stuck,2),r2=await s2.start({commandId:'stuck',source:stuck.source,useProxy:false,owner:'runner'});
  await s2.runQueue({id:r2.id,owner:'runner'});
  const run=await s2.read({id:r2.id});
  assert.equal(stuck.calls.length,3,'1 tentativa + 2 verificações');
  assert.equal(run.reason,'access_blocked_persistent');assert.notEqual(run.state,'completed');
  assert.equal(run.items[0].checkpoint.confirmedPages,0);
  assert.notEqual((await s2.resume({id:r2.id,owner:'runner-2',selection:'remaining'})).status,'accepted');
  assert.equal(stuck.calls.length,3);
});
function createService(f,maxRechecks){return require('../../src/coleta-autonoma').createAutonomousCollection({...f.ports,autoRecovery:{maxRechecks}});}

test('C4 US4 FR-016: resumo deduplica anúncios por id entre entradas e arquivos mantêm a listagem completa',async()=>{
  const ids={[url('a')]:['1','2','3'],[url('b')]:['2','3','4']};
  const f=fixture({names:['A','B'],response:async input=>({status:200,listing:true,finalUrl:input.url,records:ids[input.url].map(id=>({id})),nextUrl:null})});
  const service=f.service(),start=await service.start({commandId:'dedup',source:f.source,useProxy:false,owner:'runner'});
  await service.runQueue({id:start.id,owner:'runner'});
  const run=await service.read({id:start.id});
  assert.deepEqual(run.dedup,{unique:4,items:{[run.items[0].id]:{new:3,repeated:0},[run.items[1].id]:{new:1,repeated:2}}});
  assert.deepEqual(f.writes[1].records.map(r=>r.id),['2','3','4']);
});

test('C5 US2/US4 FR-005/006/011: uma aba Idealista visível, em foco só ao criar, navega cada página sem fetch nem telas da extensão',async()=>{
  const fake=fakeChrome(),transport=createPageTransport(fake.api,{foreground:true});
  const pages=[['A',url('a')],['A',url('a')+'pagina-2/'],['B',url('b')]];let n=0;
  for(const [itemId,page] of pages){
    const {kind}=await transport.prepare({id:'run',epoch:1,itemId,url:page});
    assert.equal(kind,'navigation');
    const facts=await transport.execute({id:'run',epoch:1,itemId,requestId:'r'+(++n),url:page,kind,expiresAt:Date.now()+60000,timeoutMs:5000});
    assert.equal(facts.finalUrl,page);
  }
  assert.equal(fake.created.length,1);assert.equal(fake.created[0].active,true);
  assert.ok(fake.created.every(t=>!String(t.url).startsWith('chrome-extension://')));
  assert.deepEqual(fake.updates.filter(u=>u.url).map(u=>u.url),pages.map(p=>p[1]));
  assert.ok(fake.updates.every(u=>u.active!==true),'foco só na criação');
  assert.equal(fake.removed.length,0,'mesma aba entre entradas');
  assert.ok(fake.messages.filter(m=>m.cmd==='COLLECT_PAGE').every(m=>m.fetch===false));
});
function fakeChrome(){
  const tabs=new Map(),created=[],updates=[],messages=[],removed=[],updated=new Set(),gone=new Set();let next=100;
  const ev=set=>({addListener:f=>set.add(f),removeListener:f=>set.delete(f)});
  const api={
    runtime:{id:'ext',getURL:p=>'chrome-extension://ext/'+p,async sendMessage(m){messages.push(m);
      if(m.cmd==='COLETA_READ_HTTP'){const t=[...tabs.values()].at(-1);return {ok:true,result:{status:200,documentId:'doc:'+t.url,finalUrl:t.url}};}
      return {ok:true,result:{status:'ok'}};}},
    tabs:{onUpdated:ev(updated),onRemoved:ev(gone),
      async create(o){const t={id:next++,url:o.url,status:'complete',active:!!o.active};tabs.set(t.id,t);created.push({...o});return {...t};},
      async update(id,o){updates.push({id,...o});const t=tabs.get(id);if(o.url){t.url=o.url;t.status='complete';}for(const f of updated)f(id,{status:'complete'});return {...t};},
      async get(id){const t=tabs.get(id);if(!t)throw Error('No tab with id');return {...t};},
      async remove(id){removed.push(id);tabs.delete(id);for(const f of gone)f(id);},
      async sendMessage(id,m){messages.push({tabId:id,...m});const t=tabs.get(id);
        if(m.cmd==='COLLECT_PAGE')return {ok:true,status:200,listing:true,finalUrl:t.url,documentId:'doc:'+t.url,records:[{id:t.url}],nextUrl:null};
        if(m.cmd==='COLETA_EXECUTOR_PROOF')return {sessionId:m.sessionId,epoch:m.epoch};return {};}},
    scripting:{async executeScript(){return [{result:null}];}}
  };
  return {api,created,updates,messages,removed};
}

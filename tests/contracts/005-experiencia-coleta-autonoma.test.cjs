const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture,source,url,deferred,settingsRepository}=require('../fixtures/autonoma.cjs');
const {createCollectionCoordinator}=require('../../src/coleta-coordinator');
const {createCollectionSettings}=require('../../src/coleta-settings');
const {buildCollectionView}=require('../../src/coleta-view-model');
const {DEFAULT_POLICY}=require('../../src/coleta-policy');

test('C1 US1 FR-001/002/003/004/006/024: um comando fixa origem, deduplica e coleta a fila sem exportacao intermediaria',async()=>{
  const f=fixture({discover:async input=>({source:structuredClone(input),items:[
    {nome:'A',url:url('A'),quantidade:7},{nome:'A repetida',url:url('A')+'#x',quantidade:7},
    {nome:'B',url:url('B'),quantidade:2},{nome:'C',url:url('C'),quantidade:1}]})});
  const service=f.service();
  const [one,two]=await Promise.all([service.start({commandId:'click-1',source:f.source,useProxy:false,owner:'runner-1'}),
    service.start({commandId:'click-1',source:f.source,useProxy:false,owner:'runner-1'})]);
  assert.equal(one.id,two.id);
  const conflict=await service.start({commandId:'click-2',source:f.source,useProxy:false,owner:'runner-2'});
  assert.equal(conflict.status,'busy');
  f.source.url=url('Other'); // Navegação posterior não modifica a origem aceita.
  await service.drive({id:one.id,owner:'runner-1'});
  const run=await service.read({id:one.id});
  assert.equal(run.state,'completed');assert.deepEqual(run.source,source);
  assert.deepEqual(run.items.map(i=>i.url),[url('A'),url('B'),url('C')]);
  assert.equal(f.discoveries.length,1);assert.equal(f.writes.length,3);
  assert.deepEqual(f.calls.map(c=>c.url),[url('A'),url('B'),url('C')]);
  assert.ok(f.writes.every(w=>w.startedAt instanceof Date&&w.startedAt.getMonth()===10));
  assert.equal(run.summary.saved,3);assert.equal(run.summary.pending,0);
});

test('C2 US2 FR-008/009/012/014/033/036: observacao descartavel nao controla execucao e resumo separa pendencias',{timeout:5000},async()=>{
  const entered=deferred(),release=deferred();
  const f=fixture({names:['A','B'],response:async input=>{
    if(input.url===url('B')){entered.resolve();await release.promise;}
    return {status:200,listing:true,finalUrl:input.url,records:[{id:input.url}],nextUrl:null};
  }});
  const runner=f.service(),started=await runner.start({commandId:'observe',source:f.source,useProxy:false,owner:'runner'});
  const work=runner.drive({id:started.id,owner:'runner'});
  try {
    await entered.promise;
    const observer=f.service(),progress=await observer.read({id:started.id});
    assert.equal(progress.summary.saved,1);
    assert.equal(progress.summary.inProgress,1);
    assert.equal(f.calls.length,2);
  } finally {release.resolve();}
  await work;
  const final=await f.service().read({id:started.id});
  assert.equal(final.state,'completed');assert.equal(final.summary.saved,2);
  const items=Array.from({length:10},(_,i)=>({id:'i'+i,nome:'Local '+i,url:url(String(i)),
    state:i<6?'saved':i===6?'running':i<9?'queued':'pending',recoverable:i===9,checkpoint:{confirmedPages:0,recordCount:0}}));
  const projection=buildCollectionView({run:{id:'display',source,state:'running',items},filter:'pending',query:''});
  assert.deepEqual(projection.counts,{total:10,queued:2,inProgress:1,saved:6,empty:0,pending:1});
  assert.equal(projection.progress.value,6);assert.equal(projection.progress.max,10);
  assert.deepEqual(projection.rows.map(r=>r.id),['i9']);assert.equal(projection.primaryAction.id,'pause');
});

test('C3 US3 FR-016/020/021/022/029: falhas locais seguem adiante e retomadas individual e em grupo preservam checkpoints',async()=>{
  const seen=new Map();
  const f=fixture({response:async input=>{
    const n=(seen.get(input.url)||0)+1;seen.set(input.url,n);
    if(input.url===url('B'))return {status:200,listing:true,finalUrl:input.url,records:[{id:'B1'}],nextUrl:url('B')+'pagina-2/'};
    if((input.url===url('B')+'pagina-2/'||input.url===url('C'))&&n===1)
      return {status:404,finalUrl:input.url,records:[]};
    return {status:200,listing:true,finalUrl:input.url,records:[{id:input.url}],nextUrl:null};
  }});
  let service=f.service();const started=await service.start({commandId:'recover',source:f.source,useProxy:false,owner:'runner'});
  await service.drive({id:started.id,owner:'runner'});
  let run=await service.read({id:started.id});assert.equal(run.state,'finished-with-pending');
  assert.equal(run.summary.saved,1);assert.equal(run.summary.pending,2);
  const b=run.items.find(i=>i.url===url('B'));
  assert.equal(b.checkpoint.confirmedPages,1);assert.equal(b.checkpoint.nextUrl,url('B')+'pagina-2/');
  const before=f.calls.length;f.advance(86400000);service=f.service();
  run=await service.read({id:started.id});assert.equal(f.calls.length,before);
  assert.equal((await service.resume({id:started.id,owner:'runner-2',selection:{itemId:b.id}})).status,'accepted');
  await service.drive({id:started.id,owner:'runner-2'});
  run=await service.read({id:started.id});assert.equal(run.summary.pending,1);assert.equal(run.summary.saved,2);
  assert.equal(seen.get(url('A')),1);assert.equal(seen.get(url('B')),1);assert.equal(seen.get(url('C')),1);
  assert.equal((await service.resume({id:started.id,owner:'runner-2',selection:'pending'})).status,'accepted');
  await service.drive({id:started.id,owner:'runner-2'});
  run=await service.read({id:started.id});assert.equal(run.state,'completed');assert.equal(run.summary.saved,3);
  assert.ok(f.writes.every(w=>w.startedAt.getMonth()===10));
  const data=JSON.parse(f.directory.directories.get('202611').files.get('B-Paginas2.json').contents);
  assert.deepEqual(data.map(r=>r.id),['B1',url('B')+'pagina-2/']);
  assert.equal(seen.get(url('B')+'pagina-2/'),2);assert.equal(seen.get(url('C')),2);
});

test('C4 US4 FR-026/027/032/039: configuracoes reutilizam valores, validam antes de salvar e nao expõem segredo',async()=>{
  const repository=settingsRepository();let active=false;
  let settings=createCollectionSettings({repository,isActive:async()=>active});
  let view=await settings.load();assert.equal(view.revision,1);assert.equal(view.proxy.passwordConfigured,true);
  assert.ok(!JSON.stringify(view).includes('fixture-secret'));
  const invalid=await settings.save({expectedRevision:1,values:{limits:{...DEFAULT_POLICY,minIntervalMs:0},useProxy:false,ipEnabled:false}});
  assert.equal(invalid.status,'invalid');assert.equal(repository.commits.length,0);
  active=true;
  const busy=await settings.save({expectedRevision:1,values:{limits:{...DEFAULT_POLICY,minIntervalMs:12000},useProxy:false,ipEnabled:false}});
  assert.equal(busy.status,'busy');assert.equal(repository.commits.length,0);
  active=false;
  const saved=await settings.save({expectedRevision:1,values:{limits:{...DEFAULT_POLICY,minIntervalMs:12000},useProxy:false,ipEnabled:false}});
  assert.equal(saved.status,'saved');
  settings=createCollectionSettings({repository,isActive:async()=>false});view=await settings.load();
  assert.equal(view.revision,2);assert.equal(view.limits.minIntervalMs,12000);
  assert.equal((await repository.load()).proxy.password,'fixture-secret');
  const stale=await settings.save({expectedRevision:1,values:{limits:{...DEFAULT_POLICY,minIntervalMs:15000},useProxy:false,ipEnabled:false}});
  assert.equal(stale.status,'conflict');assert.equal(repository.commits.length,1);
});

test('C5 US1/US3 FR-017/024/029 Constitution IV: 429 e desafio pausam todo dominio ate retomada manual elegivel',async()=>{
  let count=0;const f=fixture({response:async input=>{
    count++;return count===1?{status:429,retryAfter:'120',finalUrl:input.url,records:[]}:
      count===2?{status:200,challenge:true,finalUrl:input.url,records:[]}:
      {status:200,listing:true,finalUrl:input.url,records:[{id:input.url}],nextUrl:null};
  }});
  let service=f.service();const start=await service.start({commandId:'block',source:f.source,useProxy:false,owner:'runner'});
  await service.drive({id:start.id,owner:'runner'});assert.equal(f.calls.length,1);
  service=f.service();
  assert.equal((await service.resume({id:start.id,owner:'runner-2',selection:'remaining'})).status,'wait');
  f.advance(120001);await service.read({id:start.id});assert.equal(f.calls.length,1);
  assert.equal((await service.resume({id:start.id,owner:'runner-2',selection:'remaining'})).status,'accepted');
  await service.drive({id:start.id,owner:'runner-2'});assert.equal(f.calls.length,2);
  f.advance(1800001);
  const other=createCollectionCoordinator({store:f.store,now:f.now});
  const denied=await other.start({id:'other',mode:'itens',owner:'other-screen',domain:'idealista.pt',
    startedAt:new Date(f.now()).toISOString(),items:[{nome:'Other',url:url('Other')}],proxyRevision:'proxy-1'});
  assert.notEqual(denied.status,'started');
  assert.notEqual((await service.resume({id:start.id,owner:'runner-2',selection:'remaining'})).status,'accepted');
  assert.equal(f.calls.length,2);
  assert.equal((await service.resume({id:start.id,owner:'runner-2',selection:'remaining',accessConfirmed:true})).status,'accepted');
  await service.drive({id:start.id,owner:'runner-2'});
  assert.equal((await service.read({id:start.id})).state,'completed');assert.equal(f.calls.length,5);
});

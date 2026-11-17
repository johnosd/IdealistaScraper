const test=require('node:test'),assert=require('node:assert/strict');
const {assessListing,withContext}=require('../../src/coleta-completeness');
const {completenessText,runExtrasText}=require('../../src/sidepanel');

test('006 FR-014/015: tolerância, total ausente, limite do site e orçamento por localidade',()=>{
  assert.deepEqual(assessListing({declaredTotal:868,obtained:868}),{status:'complete',declaredTotal:868,obtained:868,reason:null});
  assert.equal(assessListing({declaredTotal:868,obtained:851}).status,'complete','2% de tolerância (18)');
  assert.equal(assessListing({declaredTotal:868,obtained:849}).status,'limited');
  assert.deepEqual(assessListing({declaredTotal:9655,obtained:1800}),{status:'limited',declaredTotal:9655,obtained:1800,reason:'site_limit'});
  assert.equal(assessListing({declaredTotal:3,obtained:1}).status,'complete','mínimo de 2 de tolerância');
  assert.deepEqual(assessListing({declaredTotal:null,obtained:10}),{status:'complete',declaredTotal:null,obtained:10,reason:null},'sem total: nunca limitado pelo site');
  assert.deepEqual(assessListing({declaredTotal:5000,obtained:3000,budgetReached:true}),{status:'limited',declaredTotal:5000,obtained:3000,reason:'item_budget'});
  assert.equal(assessListing({declaredTotal:-1,obtained:'x'}).declaredTotal,null);
});

test('006 FR-026/SC-010: contexto é aditivo, no fim, sem alterar campos existentes',()=>{
  const record={Titulo:'Apartamento T2, Gualtar',Preco:'900 €',id:'1',tags:[]};
  const out=withContext(record,{'Região':'Norte','Sub-região':'Braga','Município':'Braga'},'Gualtar');
  assert.deepEqual(Object.keys(out),['Titulo','Preco','id','tags','Região','Sub-região','Município','Freguesia']);
  for(const key of Object.keys(record))assert.deepEqual(out[key],record[key]);
  assert.deepEqual(withContext({id:'2'},null),{id:'2','Região':null,'Sub-região':null,'Município':null,'Freguesia':null});
  assert.equal(withContext({id:'3',Freguesia:'Sé'},{}).Freguesia,'Sé');
});

test('006 FR-015/016: textos do painel não afirmam captura integral para listagem limitada',()=>{
  assert.match(completenessText({completeness:{status:'limited',declaredTotal:9655,obtained:1800,reason:'site_limit'}}),/Limitada pelo site \(1800 de 9655/);
  assert.match(completenessText({completeness:{status:'limited',declaredTotal:null,obtained:3000,reason:'item_budget'}}),/limite de páginas por localidade/);
  assert.match(completenessText({completeness:{status:'complete',declaredTotal:868,obtained:868}}),/Completa \(868 de 868/);
  assert.equal(completenessText({}),'');
  assert.equal(runExtrasText({dedup:{unique:4,items:{a:{new:3,repeated:0},b:{new:1,repeated:2}}},limitedCount:1}),' · 4 anúncios únicos · 2 repetidos entre localidades · 1 listagem limitada');
  assert.equal(runExtrasText({dedup:{unique:0,items:{}},limitedCount:0}),'');
  assert.equal(runExtrasText({dedup:{unique:0,items:{}},limitedCount:0,cycle:2,counters:{confirmed:400}}),' · ciclo 3 · 400 páginas confirmadas no total');
});

test('006 D9: no modo autônomo o orçamento por localidade conclui o item e segue para o próximo',async()=>{
  const {fixture,url}=require('../fixtures/autonoma.cjs');const {DEFAULT_POLICY}=require('../../src/coleta-policy');
  const A=url('a');let n=0;
  const f=fixture({names:['A','B'],response:async input=>{n++;if(input.url.startsWith(A))return {status:200,listing:true,finalUrl:input.url,declaredTotal:500,records:[{id:'a'+n}],nextUrl:A+'pagina-'+(n+1)+'/'};return {status:200,listing:true,finalUrl:input.url,records:[{id:'b'}],nextUrl:null};}});
  f.ports.policy={...DEFAULT_POLICY,maxSessionMs:172800000,maxPagesPerItem:2};
  const service=f.service(),start=await service.start({commandId:'budget',source:f.source,useProxy:false,owner:'runner'});
  await service.runQueue({id:start.id,owner:'runner'});
  const run=await service.read({id:start.id});
  assert.equal(run.state,'completed');assert.deepEqual(f.calls.map(c=>c.url),[A,A+'pagina-2/',url('b')]);
  assert.deepEqual(run.items[0].completeness,{status:'limited',declaredTotal:500,obtained:2,reason:'item_budget'});
  assert.equal(run.limitedCount,1);assert.equal(f.writes[0].totalPages,2);
});

const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,url}=require('../fixtures/autonoma.cjs');
const {createCollectionCoordinator}=require('../../src/coleta-coordinator');
const {MemoryCollectionStore}=require('../fixtures/coleta-store.cjs');

test('006 FR-026: context e freguesia sobrevivem a start/read e a ordem do DOM é mantida sem quantidade',async()=>{
  const ctx={'Região':'Norte','Sub-região':'Braga','Município':'Braga'};
  const f=fixture({discover:async input=>({source:structuredClone(input),items:[
    {nome:'Braga',url:url('braga'),quantidade:null,context:{...ctx,'Município':null}},
    {nome:'Adaúfe',url:url('adaufe'),quantidade:null,context:ctx,freguesia:'Adaúfe'}]})});
  const service=f.service(),start=await service.start({commandId:'ctx',source:f.source,useProxy:false,owner:'runner'});
  const run=await service.read({id:start.id});
  assert.deepEqual(run.items.map(i=>i.nome),['Braga','Adaúfe']);
  assert.deepEqual(run.items[0].context,{...ctx,'Município':null});
  assert.deepEqual(run.items[1].context,ctx);assert.equal(run.items[1].freguesia,'Adaúfe');
  assert.equal(run.items[0].freguesia,undefined);
});

test('006 FR-026: coordenador recusa chaves extras no contexto e normaliza valores vazios',async()=>{
  const store=new MemoryCollectionStore(),c=createCollectionCoordinator({store,now:()=>Date.parse('2026-11-16T12:00:00Z')});
  const base={mode:'lote',owner:'o',domain:'idealista.pt',startedAt:'2026-11-16T12:00:00.000Z',proxyRevision:'p'};
  await assert.rejects(c.start({...base,id:'bad',items:[{nome:'A',url:url('a'),context:{'Região':'X',segredo:'y'}}]}),/Contexto/);
  await c.start({...base,id:'ok',items:[{nome:'A',url:url('a'),context:{'Região':' Norte ','Sub-região':'','Município':42}}]});
  const view=await c.read({id:'ok'});
  assert.deepEqual(view.items[0].context,{'Região':'Norte','Sub-região':null,'Município':null});
});

test('006 R4/FR-027: arquivo grava Freguesia da entrada ou do título validado pela fila; senão null',async()=>{
  const ctx={'Região':null,'Sub-região':'Braga','Município':'Braga'};
  const f=fixture({discover:async input=>({source:structuredClone(input),items:[
    {nome:'Braga',url:url('braga'),quantidade:null,context:ctx},
    {nome:'Gualtar',url:url('gualtar'),quantidade:null,context:ctx,freguesia:'Gualtar'}]}),
    response:async input=>({status:200,listing:true,finalUrl:input.url,nextUrl:null,records:input.url===url('braga')
      ?[{id:'1',Titulo:'Apartamento T1, Gualtar'},{id:'2',Titulo:'Moradia, Rua Inventada'}]
      :[{id:'3',Titulo:'Apartamento T2, São Victor'}]})});
  const service=f.service(),start=await service.start({commandId:'freg',source:f.source,useProxy:false,owner:'runner'});
  await service.runQueue({id:start.id,owner:'runner'});
  assert.deepEqual(f.writes[0].records.map(r=>r.Freguesia),['Gualtar',null]);
  assert.deepEqual(f.writes[1].records.map(r=>r.Freguesia),['Gualtar'],'entrada do tipo Freguesia prevalece sobre o título');
  assert.equal(f.writes[0].records[0].Titulo,'Apartamento T1, Gualtar');
});

test('006 R-020: fila preparada leva as freguesias lidas nos distritos e o arquivo grava a Freguesia validada por distrito',async()=>{
  const f=fixture({discover:async input=>({source:structuredClone(input),items:[
    {nome:'Braga',url:url('braga-distrito'),quantidade:null,context:{'Região':'Norte','Sub-região':'Braga','Município':null}}]}),
    response:async input=>({status:200,listing:true,finalUrl:input.url,nextUrl:null,records:[{id:'1',Titulo:'T2, Gualtar'},{id:'2',Titulo:'T1, Sé'},{id:'3',Titulo:'T3, Rua X'}]})});
  const service=f.service();
  const start=await service.start({commandId:'fregsrc',source:{linksSessionId:'links-1',url:'https://www.idealista.pt/arrendar-casas/',freguesias:[['Gualtar','Braga'],['Sé','Évora']]},useProxy:false,owner:'runner'});
  await service.runQueue({id:start.id,owner:'runner'});
  assert.deepEqual(f.writes[0].records.map(r=>r.Freguesia),['Gualtar',null,null],'Sé é de Évora, não de Braga');
});

test('006 D4: fila preparada inicia sem aba de origem; página comum continua exigindo tabId',async()=>{
  const f=fixture({discover:async input=>({source:structuredClone(input),items:[{nome:'A',url:url('a'),quantidade:null}]})});
  const service=f.service();
  const ok=await service.start({commandId:'prep',source:{linksSessionId:'links-1',url:'https://www.idealista.pt/arrendar-casas/'},useProxy:false,owner:'runner'});
  assert.equal(ok.status,'started');
  await assert.rejects(f.service().start({commandId:'nope',source:{url:'https://www.idealista.pt/arrendar-casas/'},useProxy:false,owner:'runner'}),/origem inválida/);
});

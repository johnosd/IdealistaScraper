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

test('006 D4: fila preparada inicia sem aba de origem; página comum continua exigindo tabId',async()=>{
  const f=fixture({discover:async input=>({source:structuredClone(input),items:[{nome:'A',url:url('a'),quantidade:null}]})});
  const service=f.service();
  const ok=await service.start({commandId:'prep',source:{linksSessionId:'links-1',url:'https://www.idealista.pt/arrendar-casas/'},useProxy:false,owner:'runner'});
  assert.equal(ok.status,'started');
  await assert.rejects(f.service().start({commandId:'nope',source:{url:'https://www.idealista.pt/arrendar-casas/'},useProxy:false,owner:'runner'}),/origem inválida/);
});

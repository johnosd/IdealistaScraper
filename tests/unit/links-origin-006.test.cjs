const test=require('node:test'),assert=require('node:assert/strict');
const {chooseLinksOrigin}=require('../../src/links-collection');
const {linksAuditText}=require('../../src/sidepanel');
const {createCollectionCoordinator}=require('../../src/coleta-coordinator');
const {MemoryCollectionStore}=require('../fixtures/coleta-store.cjs');
const NATIONAL='https://www.idealista.pt/arrendar-casas/#municipality-search';

test('006 D7/FR-028 (correção do usuário): Links sempre usam a página nacional, a base completa',()=>{
  for(const url of [undefined,'https://www.idealista.pt/arrendar-casas/braga-distrito/concelhos-freguesias','https://www.idealista.pt/arrendar-casas/',
    'https://www.idealista.pt/arrendar-casas/braga-distrito/','https://evil.example/'])
    assert.deepEqual(chooseLinksOrigin(url),{url:NATIONAL,nome:'Localidades principais',current:false},String(url));
});

test('006 FR-004: coordenador guarda a auditoria de links (visível × coletada) só no modo links',async()=>{
  const store=new MemoryCollectionStore();let time=Date.parse('2026-11-16T12:00:00Z');
  const c=createCollectionCoordinator({store,now:()=>time});
  const url='https://www.idealista.pt/arrendar-casas/';
  const s=await c.start({id:'links1',mode:'links',owner:'o',domain:'idealista.pt',startedAt:new Date(time).toISOString(),items:[{nome:'Localidades principais',url}],proxyRevision:'p'});
  await c.requestPage({id:'links1',owner:'o',epoch:s.epoch,requestId:'r1',url,kind:'navigation'});
  await c.reportPage({id:'links1',owner:'o',epoch:s.epoch,requestId:'r1',url,status:200,finalUrl:url,listing:true,nextUrl:null,
    records:[{URL:url+'a/',Texto:'A'},{URL:url+'b/',Texto:'B'}],linksAudit:{strategy:'nacional',visible:3,excluded:{zonas:0,vizinhos:0},extra:'x'}});
  const view=await c.read({id:'links1'});
  assert.deepEqual(view.linksAudit,{strategy:'nacional',visible:3,collected:2,excluded:{zonas:0,vizinhos:0}});
});

test('006 FR-004: painel informa origem, contagem e aviso de divergência; sem auditoria não inventa números',()=>{
  const ok=linksAuditText({total:84,origin:{nome:'Localidades principais'},audit:{strategy:'nacional',visible:84,collected:84,excluded:{zonas:0,vizinhos:0}}});
  assert.match(ok,/Origem: Localidades principais\./);assert.match(ok,/84 de 84 links/);assert.doesNotMatch(ok,/Não incluídos|Atenção/);
  assert.match(linksAuditText({total:80,audit:{visible:84,collected:80,excluded:{zonas:0,vizinhos:0}}}),/Atenção: a quantidade coletada difere/);
  assert.equal(linksAuditText({total:84}),'');
});

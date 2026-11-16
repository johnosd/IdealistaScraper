const test=require('node:test'),assert=require('node:assert/strict');
const {chooseLinksOrigin}=require('../../src/links-collection');
const {linksAuditText}=require('../../src/sidepanel');
const {createCollectionCoordinator}=require('../../src/coleta-coordinator');
const {MemoryCollectionStore}=require('../fixtures/coleta-store.cjs');
const NATIONAL='https://www.idealista.pt/arrendar-casas/#municipality-search';

test('006 D7/FR-028: página de concelhos/freguesias é a origem; demais páginas usam a nacional',()=>{
  const braga=chooseLinksOrigin('https://www.idealista.pt/arrendar-casas/braga-distrito/concelhos-freguesias');
  assert.deepEqual(braga,{url:'https://www.idealista.pt/arrendar-casas/braga-distrito/concelhos-freguesias',nome:'Braga',current:true});
  assert.equal(chooseLinksOrigin('https://www.idealista.pt/arrendar-casas/corvo/corvo/concelhos-freguesias').current,true);
  assert.equal(chooseLinksOrigin('https://www.idealista.pt/arrendar-casas/vila-nova-de-famalicao/concelhos-freguesias?x=1#y').url,'https://www.idealista.pt/arrendar-casas/vila-nova-de-famalicao/concelhos-freguesias');
  for(const url of [undefined,'','nao-url','https://www.idealista.pt/arrendar-casas/','https://www.idealista.pt/arrendar-casas/#municipality-search',
    'https://www.idealista.pt/arrendar-casas/braga-distrito/','https://www.idealista.pt/imovel/123/','http://www.idealista.pt/arrendar-casas/braga-distrito/concelhos-freguesias',
    'https://evil.example/arrendar-casas/braga-distrito/concelhos-freguesias','https://www.idealista.pt:444/arrendar-casas/braga-distrito/concelhos-freguesias'])
    assert.deepEqual(chooseLinksOrigin(url),{url:NATIONAL,nome:'Localidades principais',current:false},String(url));
});

test('006 FR-004: coordenador guarda a auditoria de links (visível × coletada) só no modo links',async()=>{
  const store=new MemoryCollectionStore();let time=Date.parse('2026-11-16T12:00:00Z');
  const c=createCollectionCoordinator({store,now:()=>time});
  const url='https://www.idealista.pt/arrendar-casas/braga-distrito/concelhos-freguesias';
  const s=await c.start({id:'links1',mode:'links',owner:'o',domain:'idealista.pt',startedAt:new Date(time).toISOString(),items:[{nome:'Braga',url}],proxyRevision:'p'});
  await c.requestPage({id:'links1',owner:'o',epoch:s.epoch,requestId:'r1',url,kind:'navigation'});
  await c.reportPage({id:'links1',owner:'o',epoch:s.epoch,requestId:'r1',url,status:200,finalUrl:url,listing:true,nextUrl:null,
    records:[{URL:url+'#a',Texto:'A'},{URL:url+'#b',Texto:'B'}],linksAudit:{strategy:'distrito',visible:3,excluded:{zonas:15,vizinhos:3},extra:'x'}});
  const view=await c.read({id:'links1'});
  assert.deepEqual(view.linksAudit,{strategy:'distrito',visible:3,collected:2,excluded:{zonas:15,vizinhos:3}});
});

test('006 FR-004: painel informa origem, contagem e aviso de divergência; sem auditoria não inventa números',()=>{
  const ok=linksAuditText({total:148,origin:{nome:'Braga'},audit:{strategy:'distrito',visible:148,collected:148,excluded:{zonas:15,vizinhos:3}}});
  assert.match(ok,/Origem: Braga\./);assert.match(ok,/148 de 148 links/);assert.match(ok,/15 zonas de interesse e 3 distritos vizinhos/);assert.doesNotMatch(ok,/Atenção/);
  assert.match(linksAuditText({total:80,audit:{visible:84,collected:80,excluded:{zonas:0,vizinhos:0}}}),/Atenção: a quantidade coletada difere/);
  assert.equal(linksAuditText({total:84}),'');
});

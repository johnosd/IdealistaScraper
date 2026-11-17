const test=require('node:test'),assert=require('node:assert/strict');
const {planCoverageQueue}=require('../../src/lote-queue');
const {linksAuditText}=require('../../src/sidepanel');
const O='https://www.idealista.pt/arrendar-casas/';
const r=(Tipo,Texto,path,extra={})=>({'Região':null,'Sub-região':null,'Município':null,Tipo,Texto,URL:O+path,Contagem:null,...extra});

const national=[
  r('Sub-região','Beja','beja-distrito/concelhos-freguesias',{'Região':'Alentejo','Sub-região':'Beja',Contagem:'106'}),
  r('Município','Vila Nova de Milfontes','odemira/vila-nova-de-milfontes/',{'Região':'Alentejo','Sub-região':'Beja','Município':'Vila Nova de Milfontes'}),
  r('Sub-região','Évora','evora-distrito/concelhos-freguesias',{'Região':'Alentejo','Sub-região':'Évora',Contagem:'118'}),
  {...r('Região','Alentejo','x'),URL:'https://www.idealista.pt/geo/arrendar-casas/alentejo/','Região':'Alentejo'},
  r('Sub-região','Lisboa','lisboa-distrito/concelhos-freguesias',{'Região':'Área Metropolitana de Lisboa','Sub-região':'Lisboa',Contagem:'9.654'}),
  r('Município','Cascais','cascais/',{'Região':'Área Metropolitana de Lisboa','Sub-região':'Lisboa','Município':'Cascais'}),
  {...r('Região','Área Metropolitana de Lisboa','x'),URL:'https://www.idealista.pt/geo/arrendar-casas/area-metropolitana-de-lisboa/','Região':'Área Metropolitana de Lisboa'},
  r('Sub-região','Porto','porto-distrito/concelhos-freguesias',{'Região':'Norte','Sub-região':'Porto',Contagem:'4.549'})
];
// Concelhos lidos da página de Lisboa (estratégia distrito, só Município); Porto não pôde ser lido.
const lisboaConcelhos=['cascais','sintra','lisboa'].map(n=>r('Município',n[0].toUpperCase()+n.slice(1),n+'/concelhos-freguesias',{'Sub-região':'Lisboa','Município':n[0].toUpperCase()+n.slice(1),Contagem:'10'}));

test('006 D16/FR-029: distritos são a unidade; regiões e municípios destacados não duplicam; grandes viram concelhos',()=>{
  const {entries,summary}=planCoverageQueue([...national,...lisboaConcelhos]);
  assert.deepEqual(entries.map(e=>e.url.replace(O,'')),['beja-distrito/','evora-distrito/','cascais/','sintra/','lisboa/','porto-distrito/']);
  assert.deepEqual(entries.map(e=>e.path),['Alentejo › Beja','Alentejo › Évora','Área Metropolitana de Lisboa › Lisboa › Cascais','Área Metropolitana de Lisboa › Lisboa › Sintra','Área Metropolitana de Lisboa › Lisboa › Lisboa','Norte › Porto']);
  assert.deepEqual(entries[3].context,{'Região':'Área Metropolitana de Lisboa','Sub-região':'Lisboa','Município':'Sintra'});
  assert.equal(entries[5].expectedLimited,true,'Porto sem concelhos lidos entra inteiro e sinalizado');
  assert.deepEqual(summary,{freguesias:0,subregions:3,concelhos:3,expandedDistricts:['Lisboa'],unexpandedBig:['Porto']});
  assert.ok(!entries.some(e=>/milfontes|geo\//.test(e.url)),'Vila Nova de Milfontes (contida em Beja) e regiões não entram');
});

test('006 R-020: freguesias das páginas de distrito viram lista de validação por distrito, nunca entradas',()=>{
  const freg=(nome,sub)=>r('Freguesia',nome,'x/'+nome.toLowerCase()+'/',{'Sub-região':sub,'Município':'X'});
  const {entries,freguesias,summary}=planCoverageQueue([...national,...lisboaConcelhos,freg('Gualtar','Braga'),freg('São Victor','Braga'),freg('Gualtar','Braga'),freg('Sé','Évora')]);
  assert.deepEqual(freguesias,[['Gualtar','Braga'],['São Victor','Braga'],['Sé','Évora']]);assert.equal(summary.freguesias,3);
  assert.ok(!entries.some(e=>e.tipo==='Freguesia'),'freguesias não entram na fila');
  const {knownFreguesias,matchFreguesia}=require('../../src/coleta-completeness');
  const known=knownFreguesias([],freguesias);
  const evora={context:{'Região':'Alentejo','Sub-região':'Évora','Município':null}},braga={context:{'Região':'Norte','Sub-região':'Braga','Município':null}};
  assert.equal(matchFreguesia(evora,{Titulo:'Apartamento, Sé'},known),'Sé');
  assert.equal(matchFreguesia(braga,{Titulo:'Apartamento, Sé'},known),null,'freguesia de outro distrito não vale');
  assert.equal(matchFreguesia(braga,{Titulo:'Moradia, Gualtar'},known),'Gualtar');
  assert.equal(matchFreguesia(braga,{Titulo:'Moradia, Rua X'},known),null);
});

test('006 D16: município sem distrito pai e região sem sub-regiões continuam entrando',()=>{
  const {entries}=planCoverageQueue([r('Município','Alpha','alpha/',{'Município':'Alpha'}),{...r('Região','Ilhas','x'),URL:'https://www.idealista.pt/geo/arrendar-casas/ilhas/','Região':'Ilhas'}]);
  assert.deepEqual(entries.map(e=>e.path),['Alpha','Ilhas']);
  assert.throws(()=>planCoverageQueue(null));
});

test('006 (pedido do usuário): aba Links resume a fila final do Lote',()=>{
  const {queueText}=require('../../src/sidepanel');
  assert.equal(queueText({prepared:{entries:69,summary:{subregions:19,concelhos:50}}}),'69 localidades prontas para o Lote (19 distritos/ilhas + 50 concelhos), sem repetir listagens.');
  assert.equal(queueText({prepared:{entries:1,summary:{subregions:1,concelhos:0}}}),'1 localidade pronta para o Lote (1 distritos/ilhas), sem repetir listagens.');
  assert.equal(queueText({}),'');
});

test('006 FR-004/D16: painel separa a contagem da página nacional dos concelhos acrescentados',()=>{
  const text=linksAuditText({total:130,origin:{nome:'Localidades principais'},audit:{strategy:'nacional',visible:84,collected:84,excluded:{zonas:0,vizinhos:0}}});
  assert.match(text,/84 de 84 links/);assert.match(text,/\+ 46 concelhos e freguesias lidos nas páginas dos distritos/);assert.doesNotMatch(text,/Atenção/);
});

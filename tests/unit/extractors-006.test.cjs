const test=require('node:test'),assert=require('node:assert/strict');
const {readDeclaredTotal,inspectCollectionPage,CHALLENGE_TITLE}=require('../../src/coleta-page');
const {readPageLocalities,discoverSource}=require('../../src/coleta-discovery');
const h1=text=>({querySelector:q=>q==='h1'?{textContent:text}:null,title:''});

test('006 R2: total declarado vem do número inicial do h1, com ponto de milhar',()=>{
  assert.equal(readDeclaredTotal(h1('868 casas e apartamentos para arrendar em Braga distrito')),868);
  assert.equal(readDeclaredTotal(h1('  9.655 casas e apartamentos para arrendar em Lisboa distrito ')),9655);
  assert.equal(readDeclaredTotal(h1('6.027 casas e apartamentos para arrendar, Norte')),6027);
  assert.equal(readDeclaredTotal(h1('1 apartamentos para arrendar em X')),1);
  for(const text of ['www.idealista.pt','Anúncios de casas e apartamentos para arrendar em Braga distrito','12.34 casas','casas 868',''])assert.equal(readDeclaredTotal(h1(text)),null,text);
  assert.equal(readDeclaredTotal({querySelector:()=>null}),null);
});

test('006 R3/T058: títulos de desafio reais em português e inglês são reconhecidos',()=>{
  for(const title of ['Um momento…','Um momento...','Just a moment...','Acesso negado'])assert.ok(CHALLENGE_TITLE.test(title),title);
  assert.ok(!CHALLENGE_TITLE.test('Casas e apartamentos para arrendar em Braga distrito — idealista'));
  const doc=title=>({title,querySelector:()=>null});
  assert.equal(inspectCollectionPage(doc('Um momento…')).challenge,true);
  assert.equal(inspectCollectionPage(doc('Arrendar casas — idealista')).challenge,false);
});

test('006 D1: leitura da página usa o extrator único exposto pelo content script',()=>{
  const previous=globalThis.__idealistaLocalities;
  try{
    globalThis.__idealistaLocalities={inspectLocalities:()=>({strategy:'distrito',visible:2,excluded:{zonas:15,vizinhos:3},records:[
      {'Região':null,'Sub-região':'Braga','Município':'Braga',Tipo:'Município',Texto:'Braga',URL:'https://www.idealista.pt/arrendar-casas/braga/concelhos-freguesias',Contagem:'475'},
      {'Região':null,'Sub-região':'Braga','Município':'Braga',Tipo:'Freguesia',Texto:'Adaúfe',URL:'https://www.idealista.pt/arrendar-casas/braga/adaufe/',Contagem:'1.002'}]})};
    globalThis.document={};
    const view=readPageLocalities();
    assert.equal(view.strategy,'distrito');assert.equal(view.visible,2);
    assert.deepEqual(view.items.map(i=>[i.nome,i.quantidade]),[['Braga',475],['Adaúfe',1002]]);
    assert.equal(view.items[1].record.Tipo,'Freguesia');
    delete globalThis.__idealistaLocalities;assert.equal(readPageLocalities(),null,'sem content script: nada inventado');
  }finally{globalThis.__idealistaLocalities=previous;delete globalThis.document;}
});

test('006 D1: descoberta injeta o extrator e devolve itens/estratégia da mesma página',async()=>{
  const calls=[];const url='https://www.idealista.pt/arrendar-casas/braga-distrito/concelhos-freguesias';
  const api={tabs:{get:async()=>({url})},scripting:{executeScript:async options=>{calls.push(options.files?'files':'func');
    if(calls.length===1)return [{documentId:'d1',result:url}];
    if(options.files)return [{documentId:'d1',result:null}];
    return [{documentId:'d1',result:{strategy:'distrito',visible:1,items:[{nome:'Braga',url,quantidade:475}]}}];}}};
  const found=await discoverSource(api,{tabId:7,url,documentId:'d1'});
  assert.deepEqual(calls,['func','files','func']);
  assert.equal(found.strategy,'distrito');assert.equal(found.items.length,1);assert.equal(found.source.documentId,'d1');
});

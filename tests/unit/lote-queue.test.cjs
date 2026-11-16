const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {deriveListingURL,buildBatchQueue}=require('../../src/lote-queue');
const {prepareBatchFromLinks}=require('../../src/links-collection');
const O='https://www.idealista.pt';

test('006 D2: derivação remove só o sufixo final, query e hash, garantindo barra final',()=>{
  assert.equal(deriveListingURL(O+'/arrendar-casas/braga/concelhos-freguesias'),O+'/arrendar-casas/braga/');
  assert.equal(deriveListingURL(O+'/arrendar-casas/corvo/corvo/concelhos-freguesias'),O+'/arrendar-casas/corvo/corvo/');
  assert.equal(deriveListingURL(O+'/arrendar-casas/braga/adaufe'),O+'/arrendar-casas/braga/adaufe/');
  assert.equal(deriveListingURL(O+'/arrendar-casas/concelhos-freguesias-x/'),O+'/arrendar-casas/concelhos-freguesias-x/');
  assert.throws(()=>deriveListingURL('https://example.com/arrendar-casas/x/'));
  assert.throws(()=>deriveListingURL('nao-url'));
});

test('006 FR-008/009/010: fila do fixture nacional real tem 83 entradas (Algarve+Faro fundidos) e contagem não reordena',()=>{
  // Registros do fixture nacional de 2026-11-15 (84 links), sem DOM: hrefs/rótulos lidos do HTML.
  const html=fs.readFileSync(path.join(__dirname,'../fixtures/idealista-locations-2026-11-15.html'),'utf8');
  const hrefs=[...html.matchAll(/href="([^"]+)"/g)].map(m=>O+m[1]);
  assert.equal(new Set(hrefs).size,84);
  const {entries,rejected}=buildBatchQueue(hrefs.map((URL,i)=>({Tipo:/concelhos-freguesias/.test(URL)?'Sub-região':'Município',Texto:'L'+i,URL,Contagem:String(1000-i)})));
  assert.equal(rejected.length,0);
  assert.equal(entries.length,83,'faro-distrito/ (região) e faro-distrito/concelhos-freguesias (sub-região) viram uma entrada');
  assert.ok(entries.every(e=>e.url.endsWith('/')&&!/concelhos-freguesias/.test(e.url)));
  assert.deepEqual(entries.map(e=>e.linkUrls[0]),[...new Set(hrefs.map(h=>deriveListingURL(h)))].map(u=>hrefs.find(h=>deriveListingURL(h)===u)),'ordem do DOM preservada');
});

test('006 R1/R4: freguesia da página de distrito ganha Município no contexto e nome de freguesia fora do contexto',()=>{
  const {entries}=buildBatchQueue([
    {'Região':null,'Sub-região':'Braga','Município':'Braga',Tipo:'Município',Texto:'Braga',URL:O+'/arrendar-casas/braga/concelhos-freguesias',Contagem:'475'},
    {'Região':null,'Sub-região':'Braga','Município':'Braga',Tipo:'Freguesia',Texto:'Adaúfe',URL:O+'/arrendar-casas/braga/adaufe/',Contagem:'2'}]);
  assert.deepEqual(entries.map(e=>[e.nome,e.url,e.contagem]),[['Braga',O+'/arrendar-casas/braga/',475],['Adaúfe',O+'/arrendar-casas/braga/adaufe/',2]]);
  assert.deepEqual(entries[1].context,{'Região':null,'Sub-região':'Braga','Município':'Braga'});
  assert.equal(entries[1].freguesia,'Adaúfe');assert.equal(entries[0].freguesia,undefined);
  assert.throws(()=>buildBatchQueue(null));
  assert.deepEqual(buildBatchQueue([null,{URL:'x'}]).rejected.map(r=>r.reason),['invalid_record','invalid_url']);
});

test('006 FR-008: coleta de links concluída grava a fila preparada uma única vez por sessão',async()=>{
  const data={};let writes=0;const api={storage:{local:{get:async([k])=>({[k]:data[k]}),set:async v=>{writes++;Object.assign(data,v);}}}};
  const view={id:'links-1',state:'awaiting-save',items:[{nome:'Braga',url:O+'/arrendar-casas/braga-distrito/concelhos-freguesias'}],
    checkpoint:{records:[{Tipo:'Município',Texto:'Braga',URL:O+'/arrendar-casas/braga/concelhos-freguesias'},{Tipo:'Município',Texto:'X',URL:'https://evil.example/'}]}};
  const prepared=await prepareBatchFromLinks(api,view,()=>123);
  assert.equal(prepared.linksSessionId,'links-1');assert.equal(prepared.createdAt,123);
  assert.deepEqual(prepared.entries.map(e=>e.url),[O+'/arrendar-casas/braga/']);
  assert.deepEqual(prepared.rejected,[{url:'https://evil.example/',reason:'invalid_url'}]);
  assert.equal(prepared.origin.nome,'Braga');
  await prepareBatchFromLinks(api,view);assert.equal(writes,1,'idempotente por sessão');
  assert.equal(await prepareBatchFromLinks(api,{...view,id:'links-2',state:'running'}),null,'coleta incompleta não prepara fila');
});

// Extratores do projeto sobre HTML capturado do site real (006, validation/site-inspection.md).
// Sem rede: as páginas vêm de tests/fixtures; as fontes de src/ são injetadas literalmente.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const fixture=name=>fs.readFileSync(path.join(__dirname,'../fixtures',name),'utf8');
const src=name=>fs.readFileSync(path.join(__dirname,'../../src',name),'utf8');
const cjs=(name,global)=>`(()=>{const module={exports:{}};const require=()=>({});${src(name)}\n;window.${global}=module.exports;})();`;
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  let html='';
  await page.route('https://**/*',route=>route.fulfill({contentType:'text/html',body:html}));
  async function load(url,body){
   html='<!doctype html><html><head><meta charset="utf-8"></head><body>'+body+'</body></html>';
   await page.goto(url);
   await page.addScriptTag({content:cjs('linkExtractor.js','__links')});
   await page.addScriptTag({content:cjs('coleta-page.js','__page')});
   const content=src('content.js');await page.addScriptTag({content:content.slice(0,content.indexOf('const { installCollectionExecutor }'))});
  }

  // §1 Página nacional: 84 links, mesma saída de extractLinks.
  await load('https://www.idealista.pt/arrendar-casas/',fixture('idealista-locations-2026-11-15.html'));
  const national=await page.evaluate(()=>{const r=window.__links.inspectLocalities(document);const legacy=window.__links.extractLinks(document);return {strategy:r.strategy,visible:r.visible,total:r.records.length,types:r.records.reduce((m,x)=>(m[x.Tipo]=(m[x.Tipo]||0)+1,m),{}),sameAsLegacy:JSON.stringify(legacy)===JSON.stringify(window.__links.extractLocalities(document))};});
  assert.equal(national.strategy,'nacional');assert.equal(national.total,84);assert.equal(national.visible,84);
  assert.deepEqual(national.types,{'Sub-região':22,'Município':55,'Região':7});
  assert.equal(national.sameAsLegacy,true,'extractLinks continua igual a extractLocalities na página nacional');
  // D16: a partir da nacional, o primeiro distrito acima de 1.800 anúncios (ordem de URL).
  const bigNational=await page.evaluate(()=>[...document.querySelectorAll('nav.locations-list ul.locations-list__links > li')].filter(li=>Number((li.querySelector(':scope > p')?.textContent||'').replace(/[^\d]/g,''))>1800).map(li=>li.querySelector('a.subregion').getAttribute('href')).sort());
  assert.deepEqual(bigNational,['/arrendar-casas/faro-distrito/concelhos-freguesias','/arrendar-casas/lisboa-distrito/concelhos-freguesias','/arrendar-casas/porto-distrito/concelhos-freguesias']);
  assert.equal(await page.evaluate(()=>window.__links.nextExpansionUrl(document)),'https://www.idealista.pt/arrendar-casas/faro-distrito/concelhos-freguesias');

  // §2 Página de distrito: 14 concelhos + 134 freguesias; zonas/vizinhos fora.
  await load('https://www.idealista.pt/arrendar-casas/braga-distrito/concelhos-freguesias',fixture('idealista-concelhos-braga-2026-11.html'));
  const district=await page.evaluate(()=>{const r=window.__links.inspectLocalities(document);const by=t=>r.records.filter(x=>x.Tipo===t);const ad=r.records.find(x=>x.Texto==='Adaúfe');const braga=r.records.find(x=>x.Tipo==='Município'&&x.Texto==='Braga');return {strategy:r.strategy,visible:r.visible,excluded:r.excluded,total:r.records.length,mun:by('Município').length,freg:by('Freguesia').length,ad,braga,unique:new Set(r.records.map(x=>x.URL)).size,geo:r.records.filter(x=>/\/geo\//.test(x.URL)).length};});
  assert.equal(district.strategy,'distrito');assert.equal(district.mun,14);assert.equal(district.freg,134);
  assert.equal(district.total,148);assert.equal(district.unique,148);assert.equal(district.visible,148);assert.equal(district.geo,0);
  assert.deepEqual(district.excluded,{zonas:15,vizinhos:3});
  assert.equal(district.braga.URL,'https://www.idealista.pt/arrendar-casas/braga/concelhos-freguesias');assert.equal(district.braga.Contagem,'475');
  assert.equal(district.braga['Sub-região'],'Braga');assert.equal(district.braga['Município'],'Braga');
  assert.equal(district.ad.URL,'https://www.idealista.pt/arrendar-casas/braga/adaufe/');
  assert.equal(district.ad['Município'],'Braga');assert.equal(district.ad['Sub-região'],'Braga');assert.equal(district.ad.Contagem,'2');
  // D16: no breadcrumb de Braga (868, não é grande) o próximo grande depois de braga-distrito é Faro (2.394).
  assert.equal(await page.evaluate(()=>window.__links.nextExpansionUrl(document)),'https://www.idealista.pt/arrendar-casas/faro-distrito/concelhos-freguesias');
  assert.equal(await page.evaluate(()=>window.__links.nextExpansionUrl(document,100000)),null,'sem distritos acima do limite: fim da cadeia');
  const freguesias=new Set(await page.evaluate(()=>window.__links.inspectLocalities(document).records.filter(r=>r.Tipo==='Freguesia').map(r=>r.Texto)));
  assert.equal(freguesias.size,134);

  // §3 Listagem: 30 anúncios, próxima página, total declarado.
  await load('https://www.idealista.pt/arrendar-casas/braga-distrito/',fixture('idealista-listing-braga-p1-2026-11.html'));
  const listing=await page.evaluate(()=>{const out=extrairDaRaiz(document,location.href);return {n:out.itens.length,next:out.nextUrl,ids:out.itens.filter(i=>i.id).length,links:out.itens.filter(i=>i.Link).length,facts:window.__page.inspectCollectionPage(document),declared:window.__page.readDeclaredTotal(document)};});
  assert.equal(listing.n,30);assert.equal(listing.ids,30);assert.equal(listing.links,30);
  assert.equal(listing.next,'https://www.idealista.pt/arrendar-casas/braga-distrito/pagina-2');
  assert.equal(listing.facts.listing,true);assert.equal(listing.facts.challenge,false);assert.equal(listing.declared,868);

  // §6 R4/FR-027 + SC-010: Freguesia pelo sufixo do título só quando é freguesia conhecida do distrito; campos antigos idênticos.
  const {withContext,matchFreguesia}=require('../../src/coleta-completeness');
  const itens=await page.evaluate(()=>extrairDaRaiz(document,location.href).itens);
  const context={'Região':null,'Sub-região':'Braga','Município':null},entry={nome:'Braga',context};
  const enriched=itens.map(r=>withContext(r,context,matchFreguesia(entry,r,freguesias)));
  for(let i=0;i<itens.length;i++){
   assert.deepEqual(Object.keys(enriched[i]),[...Object.keys(itens[i]),'Região','Sub-região','Município','Freguesia']);
   for(const key of Object.keys(itens[i]))assert.deepEqual(enriched[i][key],itens[i][key],'SC-010: '+key);
   const tail=itens[i].Titulo.split(',').pop().trim();
   assert.equal(enriched[i].Freguesia,freguesias.has(tail)?tail:null,'R4: '+itens[i].Titulo);
  }
  assert.equal(enriched[0].Freguesia,'São Victor');
  const filled=enriched.filter(r=>r.Freguesia).length;assert.ok(filled>=25,'maioria dos títulos reais termina em freguesia conhecida: '+filled);
  assert.equal(matchFreguesia({freguesia:'Adaúfe'},{Titulo:'Casa, São Victor'},freguesias),'Adaúfe','entrada do tipo Freguesia prevalece');
  assert.equal(matchFreguesia(entry,{Titulo:'Casa na Rua X, Rua Inventada'},freguesias),null,'sufixo desconhecido não vira freguesia');
  console.log('freguesia R4: '+filled+'/'+enriched.length+' anúncios reais com Freguesia validada');

  // §7 Desafios reais: títulos em português e inglês.
  for(const title of ['Um momento…','Just a moment...']){
   await load('https://www.idealista.pt/arrendar-casas/braga-distrito/','<title>'+title+'</title><h1>www.idealista.pt</h1>');
   await page.evaluate(t=>{document.title=t;},title);
   const facts=await page.evaluate(()=>window.__page.inspectCollectionPage(document));
   assert.equal(facts.challenge,true,'desafio "'+title+'" deve ser reconhecido');
   assert.equal(await page.evaluate(()=>window.__page.readDeclaredTotal(document)),null);
  }
  console.log('extractors-fixtures: OK');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

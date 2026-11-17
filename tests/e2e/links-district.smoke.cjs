// 006 US2/US3 FR-003/004/005/028/029/030 + R-020: mesmo estando numa página de distrito, "Coletar links" abre a página
// nacional (fixture real, 84 links) e depois a página de concelhos/freguesias de TODOS os distritos (ordem de URL):
// concelhos dividem os distritos acima de 1.800 anúncios; freguesias formam a lista de validação da Freguesia.
// Páginas de distrito sintéticas com a estrutura real do breadcrumb. Extensão real, sem telas da extensão.
const {openBrowser,poll}=require('../fixtures/coleta-browser.cjs'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const origin='https://www.idealista.pt',DISTRICT=origin+'/arrendar-casas/braga-distrito/concelhos-freguesias',NATIONAL=origin+'/arrendar-casas/';
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista006-links-district-'));let b;const requests=[];
 try{
  const wrap=(title,body)=>'<!doctype html><html><head><meta charset="utf-8"><title>'+title+'</title></head><body>'+body+'</body></html>';
  const nationalHTML=await fs.readFile(path.resolve(__dirname,'../fixtures/idealista-locations-2026-11-15.html'),'utf8');
  const district=wrap('Braga distrito — idealista',await fs.readFile(path.resolve(__dirname,'../fixtures/idealista-concelhos-braga-2026-11.html'),'utf8'));
  // Sub-regiões reais da página nacional: href, nome e contagem.
  const subs=[...nationalHTML.matchAll(/<p>([\d.]+)<\/p>\s*<a href="([^"]+)" class="subregion"[^>]*><span class="subregion-name">([^<]+)<\/span>/g)].map(m=>({count:m[1],href:m[2],name:m[3],slug:m[2].split('/')[2]}));
  assert.equal(subs.length,22);
  const big=subs.filter(s=>Number(s.count.replace(/\./g,''))>1800).map(s=>s.name).sort();
  function districtPage(current){
   return '<ul>'+subs.map(s=>s.href===current.href
    ?'<li class="breadcrumb-dropdown-element highlighted"><span class="breadcrumb-navigation-current-level">'+s.name+'</span><span class="breadcrumb-navigation-sidenote">'+s.count+'</span><ul class="breadcrumb-dropdown-subitem-list">'+
      [1,2].map(i=>'<li><a href="/arrendar-casas/'+s.slug+'-c'+i+'/concelhos-freguesias">'+s.name+' c'+i+'</a><span class="breadcrumb-navigation-sidenote">5</span></li>').join('')+'</ul></li>'
    :'<li class="breadcrumb-dropdown-element"><a href="'+s.href+'">'+s.name+'</a><span class="breadcrumb-navigation-sidenote">'+s.count+'</span></li>').join('')+'</ul>'+
    '<div id="locations"><ul id="location_list"><li><strong class="location_letter">F</strong><ul>'+[1,2].map(i=>'<li><span>1</span><a href="/arrendar-casas/'+current.slug+'-c1/'+current.slug+'-f'+i+'/">'+current.name+' f'+i+'</a></li>').join('')+'</ul></li></ul></div>';
  }
  // Caso real (Porto Santo, 2026-11-16): área pequena redireciona a página de concelhos para a listagem, sem lista.
  const REDIRECTED=subs.find(s=>s.slug==='terceira-ilha-dos-acores'),LISTING=origin+'/arrendar-casas/terceira-ilha-dos-acores/';
  const redirectedListing=()=>districtPage(REDIRECTED).replace(/<ul class="breadcrumb-dropdown-subitem-list">[\s\S]*?<\/ul><\/li>/,'</li>').replace(/<div id="locations">[\s\S]*$/,'')+'<section class="items-container items-list"><article class="item" data-element-id="t1"><div class="item-info-container"><a class="item-link" href="/imovel/t1/">Casa</a></div></article></section>';
  b=await openBrowser(profile,r=>{const url=r.request().url();if(!url.startsWith(origin+'/arrendar-casas/'))return r.abort();requests.push(url);
   if(url===origin+REDIRECTED.href)return r.fulfill({status:302,headers:{location:LISTING}});
   if(url===LISTING)return r.fulfill({contentType:'text/html; charset=utf-8',body:wrap('Terceira',redirectedListing())});
   const s=subs.find(x=>origin+x.href===url);
   return r.fulfill({contentType:'text/html; charset=utf-8',body:url===NATIONAL?wrap('Arrendar casas — idealista',nationalHTML):s?wrap(s.name,districtPage(s)):district});});
  await (await b.context.newPage()).goto(DISTRICT);assert.equal(requests.length,1);
  const popup=await b.context.newPage();await popup.goto(b.base+'popup.html');
  // Intervalo mínimo pequeno só no perfil temporário: 23 páginas na mesma coleta.
  await popup.evaluate(async()=>{const r=await chrome.runtime.sendMessage({cmd:'COLETA_GET_POLICY'});await chrome.runtime.sendMessage({cmd:'COLETA_SET_POLICY',payload:{limits:{...r.result.limits,minIntervalMs:1000,maxPagesPerWindow:1000},ipEnabled:false}});});await popup.close();
  const p=await b.context.newPage();await p.goto(b.base+'sidepanel.html');
  const tabId=await p.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url)?.id,DISTRICT);
  await p.goto(b.base+'sidepanel.html?sourceTabId='+tabId);await p.getByRole('tab',{name:'Links',exact:true}).click();
  await p.getByRole('button',{name:'Coletar links de localidades',exact:true}).click();
  const queueSize=22-big.length+big.length*2;
  await p.waitForFunction(n=>document.querySelectorAll('#links-results>li').length===n,queueSize,{timeout:90000});
  const status=await p.locator('#links-status').textContent();
  assert.match(status,new RegExp(queueSize+' localidades prontas para o Lote \\('+(22-big.length)+' distritos/ilhas \\+ '+big.length*2+' concelhos\\)'));
  assert.match(status,/Origem: Localidades principais\./);assert.match(status,/84 de 84 links de localidades/);
  assert.match(status,/\+ 84 concelhos e freguesias lidos nas páginas dos distritos/);assert.doesNotMatch(status,/Atenção/);
  const expected=[NATIONAL];for(const u of subs.map(s=>origin+s.href).sort()){expected.push(u);if(u===origin+REDIRECTED.href)expected.push(LISTING);}
  assert.deepEqual(requests.slice(1),expected,'nacional e depois a página de cada distrito, em ordem, uma vez; o redirecionamento não interrompe a cadeia');
  const view=await p.evaluate(async()=>(await chrome.runtime.sendMessage({cmd:'AUTONOMA_LINKS_READ'})).result);
  assert.deepEqual(view.audit,{strategy:'nacional',visible:84,collected:84,excluded:{zonas:0,vizinhos:0}});
  assert.equal(view.state,'collected');assert.equal(view.prepared.summary.freguesias,42);
  const prepared=await p.evaluate(async()=>(await chrome.storage.local.get(['lote:prepared']))['lote:prepared']);
  assert.equal(prepared.freguesias.length,42);assert.deepEqual(prepared.freguesias[0].length,2);
  await p.getByRole('tab',{name:'Lote',exact:true}).click();
  await p.waitForFunction(n=>document.querySelectorAll('#prepared-list>li').length===n,queueSize,{timeout:10000});
  const listed=await p.locator('#prepared-list').textContent();
  assert.match(listed,/Alentejo › Beja/);assert.match(listed,/Área Metropolitana de Lisboa › Lisboa › Lisboa c1/);
  assert.doesNotMatch(listed,/concelhos-freguesias|Vila Nova de Milfontes|\/geo\/| f1/,'sem regiões, municípios destacados nem freguesias como entradas');
  const extensionPages=b.context.pages().map(page=>page.url()).filter(u=>u.startsWith(b.base)).map(u=>new URL(u).pathname);
  assert.equal(extensionPages.some(pathname=>['/configuracoes.html','/localidades.html','/lote.html'].includes(pathname)),false,'nenhuma tela de configuração/exportação');
  await poll(async()=>b.context.pages().some(page=>page.url().includes('/runner.html?links=')),v=>!v,{timeout:10000});
  assert.equal(b.downloads.length,0);assert.deepEqual(b.errors,[]);
  console.log(JSON.stringify({pass:true,proof:'real extension; real national DOM (2026-11-15); district pages synthetic with real breadcrumb structure',cases:['from a district page, Links opens the national page','all 22 district pages visited once, in order','big districts split into concelhos','freguesias kept as validation list (not entries)','district page redirected to listing (Porto Santo case) does not stop the chain','coverage queue with full path','no extension screens'],requests:requests.length,queue:queueSize,big}));
 }finally{await b?.context.close();const resolved=path.resolve(profile);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'idealista006-links-district-'));await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
})().catch(error=>{console.error(error);process.exitCode=1;});

// 006 US2→US3→US4 ponta a ponta com a extensão real e rede local:
// Links na página de distrito → fila preparada no Lote → Iniciar → cada entrada navegada página a página
// numa única aba Idealista → arquivo gravado com contexto antes da próxima → completude/dedup no resumo.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {openBrowser,poll}=require('../fixtures/coleta-browser.cjs');
const {getMunicipalityDestination}=require('../../src/lote-export');
const origin='https://www.idealista.pt',district=origin+'/arrendar-casas/fixture-distrito/concelhos-freguesias',national=origin+'/arrendar-casas/';
const declared={alpha:2,beta:50};
const districtHTML='<title>Fixture distrito</title><ul><li class="breadcrumb-dropdown-element highlighted"><span class="breadcrumb-navigation-current-level">Fixture distrito</span><ul class="breadcrumb-dropdown-subitem-list">'+
  ['alpha','beta'].map(n=>'<li><a href="/arrendar-casas/'+n+'/concelhos-freguesias">'+n+'</a><span class="breadcrumb-navigation-sidenote">'+declared[n]+'</span></li>').join('')+'</ul></li></ul>';
// 006 FR-028: Links sempre coletam a página nacional; aqui uma navegação nacional mínima com 2 municípios.
const nationalHTML='<title>Arrendar casas</title><nav class="locations-list"><ul class="locations-list__links"><li><ul class="locations-list__municipalities">'+['alpha','beta'].map(n=>'<li><a href="/arrendar-casas/'+n+'/">'+n+'</a></li>').join('')+'</ul></li></ul></nav>';
function listing(name,page){
  const ids=[name+'-'+page,'shared-'+page];
  return '<title>Casas em '+name+'</title><h1>'+declared[name]+' casas e apartamentos para arrendar em '+name+'</h1><section class="items-container items-list">'+
    ids.map(id=>'<article class="item" data-element-id="'+id+'"><div class="item-info-container"><a class="item-link" href="/imovel/'+id+'/">Apartamento T1 na Rua X, '+name+'</a><div class="price-row"><span class="item-price">900 €</span></div></div></article>').join('')+
    '</section>'+(page===1?'<div class="pagination"><ul><li class="next"><a class="icon-arrow-right-after" href="/arrendar-casas/'+name+'/pagina-2">Seguinte</a></li></ul></div>':'');
}
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista006-lote-links-'));let b;const calls=[];const idealistaPages=new Set();
 try{
  b=await openBrowser(profile,r=>{const url=r.request().url();if(!url.startsWith(origin))return r.abort();calls.push(url);
   const m=/\/arrendar-casas\/(alpha|beta)\/(?:pagina-(\d+))?$/.exec(new URL(url).pathname);
   const body=url===national?nationalHTML:url===district?districtHTML:m?listing(m[1],Number(m[2]||1)):'<h1>Not found</h1>';
   return r.fulfill({status:url===national||url===district||m?200:404,contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8"></head><body>'+body+'</body></html>'});});
  b.context.on('page',page=>page.on('framenavigated',frame=>{if(frame===page.mainFrame()&&/\/arrendar-casas\/(alpha|beta)\//.test(frame.url()))idealistaPages.add(page);}));
  const setup=await b.page('lote.html');
  await setup.evaluate(async()=>{const r=await chrome.runtime.sendMessage({cmd:'COLETA_GET_POLICY'});await chrome.runtime.sendMessage({cmd:'COLETA_SET_POLICY',payload:{limits:{...r.result.limits,minIntervalMs:1000,maxPagesPerWindow:1000},ipEnabled:false}});});
  await setup.locator('#choose').click();await setup.waitForFunction(()=>document.querySelector('#destination').textContent.includes('acesso permitido'));await setup.close();
  const site=await b.context.newPage();await site.goto(district);
  const p=await b.context.newPage();await p.goto(b.base+'sidepanel.html');
  const tabId=await p.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url)?.id,district);
  await p.goto(b.base+'sidepanel.html?sourceTabId='+tabId);
  // Links
  await p.getByRole('tab',{name:'Links',exact:true}).click();await p.getByRole('button',{name:'Coletar links de localidades',exact:true}).click();
  await p.waitForFunction(()=>document.querySelectorAll('#links-results>li').length===2,null,{timeout:20000});
  assert.match(await p.locator('#links-status').textContent(),/2 de 2 links/);
  // Lote: fila preparada sem importação manual
  await p.getByRole('tab',{name:'Lote',exact:true}).click();
  await p.waitForFunction(()=>!document.querySelector('#prepared-card').hidden&&document.querySelectorAll('#prepared-list>li').length===2,null,{timeout:10000});
  const listed=await p.locator('#prepared-list').textContent();assert.match(listed,/\/arrendar-casas\/alpha\//);assert.doesNotMatch(listed,/concelhos-freguesias/);
  assert.equal(await p.locator('#primary-action').textContent(),'Iniciar coleta');
  const before=calls.length;await p.locator('#primary-action').click();
  const read=async()=>{const rows=(await p.evaluate(async()=>(await chrome.runtime.sendMessage({cmd:'AUTONOMA_LIST'})).result));return rows.at(-1);};
  let run;try{run=await poll(read,r=>['completed','paused','finished-with-pending','interrupted'].includes(r?.state),{timeout:30000});}
  catch(error){console.error(JSON.stringify({last:await read(),calls}));throw error;}
  if(run.state!=='completed')console.error(JSON.stringify({run:{state:run.state,reason:run.reason,items:run.items.map(i=>({n:i.nome,s:i.state,r:i.reason}))},calls}));
  assert.equal(run.state,'completed');
  // Navegação real, uma entrada após a outra, numa única aba Idealista
  assert.deepEqual(calls.slice(before).map(u=>new URL(u).pathname),['/arrendar-casas/alpha/','/arrendar-casas/alpha/pagina-2','/arrendar-casas/beta/','/arrendar-casas/beta/pagina-2']);
  assert.equal(idealistaPages.size,1,'uma única aba de coleta para todas as entradas');
  const extensionScreens=b.context.pages().map(page=>page.url()).filter(u=>u.startsWith(b.base)).map(u=>new URL(u).pathname).filter(pth=>['/configuracoes.html','/localidades.html','/lote.html','/itens.html'].includes(pth));
  assert.deepEqual(extensionScreens,[],'nenhuma tela de configuração/exportação durante a coleta');
  // Completude, dedup e contexto
  assert.deepEqual(run.items.map(i=>[i.nome,i.url.replace(origin,''),i.completeness.status]),[['alpha','/arrendar-casas/alpha/','complete'],['beta','/arrendar-casas/beta/','limited']]);
  assert.equal(run.items[1].completeness.reason,'site_limit');assert.equal(run.limitedCount,1);
  assert.equal(run.dedup.unique,6,'alpha-1, alpha-2, beta-1, beta-2 + shared-1, shared-2');
  assert.deepEqual(run.dedup.items[run.items[1].id],{new:2,repeated:2});
  await p.waitForFunction(()=>/listagem limitada/.test(document.querySelector('#run-state').textContent));
  const files=await p.evaluate(async targets=>{const root=await navigator.storage.getDirectory(),dir=await root.getDirectoryHandle('exported');const out={};for(const t of targets){const month=await dir.getDirectoryHandle(t.yearMonth);out[t.fileName]=JSON.parse(await (await (await month.getFileHandle(t.fileName)).getFile()).text());}return out;},
    ['alpha','beta'].map(nome=>getMunicipalityDestination({startedAt:new Date(),nome,totalPages:2})));
  assert.equal(files['alpha-Paginas2.json'].length,4);assert.equal(files['beta-Paginas2.json'].length,4,'arquivo mantém a listagem completa (sobreposição preservada)');
  const row=files['beta-Paginas2.json'][0];
  assert.deepEqual(Object.keys(row).slice(-4),['Região','Sub-região','Município','Freguesia']);
  assert.equal(row['Sub-região'],null);assert.equal(row['Município'],'beta');assert.equal(row.Freguesia,null);
  assert.equal(b.downloads.length,0);assert.deepEqual(b.errors,[]);
  console.log(JSON.stringify({pass:true,proof:'real extension; local routes; OPFS folder',cases:['links always from the national page (FR-028)','prepared queue in Lote (no import)','listing derived without concelhos-freguesias','one visible Idealista tab, navigation per page','entries sequential','site_limit flagged','dedup summary','files complete with context fields','no extension screens'],requests:calls.length}));
 }finally{await b?.context.close();const resolved=path.resolve(profile);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'idealista006-lote-links-'));await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
})().catch(error=>{console.error(error);process.exitCode=1;});

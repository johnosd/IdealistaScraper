// 006 US2/FR-003/004/005/028: Links coleta a página de distrito em que o usuário está (fixture real sanitizada),
// mostra visível × coletada e não abre telas da extensão. Extensão real, rede roteada localmente.
const {openBrowser,poll}=require('../fixtures/coleta-browser.cjs'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const DISTRICT='https://www.idealista.pt/arrendar-casas/braga-distrito/concelhos-freguesias';
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista006-links-district-'));let b;const requests=[];
 try{
  const fixture=await fs.readFile(path.resolve(__dirname,'../fixtures/idealista-concelhos-braga-2026-11.html'),'utf8');
  const body='<!doctype html><html><head><meta charset="utf-8"><title>Anúncios de casas e apartamentos para arrendar em Braga distrito — idealista</title></head><body>'+fixture+'</body></html>';
  b=await openBrowser(profile,r=>{const url=r.request().url();if(!url.startsWith('https://www.idealista.pt/arrendar-casas/'))return r.abort();requests.push(url);return r.fulfill({contentType:'text/html; charset=utf-8',body});});
  const site=await b.context.newPage();await site.goto(DISTRICT);assert.equal(requests.length,1);
  const p=await b.context.newPage();await p.goto(b.base+'sidepanel.html');
  const tabId=await p.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url)?.id,DISTRICT);assert.ok(tabId,'aba do distrito');
  await p.goto(b.base+'sidepanel.html?sourceTabId='+tabId);await p.getByRole('tab',{name:'Links',exact:true}).click();
  await p.getByRole('button',{name:'Coletar links de localidades',exact:true}).click();
  await p.waitForFunction(()=>document.querySelectorAll('#links-results>li').length===148,null,{timeout:20000});
  const status=await p.locator('#links-status').textContent();
  assert.match(status,/148 localidades coletadas/);assert.match(status,/Origem: Braga\./);assert.match(status,/148 de 148 links de localidades/);
  assert.match(status,/15 zonas de interesse e 3 distritos vizinhos/);assert.doesNotMatch(status,/Atenção/);
  const collected=requests.slice(1);assert.equal(collected.length,1,'uma única navegação de coleta');
  assert.equal(collected[0],DISTRICT,'origem = página atual, não a nacional');
  const view=await p.evaluate(async()=>(await chrome.runtime.sendMessage({cmd:'AUTONOMA_LINKS_READ'})).result);
  assert.equal(view.records.filter(r=>r.tipo==='Município').length,14);assert.equal(view.records.filter(r=>r.tipo==='Freguesia').length,134);
  assert.equal(view.records.some(r=>/\/geo\//.test(r.url)),false);assert.deepEqual(view.audit,{strategy:'distrito',visible:148,collected:148,excluded:{zonas:15,vizinhos:3}});
  const extensionPages=b.context.pages().map(page=>page.url()).filter(u=>u.startsWith(b.base)).map(u=>new URL(u).pathname);
  assert.equal(extensionPages.some(pathname=>['/configuracoes.html','/localidades.html','/lote.html'].includes(pathname)),false,'nenhuma tela de configuração/exportação');
  await poll(async()=>b.context.pages().some(page=>page.url().includes('/runner.html?links=')),v=>!v,{timeout:10000});
  assert.equal(b.downloads.length,0);assert.deepEqual(b.errors,[]);
  console.log(JSON.stringify({pass:true,proof:'real extension; real district DOM captured 2026-11-16 (sanitized)',cases:['current page as origin','148 = 14 concelhos + 134 freguesias','visible x collected shown','zones/neighbors excluded and counted','no extension screens','runner closed'],requests:requests.length}));
 }finally{await b?.context.close();const resolved=path.resolve(profile);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'idealista006-links-district-'));await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
})().catch(error=>{console.error(error);process.exitCode=1;});

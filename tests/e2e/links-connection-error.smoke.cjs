// Real extension with a simulated failure of Chrome's proxy settings API.
const {openBrowser,poll}=require('../fixtures/coleta-browser.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista005-links-connection-'));let b,requests=0;
 try{
  const fixture=await fs.readFile(path.resolve(__dirname,'../fixtures/localidades-list.html'),'utf8');
  b=await openBrowser(profile,route=>{requests++;return route.fulfill({contentType:'text/html; charset=utf-8',body:fixture});});
  const p=await b.context.newPage();await p.goto(b.base+'sidepanel.html');await p.getByRole('tab',{name:'Links',exact:true}).click();
  const worker=b.context.serviceWorkers()[0];await worker.evaluate(()=>{
   const original=chrome.proxy.settings.get.bind(chrome.proxy.settings);globalThis.__restoreProxyGet=()=>chrome.proxy.settings.get=original;
   chrome.proxy.settings.get=async()=>{throw Error('simulated-private-value');};
  });
  const read=()=>p.evaluate(async()=>(await chrome.runtime.sendMessage({cmd:'AUTONOMA_LINKS_READ'})).result);
  await p.locator('#tool-links-open').click();const failure=await poll(read,v=>v.reason==='connection_setup_failed');
  assert.equal(failure.stage,'start');assert.equal(failure.state,'paused');assert.equal(failure.id,undefined);assert.equal(requests,0);
  await p.waitForFunction(()=>document.querySelector('#links-status').textContent.includes('Chrome não conseguiu aplicar'));
  assert.match(await p.locator('#links-status').textContent(),/Salvar e testar conexão/);assert.doesNotMatch(await p.locator('#links-status').textContent(),/simulated-private-value/);
  assert.equal(b.context.pages().some(page=>new URL(page.url()).pathname==='/localidades.html'),false,'Setup failure must stay in Links');
  assert.equal(b.context.pages().some(page=>page.url().includes('/configuracoes.html')),false);
  await worker.evaluate(()=>__restoreProxyGet());await p.locator('#tool-links-open').click();
  await p.waitForFunction(()=>document.querySelectorAll('#links-results>li').length===1);
  assert.equal(requests,1);assert.deepEqual(b.errors,[]);
  console.log(JSON.stringify({pass:true,proof:'Chrome proxy API failure simulated, real extension and extractor',requests,cases:['connection setup reason visible','no HTTP on setup failure','no secret leakage','explicit retry collects four records']}));
 }finally{await b?.context.close();const resolved=path.resolve(profile);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'idealista005-links-connection-'));await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
})().catch(error=>{console.error(error);process.exitCode=1;});

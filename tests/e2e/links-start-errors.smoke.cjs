// Real extension and HTTP observation; controlled local responses, no public requests.
const {openBrowser,poll}=require('../fixtures/coleta-browser.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista005-links-errors-'));let b,requests=0;
 try{
  b=await openBrowser(profile,route=>{requests++;return route.fulfill({status:403,contentType:'text/html',body:'<html><body>Access denied</body></html>'});});
  const p=await b.context.newPage();await p.setViewportSize({width:360,height:800});await p.goto(b.base+'sidepanel.html');await p.getByRole('tab',{name:'Links',exact:true}).click();
  const read=()=>p.evaluate(async()=>(await chrome.runtime.sendMessage({cmd:'AUTONOMA_LINKS_READ'})).result);
  await p.locator('#tool-links-open').click();const blocked=await poll(read,v=>v.reason==='access_blocked');
  assert.ok(blocked.id);assert.equal(requests,1);
  await p.locator('#tool-links-open').click();
  await poll(read,v=>v.state!=='preparing');
  await p.waitForFunction(()=>/recusou|verificação|Não foi possível iniciar a coleta/.test(document.querySelector('#links-status').textContent),null,{timeout:5000});
  assert.match(await p.locator('#links-status').textContent(),/recusou|verificação/);
  const preserved=await read();assert.equal(preserved.reason,'access_blocked');assert.equal(preserved.id,blocked.id,'A new click must keep the blocked session and its recovery path');
  // 006 US5/AC4: o executor aguarda o prazo (30 min) para verificar sozinho; nenhuma solicitação antes disso.
  assert.equal(requests,1,'No request before the access deadline');
  assert.equal(b.context.pages().some(page=>new URL(page.url()).pathname==='/localidades.html'),false,'Blocked collection must stay in Links, never open the export screen');
  // 006 (pedido do usuário): sem 'Ver detalhes' (a tela antiga de exportação confundia); a retomada fica no botão principal.
  assert.equal(await p.locator('#links-details').isVisible(),false);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await p.screenshot({path:'.sdd/specs/005-experiencia-coleta-autonoma/validation/links-start-blocked-360.png'});
  // 006 US5/AC4: executor de Links continua vivo, agendado para a verificação automática após o prazo.
  assert.ok(b.context.pages().some(page=>page.url().includes('/runner.html?links=')),'Links runner waits for the automatic recheck');
  assert.equal((await read()).auto,true);await p.waitForFunction(()=>/Nova tentativa automática/.test(document.querySelector('#links-status').textContent),null,{timeout:5000});
  // Executor aguardando a verificação automática: o botão não oferece retomada manual que duplicaria o executor.
  assert.doesNotMatch(await p.locator('#tool-links-open').textContent(),/Retomar coleta de links/);
  assert.equal(b.context.pages().some(page=>['/localidades.html','/configuracoes.html'].includes(new URL(page.url()).pathname)),false);
  assert.equal(requests,1,'Waiting only observes the preserved session');
  assert.deepEqual(b.errors,[]);
  console.log(JSON.stringify({pass:true,proof:'local HTTP403 with real extension',requests,cases:['refusal reason visible','blocked session preserved','no request before deadline; automatic recheck scheduled (006)','no export screen; retry stays in the Links tab (006)']}));
 }finally{await b?.context.close();const resolved=path.resolve(profile);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'idealista005-links-errors-'));await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
})().catch(error=>{console.error(error);process.exitCode=1;});

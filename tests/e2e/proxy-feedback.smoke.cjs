// Extension DOM and Chrome proxy APIs; only the IP transport is simulated, no public network.
const {openBrowser}=require('../fixtures/coleta-browser.cjs'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const validation=path.resolve(__dirname,'../../.sdd/specs/005-experiencia-coleta-autonoma/validation');
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista005-feedback-'));let b;
 try{
  b=await openBrowser(profile,r=>r.abort());const p=await b.context.newPage();await p.setViewportSize({width:360,height:720});await p.goto(b.base+'configuracoes.html');
  await p.waitForFunction(()=>document.querySelector('#minIntervalMs')?.value==='10');
  assert.equal(await p.getByRole('button',{name:'Salvar e testar conexão',exact:true}).count(),1,'One explicit action must save, apply and verify near the connection fields');
  const worker=b.context.serviceWorkers()[0];await worker.evaluate(()=>{
   globalThis.__ipFeedback={mode:'hold',calls:0};globalThis.fetch=async url=>{if(!String(url).startsWith('https://api.ipify.org'))throw Error('Unexpected test request');const state=globalThis.__ipFeedback;state.calls++;if(state.mode==='hold')await new Promise(resolve=>state.release=resolve);if(state.mode==='fail')throw Error('Simulated transport failure');return new Response(JSON.stringify({ip:'203.0.113.42'}),{status:200,headers:{'Content-Type':'application/json'}});};
  });
  const send=(cmd,values={})=>p.evaluate(message=>chrome.runtime.sendMessage(message),{cmd,...values});
  const action=p.getByRole('button',{name:'Salvar e testar conexão',exact:true}),feedback=p.locator('#connection-feedback');
  await p.locator('#connection').selectOption('proxy');await action.click();await p.waitForFunction(()=>document.querySelector('#host').getAttribute('aria-invalid')==='true');
  assert.equal(await feedback.getAttribute('data-state'),'error');assert.equal((await send('PROXY_STATUS')).enabled,false);assert.equal(await worker.evaluate(()=>__ipFeedback.calls),0);
  await p.locator('#host').fill('proxy.invalid');await p.locator('#port').fill('8080');await p.locator('#user').fill('fixture-user');await p.locator('#password').fill('fixture-secret');
  await action.click();await p.waitForFunction(()=>document.querySelector('#connection-feedback-title').textContent==='Testando conexão…');
  assert.equal(await action.isDisabled(),true);assert.equal(await p.locator('#password').isDisabled(),true);await p.waitForTimeout(1100);assert.equal(await p.locator('#test-ip').isDisabled(),true,'Activity polling must not unlock a pending test');
  assert.equal(await feedback.getAttribute('data-state'),'pending');await worker.evaluate(()=>__ipFeedback.release());
  await p.waitForFunction(()=>document.querySelector('#connection-feedback-title').textContent==='Proxy conectado');assert.equal(await feedback.getAttribute('data-state'),'success');assert.match(await feedback.textContent(),/203\.0\.113\.42/);
  assert.equal(await p.locator('#password').inputValue(),'');assert.equal(await p.locator('#password').isDisabled(),false);assert.equal((await send('PROXY_STATUS')).matchesSaved,true);
  async function visibleResult(){const box=await feedback.boundingBox();const h=await p.evaluate(()=>innerHeight);assert.ok(box.y>=0&&box.y+box.height<=h,'Result must be in the visible viewport');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await visibleResult();await p.screenshot({path:path.join(validation,'proxy-feedback-success-360.png')});
  await worker.evaluate(()=>__ipFeedback.mode='fail');await p.locator('#test-ip').click();await p.waitForFunction(()=>document.querySelector('#connection-feedback').dataset.state==='error');
  assert.match(await feedback.textContent(),/Não foi possível confirmar/);assert.match(await feedback.textContent(),/host, porta, usuário e senha/);assert.equal((await send('PROXY_STATUS')).enabled,true);await visibleResult();
  await p.setViewportSize({width:320,height:720});await feedback.scrollIntoViewIfNeeded();await visibleResult();await p.screenshot({path:path.join(validation,'proxy-feedback-error-320.png')});
  await p.locator('#user').fill('edited-user');assert.equal(await feedback.getAttribute('data-state'),'info');assert.doesNotMatch(await feedback.textContent(),/Proxy conectado/);
  await worker.evaluate(()=>__ipFeedback.mode='success');await p.locator('#test-ip').click();await p.waitForFunction(()=>document.querySelector('#connection-feedback-title').textContent==='IP da conexão ativa verificado');assert.match(await feedback.textContent(),/alterações ainda não foram salvas nem testadas/);assert.equal((await send('PROXY_STATUS')).matchesSaved,true);assert.equal(await p.locator('#user').inputValue(),'edited-user');
  const view=(await send('AUTONOMA_GET_SETTINGS')).result;assert.equal((await send('AUTONOMA_SAVE_SETTINGS',{payload:{expectedRevision:view.revision,values:{...view,ipEnabled:true}}})).result.status,'saved');
  const probes=await worker.evaluate(()=>__ipFeedback.calls);await action.click();await p.waitForFunction(()=>document.querySelector('#connection-feedback').dataset.state==='error');assert.match(await feedback.textContent(),/Outra tela/);assert.equal(await worker.evaluate(()=>__ipFeedback.calls),probes);
  await p.reload();await p.waitForFunction(()=>document.querySelector('#connection')?.value==='proxy');await p.locator('#connection').selectOption('direct');await worker.evaluate(()=>__ipFeedback.mode='success');await action.click();await p.waitForFunction(()=>document.querySelector('#connection-feedback-title').textContent==='Conexão do sistema confirmada');assert.equal((await send('PROXY_STATUS')).enabled,false);await visibleResult();
  await p.evaluate(async()=>{const request=indexedDB.open('idealista-coleta-v1',1);await new Promise((resolve,reject)=>{request.onsuccess=resolve;request.onerror=reject;});const db=request.result;await new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put({active:'test-other-session'},'domain:idealista.pt');tx.oncomplete=resolve;tx.onerror=reject;});db.close();});
  await p.waitForFunction(()=>document.querySelector('#save-test-connection').disabled&&!document.querySelector('#activity-notice').hidden);assert.equal((await send('PROXY_STATUS')).enabled,false);
  await p.evaluate(()=>document.documentElement.style.zoom='2');await feedback.scrollIntoViewIfNeeded();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual((await send('AUTONOMA_LIST')).result,[]);assert.deepEqual(b.errors,[]);
  const result={pass:true,proof:'extension DOM + Chrome proxy/settings; simulated IP transport',cases:['one explicit save/apply/test','validation prevents application','immediate progress','pending controls stay locked','verified IP success','visible feedback','failure and recovery guidance','320px and CSS zoom200%','editing clears stale success','passive probe does not validate draft','conflict prevents probing','direct confirmed','active collection blocks changes','no collection started'],pageErrors:0};await fs.writeFile(path.join(validation,'proxy-feedback-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await b?.context.close();const resolved=path.resolve(profile);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'idealista005-feedback-'));await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
})().catch(error=>{console.error(error);process.exitCode=1;});

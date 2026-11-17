// Real Chrome APIs + DOM, fake proxy and all external network blocked.
const {openBrowser}=require('../fixtures/coleta-browser.cjs'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista005-proxy-settings-'));let b;
 try{
 b=await openBrowser(profile,r=>r.abort());const p=await b.context.newPage();await p.goto(b.base+'configuracoes.html');p.setDefaultTimeout(10000);
 await p.waitForFunction(()=>document.querySelector('#minIntervalMs')?.value==='10');
 const send=(cmd,values={})=>p.evaluate(message=>chrome.runtime.sendMessage(message),{cmd,...values});
 await p.locator('#connection').selectOption('proxy');await p.locator('#host').fill('proxy.invalid');await p.locator('#port').fill('8080');await p.locator('#user').fill('fixture-user');await p.locator('#password').fill('fixture-secret');
 assert.equal(await p.locator('#apply-connection').isDisabled(),true);
 await p.locator('#settings-save').click();await p.waitForFunction(()=>document.querySelector('#settings-status').textContent.includes('Configurações salvas'));
 let status=await send('PROXY_STATUS');assert.equal(status.enabled,false);assert.equal(status.requested,true);assert.equal(status.matchesSaved,false);assert.match(await p.locator('#proxy-status').textContent(),/salvo, ainda não aplicado/);assert.equal(await p.locator('#password').inputValue(),'');
 await p.locator('#connection-options summary').click();await p.locator('#apply-connection').click();await p.waitForFunction(()=>document.querySelector('#proxy-status').textContent.includes('Proxy salvo aplicado'));
 status=await send('PROXY_STATUS');assert.equal(status.enabled,true);assert.equal(status.matchesSaved,true);assert.equal(JSON.stringify(status).includes('fixture-secret'),false);
 await p.locator('#test-ip').click();await p.waitForFunction(()=>document.querySelector('#settings-status').textContent.includes('IP não verificado'));assert.equal((await send('PROXY_STATUS')).enabled,true);
 const view=(await send('AUTONOMA_GET_SETTINGS')).result;
 const saved=await send('AUTONOMA_SAVE_SETTINGS',{payload:{expectedRevision:view.revision,values:{...view,ipEnabled:true}}});assert.equal(saved.result.status,'saved');
 await p.locator('#apply-connection').click();await p.waitForFunction(()=>document.querySelector('#settings-status').textContent.includes('Outra tela salvou'));assert.equal((await send('PROXY_STATUS')).enabled,true);
 await p.reload();await p.waitForFunction(()=>document.querySelector('#connection')?.value==='proxy');
 await p.locator('#connection').selectOption('direct');assert.equal(await p.locator('#apply-connection').isDisabled(),true);await p.locator('#settings-save').click();await p.waitForFunction(()=>document.querySelector('#settings-status').textContent.includes('Configurações salvas'));
 assert.equal((await send('PROXY_STATUS')).enabled,true,'Save does not modify connection');
 await p.locator('#connection-options summary').click();await p.locator('#apply-connection').click();await p.waitForFunction(()=>document.querySelector('#proxy-status').textContent.includes('Conexão do sistema ativa'));
 status=await send('PROXY_STATUS');assert.equal(status.enabled,false);assert.equal(status.matchesSaved,true);
 assert.deepEqual((await send('AUTONOMA_LIST')).result,[]);assert.deepEqual(b.errors,[]);
 console.log(JSON.stringify({pass:true,proof:'Chrome proxy/settings + extension DOM; no provider traffic',cases:['saved is not applied','explicit apply','secret omitted','IP test observational','stale revision refused','dirty cannot apply','direct clears own proxy','no collection started'],pageErrors:0}));
 }finally{await b?.context.close();const resolved=path.resolve(profile);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'idealista005-proxy-settings-'));await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
})().catch(error=>{console.error(error);process.exitCode=1;});


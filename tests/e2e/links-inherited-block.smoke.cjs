// Real cross-mode block; spoofing only the UI's deadline verifies the backend cannot be bypassed.
const {openBrowser,configure,waitState,poll}=require('../fixtures/coleta-browser.cjs');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista005-inherited-block-'));let b,requests=0;
 try{
  const navigationHTML=await fs.readFile(path.join(__dirname,'../fixtures/idealista-locations-2026-11-15.html'),'utf8');
  b=await openBrowser(profile,route=>{requests++;return route.fulfill({status:requests===1?403:200,contentType:'text/html',body:requests===1?'<h1>Access denied</h1>':'<!doctype html><html><head><title>Localidades</title></head><body>'+navigationHTML+'</body></html>'});});
  const batch=await b.page('lote.html');await configure(batch);await batch.locator('#choose').click();await batch.locator('#loteUrls').fill(JSON.stringify([{nome:'Blocked',link:'https://www.idealista.pt/arrendar-casas/blocked-fixture/'}]));await batch.locator('#loteStart').click();await waitState(batch,'blocked');assert.equal(requests,1);
  const p=await b.context.newPage();await p.goto(b.base+'sidepanel.html');await p.getByRole('tab',{name:'Links',exact:true}).click();await p.locator('#tool-links-open').click();
  await p.waitForFunction(()=>document.querySelector('#tool-links-open').textContent.includes('espera'));
  assert.equal(await p.locator('#tool-links-open').isDisabled(),true);assert.equal(requests,1,'Inherited block must not dispatch a new request');
  const read=()=>p.evaluate(async()=>(await chrome.runtime.sendMessage({cmd:'AUTONOMA_LINKS_READ'})).result);
  const view=await read();assert.equal(view.id,undefined);assert.equal(view.recovery,'confirm-access');assert.ok(view.until>Date.now());
  assert.equal(b.context.pages().some(page=>['/localidades.html','/configuracoes.html'].includes(new URL(page.url()).pathname)),false);
  await p.evaluate(()=>{window.__linksStarts=[];const send=chrome.runtime.sendMessage.bind(chrome.runtime);chrome.runtime.sendMessage=async(message,...args)=>{const result=await send(message,...args);if(message.cmd==='AUTONOMA_LINKS_START')window.__linksStarts.push(result?.result);if(message.cmd==='AUTONOMA_LINKS_READ'&&result?.result)result.result.until=null;return result;};});
  await p.getByRole('tab',{name:'Links',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#tool-links-open').textContent.includes('Conferir acesso'));
  await p.locator('#tool-links-open').click();await p.locator('#confirm-dialog').waitFor({state:'visible'});await p.locator('#confirm-dialog button[value=cancel]').click();assert.equal(requests,1);
  await p.locator('#tool-links-open').click();await p.locator('#confirm-dialog').waitFor({state:'visible'});await p.locator('#confirm-ok').click();
  await p.waitForFunction(()=>window.__linksStarts.some(result=>result?.status==='wait'));
  await poll(()=>p.locator('#tool-links-open').isDisabled(),v=>!v);assert.equal(requests,1,'Even confirmed UI cannot bypass the backend deadline');
  const blocking=await batch.evaluate(async()=>(await chrome.runtime.sendMessage({cmd:'COLETA_LIST'})).result);assert.equal(blocking[0].state,'blocked');assert.deepEqual(b.errors,[]);
  // Temporary profile only: seed the domain as if the prior wait had elapsed.
  // This is a controlled eligibility fixture, not proof of waiting 30 real minutes.
  await p.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('idealista-coleta-v1',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('records','readwrite'),store=tx.objectStore('records'),get=store.get('domain:idealista.pt');get.onsuccess=()=>{const domain=get.result,elapsed=1800001;domain.blockedUntil-=elapsed;domain.highWaterClock-=elapsed;domain.lastStarted-=elapsed;domain.events=domain.events.map(t=>t-elapsed);store.put(domain,'domain:idealista.pt');};tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(tx.error);};};}));
  await p.locator('#tool-links-open').click();await p.locator('#confirm-dialog').waitFor({state:'visible'});await p.locator('#confirm-ok').click();
  const collected=await poll(read,v=>v.state==='collected');assert.equal(collected.total,84);assert.equal(collected.records.length,84);assert.equal(requests,2);
  await p.waitForFunction(()=>document.querySelector('#links-status').textContent.includes('84 localidades coletadas'));
  assert.equal(await p.locator('#links-results li').count(),84);assert.equal(await p.locator('#links-save').isVisible(),true);
  const prior=await batch.evaluate(async()=>(await chrome.runtime.sendMessage({cmd:'COLETA_LIST'})).result);assert.equal(prior.find(s=>s.id===blocking[0].id).state,'blocked');
  assert.equal(b.context.pages().some(page=>['/localidades.html','/configuracoes.html'].includes(new URL(page.url()).pathname)),false);assert.deepEqual(b.errors,[]);
  console.log(JSON.stringify({pass:true,proof:'real extension, controlled HTTP403/200 and captured real DOM; elapsed deadline seeded only in temporary profile',requests,records:collected.total,cases:['Lote block inherited by Links','recovery visible without Links session','mandatory wait enforced','cancel preserves block','confirmation before deadline refused','eligible confirmation collects 84 links','old session preserved','no export or settings page']}));
 }finally{await b?.context.close();const resolved=path.resolve(profile);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'idealista005-inherited-block-'));await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
})().catch(error=>{console.error(error);process.exitCode=1;});

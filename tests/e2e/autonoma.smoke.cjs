const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {openBrowser,poll,stopWorker}=require('../fixtures/coleta-browser.cjs');
const origin='https://www.idealista.pt',source=origin+'/arrendar-casas/fixture-distrito/';
function listing(name){return '<section class="items-container items-list"><article class="item" data-element-id="'+name+'"><div class="item-info-container"><a class="item-link" href="/imovel/'+name+'/">Casa '+name+'</a></div><div class="price-row"><span class="item-price">900 €</span></div></article></section>';}
const directory='<div class="breadcrumb-dropdown-element highlighted"><ul class="breadcrumb-dropdown-subitem-list">'+['alpha','beta','gamma'].map(n=>'<li><a href="/arrendar-casas/'+n+'/">'+n+'</a><span class="breadcrumb-navigation-sidenote">1</span></li>').join('')+'</ul></div>';
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista005-core-'));let browser;
 const calls=[];let mode='happy',failed=false,gate=null,release=null;try{
 const route=async r=>{const url=r.request().url();if(!url.startsWith(origin))return r.abort();calls.push(url);
  if(mode==='quota'&&url===origin+'/arrendar-casas/alpha/'&&gate)await gate;
  const second=url===origin+'/arrendar-casas/beta/pagina-2/',fail=mode==='local'&&second&&!failed;if(fail)failed=true;
  let body=url===source?directory:listing(url.split('/').filter(Boolean).at(-1));
  if(mode==='local'&&url===origin+'/arrendar-casas/beta/')body+='<div class="pagination"><li class="next"><a href="'+origin+'/arrendar-casas/beta/pagina-2/">Seguinte</a></li></div>';
  return r.fulfill({status:fail?404:200,contentType:'text/html; charset=utf-8',body:fail?'<h1>Not found</h1>':body});
 };
 browser=await openBrowser(profile,route);
 for(const worker of browser.context.serviceWorkers())worker.on('console',message=>console.log('worker:',message.text()));
 const observer=await browser.page('lote.html');
 await observer.evaluate(async()=>{const r=await chrome.runtime.sendMessage({cmd:'COLETA_GET_POLICY'});await chrome.runtime.sendMessage({cmd:'COLETA_SET_POLICY',payload:{limits:{...r.result.limits,minIntervalMs:1000,maxPagesPerWindow:1000},ipEnabled:false}});});
 await observer.locator('#choose').click();await observer.waitForFunction(()=>document.querySelector('#destination').textContent.includes('acesso permitido'));
 const sourceTab=await observer.evaluate(async url=>{const tab=await chrome.tabs.create({url:'about:blank',active:false});await chrome.tabs.update(tab.id,{url});return tab.id;},source);
 await poll(()=>observer.evaluate(id=>chrome.tabs.get(id),sourceTab),t=>t.status==='complete');
 const started=await observer.evaluate(async tabId=>{const r=await chrome.runtime.sendMessage({cmd:'AUTONOMA_START',payload:{commandId:crypto.randomUUID(),source:{tabId}}});return r;},sourceTab);
 if(!started.ok)console.error({started,calls,pageerrors:browser.errors});assert.equal(started.ok,true);assert.equal(started.result.status,'accepted');const id=started.result.id;
 await observer.close();
 const watch=await browser.context.newPage();await watch.goto(browser.base+'popup.html');
 let run;try{run=await poll(()=>watch.evaluate(async id=>(await chrome.runtime.sendMessage({cmd:'AUTONOMA_READ',payload:{id}})).result,id),r=>['completed','paused','finished-with-pending','interrupted'].includes(r?.state),{timeout:12000});}
 catch(error){console.error({snapshot:await watch.evaluate(async id=>chrome.runtime.sendMessage({cmd:'AUTONOMA_READ',payload:{id}}),id),calls,pages:await Promise.all(browser.context.pages().map(async page=>({path:new URL(page.url()).pathname,status:await page.locator('#runner-status').textContent({timeout:500}).catch(()=>null)}))),errors:browser.errors});throw error;}
 if(run.state!=='completed')console.error({run,calls,errors:browser.errors,background:await Promise.all(browser.context.serviceWorkers().map(w=>w.evaluate(()=>Object.keys(globalThis))))});
 assert.equal(run.state,'completed');assert.equal(run.summary.saved,3);
 assert.equal(calls.filter(u=>u!==source).length,3);assert.deepEqual(browser.errors,[]);
 assert.equal((await watch.evaluate(id=>chrome.tabs.get(id),sourceTab)).url,source);
 const rpc=(action,payload={})=>watch.evaluate(async({action,payload})=>{const r=await chrome.runtime.sendMessage({cmd:'AUTONOMA_'+action,payload});if(!r?.ok)throw Error('Rejected '+action);return r.result;},{action,payload});
 const start=async()=>{const r=await rpc('START',{commandId:crypto.randomUUID(),source:{tabId:sourceTab}});assert.equal(r.status,'accepted');return r.id;};
 const terminal=id=>poll(()=>rpc('READ',{id}),r=>['completed','paused','finished-with-pending','interrupted'].includes(r.state));
 mode='local';const localId=await start();await stopWorker(browser.context,watch,browser.extensionId);let local=await terminal(localId);
 if(local.summary.saved!==2)console.error(JSON.stringify({stage:'local-after-worker-stop',state:local.state,reason:local.reason,summary:local.summary,items:local.items.map(item=>({state:item.state,reason:item.reason})),tabs:await watch.evaluate(async()=>{const safe=value=>{try{const u=new URL(value);return u.origin+u.pathname;}catch{return null;}};return (await chrome.tabs.query({})).map(tab=>({id:tab.id,url:safe(tab.url),pendingUrl:safe(tab.pendingUrl)}));}),calls}));
 assert.equal(local.summary.saved,2);assert.equal(local.summary.pending,1);const beta=local.items.find(i=>i.nome==='beta');assert.equal(beta.checkpoint.confirmedPages,1);
 const beforeResume=calls.length;assert.equal((await rpc('RESUME',{id:localId,selection:{itemId:beta.id}})).status,'accepted');local=await poll(()=>rpc('READ',{id:localId}),r=>r.state==='completed');
 assert.equal(calls.length,beforeResume+1);assert.equal(local.summary.saved,3);assert.equal(local.items.find(i=>i.id===beta.id).checkpoint.confirmedPages,2);
 mode='quota';gate=new Promise(resolve=>{release=resolve;});const quotaId=await start();
 const runner=await poll(async()=>browser.context.pages().find(p=>p.url().includes('runner.html?id='+quotaId)),Boolean);
 await runner.evaluate(()=>{const original=FileSystemFileHandle.prototype.createWritable;FileSystemFileHandle.prototype.createWritable=function(...args){FileSystemFileHandle.prototype.createWritable=original;throw new DOMException('fixture quota','QuotaExceededError');};});release();gate=null;
 const quota=await terminal(quotaId);assert.equal(quota.reason,'quota_exceeded');const item=quota.items[0];assert.equal(item.stage,'save');const beforeSave=calls.length;
 assert.equal((await rpc('RESUME',{id:quotaId,selection:{itemId:item.id},retrySave:true})).status,'accepted');
 const saved=await poll(()=>rpc('READ',{id:quotaId}),r=>r.summary.saved===1&&r.state==='paused');assert.equal(calls.length,beforeSave);assert.equal(saved.items[0].state,'saved');
 await watch.evaluate(async()=>{const p=(await chrome.runtime.sendMessage({cmd:'COLETA_GET_POLICY'})).result;const r=await chrome.runtime.sendMessage({cmd:'COLETA_SET_POLICY',payload:{limits:{...p.limits,minIntervalMs:3000},ipEnabled:false}});if(!r.ok)throw Error('Policy rejected');});
 mode='restart';const restartId=await start();await poll(()=>rpc('READ',{id:restartId}),r=>r.summary.saved===1&&r.state==='waiting');
 const extensionId=browser.extensionId;await browser.context.close();browser=null;const beforeRestart=calls.length;browser=await openBrowser(profile,route,{extensionId});const reopened=await browser.context.newPage();await reopened.goto(browser.base+'sidepanel.html');await reopened.waitForFunction(()=>document.querySelector('#primary-action').textContent!=='Carregando…');assert.equal(calls.length,beforeRestart);
 const resumeResponse=await reopened.evaluate(async id=>(await chrome.runtime.sendMessage({cmd:'AUTONOMA_RESUME',payload:{id,selection:'remaining'}})).result,restartId);assert.equal(resumeResponse.status,'accepted');
 const afterRestart=await poll(()=>reopened.evaluate(async id=>(await chrome.runtime.sendMessage({cmd:'AUTONOMA_READ',payload:{id}})).result,restartId),r=>r?.state==='completed');assert.equal(afterRestart.summary.saved,3);assert.equal(calls.length,beforeRestart+2);assert.deepEqual(browser.errors,[]);
 const result={pass:true,cases:['one click','observer closed','source preserved','worker stopped during queue','local404 followed by next item','new runner resumes only page2','quota after collection','save-only without HTTP','browser restart no automatic requests'],pageerrors:browser.errors.length,calls:calls.length};
 await fs.writeFile(path.resolve(__dirname,'../../.sdd/specs/005-experiencia-coleta-autonoma/validation/core-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser?.context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

// Installed Chrome, REAL sidePanel context/action, isolated profile. FSA remains OPFS simulation here.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {poll}=require('../fixtures/coleta-browser.cjs');
const root=path.resolve(__dirname,'../..'),validation=path.join(root,'.sdd/specs/005-experiencia-coleta-autonoma/validation');
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista005-chrome-'));let context;
 try{
 context=await chromium.launchPersistentContext(profile,{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:false,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging','--disable-background-networking','--host-resolver-rules=MAP * ~NOTFOUND']});
 const errors=[],calls=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await context.route('https://**/*',r=>{const url=r.request().url();if(!url.startsWith('https://www.idealista.pt/'))return r.abort();calls.push(url);const body=url.endsWith('/native-source/')?'<div class="breadcrumb-dropdown-element highlighted"><ul class="breadcrumb-dropdown-subitem-list">'+['A','B','C'].map(n=>'<li><a href="/native-'+n+'/">'+n+'</a></li>').join('')+'</ul></div>':'<section class="items-container items-list"><article class="item" data-element-id="'+url.slice(-2,-1)+'"><div class="item-info-container"><a class="item-link" href="/imovel/1/">Casa local</a></div></article></section>';return r.fulfill({contentType:'text/html',body});});
 await context.route('http://**/*',r=>r.abort());
 await context.addInitScript(()=>{if(location.protocol!=='chrome-extension:')return;FileSystemHandle.prototype.queryPermission=async()=> 'granted';FileSystemHandle.prototype.requestPermission=async()=> 'granted';window.showDirectoryPicker=async()=> (await navigator.storage.getDirectory()).getDirectoryHandle('native-panel-opfs',{create:true});});
 const browser=context.browser(),cdp=await browser.newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root}),base='chrome-extension://'+id+'/';
 const worker=context.serviceWorkers().find(w=>w.url().startsWith(base))||await context.waitForEvent('serviceworker');
 await worker.evaluate(()=>{globalThis.__panelEvents=[];chrome.sidePanel.onOpened.addListener(info=>globalThis.__panelEvents.push({type:'opened',...info}));chrome.sidePanel.onClosed?.addListener(info=>globalThis.__panelEvents.push({type:'closed',...info}));});
 const settings=await context.newPage();await settings.goto(base+'configuracoes.html');await settings.waitForFunction(()=>document.querySelector('#minIntervalMs')?.value==='10');await settings.locator('#minIntervalMs').fill('1');await settings.locator('#settings-save').click();await settings.waitForFunction(()=>document.querySelector('#settings-status').textContent.includes('Configurações salvas'));await settings.locator('#choose-ads').click();await settings.waitForFunction(()=>document.querySelector('#ads-destination').textContent.includes('acesso permitido'));
 const page=await context.newPage();await page.goto('https://www.idealista.pt/native-source/');const {targetInfos}=await cdp.send('Target.getTargets',{filter:[{type:'tab'}]});const targetInfo=targetInfos.find(t=>t.url===page.url());assert.ok(targetInfo,'Native Chrome tab target');
 await cdp.send('Extensions.triggerAction',{id,targetId:targetInfo.targetId});
 const contexts=()=>worker.evaluate(()=>chrome.runtime.getContexts({contextTypes:['SIDE_PANEL']}));
 const opened=await poll(contexts,rows=>rows.length===1);const windowId=await settings.evaluate(async()=> (await chrome.tabs.query({url:'https://www.idealista.pt/native-source/'}))[0].windowId);
 assert.ok(opened[0].documentUrl.endsWith('sidepanel.html'));
 const started=await settings.evaluate(async tabId=>(await chrome.runtime.sendMessage({cmd:'AUTONOMA_START',payload:{commandId:crypto.randomUUID(),source:{tabId}}})).result,(await settings.evaluate(async()=> (await chrome.tabs.query({url:'https://www.idealista.pt/native-source/'}))[0].id)));
 assert.equal(started.status,'accepted');
 await worker.evaluate(windowId=>chrome.sidePanel.close({windowId}),windowId);await poll(contexts,rows=>rows.length===0);
 const completed=await poll(()=>settings.evaluate(async id=>(await chrome.runtime.sendMessage({cmd:'AUTONOMA_READ',payload:{id}})).result,started.id),r=>r?.state==='completed');
 assert.equal(completed.summary.saved,3);assert.equal(page.url(),'https://www.idealista.pt/native-source/');
 await cdp.send('Extensions.triggerAction',{id,targetId:targetInfo.targetId});await poll(contexts,rows=>rows.length===1);
 const events=await worker.evaluate(()=>globalThis.__panelEvents);assert.ok(events.filter(e=>e.type==='opened').length>=2);assert.deepEqual(errors,[]);
 const result={pass:true,proof:'installed Chrome headed + CDP Extensions.triggerAction + runtime SIDE_PANEL context + onOpened/onClosed; OPFS only for writes',version:browser.version(),events,cases:['action opens real panel','native close removes panel context','collection continues with closed native panel','source preserved','action reopens panel'],saved:completed.summary.saved,requests:calls.length,pageErrors:0};
 await fs.writeFile(path.join(validation,'native-panel-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await context?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});


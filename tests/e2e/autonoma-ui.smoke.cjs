// Real extension DOM, isolated profile, local routes, simulated picker/OPFS.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {openBrowser,poll}=require('../fixtures/coleta-browser.cjs');
const origin='https://www.idealista.pt',url=origin+'/arrendar-casas/ui-fixture/';
const root=path.resolve(__dirname,'../..'),validation=path.join(root,'.sdd/specs/005-experiencia-coleta-autonoma/validation');
const listing='<section class="items-container items-list"><article class="item" data-element-id="1"><div class="item-info-container"><a class="item-link" href="/imovel/1/">Casa</a></div></article></section>';
const breadcrumb='<div class="breadcrumb-dropdown-element highlighted"><ul class="breadcrumb-dropdown-subitem-list">'+Array.from({length:308},(_,i)=>'<li><a href="/arrendar-casas/ui-'+i+'/">'+(i===307?'São Brás de Alportel — localidade com nome muito comprido para consultar':'Localidade '+i)+'</a></li>').join('')+'</ul></div>';
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista005-ui-'));let b;
 const calls=[];try{
 b=await openBrowser(profile,r=>{const u=r.request().url();if(!u.startsWith(origin))return r.abort();calls.push(u);return r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:u===url?breadcrumb:listing});});
 const p=await b.context.newPage();await p.goto(b.base+'sidepanel.html');
 await p.locator('#primary-action').filter({hasText:'Configurar pasta'}).waitFor();
 await p.locator('#primary-action').click();await p.locator('#settings-save').waitFor();await p.waitForFunction(()=>document.querySelector('#minIntervalMs')?.value==='10');
 assert.equal(await p.locator('#proxy-fields').isVisible(),false);
 await p.locator('#minIntervalMs').fill('0');await p.locator('#settings-save').click();await p.waitForFunction(()=>document.querySelector('#minIntervalMs').getAttribute('aria-invalid')==='true');
 assert.equal(await p.locator('#minIntervalMs').evaluate(e=>e===document.activeElement),true);
 await p.locator('#minIntervalMs').fill('12');await p.locator('#settings-save').click();await p.waitForFunction(()=>document.querySelector('#settings-status').textContent.includes('Configurações salvas'));
 assert.equal(calls.length,0);
 await p.locator('#choose-ads').click();await p.waitForFunction(()=>document.querySelector('#ads-destination').textContent.includes('acesso permitido'));
 assert.equal(await p.evaluate(()=>window.__collectionTest.activations.every(Boolean)),true);
 await p.locator('#minIntervalMs').fill('13');await p.locator('#back').click();await p.locator('#leave-dialog[open]').waitFor();
 await p.getByRole('button',{name:'Permanecer',exact:true}).click();assert.equal(await p.locator('#minIntervalMs').inputValue(),'13');
 await p.locator('#back').click();await p.getByRole('button',{name:'Descartar edições',exact:true}).click();await p.locator('#collection-app').waitFor();
 await p.locator('#settings-link').click();await p.waitForFunction(()=>document.querySelector('#minIntervalMs')?.value==='12');
 await p.locator('#minIntervalMs').fill('1');await p.locator('#maxPagesPerRun').fill('1');await p.locator('#settings-save').click();await p.waitForFunction(()=>document.querySelector('#settings-status').textContent.includes('Configurações salvas'));
 const sourceTab=await p.evaluate(async url=>{const tab=await chrome.tabs.create({url:'about:blank',active:false});await chrome.tabs.update(tab.id,{url});return tab.id;},url);
 await poll(()=>p.evaluate(id=>chrome.tabs.get(id),sourceTab),t=>t.status==='complete');
 await p.goto(b.base+'sidepanel.html?sourceTabId='+sourceTab);await p.waitForFunction(()=>document.querySelector('#primary-action').textContent==='Iniciar coleta'&&!document.querySelector('#primary-action').disabled);
 await p.locator('#primary-action').click();await p.waitForFunction(()=>document.querySelectorAll('#localities>li').length===308,{timeout:20000});
 try{await p.waitForFunction(()=>document.querySelector('#run-state').textContent==='Coleta pausada',null,{timeout:20000});}catch(error){console.error({state:await p.locator('#run-state').textContent(),feedback:await p.locator('#feedback').textContent(),reason:await p.locator('#run-reason').textContent(),calls,errors:b.errors});throw error;}
 assert.equal(calls.filter(u=>u!==url).length,1);
 await p.locator('#search').fill('sao bras');await p.waitForFunction(()=>document.querySelector('#list-total').textContent==='1 de 308');
 const row=p.locator('.locality:not([hidden])');await row.locator('summary').click();await row.locator('summary').focus();
 await p.waitForTimeout(1100);assert.equal(await row.locator('details').getAttribute('open'),'');assert.equal(await row.locator('summary').evaluate(e=>e===document.activeElement),true);
 await p.locator('#settings-link').click();await p.locator('#back').click();await p.waitForFunction(()=>document.querySelector('#search')?.value==='sao bras');
 assert.equal(await p.locator('.locality:not([hidden]) details').getAttribute('open'),'');
 await p.setViewportSize({width:320,height:800});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await p.screenshot({path:path.join(validation,'panel-320.png'),fullPage:true});
 await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>{document.documentElement.style.zoom='2';});
 if(!await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))console.error(await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth&&!e.closest('[hidden]')).slice(0,8).map(e=>({tag:e.tagName,id:e.id,class:e.className,width:e.getBoundingClientRect().width}))));
 await p.screenshot({path:path.join(validation,'panel-css-zoom-200.png'),fullPage:true});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await p.evaluate(()=>{document.documentElement.style.zoom='';});await p.locator('#settings-link').click();await p.locator('#settings-save').waitFor();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:path.join(validation,'settings-320.png'),fullPage:true});await p.evaluate(()=>{document.documentElement.style.zoom='2';});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:path.join(validation,'settings-css-zoom-200.png'),fullPage:true});
 assert.deepEqual(b.errors,[]);assert.equal(b.downloads.length,0);
 const result={pass:true,proof:'extension-page DOM (not native sidePanel)',cases:['first use','invalid/focus','saved preferences','native gesture simulated picker','dirty/stay/discard','308 discovered items','filter/accent','stable focus/details','reading context restored','320px','CSS zoom 200%','reduced motion'],requests:calls.length,pageErrors:0,downloads:0};
 await fs.writeFile(path.join(validation,'ui-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await b?.context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});


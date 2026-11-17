const {openBrowser,send,configure,readSession,waitState,stopWorker,poll}=require('../fixtures/coleta-browser.cjs');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const origin='https://www.idealista.pt',start=origin+'/geo/fixture/';
function listing(n,next){return `<section class="items-container items-list"><article class="item" data-element-id="${n}"><div class="item-info-container"><a class="item-link" href="/imovel/${n}/">Apartamento ${n}</a></div><div class="price-row"><span class="item-price">900 €</span></div></article></section>${next?`<div class="pagination"><li class="next"><a href="${start}pagina-${n+1}/">Seguinte</a></li></div>`:''}`;}
(async()=>{
 const profiles=[],cases=[],urls=[];let browser;
 async function profile(){const p=await fs.mkdtemp(path.join(os.tmpdir(),'idealista-coleta-e2e-'));profiles.push(p);return p;}
 const localities=await fs.readFile(path.join(__dirname,'../fixtures/localidades-list.html'),'utf8');
 const route=r=>{const url=r.request().url();if(!url.startsWith(origin))return r.abort();urls.push({url,at:Date.now()});
  if(url===origin+'/arrendar-casas/')return r.fulfill({contentType:'text/html; charset=utf-8',body:localities});
  const n=Number(url.match(/pagina-(\d+)/)?.[1]||1);return r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:listing(n,url.startsWith(start)&&n<4)});
 };
 try{
  const persistent=await profile();browser=await openBrowser(persistent,route);let page=await browser.page();await configure(page,{minIntervalMs:3000});
  // Congelar somente a leitura do runner após o terceiro commit real. Sem essa
  // barreira, o poll de exatamente3 depende de observar um estado transitório.
  // Não altera policy/timers/store nem reserva/envia uma quarta página.
  await page.evaluate(()=>{const send=chrome.runtime.sendMessage.bind(chrome.runtime);let held=false;chrome.runtime.sendMessage=async(message,...args)=>{const response=await send(message,...args);if(!held&&message.cmd==='COLETA_READ'&&!message.payload.full&&response?.result?.checkpoint?.confirmedPages===3){held=true;window.__checkpointBarrier=true;await new Promise(()=>{});}return response;};});
  await page.locator('#items-url').fill(start);await page.locator('#items-start').click();
  try{await poll(()=>send(page,'LIST'),l=>l[0]?.confirmed===3);}catch(error){console.error({checkpointWaitFailure:await readSession(page),urls,pageErrors:browser.errors});throw error;}
  await page.waitForFunction(()=>window.__checkpointBarrier===true);
   let saved=await readSession(page);if(saved.checkpoint.confirmedPages!==3)console.error({saved,urls});assert.equal(saved.checkpoint.confirmedPages,3);assert.equal(saved.counters.requested,3);const id=saved.id,epoch=saved.epoch,month=saved.exportContext.yearMonth;
  await stopWorker(browser.context,page,browser.extensionId);assert.equal((await send(page,'READ',{id})).checkpoint.confirmedPages,3);
  await page.close();const observer=await browser.page();assert.ok(['running','waiting'].includes((await send(observer,'LIST'))[0].state));
  assert.equal((await send(observer,'START',{mode:'links',items:[{url:origin+'/arrendar-casas/'}]})).status,'busy');
  cases.push('worker real encerrado; owner fechado com executor vivo não permite outro modo');
  const extensionId=browser.extensionId;assert.deepEqual(browser.errors,[]);await browser.context.close();browser=null;
  const before=urls.length;browser=await openBrowser(persistent,route,{extensionId});page=await browser.page();await page.waitForTimeout(1200);
  assert.equal(urls.length,before,'Reabrir não deve coletar');const sessions=await send(page,'LIST');assert.equal(sessions[0].state,'interrupted');
  await page.locator(`[data-session="${id}"]`).click();const downloaded=page.waitForEvent('download').catch(async error=>{console.error({resumeFailure:await send(page,'READ',{id}),status:await page.locator('#collection-status').textContent(),urls,errors:browser.errors});throw error;});await page.locator('#collection-resume').click();await downloaded;
  await waitState(page,'awaiting-save');saved=await readSession(page);assert.equal(saved.checkpoint.confirmedPages,4);assert.equal(saved.exportContext.yearMonth,month);assert.ok(saved.epoch>epoch);
  for(let n=1;n<=4;n++)assert.equal(urls.filter(x=>x.url===(n===1?start:start+`pagina-${n}/`)).length,1);
  for(let i=1;i<urls.length;i++)assert.ok(urls[i].at-urls[i-1].at>=2950,'Intervalo efetivo conservado');
  assert.equal(browser.downloads.length,1);assert.match(browser.downloads[0].suggestedFilename(),/^fixture-Paginas4-\d{12}\.json$/);
  const rows=JSON.parse(await fs.readFile(await browser.downloads[0].path(),'utf8'));assert.equal(rows.length,4);assert.equal(Object.keys(rows[0]).length,17);
  page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Já baixei este resultado',exact:true}).click();await waitState(page,'saved');
  cases.push('restart REAL no mesmo perfil; zero rede automática; resume página4 sem refetch1–3; download confirmado');
  await configure(page);
  const links=await browser.page('localidades.html');await links.locator('#choose').click();
  await links.evaluate(()=>{const original=FileSystemFileHandle.prototype.createWritable;FileSystemFileHandle.prototype.createWritable=function(...args){FileSystemFileHandle.prototype.createWritable=original;throw new DOMException('SECRET_WRITE_ERROR','QuotaExceededError');};});
  await links.locator('#extract-save').click();await waitState(links,'error');
  const failed=await readSession(links);assert.equal(failed.reason,'save_failed');assert.equal(failed.checkpoint.records.length,4);assert.ok(failed.saveIntent);
  assert.doesNotMatch(JSON.stringify(failed.diagnostics),/SECRET_WRITE_ERROR/);const afterFailureRequests=urls.length;
  await links.reload();await links.locator(`[data-session="${failed.id}"]`).click();
  await links.waitForFunction(()=>document.querySelector('#collection-diagnostics').textContent.includes('Sem espaço para gravar o arquivo'));
  links.on('dialog',d=>d.accept());await links.locator('#collection-save').click();await waitState(links,'saved');assert.equal(urls.length,afterFailureRequests);
  assert.equal((await readSession(links)).reason,null);cases.push('falha injetada no FileSystem real persiste diagnóstico sanitizado após reload; retry grava checkpoint sem recoleta');
  const lote=await browser.page('lote.html');await lote.locator('#choose').click();await lote.locator('#loteUrls').fill(JSON.stringify([{nome:'Local',link:origin+'/listing/'}]));await lote.locator('#loteStart').click();await waitState(lote,'saved');
  assert.equal(browser.downloads.length,1);assert.ok((await links.evaluate(()=>window.__collectionTest.activations)).every(Boolean));assert.ok((await lote.evaluate(()=>window.__collectionTest.activations)).every(Boolean));
  cases.push('Links e Lote usam mesmo runtime e writers reais com OPFS');assert.deepEqual(browser.errors,[]);await browser.context.close();browser=null;
  for(const variant of ['initial-403','initial-429','middle-200-challenge','middle-429']){
   const seen=[],status=variant.includes('429')?429:variant.includes('403')?403:200;
   browser=await openBrowser(await profile(),r=>{const u=r.request().url();if(!u.startsWith(origin))return r.abort();seen.push(u);const n=Number(u.match(/pagina-(\d+)/)?.[1]||1),blocked=variant.startsWith('initial')||n===2;
    return r.fulfill({status:blocked?status:200,headers:blocked&&status===429?{'retry-after':'120'}:{},contentType:'text/html',body:blocked?(status===429?listing(n,false):'<title>Just a moment...</title><form id="challenge-form"></form>'):listing(1,true)});
   });
   const p=await browser.page();await configure(p);await p.locator('#items-url').fill(start);await p.locator('#items-start').click();await waitState(p,status===429?'paused':'blocked');
   const s=await readSession(p);assert.equal(s.counters.requested,variant.startsWith('initial')?1:2);assert.equal(s.checkpoint.confirmedPages,variant.startsWith('initial')?0:1);assert.equal(browser.downloads.length,0);
   assert.match(await p.locator('#collection-status').textContent(),/Próxima elegibilidade/);
   const count=seen.length;await stopWorker(browser.context,p,browser.extensionId);await p.reload();assert.equal(seen.length,count);
   const state=(await send(p,'LIST'))[0];const resumed=await send(p,'RESUME',{id:state.id,epoch:state.epoch,accessConfirmed:true});assert.equal(resumed.status,'wait');assert.equal(seen.length,count);assert.deepEqual(browser.errors,[]);
   cases.push(variant+' persiste espera e não insiste');await browser.context.close();browser=null;
  }
  console.log(JSON.stringify({pass:true,proof:'MV3/IndexedDB/worker-stop/browser-restart-same-profile/OPFS',cases,urls,pageErrors:0}));
 }finally{await browser?.context.close();for(const p of profiles){assert.ok(path.resolve(p).startsWith(path.resolve(os.tmpdir())+path.sep+'idealista-coleta-e2e-'));await fs.rm(p,{recursive:true,force:true});}}
})().catch(e=>{console.error(e);process.exitCode=1;});

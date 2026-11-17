// Gate interativo: picker, confirmação e Downloads do Chromium visível.
// Não simula permissões/handles; somente respostas web são fixtures sem rede pública.
const {openBrowser,send}=require('../fixtures/coleta-browser.cjs');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),validation=path.join(root,'.sdd/specs/004-coleta-resiliente/validation');
const sha=text=>createHash('sha256').update(text).digest('hex');
(async()=>{
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'idealista-coleta-native-')),profile=path.join(temporary,'profile');
 // O seletor Windows/Chrome pode recusar AppData/Temp como diretório sensível.
 const exports=path.join(root,'.data','validacao-nativa-004',path.basename(temporary));let browser;
 const linksFolder=path.join(exports,'localidades'),loteFolder=path.join(exports,'municipios');
 await fs.mkdir(linksFolder,{recursive:true});await fs.mkdir(loteFolder,{recursive:true});
 async function banner(page,text){await page.evaluate(text=>{let box=document.querySelector('#native-instructions');if(!box){box=document.createElement('aside');box.id='native-instructions';box.style='white-space:pre-wrap;padding:16px;background:#fff7cc;border:2px solid #aa7700';document.querySelector('main').prepend(box);}box.textContent=text;},text);console.log(text);}
 async function state(page,selector,value){await page.waitForFunction(({selector,value})=>document.querySelector(selector)?.dataset.state===value,{selector,value},{timeout:900000});}
 try{
  const fixture=await fs.readFile(path.join(__dirname,'../fixtures/localidades-list.html'),'utf8');
  browser=await openBrowser(profile,r=>{const u=r.request().url();if(!u.startsWith('https://www.idealista.pt/'))return r.abort();return r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:u.includes('/arrendar-casas/')?fixture:'<section class="items-container items-list"><article class="item" data-element-id="1"><div class="item-info-container"><a class="item-link" href="/imovel/1/">Apartamento local</a></div></article></section>'});},{native:true});
  const links=await browser.page('localidades.html');
  await banner(links,`VALIDAÇÃO NATIVA LOCAL — use somente a pasta temporária:\n${linksFolder}\n1. Escolher / trocar pasta → selecione essa pasta.\n2. Extrair e salvar. As respostas web são fixtures locais.`);
  await state(links,'#status','saved');let sessions=await send(links,'LIST'),session=await send(links,'READ',{id:sessions.at(-1).id,full:true}),month=session.exportContext.yearMonth;
  const linksPath=path.join(linksFolder,month,`links_localidades_${month}.json`),before=await fs.readFile(linksPath,'utf8');assert.equal(JSON.parse(before).length,4);
  await banner(links,'3. Clique novamente em Extrair e salvar. Recuse a confirmação de substituição.');await state(links,'#status','cancelled');assert.equal(await fs.readFile(linksPath,'utf8'),before);
  await banner(links,'4. Clique em Salvar JSON coletado e aceite a substituição.');await state(links,'#status','saved');assert.equal(await fs.readFile(linksPath,'utf8'),before);
  const gestures=await links.evaluate(()=>window.__nativeGestures);
  const lote=await browser.page('lote.html');await lote.locator('#loteUrls').fill(JSON.stringify([{nome:'Municipio',link:'https://www.idealista.pt/native-listing/'}]));
  await banner(lote,`5. Escolha a pasta temporária abaixo e clique em Iniciar lote:\n${loteFolder}`);await state(lote,'#loteLog','complete');
  sessions=await send(lote,'LIST');session=await send(lote,'READ',{id:sessions.at(-1).id,full:true});
  const lotePath=path.join(loteFolder,session.exportContext.yearMonth,'Municipio-Paginas1.json'),loteData=await fs.readFile(lotePath,'utf8');assert.equal(JSON.parse(loteData).length,1);assert.equal(Object.keys(JSON.parse(loteData)[0]).length,17);assert.equal(browser.downloads.length,0);
  gestures.push(...await lote.evaluate(()=>window.__nativeGestures));
  const itens=await browser.page();await itens.locator('#items-url').fill('https://www.idealista.pt/geo/native-listing/');
  await banner(itens,'6. Clique em Iniciar coleta. O resultado será baixado. Depois a página será reaberta para testar o resultado desconhecido.');
  const download=await itens.waitForEvent('download',{timeout:900000});await state(itens,'#collection-panel','awaiting-save');
  const downloadPath=path.join(exports,download.suggestedFilename());await download.saveAs(downloadPath);assert.equal(JSON.parse(await fs.readFile(downloadPath,'utf8')).length,1);gestures.push(...await itens.evaluate(()=>window.__nativeGestures));
  await itens.reload();await banner(itens,`7. Confira o arquivo:\n${downloadPath}\nSelecione a sessão e clique em Conferir gravação anterior. Aguarde o próximo banner antes de confirmar o download.`);
  await itens.waitForFunction(()=>['save-unknown','saved'].includes(document.querySelector('#collection-panel')?.dataset.state),null,{timeout:900000});
  assert.equal(await itens.locator('#collection-panel').getAttribute('data-state'),'save-unknown','O roteiro precisa observar Conferir gravação anterior antes da confirmação humana.');assert.equal(browser.downloads.length,1);
  await banner(itens,'8. Gravação desconhecida verificada, sem novo download. Agora clique em Já baixei este resultado e aceite a confirmação.');
  await state(itens,'#collection-panel','saved');assert.equal(browser.downloads.length,1);assert.deepEqual(browser.errors,[]);assert.ok(gestures.length>=3&&gestures.every(g=>g.trusted&&g.active));
  const evidence={pass:true,proof:'headed-Chromium/native-picker/native-confirm/real-files/download-human-confirmation',exports,files:[{path:linksPath,sha256:sha(before)},{path:lotePath,sha256:sha(loteData)},{path:downloadPath,sha256:sha(await fs.readFile(downloadPath,'utf8'))}],gestures,downloads:1,pageErrors:0,reauthorization:'Handlers de gesto inalterados; evidências nativas002/003 preservadas, gestos simulados adicionais no E2E004.'};
  await fs.writeFile(path.join(validation,'native-result.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
 }finally{await browser?.context.close();assert.ok(path.resolve(profile).startsWith(path.resolve(temporary)+path.sep));await fs.rm(profile,{recursive:true,force:true});console.log('Arquivos de validação preservados em: '+exports);}
})().catch(e=>{console.error(e);process.exitCode=1;});

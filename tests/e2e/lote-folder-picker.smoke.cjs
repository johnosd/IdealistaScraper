// 006 (pedido do usuário): sem pasta de anúncios, "Configurar pasta" escolhe a pasta no próprio painel
// (seletor do sistema simulado com OPFS no perfil temporário), sem abrir Configurações nem outra tela.
const {openBrowser}=require('../fixtures/coleta-browser.cjs'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista006-folder-'));let b;
 try{
  b=await openBrowser(profile,r=>r.abort());
  const p=await b.context.newPage();await p.goto(b.base+'sidepanel.html');
  await p.locator('#primary-action').filter({hasText:'Configurar pasta'}).waitFor();
  assert.match(await p.locator('#ready-destination').textContent(),/Nenhuma pasta autorizada/);
  await p.locator('#primary-action').click();
  await p.waitForFunction(()=>/Pasta de anúncios: exported\. Agora clique em Iniciar coleta\./.test(document.querySelector('#feedback').textContent));
  assert.equal(new URL(p.url()).pathname,'/sidepanel.html','continua no painel');
  await p.waitForFunction(()=>/exported/.test(document.querySelector('#ready-destination').textContent));
  assert.notEqual(await p.locator('#primary-action').textContent(),'Configurar pasta');
  assert.equal(await p.evaluate(()=>window.__collectionTest.activations.every(Boolean)),true,'seletor chamado com gesto do usuário');
  const extensionPages=b.context.pages().map(page=>page.url()).filter(u=>u.startsWith(b.base)).map(u=>new URL(u).pathname);
  assert.equal(extensionPages.some(x=>['/configuracoes.html','/localidades.html','/lote.html'].includes(x)),false,'nenhuma outra tela aberta');
  assert.deepEqual(b.errors,[]);
  console.log(JSON.stringify({pass:true,proof:'real extension side panel; native picker simulated with OPFS in a temporary profile',cases:['missing folder: Configurar pasta','picker opens in the panel','folder saved and shown','no settings/export screen']}));
 }finally{await b?.context.close();const resolved=path.resolve(profile);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'idealista006-folder-'));await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
})().catch(error=>{console.error(error);process.exitCode=1;});

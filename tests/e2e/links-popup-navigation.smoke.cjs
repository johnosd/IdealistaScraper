// Legacy Links entry must collect too; only explicit export may open localidades.html.
const {openBrowser,poll}=require('../fixtures/coleta-browser.cjs');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista005-links-popup-'));let b,requests=0,release;
 const gate=new Promise(resolve=>release=resolve);
 try{
  const fixture=await fs.readFile(path.resolve(__dirname,'../fixtures/localidades-list.html'),'utf8');
  b=await openBrowser(profile,async route=>{if(!route.request().url().startsWith('https://www.idealista.pt/arrendar-casas/'))return route.abort();requests++;await gate;return route.fulfill({contentType:'text/html; charset=utf-8',body:fixture});});
  const p=await b.context.newPage();await p.goto(b.base+'popup.html');
  const opened=b.context.waitForEvent('page');await p.locator('#extract').click();const next=await opened;
  await poll(()=>Promise.resolve(next.url()),url=>url!=='about:blank');
  assert.notEqual(new URL(next.url()).pathname,'/localidades.html','Collect in the legacy Links tab must not open the export screen from the screenshot');
  await poll(()=>Promise.resolve(requests),n=>n===1);
  const active=await p.evaluate(async()=>(await chrome.tabs.query({active:true,currentWindow:true}))[0]);assert.ok(String(active.pendingUrl||active.url).startsWith('https://www.idealista.pt/arrendar-casas/'));
  assert.equal(b.context.pages().some(page=>['/localidades.html','/configuracoes.html'].includes(new URL(page.url()).pathname)),false);
  release();await poll(()=>p.evaluate(async()=>(await chrome.runtime.sendMessage({cmd:'AUTONOMA_LINKS_READ'})).result),v=>v.state==='collected'&&v.total===4);
  assert.equal(requests,1);assert.equal(b.downloads.length,0);assert.deepEqual(b.errors,[]);
  console.log(JSON.stringify({pass:true,proof:'legacy popup, real extension, local site fixture',requests,cases:['collect opens Idealista foreground','no export or settings page','four records','no automatic download']}));
 }finally{release();await b?.context.close();const resolved=path.resolve(profile);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'idealista005-links-popup-'));await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
})().catch(error=>{console.error(error);process.exitCode=1;});

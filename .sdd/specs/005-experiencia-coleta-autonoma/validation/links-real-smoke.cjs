// Explicit opt-in, one collection page, one attempt, no recursion or secret output.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'../../../..');
(async()=>{
 if(!process.argv.includes('--real'))throw Error('Explicit opt-in required');process.loadEnvFile(path.join(root,'.env'));
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista005-links-real-'));let context,stage='launch';
 try{
  context=await chromium.launchPersistentContext(profile,{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging','--disable-background-networking']});
  // As in the offline harness, attach DevTools before an extension-owned tab navigates.
  // Otherwise Playwright can attach its auth machinery in the middle of the proxy challenge.
  await context.exposeBinding('__linksRealAttached',async({page},tabId)=>{await page.waitForFunction(async id=>(await chrome.tabs.get(id)).url==='about:blank',tabId);const target=context.pages().filter(p=>p.url()==='about:blank').at(-1);if(target)await target.waitForLoadState('domcontentloaded');});
  await context.addInitScript(()=>{if(location.protocol!=='chrome-extension:')return;const create=chrome.tabs.create;chrome.tabs.create=async options=>{const tab=await create(options);if(options.url==='about:blank')await window.__linksRealAttached(tab.id);return tab;};});
  if(!process.argv.includes('--no-routing'))await context.route('**/*',r=>{const u=new URL(r.request().url());return u.protocol==='chrome-extension:'||u.hostname==='idealista.pt'||u.hostname.endsWith('.idealista.pt')?r.continue():r.abort();});
  const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root}),p=await context.newPage();await p.goto('chrome-extension://'+id+'/sidepanel.html');
  const rpc=(cmd,payload={})=>p.evaluate(message=>chrome.runtime.sendMessage(message),{cmd,payload});
  stage='configure';const view=(await rpc('AUTONOMA_GET_SETTINGS')).result;
  const saved=(await rpc('AUTONOMA_SAVE_SETTINGS',{expectedRevision:view.revision,values:{...view,useProxy:true,ipEnabled:false,limits:{...view.limits,maxAttempts:1,maxPagesPerRun:1,requestTimeoutMs:15000},proxy:{host:process.env.PROXY_CHEAP_IP,port:process.env.PROXY_CHEAP_PORT,user:process.env.PROXY_CHEAP_USER,password:process.env.PROXY_CHEAP_PASS}}})).result;if(saved.status!=='saved')throw Error('Not saved');
  const worker=context.serviceWorkers()[0];await worker.evaluate(()=>{globalThis.__linksAuth={httpStatuses:[],networkErrors:[]};chrome.webRequest.onHeadersReceived.addListener(d=>{if(d.type==='main_frame')__linksAuth.httpStatuses.push(d.statusCode);},{urls:['https://*.idealista.pt/*']});chrome.webRequest.onErrorOccurred.addListener(d=>{if(d.type==='main_frame')__linksAuth.networkErrors.push(String(d.error).match(/net::ERR_[A-Z_]+/)?.[0]||'unknown');},{urls:['https://*.idealista.pt/*']});});
  stage='collect';await p.getByRole('tab',{name:'Links',exact:true}).click();await p.locator('#tool-links-open').click();let result;
  const deadline=Date.now()+40000;while(Date.now()<deadline){result=(await rpc('AUTONOMA_LINKS_READ')).result;if(result&&['collected','paused','interrupted','error'].includes(result.state))break;await p.waitForTimeout(250);}
  await p.waitForTimeout(2000);
  const proxyStatus=await rpc('PROXY_STATUS'),auth=await worker.evaluate(()=>__linksAuth),diagnostics=result?.id?await p.evaluate(async id=>{const r=indexedDB.open('idealista-coleta-v1',1);await new Promise(resolve=>r.onsuccess=resolve);const db=r.result,s=await new Promise(resolve=>{const q=db.transaction('records').objectStore('records').get('session:'+id);q.onsuccess=()=>resolve(q.result);});db.close();return {requested:s.counters.requested,confirmed:s.counters.confirmed,events:s.events.map(e=>({code:e.code,status:e.status||null,reason:e.reason||null}))};},result.id):null;
  const evidence={realNetwork:true,browser:context.browser().version(),routing:!process.argv.includes('--no-routing'),singlePage:true,maxAttempts:1,proxyConfigured:true,proxyApplied:proxyStatus.enabled,proxyMatchesSaved:proxyStatus.matchesSaved,auth,diagnostics,state:result?.state||'unknown',reason:result?.reason||null,localityCount:result?.total||0,success:result?.state==='collected'&&result.total>0};
  await fs.writeFile(path.join(__dirname,process.argv.includes('--no-routing')?'links-real-no-routing-result.json':'links-real-result.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));if(!evidence.success)process.exitCode=1;
 }catch{console.log(JSON.stringify({status:'failed',stage,secretsRedacted:true}));process.exitCode=1;}
 finally{await context?.close();const resolved=path.resolve(profile);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'idealista005-links-real-'))throw Error('Unexpected profile');await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
})().catch(()=>{console.log(JSON.stringify({status:'failed',secretsRedacted:true}));process.exitCode=1;});

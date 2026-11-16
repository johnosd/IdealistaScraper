// Opt-in bounded real test. Never print fields, credentials, or IPs; no screenshots.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'../../../..');
(async()=>{
 if(!process.argv.includes('--real'))throw Error('Real opt-in required');process.loadEnvFile(path.join(root,'.env'));
 const config={host:process.env.PROXY_CHEAP_IP,port:process.env.PROXY_CHEAP_PORT,user:process.env.PROXY_CHEAP_USER,password:process.env.PROXY_CHEAP_PASS};if(Object.values(config).some(v=>!v))throw Error('Env incomplete');
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista005-feedback-real-'));let context,stage='launch';
 try{
  context=await chromium.launchPersistentContext(profile,{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging','--disable-background-networking']});
  let unexpectedRequests=0;await context.route('**/*',r=>{const url=r.request().url();if(url.startsWith('chrome-extension:')||url.startsWith('https://api.ipify.org/'))return r.continue();unexpectedRequests++;return r.abort();});
  const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root}),p=await context.newPage();await p.setViewportSize({width:360,height:720});await p.goto('chrome-extension://'+id+'/configuracoes.html');p.setDefaultTimeout(10000);await p.waitForFunction(()=>document.querySelector('#minIntervalMs')?.value==='10');
  const send=cmd=>p.evaluate(cmd=>chrome.runtime.sendMessage({cmd}),cmd);stage='baseline';const direct=(await send('AUTONOMA_TEST_IP')).result;
  stage='fill';await p.locator('#connection').selectOption('proxy');for(const [key,value]of Object.entries(config))await p.locator('#'+key).fill(value);
  stage='save and test';await p.locator('#save-test-connection').click();await p.waitForFunction(()=>document.querySelector('#connection-feedback').dataset.state==='success');
  const proxyStatus=await send('PROXY_STATUS'),proxyIP=await p.locator('#connection-feedback-detail').textContent();
  const visible=await p.locator('#connection-feedback').evaluate(el=>{const box=el.getBoundingClientRect();return box.top>=0&&box.bottom<=innerHeight;});
  const proxyConfirmed=(await p.locator('#connection-feedback-title').textContent())==='Proxy conectado';
  stage='restore system';await p.locator('#connection').selectOption('direct');await p.locator('#save-test-connection').click();await p.waitForFunction(()=>document.querySelector('#connection-feedback-title').textContent==='Conexão do sistema confirmada');
  const final=await send('PROXY_STATUS'),finalDetail=await p.locator('#connection-feedback-detail').textContent();
  const result={realNetwork:true,browser:context.browser().version(),oneClickProxyConfirmed:proxyConfirmed,applied:proxyStatus.enabled,matchesSaved:proxyStatus.matchesSaved,ipChanged:!!direct.ip&&!proxyIP.includes(direct.ip),resultVisible:visible,passwordCleared:await p.locator('#password').inputValue()==='',directRestored:!final.enabled&&final.matchesSaved&&!!direct.ip&&finalDetail.includes(direct.ip),unexpectedRequests};
  await fs.writeFile(path.join(__dirname,'proxy-feedback-real-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.oneClickProxyConfirmed||!result.ipChanged||!result.resultVisible||!result.directRestored)process.exitCode=1;
 }catch{console.log(JSON.stringify({status:'failed',stage,secretsRedacted:true}));process.exitCode=1;}
 finally{await context?.close();const resolved=path.resolve(profile);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'idealista005-feedback-real-'))throw Error('Unexpected profile');await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
})().catch(()=>{console.log(JSON.stringify({status:'failed',secretsRedacted:true}));process.exitCode=1;});

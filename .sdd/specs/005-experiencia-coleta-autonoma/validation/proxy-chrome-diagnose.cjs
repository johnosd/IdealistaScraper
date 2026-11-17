// Explicit opt-in; only api.ipify.org is contacted. Never print credentials or IP addresses.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const root=path.resolve(__dirname,'../../../..'),validation=__dirname;
(async()=>{
 if(!process.argv.includes('--real'))throw Error('real opt-in required');
 process.loadEnvFile(path.join(root,'.env'));
 const config={host:process.env.PROXY_CHEAP_IP.trim(),port:Number(process.env.PROXY_CHEAP_PORT),username:process.env.PROXY_CHEAP_USER,password:process.env.PROXY_CHEAP_PASS};
 if(!config.host||!config.port||!config.username||!config.password)throw Error('env incomplete');
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista005-proxy-real-'));let context,stage='launch';
 try{
 context=await chromium.launchPersistentContext(profile,{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging','--disable-background-networking']});
 const unexpected=[];await context.route('**/*',r=>{const u=r.request().url();if(u.startsWith('chrome-extension:')||u.startsWith('https://api.ipify.org/'))return r.continue();unexpected.push(new URL(u).origin);return r.abort();});
 const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root});
 const p=await context.newPage();await p.goto('chrome-extension://'+id+'/configuracoes.html');p.setDefaultTimeout(10000);await p.waitForFunction(()=>document.querySelector('#minIntervalMs')?.value==='10');
 const send=(cmd,payload)=>p.evaluate(async({cmd,payload})=>chrome.runtime.sendMessage({cmd,payload}),{cmd,payload});
 const probe=()=>send('AUTONOMA_TEST_IP',{});
 stage='direct probe';const direct=(await probe()).result;
 const v=(await send('AUTONOMA_GET_SETTINGS',{})).result;
 stage='save';const saved=(await send('AUTONOMA_SAVE_SETTINGS',{expectedRevision:v.revision,values:{...v,useProxy:true,proxy:{host:config.host,port:String(config.port),user:config.username,password:config.password}}})).result;
 const before=await send('PROXY_STATUS');const observedBefore=(await probe()).result;
 stage='apply saved';let enabled;
 if(process.argv.includes('--after-fix')){await p.reload();await p.waitForFunction(()=>document.querySelector('#connection')?.value==='proxy');await p.locator('#connection-options summary').click();await p.locator('#apply-connection').click();await p.waitForFunction(()=>document.querySelector('#proxy-status').textContent.includes('Proxy salvo aplicado'));enabled={ok:true};}
 else enabled=await p.evaluate(async config=>chrome.runtime.sendMessage({cmd:'ENABLE_PROXY',...config}),config);
 const actual=await send('PROXY_STATUS');stage='proxy probe';const proxied=(await probe()).result;
 const result={realNetwork:true,browser:context.browser().version(),saved:saved.status,beforeApply:{enabled:before.enabled,verified:observedBefore.status==='verified',stillDirect:direct.ip&&observedBefore.ip?direct.ip===observedBefore.ip:null},explicitApply:{ok:enabled.ok,enabled:actual.enabled,verified:proxied.status==='verified',ipChanged:direct.ip&&proxied.ip?direct.ip!==proxied.ip:null},unexpectedRequests:unexpected.length};
 if(process.argv.includes('--after-fix')){
  stage='restore direct';await p.locator('#connection').selectOption('direct');await p.locator('#settings-save').click();await p.waitForFunction(()=>document.querySelector('#settings-status').textContent.includes('Configurações salvas'));await p.locator('#apply-connection').click();await p.waitForFunction(()=>document.querySelector('#proxy-status').textContent.includes('Conexão do sistema ativa'));
  const final=await send('PROXY_STATUS'),directAgain=(await probe()).result;result.directRestored={enabled:final.enabled,matchesSaved:final.matchesSaved,verified:directAgain.status==='verified',sameDirectIP:direct.ip&&directAgain.ip?direct.ip===directAgain.ip:null};
 }
 await fs.writeFile(path.join(validation,process.argv.includes('--after-fix')?'proxy-chrome-after-fix.json':'proxy-chrome-before-fix.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 if(!result.explicitApply.ok||!result.explicitApply.verified||result.explicitApply.ipChanged!==true||result.directRestored?.enabled===true)process.exitCode=1;
 }catch{console.log(JSON.stringify({status:'failed',stage,secretsRedacted:true}));process.exitCode=1;}
 finally{await context?.close();const resolved=path.resolve(profile);if(!resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'idealista005-proxy-real-'))throw Error('Unexpected temp profile');await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
})().catch(()=>{console.log(JSON.stringify({status:'failed',secretsRedacted:true}));process.exitCode=1;});


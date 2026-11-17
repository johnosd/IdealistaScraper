// Native Windows picker through UI Automation; no FSA/permission/handle mocking.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {poll}=require('../fixtures/coleta-browser.cjs');
const root=path.resolve(__dirname,'../..'),validation=path.join(root,'.sdd/specs/005-experiencia-coleta-autonoma/validation');
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista005-fs-')),destination=path.join(os.homedir(),'Documents','Idealista005-native-validation-'+Date.now());await fs.mkdir(destination);
 let context;
 try{
 context=await chromium.launchPersistentContext(profile,{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:false,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging','--disable-background-networking','--host-resolver-rules=MAP * ~NOTFOUND']});
 const errors=[],calls=[];context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await context.route('https://**/*',r=>{const u=r.request().url();if(!u.startsWith('https://www.idealista.pt/'))return r.abort();calls.push(u);return r.fulfill({contentType:'text/html',body:u.endsWith('/fs-source/')?'<div class="breadcrumb-dropdown-element highlighted"><ul class="breadcrumb-dropdown-subitem-list"><li><a href="/fs-A/">Municipio</a></li></ul></div>':'<section class="items-container items-list"><article class="item" data-element-id="FS1"><div class="item-info-container"><a class="item-link" href="/imovel/FS1/">Casa de teste</a></div></article></section>'});});
 await context.route('http://**/*',r=>r.abort());
 const cdp=await context.browser().newBrowserCDPSession(),{id}=await cdp.send('Extensions.loadUnpacked',{path:root}),base='chrome-extension://'+id+'/';
 const p=await context.newPage();await p.goto(base+'configuracoes.html');p.setDefaultTimeout(15000);await p.waitForFunction(()=>document.querySelector('#minIntervalMs')?.value==='10');
 if(process.argv.includes('--manual')){console.log('Selecione somente a pasta temporária: '+destination);p.setDefaultTimeout(300000);await p.locator('#choose-ads').click();}
 else{
 const helper=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(validation,'native-picker.ps1'),'-Profile',profile,'-Destination',destination],{windowsHide:true});let output='';helper.stdout.on('data',b=>output+=b);helper.stderr.on('data',b=>output+=b);const helperDone=new Promise(resolve=>helper.once('exit',code=>resolve(code)));
 await p.locator('#choose-ads').click();const code=await helperDone;if(code!==0)throw Error('Picker helper: '+output);
 }
 await p.waitForFunction(()=>document.querySelector('#ads-destination').textContent.includes('acesso permitido'));
 await p.reload();await p.waitForFunction(()=>document.querySelector('#ads-destination').textContent.includes('acesso permitido'));
 const sourceTab=await p.evaluate(async()=>{const t=await chrome.tabs.create({url:'about:blank',active:false});await chrome.tabs.update(t.id,{url:'https://www.idealista.pt/fs-source/'});return t.id;});await poll(()=>p.evaluate(id=>chrome.tabs.get(id),sourceTab),t=>t.status==='complete');
 const r=await p.evaluate(async tabId=>(await chrome.runtime.sendMessage({cmd:'AUTONOMA_START',payload:{commandId:crypto.randomUUID(),source:{tabId}}})).result,sourceTab);assert.equal(r.status,'accepted');
 const run=await poll(()=>p.evaluate(async id=>(await chrome.runtime.sendMessage({cmd:'AUTONOMA_READ',payload:{id}})).result,r.id),v=>['completed','paused','interrupted'].includes(v.state));assert.equal(run.state,'completed');
 const filename=path.join(destination,run.items[0].receipt.relativePath),records=JSON.parse(await fs.readFile(filename,'utf8'));assert.equal(records.length,1);assert.deepEqual(errors,[]);
 const result={pass:true,proof:'installed Chrome/native Windows directory picker/UIA/native FileSystemDirectoryHandle/external real write/reuse after reload',version:context.browser().version(),destination,filename,records:records.length,requests:calls.length,pageErrors:0,remaining:['native refusal and permission reauthorization/save-only']};
 await fs.writeFile(path.join(validation,'native-filesystem-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await context?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});


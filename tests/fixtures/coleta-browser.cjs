const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path');
async function openBrowser(profile,route,{extensionId,native=false}={}){
 const extensionPath=path.resolve(__dirname,'../..');
 const context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:!native,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging',`--load-extension=${extensionPath}`,'--host-resolver-rules=MAP * ~NOTFOUND','--disable-background-networking']});
 const errors=[],downloads=[];
 context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('download',d=>downloads.push(d));if(native)p.on('dialog',dialog=>{console.log('Diálogo nativo aguardando a ação do usuário: '+dialog.type());});});
 await context.route('https://**/*',route);await context.route('http://**/*',r=>r.abort());
 await context.exposeBinding('__collectionAttached',async({page},tabId)=>{
  await page.waitForFunction(async id=>(await chrome.tabs.get(id)).url==='about:blank',tabId);
  assert.ok(context.pages().some(p=>p.url()==='about:blank'));
 });
 await context.addInitScript(native=>{
  if(location.protocol!=='chrome-extension:')return;
  const create=chrome.tabs.create;
  chrome.tabs.create=async options=>{const tab=await create(options);if(options.url==='about:blank')await window.__collectionAttached(tab.id);return tab;};
  if(native){window.__nativeGestures=[];document.addEventListener('click',event=>{if(['choose','reauthorize','items-start','loteStart'].includes(event.target.id))window.__nativeGestures.push({id:event.target.id,trusted:event.isTrusted,active:navigator.userActivation.isActive});},true);return;}
  const state=window.__collectionTest={permission:'granted',activations:[]};
  FileSystemHandle.prototype.queryPermission=async()=>state.permission;
  FileSystemHandle.prototype.requestPermission=async()=>{state.activations.push(navigator.userActivation.isActive);return state.permission='granted';};
  window.showDirectoryPicker=async()=>{state.activations.push(navigator.userActivation.isActive);return (await navigator.storage.getDirectory()).getDirectoryHandle('exported',{create:true});};
 },native);
 if(!extensionId){const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');extensionId=new URL(worker.url()).hostname;}
 const base=`chrome-extension://${extensionId}/`;
 async function page(name='itens.html'){const p=await context.newPage();await p.goto(base+name);await p.locator('#collection-panel').waitFor();return p;}
 return {context,extensionId,base,page,errors,downloads};
}
const send=(page,action,payload={})=>page.evaluate(async({action,payload})=>{
 const r=await chrome.runtime.sendMessage({cmd:'COLETA_'+action,payload});if(!r.ok)throw Error(r.message);return r.result;
},{action,payload});
async function configure(page,limits={}){const p=await send(page,'GET_POLICY');await send(page,'SET_POLICY',{limits:{...p.limits,minIntervalMs:1000,maxPagesPerWindow:1000,...limits},ipEnabled:false});}
async function readSession(page){const sessions=await send(page,'LIST');return sessions.length?send(page,'READ',{id:sessions.at(-1).id,full:true}):null;}
async function waitState(page,state){try{await page.waitForFunction(expected=>document.querySelector('#collection-panel')?.dataset.state===expected,state,{timeout:20000});}catch(error){console.error({status:await page.locator('#collection-status').textContent(),session:await readSession(page)});throw error;}}
async function poll(read,predicate,{timeout=25000}={}){const deadline=Date.now()+timeout;for(;;){const value=await read();if(predicate(value))return value;if(Date.now()>=deadline)throw Error('State predicate timed out');await new Promise(resolve=>setTimeout(resolve,50));}}
async function stopWorker(context,page,extensionId){
 const cdp=await context.newCDPSession(page);let version;
 cdp.on('ServiceWorker.workerVersionUpdated',({versions})=>{version=versions.find(v=>v.scriptURL?.startsWith(`chrome-extension://${extensionId}/`)&&v.runningStatus==='running')||version;});
 await cdp.send('ServiceWorker.enable');
 for(let i=0;!version&&i<30;i++)await page.waitForTimeout(50);assert.ok(version,'Worker version must exist');
 const stopped=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Worker stop timed out')),10000);cdp.on('ServiceWorker.workerVersionUpdated',({versions})=>{if(versions.some(v=>v.versionId===version.versionId&&v.runningStatus==='stopped')){clearTimeout(timer);resolve();}});});
 await cdp.send('ServiceWorker.stopWorker',{versionId:version.versionId});await stopped;await cdp.detach();
}
module.exports={openBrowser,send,configure,readSession,waitState,stopWorker,poll};

const test=require('node:test'),assert=require('node:assert/strict');
const {MemoryCollectionStore}=require('../fixtures/coleta-store.cjs');
const {createSettingsRepository}=require('../../src/coleta-settings-repository');
const {createCollectionSettings}=require('../../src/coleta-settings');
const {DEFAULT_POLICY}=require('../../src/coleta-policy');
function setup(){const store=new MemoryCollectionStore(),legacy={proxyHost:'proxy.invalid',proxyPort:'8080',proxyUser:'user',proxyPass:'private-secret',usarProxy:'false'};const storage={async get(){return structuredClone(legacy);},async set(v){Object.assign(legacy,v);}};const repository=createSettingsRepository({store,storage}),settings=createCollectionSettings({repository});return {store,legacy,storage,repository,settings};}
const values={limits:{...DEFAULT_POLICY,minIntervalMs:12000},useProxy:false,ipEnabled:true};

test('senha salva só é revelada por leitura explícita com revisão atual',async()=>{
 const f=setup();const view=await f.settings.load();assert.equal(JSON.stringify(view).includes('private-secret'),false);
 assert.deepEqual(await f.settings.revealPassword({expectedRevision:view.revision}),{status:'revealed',password:'private-secret'});
 assert.equal((await f.settings.save({expectedRevision:view.revision,values:{...values,proxy:{password:'replacement-secret'}}})).status,'saved');
 assert.deepEqual(await f.settings.revealPassword({expectedRevision:view.revision}),{status:'conflict'});
 assert.deepEqual(await f.settings.revealPassword({expectedRevision:view.revision+1}),{status:'revealed',password:'replacement-secret'});
});

test('comando de revelar senha aceita apenas Configurações no documento principal',async()=>{
 const {runtimeFixture}=require('../fixtures/coleta-runtime.cjs'),{installAutonomousBackground}=require('../../src/coleta-autonoma-background');const f=runtimeFixture();f.local.proxyPass='private-secret';
 const repository=createSettingsRepository({store:f.store,storage:f.api.storage.local}),settings=createCollectionSettings({repository});installAutonomousBackground(f.api,{runtime:f.runtime,proxy:f.proxy,settings});
 const view=await settings.load(),message={cmd:'AUTONOMA_REVEAL_PROXY_PASSWORD',payload:{expectedRevision:view.revision}},sender={id:'fixture',url:f.api.runtime.getURL('configuracoes.html'),frameId:0};
 const send=s=>new Promise(resolve=>f.api.runtime.onMessage.listeners.at(-1)(message,s,resolve));
 for(const invalid of [{...sender,url:f.api.runtime.getURL('sidepanel.html')},{...sender,url:'https://www.idealista.pt/a/'},{...sender,frameId:1},{...sender,id:'other'}]){const r=await send(invalid);assert.equal(r.ok,false);assert.equal(JSON.stringify(r).includes('private-secret'),false);}
 const revealed=await send(sender);assert.equal(revealed.ok,true);assert.equal(revealed.result.password,'private-secret');
});

test('interface antiga SET_POLICY usa autoridade canônica e não burla coleta ativa',async()=>{
 const {runtimeFixture}=require('../fixtures/coleta-runtime.cjs');const f=runtimeFixture(),repository=createSettingsRepository({store:f.store,storage:f.api.storage.local}),settings=createCollectionSettings({repository});
 f.runtime.setSettings(settings);await settings.load();
 await f.store.transact(['domain:idealista.pt'],()=>({writes:{'domain:idealista.pt':{active:'writing'}}}));
 const r=await f.send('SET_POLICY',{limits:{...DEFAULT_POLICY,minIntervalMs:20000},ipEnabled:true});assert.equal(r.ok,false);assert.equal((await settings.load()).revision,1);
});
test('settings rejeita remetente do site e nunca entrega senha ao painel',async()=>{
 const {runtimeFixture}=require('../fixtures/coleta-runtime.cjs'),{installAutonomousBackground}=require('../../src/coleta-autonoma-background');const f=runtimeFixture(),repository=createSettingsRepository({store:f.store,storage:f.api.storage.local}),settings=createCollectionSettings({repository});f.local.proxyPass='private-secret';
 installAutonomousBackground(f.api,{runtime:f.runtime,proxy:f.proxy,settings});
 const send=(sender)=>new Promise(resolve=>f.api.runtime.onMessage.listeners.at(-1)({cmd:'AUTONOMA_GET_SETTINGS'},sender,resolve));
 assert.equal((await send({id:'fixture',url:'https://www.idealista.pt/a/',tab:{id:9},frameId:0})).ok,false);
 const r=await send({id:'fixture',url:f.api.runtime.getURL('configuracoes.html'),documentId:'settings'});assert.equal(r.ok,true);assert.equal(r.result.proxy.passwordConfigured,true);assert.equal(JSON.stringify(r).includes('private-secret'),false);
});

test('duas importações legadas preservam credencial/política e convergem na mesma revisão',async()=>{const f=setup();const [a,b]=await Promise.all([f.repository.load(),f.repository.load()]);assert.deepEqual(a,b);assert.equal(a.revision,1);assert.equal(a.proxy.password,'private-secret');assert.equal(JSON.stringify(await f.settings.load()).includes('private-secret'),false);});
test('CAS transacional aceita uma tela e conserva rascunho da outra',async()=>{const f=setup();await f.settings.load();const results=await Promise.all([f.settings.save({expectedRevision:1,values}),f.settings.save({expectedRevision:1,values:{...values,ipEnabled:false}})]);assert.deepEqual(results.map(r=>r.status).sort(),['conflict','saved']);assert.equal((await f.settings.load()).revision,2);});
test('falha de commit reverte política e configuração; projeção não é autoridade',async()=>{const f=setup();await f.settings.load();f.store.failNextCommit=true;assert.equal((await f.settings.save({expectedRevision:1,values})).status,'error');assert.equal((await f.settings.load()).revision,1);assert.equal((await f.store.read(['policy'])).policy.minIntervalMs,10000);f.storage.set=async()=>{throw Error('local projection');};assert.equal((await f.settings.save({expectedRevision:1,values})).status,'saved');assert.equal((await f.settings.load()).limits.minIntervalMs,12000);assert.equal((await f.repository.load()).proxy.password,'private-secret');});
test('bloqueio transacional cobre descoberta/gravação mesmo com precheck defasado',async()=>{const f=setup();await f.settings.load();await f.store.transact(['domain:idealista.pt'],()=>({writes:{'domain:idealista.pt':{active:'run'}}}));assert.equal((await f.settings.save({expectedRevision:1,values})).status,'busy');assert.equal((await f.settings.load()).revision,1);});
test('proxy inválido não inclui valores ou senha no erro; valores ausentes conservam segredo',async()=>{const f=setup();await f.settings.load();const invalid=await f.settings.save({expectedRevision:1,values:{...values,useProxy:true,proxy:{host:'https://bad/private-secret',port:'0',password:'private-secret'}}});assert.equal(invalid.status,'invalid');assert.equal(JSON.stringify(invalid).includes('private-secret'),false);assert.equal((await f.settings.save({expectedRevision:1,values:{...values,proxy:{password:''}}})).status,'saved');assert.equal(f.legacy.proxyPass,'private-secret');assert.equal(f.legacy.collectionIpEnabled,true);});


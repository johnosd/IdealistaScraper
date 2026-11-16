const test=require('node:test'),assert=require('node:assert/strict');
const {runtimeFixture}=require('../fixtures/coleta-runtime.cjs');
const {installAutonomousBackground}=require('../../src/coleta-autonoma-background');
test('pausa pública só libera comandos depois de FINISHED do runner',async()=>{
 const f=setup();f.session.collectionRunId='browser';await f.runtime.coordinator.reserveLaunch({id:'settle',commandId:'settle-command',owner:'launch',source:{tabId:9,url:'https://www.idealista.pt/a/'},runId:'browser',startedAt:new Date().toISOString(),exportContext:{yearMonth:'202611'}});
 const bound=await f.runtime.coordinator.bindOwner({id:'settle',owner:'launch',epoch:1,newOwner:'8',runId:'browser'});
 await f.runtime.coordinator.control({id:'settle',owner:'8',epoch:bound.epoch,action:'pause'});
 f.tabs.set(8,{id:8,url:f.api.runtime.getURL('runner.html')});f.session['autonomous:settle']={id:'settle',tabId:8,token:'settle-token',runId:'browser'};
 assert.equal((await f.send('READ',{id:'settle'})).result.state,'pausing');
 const done=await f.send('FINISHED',{id:'settle',token:'settle-token'},{id:'fixture',url:f.api.runtime.getURL('runner.html'),tab:{id:8},documentId:'settle-document',frameId:0});assert.equal(done.ok,true);assert.equal((await f.send('READ',{id:'settle'})).result.state,'paused');
});

test('retomada troca a identidade de documento antes de autenticar novo runner',async()=>{
 const f=setup();f.session.collectionRunId='browser';
 await f.runtime.coordinator.reserveLaunch({id:'r',commandId:'gesture',owner:'8',source:{tabId:9,url:'https://www.idealista.pt/a/'},runId:'browser',startedAt:new Date().toISOString(),exportContext:{yearMonth:'202611'}});
 await f.runtime.coordinator.control({id:'r',owner:'8',epoch:1,action:'pause'});
 await f.store.transact(['session:r'],rows=>{rows['session:r'].ownerDocumentId='old-document';rows['session:r'].ownerToken='old-token';return {writes:rows};});
 f.api.tabs.create=async o=>{const tab={id:10,url:o.url};f.tabs.set(10,tab);return tab;};f.api.tabs.update=async()=>{};
 assert.equal((await f.send('RESUME',{id:'r'})).result.status,'accepted');const b=f.session['autonomous:r'];
 const attached=await f.send('ATTACH',{id:'r',token:b.token},{id:'fixture',url:f.api.runtime.getURL('runner.html'),tab:{id:10},frameId:0,documentId:'new-document'});assert.equal(attached.result.status,'ready');assert.equal((await f.runtime.coordinator.metadata({id:'r'})).ownerDocumentId,'new-document');
});

function setup(){const f=runtimeFixture();installAutonomousBackground(f.api,{runtime:f.runtime,proxy:f.proxy});const send=(action,payload={},sender={id:'fixture',url:f.api.runtime.getURL('sidepanel.html')})=>new Promise(resolve=>f.api.runtime.onMessage.listeners.at(-1)({cmd:'AUTONOMA_'+action,payload},sender,resolve));return {...f,send};}
test('painel sem sender.tab pode observar sem começar coleta',async()=>{const f=setup();const r=await f.send('LIST');assert.equal(r.ok,true);assert.deepEqual(r.result,[]);assert.equal((await f.runtime.coordinator.list()).length,0);});
test('site e página arbitrária da extensão não comandam execução',async()=>{const f=setup();for(const url of ['https://www.idealista.pt/a/',f.api.runtime.getURL('unknown.html')]){const r=await f.send('LIST',{}, {id:'fixture',url,tab:{id:8},frameId:0});assert.equal(r.ok,false);}});
test('inicialização e listagem nunca criam runner nem solicitam anúncios',async()=>{const f=setup();let creates=0;f.api.tabs.create=async()=>{creates++;throw Error('Não deveria criar aba');};await f.send('LIST');await f.send('LIST');assert.equal(creates,0);});

test('worker reconstruído observa o runner vivo sem criar outro e sem dirigir coleta',async()=>{
 const f=setup();f.session.collectionRunId='browser';f.tabs.set(8,{id:8,url:f.api.runtime.getURL('runner.html')+'?id=r&token=t'});
 await f.runtime.coordinator.reserveLaunch({id:'r',commandId:'gesture',owner:'8',source:{tabId:9,url:'https://www.idealista.pt/a/'},runId:'browser',startedAt:new Date().toISOString(),exportContext:{yearMonth:'202611'}});
 let creates=0;f.api.tabs.create=async()=>{creates++;};installAutonomousBackground(f.api,{runtime:f.runtime,proxy:f.proxy});
 const response=await f.send('LIST');assert.equal(response.result[0].state,'discovering');assert.equal(creates,0);
});
test('worker reconstruído conserva runner próprio ainda navegando a partir de about:blank',async()=>{
 const f=setup();f.session.collectionRunId='browser';f.tabs.set(8,{id:8,url:'about:blank',pendingUrl:f.api.runtime.getURL('runner.html')+'?id=pending&token=t'});
 await f.runtime.coordinator.reserveLaunch({id:'pending',commandId:'gesture',owner:'8',source:{tabId:9,url:'https://www.idealista.pt/a/'},runId:'browser',startedAt:new Date().toISOString(),exportContext:{yearMonth:'202611'}});
 const list=await f.send('LIST');assert.equal(list.result[0].state,'discovering');
});
test('runner de outro browser fica interrompido e ATTACH restaurado não autoriza rede',async()=>{
 const f=setup();await f.runtime.coordinator.reserveLaunch({id:'r',commandId:'gesture',owner:'8',source:{tabId:9,url:'https://www.idealista.pt/a/'},runId:'old',startedAt:new Date().toISOString(),exportContext:{yearMonth:'202611'}});
 f.tabs.set(8,{id:8,url:f.api.runtime.getURL('runner.html')+'?id=r&token=old'});
 const list=await f.send('LIST');assert.equal(list.result[0].state,'interrupted');
 const attach=await f.send('ATTACH',{id:'r',token:'old'},{id:'fixture',url:f.api.runtime.getURL('runner.html'),tab:{id:8},documentId:'restored',frameId:0});assert.equal(attach.result.status,'inactive');
});
test('recarregamento autenticado interrompe executor anterior e não retoma automaticamente',async()=>{
 const f=setup();f.session.collectionRunId='browser';
 await f.runtime.coordinator.reserveLaunch({id:'r',commandId:'gesture',owner:'8',source:{tabId:9,url:'https://www.idealista.pt/a/'},runId:'browser',startedAt:new Date().toISOString(),exportContext:{yearMonth:'202611'}});
 await f.store.transact(['session:r'],rows=>{rows['session:r'].ownerDocumentId='old-document';rows['session:r'].ownerToken='token';return {writes:rows};});
 f.session['autonomous:r']={id:'r',tabId:8,token:'token',runId:'browser'};
 f.tabs.set(8,{id:8,url:f.api.runtime.getURL('runner.html')+'?id=r&token=token'});
 const response=await f.send('ATTACH',{id:'r',token:'token'},{id:'fixture',url:f.api.runtime.getURL('runner.html'),tab:{id:8},documentId:'new-document',frameId:0});
 assert.equal(response.result.status,'inactive');assert.equal((await f.runtime.coordinator.metadata({id:'r'})).state,'interrupted');assert.equal(f.removed.includes(8),false);
});


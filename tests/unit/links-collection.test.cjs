const test=require('node:test'),assert=require('node:assert/strict');
const {runtimeFixture}=require('../fixtures/coleta-runtime.cjs'),{createLinksCollection}=require('../../src/links-collection');
function fixture(settings=null){const f=runtimeFixture(),created=[];let tick=1000;f.api.tabs.create=async data=>{const tab={id:30+created.length,...data};created.push(tab);f.tabs.set(tab.id,tab);return tab;};const links=createLinksCollection({api:f.api,runtime:f.runtime,settings,now:()=>tick});return {...f,created,links,advance:ms=>tick+=ms};}
test('Links inicia executor técnico sem carregar a tela de exportação e clique repetido não cria outro',async()=>{const f=fixture();assert.equal((await f.links.handle('LINKS_START',{},{})).status,'accepted');assert.equal((await f.links.handle('LINKS_START',{},{})).status,'accepted');assert.equal(f.created.length,1);assert.equal(f.created[0].active,false);assert.match(f.created[0].url,/runner.html\?links=/);});
test('launch de Links exige documento dono, é consumido uma vez e expira sem iniciar rede',async()=>{const f=fixture();await f.links.handle('LINKS_START',{},{});const token=new URL(f.created[0].url).searchParams.get('links'),sender={tab:{id:f.created[0].id},url:f.created[0].url};assert.equal((await f.links.handle('LINKS_CLAIM',{token},{...sender,tab:{id:999}})).status,'inactive');assert.equal((await f.links.handle('LINKS_CLAIM',{token},sender)).status,'ready');assert.equal((await f.links.handle('LINKS_CLAIM',{token},sender)).status,'inactive');f.advance(120001);assert.equal((await f.links.handle('LINKS_READ',{},{})).state,'error');assert.equal((await f.runtime.coordinator.list()).length,0);});
test('Links respeita a exclusividade antes de abrir controlador ou mudar conexão',async()=>{const f=fixture();await f.store.transact(['domain:idealista.pt'],()=>({writes:{'domain:idealista.pt':{active:'other'}}}));assert.equal((await f.links.handle('LINKS_START',{},{})).status,'busy');assert.equal(f.created.length,0);assert.equal(f.proxy.revision,'proxy-1');});
test('recusa antes de criar sessão mantém motivo e prazo sem atribuir falha à rede',async()=>{
 const f=fixture();await f.links.handle('LINKS_START',{},{});const sender={tab:{id:f.created[0].id},url:f.created[0].url};
 await f.links.handle('LINKS_FAILED',{reason:'rate_limit',until:125000,stage:'start'},sender);
 const view=await f.links.handle('LINKS_READ',{},{});assert.equal(view.state,'paused');assert.equal(view.reason,'rate_limit');assert.equal(view.until,125000);assert.equal(view.stage,'start');
 await f.links.handle('LINKS_FAILED',{reason:'password=never-echo',stage:'never-echo'},sender);
 const safe=await f.links.handle('LINKS_READ',{},{});assert.equal(safe.reason,'collector_start_failed');assert.doesNotMatch(JSON.stringify(safe),/never-echo/);
});
test('controlador fechado antes de criar sessão informa interrupção sem esperar dois minutos',async()=>{
 const f=fixture();await f.links.handle('LINKS_START',{},{});f.tabs.delete(f.created[0].id);
 const view=await f.links.handle('LINKS_READ',{},{});assert.equal(view.state,'error');assert.equal(view.reason,'controller_closed');
});

test('runner de Links ainda navegando não é confundido com controlador fechado',async()=>{
 const f=fixture();await f.links.handle('LINKS_START',{},{});const tab=f.created[0];f.tabs.set(tab.id,{id:tab.id,url:'about:blank',pendingUrl:tab.url});
 assert.equal((await f.links.handle('LINKS_READ',{},{})).state,'preparing');
 await f.links.handle('LINKS_START',{},{});assert.equal(f.created.length,1);
});
test('erro genérico legado recupera sessão anterior e abre seu controlador dono',async()=>{
 const f=fixture(),url=f.api.runtime.getURL('localidades.html');f.tabs.set(10,{id:10,url});f.session.collectionRunId='same-run';
 const started=await f.runtime.coordinator.start({id:'previous-links',mode:'links',owner:'10',runId:'same-run',domain:'idealista.pt',startedAt:new Date().toISOString(),items:[{url:'https://www.idealista.pt/a/'}],proxyRevision:'proxy-1'});
 await f.runtime.coordinator.control({id:started.id,epoch:started.epoch,owner:'10',action:'pause',reason:'proxy_error'});
 f.session['linksLaunch:005']={tabId:99,createdAt:1000,consumed:true,error:true};
 const view=await f.links.handle('LINKS_READ',{},{});assert.equal(view.id,started.id);assert.equal(view.reason,'proxy_error');
 const updated=[];f.api.tabs.update=async(id,values)=>{updated.push({id,...values});return f.api.tabs.get(id);};
 await f.links.handle('LINKS_DETAILS',{},{});assert.equal(updated[0].id,10);assert.equal(f.created.length,0);
});
test('gerenciar sessões abre controle sem iniciar captura quando não existe sessão do lançamento',async()=>{
 const f=fixture();const result=await f.links.handle('LINKS_DETAILS',{},{});
 assert.equal(result.status,'opened');assert.equal(f.created[0].url,f.api.runtime.getURL('localidades.html'));assert.equal(f.created[0].active,true);
 assert.equal((await f.runtime.coordinator.list()).length,0);
});
test('após reiniciar Chrome, novo clique retoma a sessão pendente (006) mesmo sem lançamento em storage.session',async()=>{
 const f=fixture(),started=await f.runtime.coordinator.start({id:'previous-browser',mode:'links',owner:'10',runId:'previous-run',domain:'idealista.pt',startedAt:new Date().toISOString(),items:[{url:'https://www.idealista.pt/a/'}],proxyRevision:'proxy-1'});
 await f.runtime.coordinator.control({id:started.id,epoch:started.epoch,owner:'10',action:'pause',reason:'proxy_error'});
 // 006 (pedido do usuário): o clique retoma a mesma sessão por um executor técnico; nenhuma requisição no clique.
 const result=await f.links.handle('LINKS_START',{},{});assert.equal(result.status,'accepted');assert.equal(f.created.length,1);assert.match(f.created[0].url,/runner\.html\?links=/);
 assert.equal(f.session['linksLaunch:005'].resumeId,started.id);assert.equal((await f.runtime.coordinator.metadata({id:started.id})).counters.requested,0);
});
test('tela de exportação não pode consumir autorização do executor técnico',async()=>{
 const f=fixture();await f.links.handle('LINKS_START',{},{});const token=f.session['linksLaunch:005'].token;
 const claim=await f.links.handle('LINKS_CLAIM',{token},{tab:{id:f.created[0].id},url:f.api.runtime.getURL('localidades.html')});assert.equal(claim.status,'inactive');
});
test('encerramento autenticado fecha só o executor técnico após falha, preservando página e dados',async()=>{
 const f=fixture();await f.links.handle('LINKS_START',{},{});const sender={tab:{id:f.created[0].id},url:f.created[0].url};
 await f.links.handle('LINKS_FAILED',{reason:'connection_setup_failed',stage:'start'},sender);
 await assert.rejects(f.links.handle('LINKS_FINISHED',{}, {...sender,tab:{id:999}}));
 assert.equal((await f.links.handle('LINKS_FINISHED',{},sender)).status,'closed');assert.deepEqual(f.removed,[f.created[0].id]);
 assert.equal((await f.links.handle('LINKS_READ',{},{})).reason,'connection_setup_failed');
});
test('claim entrega apenas escolha de conexão e origem (006 D7) ao executor e protege falha na leitura das configurações',async()=>{
 const f=fixture({load:async()=>({useProxy:true,proxy:{password:'never-publish'}})});await f.links.handle('LINKS_START',{},{});
 const sender={tab:{id:f.created[0].id},url:f.created[0].url},token=f.session['linksLaunch:005'].token;
 const result=await f.links.handle('LINKS_CLAIM',{token},sender);
 assert.deepEqual(result,{status:'ready',useProxy:true,origin:{url:'https://www.idealista.pt/arrendar-casas/#municipality-search',nome:'Localidades principais',current:false}});
 assert.doesNotMatch(JSON.stringify(result),/never-publish/);
 const broken=fixture({load:async()=>{throw Error('never-publish');}});await broken.links.handle('LINKS_START',{},{});
 assert.equal((await broken.links.handle('LINKS_CLAIM',{token:broken.session['linksLaunch:005'].token},{tab:{id:broken.created[0].id},url:broken.created[0].url})).reason,'settings_unavailable');
 const view=await broken.links.handle('LINKS_READ',{},{});assert.equal(view.stage,'settings');assert.doesNotMatch(JSON.stringify(view),/never-publish/);
});
test('executor em andamento não pode encerrar a própria aba antes de terminar a operação',async()=>{
 const f=fixture();await f.links.handle('LINKS_START',{},{});const tab=f.created[0];
 await f.runtime.coordinator.start({id:'active-links',mode:'links',owner:String(tab.id),domain:'idealista.pt',startedAt:new Date().toISOString(),items:[{url:'https://www.idealista.pt/a/'}],proxyRevision:'proxy-1'});
 assert.equal((await f.links.handle('LINKS_FINISHED',{}, {tab:{id:tab.id},url:tab.url})).status,'busy');assert.deepEqual(f.removed,[]);
});
test('novo clique numa coleta pendente retoma pela mesma sessão (006) sem renavegar a página existente do Idealista',async()=>{
 const f=fixture();f.session.collectionRunId='browser';f.tabs.set(20,{id:20,url:'https://www.idealista.pt/arrendar-casas/'});
 const started=await f.runtime.coordinator.start({id:'pending-page',mode:'links',owner:'10',runId:'browser',domain:'idealista.pt',startedAt:new Date().toISOString(),items:[{url:'https://www.idealista.pt/arrendar-casas/'}],proxyRevision:'proxy-1'});
 await f.runtime.coordinator.control({id:started.id,epoch:started.epoch,owner:'10',action:'pause',reason:'proxy_error'});
 await f.store.transact(['session:'+started.id],rows=>{rows['session:'+started.id].executor={tabId:20,runId:'browser'};return {writes:rows};});
 const updated=[];f.api.tabs.update=async(id,values)=>updated.push({id,...values});
 assert.equal((await f.links.handle('LINKS_START',{},{})).status,'accepted');assert.deepEqual(updated,[],'página existente não é renavegada');assert.equal(f.created.length,1);assert.equal(f.session['linksLaunch:005'].resumeId,started.id);
});

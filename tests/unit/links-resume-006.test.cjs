const test=require('node:test'),assert=require('node:assert/strict');
const {runtimeFixture}=require('../fixtures/coleta-runtime.cjs'),{createLinksCollection}=require('../../src/links-collection');
function fixture(){const f=runtimeFixture(),created=[];let tick=1000;f.api.tabs.create=async data=>{const tab={id:30+created.length,...data};created.push(tab);f.tabs.set(tab.id,tab);return tab;};
 return {...f,created,links:createLinksCollection({api:f.api,runtime:f.runtime,now:()=>tick}),advance:ms=>tick+=ms};}

test('006: coleta de links pausada é retomada pelo próprio botão, sem abrir a tela de exportação/pastas',async()=>{
  const f=fixture();await f.links.handle('LINKS_START',{},{});const first=f.created[0];
  // Sessão de links criada pelo primeiro executor e depois pausada (ex.: página inesperada); executor encerrado.
  await f.runtime.coordinator.start({id:'links-paused',mode:'links',owner:String(first.id),domain:'idealista.pt',startedAt:new Date().toISOString(),items:[{url:'https://www.idealista.pt/arrendar-casas/'}],proxyRevision:'proxy-1'});
  const s=await f.runtime.coordinator.metadata({id:'links-paused'});
  await f.runtime.coordinator.control({id:s.id,owner:s.owner,epoch:s.epoch,action:'pause',reason:'unexpected_content'});
  f.tabs.delete(first.id);
  const started=await f.links.handle('LINKS_START',{},{});
  assert.equal(started.status,'accepted');assert.equal(f.created.length,2);
  assert.match(f.created[1].url,/runner\.html\?links=/,'executor técnico, não localidades.html');
  assert.ok(!f.created.some(t=>/localidades\.html|configuracoes\.html/.test(t.url)));
  const token=new URL(f.created[1].url).searchParams.get('links');
  const claim=await f.links.handle('LINKS_CLAIM',{token},{tab:{id:f.created[1].id},url:f.created[1].url});
  assert.equal(claim.status,'ready');assert.equal(claim.resumeId,'links-paused');assert.equal(claim.accessConfirmed,false);
  assert.equal((await f.links.handle('LINKS_READ',{},{})).id,'links-paused','a sessão pausada continua visível durante a retomada');
});

test('006: retomada após bloqueio de acesso leva a confirmação explícita ao executor',async()=>{
  const f=fixture();await f.links.handle('LINKS_START',{},{});const first=f.created[0];
  await f.runtime.coordinator.start({id:'links-blocked',mode:'links',owner:String(first.id),domain:'idealista.pt',startedAt:new Date().toISOString(),items:[{url:'https://www.idealista.pt/arrendar-casas/'}],proxyRevision:'proxy-1'});
  const s=await f.runtime.coordinator.metadata({id:'links-blocked'});
  await f.runtime.coordinator.control({id:s.id,owner:s.owner,epoch:s.epoch,action:'pause',reason:'access_blocked'});f.tabs.delete(first.id);
  await f.links.handle('LINKS_START',{accessConfirmed:true},{});
  const token=new URL(f.created[1].url).searchParams.get('links');
  const claim=await f.links.handle('LINKS_CLAIM',{token},{tab:{id:f.created[1].id},url:f.created[1].url});
  assert.equal(claim.resumeId,'links-blocked');assert.equal(claim.accessConfirmed,true);
});

const test=require('node:test'),assert=require('node:assert/strict');
const {createPageTransport}=require('../../src/coleta-runner');
const {fixture,url}=require('../fixtures/autonoma.cjs');

function fakeChrome(){
  const tabs=new Map(),created=[],updates=[],messages=[],updated=new Set(),gone=new Set();let next=10;
  const ev=set=>({addListener:f=>set.add(f),removeListener:f=>set.delete(f)});
  const api={runtime:{id:'ext',async sendMessage(m){messages.push(m);if(m.cmd==='COLETA_READ_HTTP'){const t=[...tabs.values()].at(-1);return {ok:true,result:{status:200,documentId:'d:'+t.url,finalUrl:t.url}};}return {ok:true,result:{}};}},
    tabs:{onUpdated:ev(updated),onRemoved:ev(gone),
      async create(o){const t={id:next++,url:o.url,status:'complete'};tabs.set(t.id,t);created.push(o);return {...t};},
      async update(id,o){updates.push({id,...o});const t=tabs.get(id);if(o.url){t.url=o.url;}for(const f of updated)f(id,{status:'complete'});return {...t};},
      async get(id){const t=tabs.get(id);if(!t)throw Error('No tab');return {...t};},
      async remove(id){tabs.delete(id);for(const f of gone)f(id);},
      async sendMessage(id,m){messages.push(m);const t=tabs.get(id);if(m.cmd==='COLLECT_PAGE')return {ok:true,status:200,listing:true,finalUrl:t.url,documentId:'d:'+t.url,records:[],nextUrl:null};return {};}},
    scripting:{async executeScript(){return [{result:null}];}}};
  return {api,tabs,created,updates,messages,close:id=>api.tabs.remove(id)};
}

test('006 edge: aba de coleta fechada pelo usuário não é recriada em foco; transporte acusa o fechamento',async()=>{
  const f=fakeChrome(),t=createPageTransport(f.api,{foreground:true});
  await t.prepare({id:'run',epoch:1,itemId:'A',url:url('a')});
  await f.close(f.created[0]&&10);
  await assert.rejects(t.prepare({id:'run',epoch:1,itemId:'B',url:url('b')}),e=>e.code==='COLLECTION_TAB_CLOSED');
  assert.equal(f.created.length,1,'nenhuma aba nova');
});

test('006 D5: mudança de epoch (retomada) re-registra a mesma aba passando por about:blank, sem novo foco',async()=>{
  const f=fakeChrome(),t=createPageTransport(f.api,{foreground:true});
  await t.prepare({id:'run',epoch:1,itemId:'A',url:url('a')});
  await t.execute({id:'run',epoch:1,itemId:'A',requestId:'r1',url:url('a'),kind:'navigation',expiresAt:Date.now()+60000,timeoutMs:5000});
  await t.prepare({id:'run',epoch:2,itemId:'A',url:url('a')+'pagina-2/'});
  const registers=f.messages.filter(m=>m.cmd==='COLETA_REGISTER');
  assert.deepEqual(registers.map(m=>m.payload.epoch),[1,2]);
  assert.equal(f.created.length,1);assert.ok(f.updates.some(u=>u.url==='about:blank'));assert.ok(f.updates.every(u=>u.active!==true));
});

test('006 edge: fechamento da aba pausa a execução com motivo próprio e progresso preservado',async()=>{
  let calls=0;const f=fixture({names:['A','B'],response:async input=>({status:200,listing:true,finalUrl:input.url,records:[{id:input.url}],nextUrl:null})});
  f.ports.preparePage=async()=>{if(++calls>1){const e=new Error('Aba de coleta fechada');e.code='COLLECTION_TAB_CLOSED';throw e;}return {kind:'navigation'};};
  const service=f.service(),start=await service.start({commandId:'closed',source:f.source,useProxy:false,owner:'runner'});
  await service.runQueue({id:start.id,owner:'runner'});
  const run=await service.read({id:start.id});
  assert.equal(run.reason,'collection_tab_closed');assert.notEqual(run.state,'completed');
  assert.equal(run.summary.saved,1);assert.equal(f.writes.length,1,'item concluído antes do fechamento permanece salvo');
});

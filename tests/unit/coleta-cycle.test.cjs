const test=require('node:test'),assert=require('node:assert/strict');
const {createCollectionCoordinator}=require('../../src/coleta-coordinator');
const {MemoryCollectionStore}=require('../fixtures/coleta-store.cjs');
const {fixture,url}=require('../fixtures/autonoma.cjs');
const {DEFAULT_POLICY}=require('../../src/coleta-policy');

test('006 D13: sem ciclo a regra é idêntica (v1 pausa em run_budget) e renewCycle é recusado fora de v2',async()=>{
  const store=new MemoryCollectionStore();let time=Date.parse('2026-11-16T12:00:00Z');const c=createCollectionCoordinator({store,now:()=>time});
  await c.updatePolicy({...DEFAULT_POLICY,maxPagesPerRun:1,minIntervalMs:1000});
  const base=url('a'),s=await c.start({id:'v1',mode:'lote',owner:'o',domain:'idealista.pt',startedAt:new Date(time).toISOString(),items:[{nome:'A',url:base}],proxyRevision:'p'});
  await c.requestPage({id:'v1',owner:'o',epoch:s.epoch,requestId:'r1',url:base,kind:'navigation'});
  await c.reportPage({id:'v1',owner:'o',epoch:s.epoch,requestId:'r1',url:base,status:200,finalUrl:base,listing:true,records:[{id:'1'}],nextUrl:base+'pagina-2/'});
  time+=2000;const second=await c.requestPage({id:'v1',owner:'o',epoch:s.epoch,requestId:'r2',url:base+'pagina-2/',kind:'pagination'});
  assert.deepEqual([second.status,second.reason],['paused','run_budget']);
  assert.equal((await c.renewCycle({id:'v1',owner:'o',epoch:s.epoch})).reason,'incompatible_context');
});

test('006 D13: autônomo com recuperação renova o ciclo em run_budget e conclui, mantendo intervalo entre páginas',async()=>{
  const A=url('a');const at=[];
  const f=fixture({names:['A'],response:async input=>{at.push(f.now());const n=Number(/pagina-(\d+)/.exec(input.url)?.[1]||1);return {status:200,listing:true,finalUrl:input.url,records:[{id:'p'+n}],nextUrl:n<3?A+'pagina-'+(n+1)+'/':null};}});
  f.ports.policy={...DEFAULT_POLICY,maxSessionMs:172800000,maxPagesPerRun:2};
  const service=require('../../src/coleta-autonoma').createAutonomousCollection({...f.ports,autoRecovery:{maxRechecks:3}});
  const start=await service.start({commandId:'cycle',source:f.source,useProxy:false,owner:'runner'});
  const run=await service.runQueue({id:start.id,owner:'runner'});
  assert.equal(run.state,'completed');assert.equal(run.cycle,1);assert.equal(f.calls.length,3);
  for(let i=1;i<at.length;i++)assert.ok(at[i]-at[i-1]>=DEFAULT_POLICY.minIntervalMs,'intervalo mínimo preservado entre ciclos');
  assert.equal(f.writes[0].records.length,3);
});

test('006 D13: renewCycle só aceita pausa por orçamento/duração e não mexe no domínio',async()=>{
  const f=fixture({names:['A'],response:async input=>({status:200,listing:true,finalUrl:input.url,records:[{id:'1'}],nextUrl:null})});
  const service=f.service(),start=await service.start({commandId:'nr',source:f.source,useProxy:false,owner:'runner'});
  const c=service.coordinator,s=await c.metadata({id:start.id});
  assert.equal((await c.renewCycle({id:s.id,owner:s.owner,epoch:s.epoch})).reason,'not_renewable');
  const before=(await f.store.read(['domain:idealista.pt']))['domain:idealista.pt'];
  await c.control({id:s.id,owner:s.owner,epoch:s.epoch,action:'pause',reason:'session_duration'});
  assert.equal((await c.renewCycle({id:s.id,owner:s.owner,epoch:s.epoch})).status,'ready');
  const after=(await f.store.read(['domain:idealista.pt']))['domain:idealista.pt'];
  assert.deepEqual({events:after.events,lastStarted:after.lastStarted,blockedUntil:after.blockedUntil},{events:before.events,lastStarted:before.lastStarted,blockedUntil:before.blockedUntil});
});

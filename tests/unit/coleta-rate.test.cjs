const test=require('node:test'),assert=require('node:assert/strict');
const {createCollectionCoordinator}=require('../../src/coleta-coordinator');
const {MemoryCollectionStore}=require('../fixtures/coleta-store.cjs');
const {DEFAULT_POLICY}=require('../../src/coleta-policy');
test('relógio recuado não elimina intervalo nem devolve consumo',async()=>{
 let t=Date.now();const c=createCollectionCoordinator({store:new MemoryCollectionStore(),now:()=>t});
 const s=await c.start({id:'clock',mode:'itens',owner:'a',domain:'idealista.pt',startedAt:new Date(t).toISOString(),items:[{url:'https://www.idealista.pt/a/'}]});
 const r={id:'clock',owner:'a',epoch:s.epoch,requestId:'first',url:'https://www.idealista.pt/a/',kind:'navigation'};
 await c.requestPage(r);await c.reportPage({...r,status:200,listing:true,records:[{id:'1'}],nextUrl:'/b/'});t-=1000;
 assert.equal((await c.requestPage({...r,requestId:'second',url:'https://www.idealista.pt/b/'})).reason,'clock_inconsistent');
 assert.equal((await c.read({id:'clock'})).counters.requested,1);
 await assert.rejects(c.updatePolicy({...DEFAULT_POLICY,maxAttempts:0}));
});
test('teto pausa a sessão sem prender a exclusividade do domínio',async()=>{
 const {scenario}=require('../fixtures/coleta-scenario.cjs');const f=await scenario({maxPagesPerRun:1}),r=f.command();
 await f.c.requestPage(r);await f.c.reportPage({...r,status:200,listing:true,records:[{id:'1'}],nextUrl:'https://www.idealista.pt/b/'});f.advance(10000);
 assert.equal((await f.c.requestPage(f.command('https://www.idealista.pt/b/'))).reason,'run_budget');
 const next=await f.c.start({id:'other',mode:'links',owner:'new',domain:'idealista.pt',startedAt:new Date(f.now()).toISOString(),items:[{url:'https://www.idealista.pt/next/'}]});
 assert.equal(next.status,'started');assert.equal((await f.c.read({id:r.id})).counters.requested,1);
});

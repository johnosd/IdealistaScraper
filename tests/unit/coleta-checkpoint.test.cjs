const test=require('node:test'),assert=require('node:assert/strict');const {scenario}=require('../fixtures/coleta-scenario.cjs');
test('descarte explícito remove dados da sessão mas conserva orçamento do domínio',async()=>{
 const f=await scenario({maxPagesPerWindow:1});const r=f.command();await f.c.requestPage(r);await f.c.reportPage({...r,status:200,listing:true,records:[{id:'1'}],nextUrl:null});
 await f.c.control({...r,action:'discard'});assert.equal((await f.c.list()).length,0);
 await f.c.start({id:'new',mode:'links',owner:'b',domain:'idealista.pt',startedAt:new Date(f.now()).toISOString(),items:[{url:r.url}]});
 f.advance(10000);assert.equal((await f.c.requestPage({...r,id:'new',owner:'b',epoch:1,requestId:'new-request'})).reason,'window_budget');
});
test('checkpoint corrompido nunca vira resultado válido e revisão de proxy divergente não retoma',async()=>{
 const f=await scenario();const r=f.command();await f.c.requestPage(r);await f.c.reportPage({...r,status:200,listing:true,records:[{id:'1'}],nextUrl:'https://www.idealista.pt/b/'});
 await f.c.control({...r,action:'pause'});f.advance(10000);
 assert.equal((await f.c.control({...r,action:'resume',proxyRevision:'different'})).reason,'incompatible_context');
 const view=await f.c.read({id:'scenario'}),key=view.checkpoint.pageKeys[0];
 await f.store.transact([key],rows=>({writes:{[key]:{...rows[key],records:[{id:'corrupted'}]}}}));
 await assert.rejects(f.c.read({id:'scenario'}),/incompatível/);
});
test('capacidade agregada aborta commit integral e idade/schema impedem retomar sem apagar dados',async()=>{
 const f=await scenario({maxSessionMs:604800000}),r=f.command();await f.c.requestPage(r);
 await f.store.transact(['storage-usage'],()=>({writes:{'storage-usage':{bytes:100*1024*1024}}}));
 await assert.rejects(f.c.reportPage({...r,status:200,listing:true,records:[{id:'1'}],nextUrl:null}),/armazenamento/);
 let s=await f.c.read({id:r.id});assert.equal(s.checkpoint.confirmedPages,0);assert.equal(s.counters.requested,1);assert.equal(s.inFlight,r.requestId);
 await f.store.transact(['storage-usage'],()=>({writes:{'storage-usage':{bytes:0}}}));
 await f.c.reportPage({...r,status:200,listing:true,records:[{id:'1'}],nextUrl:'https://www.idealista.pt/b/'});
 await f.c.control({...r,action:'pause'});f.advance(604800001);
 assert.equal((await f.c.control({...r,action:'resume',proxyRevision:'proxy-1'})).reason,'incompatible_context');
 s=await f.c.read({id:r.id});assert.equal(s.checkpoint.records[0].id,'1');
 const key=`session:${r.id}`;await f.store.transact([key],rows=>({writes:{[key]:{...rows[key],schemaVersion:2}}}));
 assert.equal((await f.c.control({...r,action:'resume',proxyRevision:'proxy-1'})).reason,'incompatible_context');
});
test('sessão acima do teto de metadados é recusada antes de ocupar o domínio',async()=>{
 const f=await scenario();await f.c.control({id:'scenario',owner:'screen',epoch:f.epoch,action:'discard'});
 await assert.rejects(f.c.start({id:'oversized',mode:'lote',owner:'screen',domain:'idealista.pt',startedAt:new Date(f.now()).toISOString(),items:[{nome:'x'.repeat(1048576),url:'https://www.idealista.pt/a/'}]}),/metadados/);
 assert.equal((await f.c.list()).length,0);
});

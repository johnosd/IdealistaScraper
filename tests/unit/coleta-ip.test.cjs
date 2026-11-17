const test=require('node:test'),assert=require('node:assert/strict');
const {probePublicIP}=require('../../src/coleta-ip');
const {scenario}=require('../fixtures/coleta-scenario.cjs');
const {createCollectionCoordinator}=require('../../src/coleta-coordinator');
test('sonda fixa responde unknown no timeout/erro, aborta e não altera proxy',async()=>{
 let options,url,timer,aborted=false;
 const p=probePublicIP({fetchImpl:(u,o)=>{url=u;options=o;o.signal.addEventListener('abort',()=>{aborted=true;});return new Promise(()=>{});},setTimer:fn=>{timer=fn;return 1;},clearTimer:()=>{}});
 await Promise.resolve();timer();assert.equal((await p).status,'unknown');assert.equal(aborted,true);
 assert.equal(url,'https://api.ipify.org?format=json');assert.equal(options.redirect,'error');
 assert.equal((await probePublicIP({fetchImpl:async()=>{throw Error('fixture secret');}})).status,'unknown');
 const verified=await probePublicIP({fetchImpl:async()=>({ok:true,json:async()=>({ip:'192.0.2.1'})})});assert.equal(verified.ip,'192.0.2.1');
});
test('marker reservado antes do fetch persiste após restart e não se repete em cem páginas',async()=>{
 const f=await scenario({minIntervalMs:1000,maxPagesPerWindow:1000,maxPagesPerRun:200,maxPagesPerItem:1000}),identity={id:'scenario',owner:'screen',epoch:f.epoch,proxyRevision:'proxy-1'};
 assert.equal((await f.c.reserveIP(identity)).status,'ready');
 const recreated=createCollectionCoordinator({store:f.store,now:f.now});
 for(let i=0;i<100;i++){
  assert.equal((await recreated.reserveIP(identity)).status,'duplicate');
  const r=f.command(`https://www.idealista.pt/page-${i}/`);await recreated.requestPage(r);
  await recreated.reportPage({...r,status:200,listing:true,records:[{id:String(i)}],nextUrl:`https://www.idealista.pt/page-${i+1}/`});f.advance(1000);
 }
 const view=await recreated.read({id:'scenario'});assert.equal(view.counters.ipProbes,1);assert.equal(view.counters.requested,100);
});
test('IP opt-in não bloqueia cancelamento e restart não repete a tentativa interrompida',{timeout:3000},async()=>{
 const {runtimeFixture}=require('../fixtures/coleta-runtime.cjs');let calls=0,started;
 const began=new Promise(r=>{started=r;});
 const f=runtimeFixture({probeIP:({signal}={})=>{calls++;started();return new Promise(resolve=>signal.addEventListener('abort',()=>resolve({status:'unknown'}),{once:true}));}});
 const s=(await f.send('START',{mode:'itens',items:[{url:'https://www.idealista.pt/a/'}]})).result;
 const identity={id:s.id,epoch:s.epoch};assert.equal((await f.send('PROBE_IP',identity)).result.status,'disabled');assert.equal(calls,0);
 f.local.collectionIpEnabled=true;const pending=f.send('PROBE_IP',identity);await began;
 assert.equal((await f.send('CANCEL',identity)).result.status,'cancelled');assert.equal((await pending).result.status,'unknown');
 f.boot();await f.send('PROBE_IP',identity);assert.equal(calls,1);
});

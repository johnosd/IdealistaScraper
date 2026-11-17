const test=require('node:test'),assert=require('node:assert/strict');
const {recoverLinks}=require('../../src/links-runner');

function fakeWorkflow(results){
  const resumes=[];let records=3;
  return {resumes,get records(){return records;},workflow:{id:'links-1',
    async client(action){assert.equal(action,'READ');const r=results[0];return {state:r.state,reason:r.reason,eligibility:{until:r.until},checkpoint:{recordCount:records}};},
    async resume(id,accessConfirmed){resumes.push(accessConfirmed);results.shift();const next=results[0];return {status:next.state==='awaiting-save'?'collected':next.state,reason:next.reason};}}};
}

test('006 US5/AC4: links 403 → espera o prazo → reverifica com confirmação automática e conclui, sem perder registros',async()=>{
  let clock=0;const waits=[];const status=[];
  const f=fakeWorkflow([{state:'blocked',reason:'access_blocked',until:1800000},{state:'awaiting-save'}]);
  const out=await recoverLinks(f.workflow,{status:'blocked',reason:'access_blocked'},{onStatus:s=>status.push(s),delay:async ms=>{waits.push(ms);clock+=ms;},now:()=>clock,maxRechecks:3});
  assert.equal(out.status,'collected');assert.deepEqual(f.resumes,[true]);assert.deepEqual(waits,[1800000]);
  assert.match(status[0],/verificação/);assert.equal(f.records,3);
});

test('006 US5/AC4: links com bloqueio persistente param após o limite de verificações',async()=>{
  let clock=0;const status=[];
  const blocked={state:'blocked',reason:'access_blocked',until:10};
  const f=fakeWorkflow([blocked,blocked,blocked,blocked,blocked]);
  const out=await recoverLinks(f.workflow,{status:'blocked',reason:'access_blocked'},{onStatus:s=>status.push(s),delay:async ms=>{clock+=ms;},now:()=>clock,maxRechecks:2});
  assert.equal(f.resumes.length,2);assert.equal(out.persistent,'access_blocked_persistent');assert.match(status.at(-1),/3 verificações|verificações automáticas/);
});

test('006 US5/AC4: motivo não recuperável não espera nem reverifica',async()=>{
  const f=fakeWorkflow([{state:'paused',reason:'proxy_error'}]);
  const out=await recoverLinks(f.workflow,{status:'paused',reason:'proxy_error'},{onStatus:()=>{},delay:async()=>{throw Error('não deveria esperar');},now:()=>0,maxRechecks:3});
  assert.equal(f.resumes.length,0);assert.equal(out.reason,'proxy_error');
});

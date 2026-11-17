const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,url}=require('../fixtures/autonoma.cjs');
const unexpected=input=>({status:200,listing:false,finalUrl:input.url,records:[]});
const ok=input=>({status:200,listing:true,finalUrl:input.url,records:[{id:input.url}],nextUrl:null});
const path=u=>u.replace('https://www.idealista.pt/arrendar-casas/','');

test('006: conteúdo inesperado passageiro → espera e nova tentativa na mesma página, sem parar a fila',async()=>{
  const seen={};const times=[];
  const f=fixture({names:['A','B'],response:async input=>{times.push(f.now());seen[input.url]=(seen[input.url]||0)+1;return input.url===url('A')&&seen[input.url]<=2?unexpected(input):ok(input);}});
  const service=f.service(),start=await service.start({commandId:'u1',source:f.source,useProxy:false,owner:'runner'});
  const run=await service.runQueue({id:start.id,owner:'runner'});
  assert.equal(run.state,'completed');assert.deepEqual(f.calls.map(c=>path(c.url)),['a/','a/','a/','b/']);
  assert.ok(times[1]-times[0]>=30000&&times[2]-times[1]>=60000,'espera de 30 s e 60 s entre as tentativas');
});

test('006: 3 tentativas sem conteúdo → localidade vai para o fim da fila, a fila segue e ela é retomada de onde parou',async()=>{
  const seen={};
  const f=fixture({names:['A','B','C'],response:async input=>{seen[input.url]=(seen[input.url]||0)+1;
    if(input.url===url('A'))return {status:200,listing:true,finalUrl:input.url,records:[{id:'a1'}],nextUrl:url('A')+'pagina-2/'};
    if(input.url===url('A')+'pagina-2/'&&seen[input.url]<=3)return unexpected(input);
    return ok(input);}});
  const service=f.service(),start=await service.start({commandId:'u2',source:f.source,useProxy:false,owner:'runner'});
  const run=await service.runQueue({id:start.id,owner:'runner'});
  assert.deepEqual(f.calls.map(c=>path(c.url)),['a/','a/pagina-2/','a/pagina-2/','a/pagina-2/','b/','c/','a/pagina-2/'],'A volta no fim, a partir da página 2 (página 1 não é refeita)');
  assert.equal(run.state,'completed');assert.equal(run.summary.saved,3);
  assert.deepEqual(f.writes.map(w=>w.nome),['B','C','A']);assert.equal(f.writes[2].records.length,2);
});

test('006: falha de novo no fim da fila → fica pendente (recuperável) e a execução termina sem travar',async()=>{
  const f=fixture({names:['A','B'],response:async input=>input.url===url('A')?unexpected(input):ok(input)});
  const service=f.service(),start=await service.start({commandId:'u3',source:f.source,useProxy:false,owner:'runner'});
  const run=await service.runQueue({id:start.id,owner:'runner'});
  assert.deepEqual(f.calls.map(c=>path(c.url)),['a/','a/','a/','b/','a/','a/','a/']);
  assert.equal(run.state,'finished-with-pending');assert.equal(run.summary.saved,1);assert.equal(run.summary.pending,1);
  const a=run.items.find(i=>i.nome==='A');assert.equal(a.state,'pending');assert.equal(a.reason,'unexpected_content');assert.equal(a.recoverable,true);
});

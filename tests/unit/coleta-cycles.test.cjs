const test=require('node:test'),assert=require('node:assert/strict'),{scenario}=require('../fixtures/coleta-scenario.cjs');
test('destino externo ou outra origem pausa sem checkpoint e sem inFlight preso',async()=>{
 for(const nextUrl of ['https://outside.invalid/','https://other.idealista.pt/page/']){
  const f=await scenario(),r=f.command();await f.c.requestPage(r);
  const result=await f.c.reportPage({...r,status:200,listing:true,records:[{id:'one'}],nextUrl});
  assert.equal(result.reason,'invalid_destination');const view=await f.c.read({id:r.id});assert.equal(view.inFlight,null);assert.equal(view.checkpoint.confirmedPages,0);
 }
});
test('ciclo pelo next ou pelo redirect final não produz conclusão falsa',async()=>{
 const f=await scenario(),r=f.command();await f.c.requestPage(r);
 let result=await f.c.reportPage({...r,status:200,listing:true,records:[{id:'one'}],nextUrl:r.url+'#same'});
 assert.equal(result.reason,'pagination_cycle');assert.equal((await f.c.read({id:r.id})).checkpoint.complete,false);
 const g=await scenario(),a=g.command();await g.c.requestPage(a);await g.c.reportPage({...a,status:200,listing:true,records:[{id:'1'}],nextUrl:'https://www.idealista.pt/b/'});g.advance(10000);
 const b=g.command('https://www.idealista.pt/b/');await g.c.requestPage(b);result=await g.c.reportPage({...b,status:200,finalUrl:a.url,listing:true,records:[{id:'2'}],nextUrl:null});
 assert.equal(result.reason,'pagination_cycle');assert.equal((await g.c.read({id:a.id})).checkpoint.confirmedPages,1);
});
test('páginas consecutivas sem novos anúncios param com dados anteriores preservados',async()=>{
 const f=await scenario();let last;
 for(let i=0;i<4;i++){const r=f.command(`https://www.idealista.pt/${i}/`);await f.c.requestPage(r);last=await f.c.reportPage({...r,status:200,listing:true,records:[{id:'same'}],nextUrl:`https://www.idealista.pt/${i+1}/`});f.advance(10000);}
 assert.equal(last.reason,'no_new_records');const s=await f.c.read({id:'scenario'});assert.equal(s.checkpoint.records.length,1);assert.equal(s.checkpoint.complete,false);
});
test('CTA circular é interrompido antes de reenviar a página inicial',async()=>{
 const f=await scenario(),a=f.command();await f.c.requestPage(a);await f.c.reportPage({...a,status:200,destinationUrl:'https://www.idealista.pt/b/',records:[]});f.advance(10000);
 const b=f.command('https://www.idealista.pt/b/');await f.c.requestPage(b);
 assert.equal((await f.c.reportPage({...b,status:200,destinationUrl:a.url,records:[]})).reason,'pagination_cycle');
});

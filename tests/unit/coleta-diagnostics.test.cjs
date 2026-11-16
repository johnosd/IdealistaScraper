const test=require('node:test'),assert=require('node:assert/strict'),{scenario}=require('../fixtures/coleta-scenario.cjs');
test('diagnóstico remove query/HTML/erros/configuração; expiração terminal conserva checkpoint',async()=>{
 const f=await scenario(),r=f.command('https://www.idealista.pt/a/?token=SECRET_QUERY');await f.c.requestPage(r);
 await f.c.reportPage({...r,status:200,listing:true,records:[{id:'one',Titulo:'SECRET_DATA'}],nextUrl:null,error:'SECRET_ERROR',html:'SECRET_HTML',password:'SECRET_CONFIG'});
 let view=await f.c.read({id:r.id});assert.doesNotMatch(JSON.stringify(view.diagnostics),/SECRET_/);
 await f.c.markSaved({...r,receipt:{id:'save',relativePath:'fixed.json'}});f.advance(604800001);
 view=await f.c.read({id:r.id});assert.equal(view.diagnostics.length,0);assert.equal(view.checkpoint.records[0].Titulo,'SECRET_DATA');
 assert.equal((await f.c.list())[0].state,'saved');
});

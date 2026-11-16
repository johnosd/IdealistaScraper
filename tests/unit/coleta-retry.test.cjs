const test=require('node:test'),assert=require('node:assert/strict');const {scenario}=require('../fixtures/coleta-scenario.cjs');
test('503 usa30/60segundos e terceira falha esgota tentativas sem reset manual',async()=>{
 const f=await scenario();let command=f.command();await f.c.requestPage(command);await f.c.reportPage({...command,status:503,records:[]});
 assert.equal((await f.c.requestPage(f.command())).until,f.now()+30000);f.advance(30000);
 command=f.command();await f.c.requestPage(command);await f.c.reportPage({...command,status:503,records:[]});
 assert.equal((await f.c.requestPage(f.command())).until,f.now()+60000);f.advance(60000);
 command=f.command();await f.c.requestPage(command);await f.c.reportPage({...command,status:503,records:[]});
 assert.equal((await f.c.read({id:'scenario'})).reason,'attempts_exhausted');assert.equal((await f.c.read({id:'scenario'})).counters.requested,3);
});

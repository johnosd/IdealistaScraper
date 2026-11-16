const test=require('node:test'),assert=require('node:assert/strict');const {abortableDelay}=require('../../src/coleta-runner');
test('cancelar espera não aguarda o timer nem deixa trabalho posterior',async()=>{
 const control=new AbortController();let completed=false;
 const waiting=abortableDelay(60000,control.signal).then(()=>{completed=true;});control.abort();await assert.rejects(waiting);assert.equal(completed,false);
});

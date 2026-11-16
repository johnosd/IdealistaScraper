const test=require('node:test'),assert=require('node:assert/strict');
const {classifyResponse,retryAfterUntil}=require('../../src/coleta-classification');
test('classificação distingue desafio, autenticação, limitação, transitório e vazio inequívoco',()=>{
 for(const [input,want] of [[{status:200,challenge:true},'access-blocked'],[{status:403},'access-blocked'],[{status:429},'rate-limit'],[{status:407},'proxy-error'],[{status:503},'transient'],[{status:401},'authentication-required'],[{status:200},'unexpected-content'],[{status:200,empty:true},'empty']])assert.equal(classifyResponse(input),want);
});
test('Retry-After longo não é truncado; inválido tem espera; zero não repete imediatamente',()=>{
 const t=Date.parse('2026-11-14T12:00:00Z');
 assert.equal(retryAfterUntil('120',t),t+120000);assert.equal(retryAfterUntil('bad',t),t+900000);
 assert.equal(retryAfterUntil('0',t),t+60000);assert.equal(retryAfterUntil('Sun, 15 Nov 2026 12:00:00 GMT',t),t+86400000);
});

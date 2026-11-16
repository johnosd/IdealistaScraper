const test=require('node:test'),assert=require('node:assert/strict');const {inspectCollectionPage}=require('../../src/coleta-page');
test('desafio e login são diferentes de vazio inequívoco',()=>{
 const doc=(title,selectors={})=>({title,querySelector:selector=>selectors[selector]||null});
 assert.equal(inspectCollectionPage(doc('Just a moment...')).challenge,true);
 assert.equal(inspectCollectionPage(doc('Login',{'form input[type="password"]':{}})).login,true);
 const empty=inspectCollectionPage(doc('',{'.not-found, .no-results':{textContent:'Nenhum resultado'}}));assert.equal(empty.empty,true);assert.equal(empty.challenge,false);
});

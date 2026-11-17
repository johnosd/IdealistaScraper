const test=require('node:test'),assert=require('node:assert/strict');
const {distinctDestination}=require('../../src/coleta-destinations');
test('selecionar novamente a mesma pasta não transforma colisão em sobrescrita',async()=>{
 const existing={},same={isSameEntry:async handle=>handle===existing},different={isSameEntry:async()=>false},items=[{id:'A',receipt:{relativePath:'202611/Mesmo-Paginas1.json',directoryKey:'original'}},{id:'B'}],options={items,itemId:'B',relativePath:'202611/Mesmo-Paginas1.json',load:async key=>{assert.equal(key,'original');return existing;}};
 assert.equal(await distinctDestination({...options,directory:same}),false);assert.equal(await distinctDestination({...options,directory:different}),true);
 await assert.rejects(()=>distinctDestination({...options,directory:{}}));
});


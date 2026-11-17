const test=require('node:test'),assert=require('node:assert/strict');
const {MemoryDirectory,MemoryLocks}=require('../fixtures/localidades-filesystem.cjs');
const {writeMunicipality}=require('../../src/lote-export');
const {hashText,reconcileDirectory}=require('../../src/coleta-runner');
const {collectionDownloadName,localExportContext}=require('../../src/coleta-download');
test('nome de download preserva slug/páginas/timestamp original mesmo após mudança de mês',()=>{
 const context=localExportContext(new Date(2026,10,30,23,59));
 const view={items:[{url:'https://www.idealista.pt/geo/alvor/casas/?q=1'}],itemIndex:0,checkpoint:{confirmedPages:3},exportContext:context};
 assert.equal(collectionDownloadName(view),'alvor-casas-Paginas3-202611302359.json');assert.equal(context.yearMonth,'202611');
});
test('crash depois de close é reconciliado por bytes/digest sem reescrever arquivo',async()=>{
 const directory=new MemoryDirectory('municipios'),records=[{id:'1',Titulo:'São João'}],text=JSON.stringify(records,null,2);
 const intent={relativePath:'202611/Alvor-Paginas1.json',digest:await hashText(text),bytes:new TextEncoder().encode(text).length};
 await writeMunicipality({directory,records,startedAt:new Date(2026,10,30),nome:'Alvor',totalPages:1,locks:new MemoryLocks()});
 const month=await directory.getDirectoryHandle('202611'),file=await month.getFileHandle('Alvor-Paginas1.json');
 file.createWritable=()=>assert.fail('Reconciliação não deve reescrever');
 assert.equal((await reconcileDirectory(directory,intent)).status,'saved');
 file.contents='different';assert.equal((await reconcileDirectory(directory,intent)).status,'save-unknown');
 directory.permission='denied';assert.equal((await reconcileDirectory(directory,intent)).status,'permission-required');
});
test('Downloads desconhecido sobrevive à reconstrução sem rede e requer confirmação antes do receipt',async()=>{
 const {runtimeFixture}=require('../fixtures/coleta-runtime.cjs');
 const {createCollectionWorkflow}=require('../../src/coleta-runner');const f=runtimeFixture();
 f.api.runtime.sendMessage=message=>f.send(message.cmd.slice(7),message.payload);
 const start=(await f.send('START',{mode:'itens',items:[{url:'https://www.idealista.pt/a/'}]})).result;
 const r={id:start.id,epoch:start.epoch,requestId:'one',url:'https://www.idealista.pt/a/',kind:'navigation'};
 await f.send('REQUEST',r);await f.send('REPORT',{...r,status:200,listing:true,records:[{id:'1'}],nextUrl:null});
 let downloads=0;const make=()=>createCollectionWorkflow({api:f.api,mode:'itens',destination:()=> 'original.json',save:async()=>{downloads++;return {status:'download-requested'};}});
 let workflow=make();await workflow.adopt(start.id);await workflow.save(true);assert.equal(downloads,1);
 f.boot();workflow=make();await workflow.adopt(start.id);assert.equal((await workflow.resume(start.id)).status,'save-unknown');
 assert.equal(downloads,1);assert.equal((await f.send('READ',{id:start.id})).result.counters.requested,1);
 assert.equal((await workflow.save(false,true)).status,'saved');assert.equal(downloads,1);
 assert.equal((await f.send('SAVE_RESULT',{...r,receipt:{id:'forged',relativePath:'different'}})).ok,false);
});
test('falha da projeção da fila após receipt é retomável sem novo arquivo nem coleta',async()=>{
 const {runtimeFixture}=require('../fixtures/coleta-runtime.cjs'),{createCollectionWorkflow}=require('../../src/coleta-runner');const f=runtimeFixture();f.api.runtime.sendMessage=m=>f.send(m.cmd.slice(7),m.payload);
 const s=(await f.send('START',{mode:'lote',items:[{nome:'One',url:'https://www.idealista.pt/a/'}]})).result,r={id:s.id,epoch:s.epoch,requestId:'one',url:'https://www.idealista.pt/a/',kind:'navigation'};
 await f.send('REQUEST',r);await f.send('REPORT',{...r,status:200,listing:true,records:[{id:'1'}],nextUrl:null});
 let writes=0,fail=true;const make=()=>createCollectionWorkflow({api:f.api,mode:'lote',destination:()=> '202611/one.json',save:async()=>{writes++;return {status:'saved',relativePath:'202611/one.json'};},onSaved:async()=>{if(fail)throw Error('projection failed');}});
 let flow=make();await flow.adopt(s.id);await assert.rejects(flow.save(true),/projection failed/);
 assert.ok((await f.send('READ',{id:s.id})).result.pendingProjection);fail=false;flow=make();await flow.adopt(s.id);assert.equal((await flow.save(true)).status,'saved');
 assert.equal(writes,1);assert.equal((await f.send('READ',{id:s.id})).result.pendingProjection,null);
});
test('pausar durante gravação confirma o arquivo e a fila, mas não inicia o próximo item',async()=>{
 const {scenario}=require('../fixtures/coleta-scenario.cjs');const f=await scenario(),key='session:scenario';
 await f.store.transact([key],rows=>{const s=rows[key];s.items.push({nome:'Two',url:'https://www.idealista.pt/b/'});return {writes:{[key]:s}};});
 const r=f.command();await f.c.requestPage(r);await f.c.reportPage({...r,status:200,listing:true,records:[{id:'1'}],nextUrl:null});
 await f.c.control({...r,action:'pause'});const result=await f.c.markSaved({...r,receipt:{id:'file',relativePath:'file.json'}});
 assert.equal(result.status,'paused');assert.equal((await f.c.read({id:r.id})).itemIndex,1);
});
test('intent inválido não autoriza receipt nem persiste destino fora do formato permitido',async()=>{
 const {runtimeFixture}=require('../fixtures/coleta-runtime.cjs');const f=runtimeFixture();
 const s=(await f.send('START',{mode:'itens',items:[{url:'https://www.idealista.pt/a/'}]})).result,r={id:s.id,epoch:s.epoch,requestId:'one',url:'https://www.idealista.pt/a/',kind:'navigation'};
 await f.send('REQUEST',r);await f.send('REPORT',{...r,status:200,listing:true,records:[{id:'1'}],nextUrl:null});
 assert.equal((await f.send('SAVE_INTENT',{...r,intent:{id:'bad',relativePath:'../outside',digest:'bad',bytes:1}})).ok,false);
 assert.equal((await f.send('GET_INTENT',r)).result,null);
});

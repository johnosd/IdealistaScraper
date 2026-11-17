const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('extração de uma página não consulta IP nem reativa proxy ou faz fetch duplicado',async()=>{
 let listener;const commands=[];const module={exports:{}};
 const api={runtime:{id:'fixture',onMessage:{addListener:fn=>listener=fn},sendMessage:async m=>{commands.push(m.cmd);return {ok:true,result:{valid:true,mode:'itens'}};}}};
 const scope={module,document:{querySelector:selector=>selector.startsWith('section')?{}:null},location:{href:'https://www.idealista.pt/a/'},setTimeout,clearTimeout,AbortController,fetch:()=>assert.fail('Página inicial não deve ser buscada novamente')};
 vm.runInNewContext(fs.readFileSync(require.resolve('../../src/coleta-page'),'utf8'),scope);
 module.exports.installCollectionExecutor(api,{extractItems:()=>({itens:[{id:'1'}],nextUrl:null}),extractLinks:()=>[]});
 const response=await new Promise(resolve=>listener({cmd:'COLLECT_PAGE',sessionId:'s',epoch:1,requestId:'r',fetch:false},{id:'fixture'},resolve));
 assert.equal(response.records[0].id,'1');assert.deepEqual(commands,['COLETA_VALIDATE']);
});
test('duas mensagens durante validação não disparam dois fetches',async()=>{
 let listener,release,count=0;const gate=new Promise(r=>release=r),module={exports:{}};
 const api={runtime:{id:'fixture',onMessage:{addListener:fn=>listener=fn},sendMessage:async()=>{await gate;return {ok:true,result:{valid:true,mode:'itens'}};}}};
 const doc={querySelector:s=>s.startsWith('section')?{}:null};
 vm.runInNewContext(fs.readFileSync(require.resolve('../../src/coleta-page'),'utf8'),{module,document:doc,location:{href:'https://www.idealista.pt/a/',origin:'https://www.idealista.pt'},URL,setTimeout,clearTimeout,AbortController,DOMParser:class{parseFromString(){return doc;}},fetch:async()=>{count++;return {status:200,url:'https://www.idealista.pt/b/',headers:{get:()=>null},text:async()=>''};}});
 module.exports.installCollectionExecutor(api,{extractItems:()=>({itens:[{id:'2'}],nextUrl:null}),extractLinks:()=>[]});
 const msg={cmd:'COLLECT_PAGE',sessionId:'s',epoch:1,requestId:'r',url:'https://www.idealista.pt/b/',fetch:true};
 const first=new Promise(r=>listener(msg,{id:'fixture'},r));const second=new Promise(r=>listener(msg,{id:'fixture'},r));release();
 const results=await Promise.all([first,second]);assert.equal(count,1);assert.equal(results.filter(r=>r.ok).length,1);
});

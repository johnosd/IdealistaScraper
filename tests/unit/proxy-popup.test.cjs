const test=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(existing=[]){
 const elements={},calls=[],alerts=[];let ready;
 const get=id=>elements[id]||=( {value:'',checked:false,disabled:false,style:{},addEventListener(e,fn){this[e]=fn;} } );
 get('extractItemsUrl').value='https://www.idealista.pt/listing/';
 const chrome={runtime:{getURL:f=>'chrome-extension://fixture/'+f,onMessage:{addListener(){}},sendMessage:async msg=>{if(msg.cmd==='PROXY_STATUS')return {enabled:false};calls.push(['runtime',msg]);return {ok:true,result:{status:'unknown'}};}},storage:{local:{get:(keys,cb)=>cb?.({}),set:async value=>calls.push(['draft',value])}},tabs:{query:async()=>existing,create:async o=>calls.push(['create',o]),update:async(id,o)=>calls.push(['focus',id,o])}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../../src/popup.js'),'utf8'),{chrome,document:{getElementById:get,addEventListener(e,fn){if(e==='DOMContentLoaded')ready=fn;}},console,alert:m=>alerts.push(m)});
 return {get,calls,alerts,chrome,ready:()=>ready()};
}
test('Itens abre tela durável e preserva URL sem navegar/coletar no popup',async()=>{
 const f=setup();await f.get('extractItems').click();assert.equal(f.calls[0][0],'draft');assert.equal(f.calls[1][0],'create');assert.equal(f.calls[1][1].url,'chrome-extension://fixture/itens.html');assert.equal(f.calls[1][1].active,true);assert.equal(f.get('extractItems').disabled,false);
});
test('Itens reutiliza tela existente e URL inválida não abre coleta',async()=>{
 const f=setup([{id:4}]);await f.get('extractItems').click();assert.equal(f.calls[1][0],'focus');
 const invalid=setup();invalid.get('extractItemsUrl').value='http://outside.invalid/';await invalid.get('extractItems').click();assert.equal(invalid.calls.length,0);assert.equal(invalid.alerts.length,1);
});
test('falha do launcher libera botão e informa erro sem iniciar crawler',async()=>{
 const f=setup();f.chrome.tabs.create=async()=>{throw Error('failed');};await f.get('extractItems').click();assert.equal(f.get('extractItems').disabled,false);assert.equal(f.alerts.length,1);
});
test('teste manual usa sonda do worker sem ativar/desativar proxy',async()=>{
 const f=setup();f.ready();await f.get('testProxyBtn').onclick();
 assert.deepEqual(f.calls.filter(c=>c[0]==='runtime').map(c=>c[1].cmd),['COLETA_TEST_IP']);
 assert.match(f.get('proxyTestResult').textContent,/não verificado/i);
});
test('desativação explícita respeita recusa do worker durante coleta',async()=>{
 const f=setup();f.chrome.runtime.sendMessage=async msg=>{f.calls.push(['runtime',msg]);return {ok:false,error:'Pause a coleta antes de alterar o proxy.'};};f.ready();
 await f.get('disableProxy').onclick();assert.match(f.get('proxyTestResult').textContent,/Pause a coleta/);
 assert.equal(f.calls.some(c=>c[1]?.cmd==='DISABLE_PROXY'),true);
});

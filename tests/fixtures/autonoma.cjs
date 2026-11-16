// Somente colaboradores de storage/DOM-rede/filesystem. Nenhuma regra da coleta.
const {MemoryCollectionStore}=require('./coleta-store.cjs');
const {MemoryDirectory,MemoryLocks}=require('./localidades-filesystem.cjs');
const {writeMunicipality}=require('../../src/lote-export');
const {DEFAULT_POLICY}=require('../../src/coleta-policy');
const {createAutonomousCollection}=require('../../src/coleta-autonoma');
const origin='https://www.idealista.pt';
const source={tabId:41,documentId:'source-document',url:origin+'/arrendar-casas/faro-distrito/'};
const url=name=>origin+'/arrendar-casas/'+name.toLowerCase()+'/';
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function fixture({names=['A','B','C'],response,discover}={}) {
  const store=new MemoryCollectionStore(),directory=new MemoryDirectory('municipios'),locks=new MemoryLocks();
  let time=Date.parse('2026-11-30T12:00:00Z'),sequence=0;
  const calls=[],writes=[],discoveries=[],preflights=[];
  const ports={
    store,now:()=>time,nextId:()=> 'autonomous-'+(++sequence),
    policy:{...DEFAULT_POLICY,maxSessionMs:172800000},
    async preflight(input){preflights.push(structuredClone(input));return {status:'ready',destination:{name:directory.name},proxyRevision:'proxy-1'};},
    async discover(input){discoveries.push(structuredClone(input));return discover?discover(input):{source:structuredClone(source),items:names.map(nome=>({nome,url:url(nome),quantidade:3}))};},
    async executePage(input){calls.push(structuredClone(input));return response?response(input,calls):{status:200,listing:true,finalUrl:input.url,records:[{id:input.url}],nextUrl:null};},
    async write(input){writes.push(structuredClone(input));return writeMunicipality({...input,directory,locks});},
    async reconcile(intent){const [month,name]=intent.relativePath.split('/');const file=directory.directories.get(month)?.files.get(name);return file?{status:'saved',relativePath:intent.relativePath}:{status:'save-unknown'};},
    async waitUntil(until){time=Math.max(time,until);},
    async proxySnapshot(){return {revision:'proxy-1'};}
  };
  return {store,directory,calls,writes,discoveries,preflights,ports,source:structuredClone(source),
    now:()=>time,advance:ms=>{time+=ms;},service:()=>createAutonomousCollection(ports)};
}
function settingsRepository() {
  let row={revision:1,limits:{...DEFAULT_POLICY},useProxy:false,ipEnabled:false,
    proxy:{host:'proxy.example',port:'8080',user:'operator',password:'fixture-secret'}};
  const commits=[];
  return {commits,async load(){return structuredClone(row);},
    async commit(value){commits.push(structuredClone(value));row=structuredClone(value);return structuredClone(row);}};
}
module.exports={fixture,source,url,origin,deferred,settingsRepository};

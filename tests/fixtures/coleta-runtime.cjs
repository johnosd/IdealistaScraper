const {MemoryCollectionStore}=require('./coleta-store.cjs');
const {installCollectionBackground}=require('../../src/coleta-background');
const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn);},removeListener(fn){this.listeners=this.listeners.filter(x=>x!==fn);}});
function runtimeFixture(options={}){
 const local={},session={},tabs=new Map([[1,{id:1,url:'chrome-extension://fixture/itens.html'}]]),proofs=new Map(),removed=[];
 const storage=data=>({async get(keys){return Object.fromEntries(keys.map(k=>[k,data[k]]));},async set(values){Object.assign(data,values);}});
 const api={runtime:{id:'fixture',getURL:path=>'chrome-extension://fixture/'+path,onMessage:event()},storage:{local:storage(local),session:storage(session)},
  tabs:{async get(id){if(!tabs.has(id))throw Error('No tab');return tabs.get(id);},async remove(id){removed.push(id);tabs.delete(id);},async sendMessage(id,message){if(!tabs.has(id)||!proofs.has(id))throw Error('No receiver');return proofs.get(id)(message);}},
  webRequest:{onHeadersReceived:event(),onBeforeRedirect:event(),onErrorOccurred:event()}};
 const store=new MemoryCollectionStore(),proxy={revision:'proxy-1',async prepare(){},async snapshot(){return {revision:this.revision,enabled:true};}};
 const boot=()=>installCollectionBackground(api,proxy,{store,...options});const runtime=boot();
 const send=(action,payload={},sender={id:'fixture',url:api.runtime.getURL('itens.html'),tab:{id:1}})=>new Promise(resolve=>{api.runtime.onMessage.listeners.at(-1)({cmd:'COLETA_'+action,payload},sender,resolve);});
 return {api,store,proxy,runtime,boot,send,tabs,proofs,removed,local,session};
}
module.exports={runtimeFixture};

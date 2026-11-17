const {createCollectionCoordinator}=require('../../src/coleta-coordinator');
const {MemoryCollectionStore}=require('./coleta-store.cjs');
const {DEFAULT_POLICY}=require('../../src/coleta-policy');
async function scenario(overrides={}){
 let time=Date.parse('2026-11-14T12:00:00Z'),seq=0;
 const store=new MemoryCollectionStore(),c=createCollectionCoordinator({store,now:()=>time});
 await c.updatePolicy({...DEFAULT_POLICY,...overrides});
 const started=await c.start({id:'scenario',mode:'itens',owner:'screen',domain:'idealista.pt',startedAt:new Date(time).toISOString(),proxyRevision:'proxy-1',items:[{nome:'Alvor',url:'https://www.idealista.pt/a/'}],exportContext:{yearMonth:'202611'}});
 return {store,c,epoch:started.epoch,advance:ms=>{time+=ms;},now:()=>time,
  command:(url='https://www.idealista.pt/a/')=>({id:'scenario',owner:'screen',epoch:started.epoch,requestId:'request-'+(++seq),url,kind:'navigation'})};
}
module.exports={scenario};

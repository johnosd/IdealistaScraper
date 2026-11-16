const {createCollectionWorkflow}=require('./coleta-runner');
const {REASONS}=require('./coleta-labels');
async function runLinksRunner({api=chrome,token,onStatus=()=>{}}){
 const send=(action,payload={})=>api.runtime.sendMessage({cmd:'AUTONOMA_LINKS_'+action,payload:{token,...payload}});
 let stage='claim',authorized=false;
 try{
  const claim=await send('CLAIM');
  if(!claim?.ok)throw Error('Executor indisponível');
  if(claim.result.status==='inactive'){onStatus('Execução inativa. Inicie ou retome pela aba Links.');return;}
  authorized=true;
  if(claim.result.status==='failed'){onStatus(REASONS[claim.result.reason]);return;}
  stage='start';
  const workflow=createCollectionWorkflow({api,mode:'links',autoSave:false,foreground:true,keepPage:true,
   onState(view,extra={}){onStatus(REASONS[extra.reason||view?.reason]||(view?.state==='awaiting-save'?'Localidades coletadas. Confira o resultado na aba Links.':'Coletando localidades. Acompanhe pela aba Links.'));}
  });
  // 006 D7: origem escolhida no background (página atual suportada ou nacional).
  const origin=claim.result.origin||{nome:'Localidades principais',url:'https://www.idealista.pt/arrendar-casas/#municipality-search'};
  const result=await workflow.start([{nome:origin.nome,url:origin.url}],claim.result.useProxy);
  if(!workflow.id)await send('FAILED',{stage,reason:result?.reason,until:result?.until});
 }catch{
  if(authorized)await send('FAILED',{stage,reason:'collector_start_failed'}).catch(()=>{});
  onStatus('Não foi possível iniciar. Confira o motivo na aba Links.');
 }finally{if(authorized)await send('FINISHED').catch(()=>{});}
}
module.exports={runLinksRunner};

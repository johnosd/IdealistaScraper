const {createCollectionWorkflow,abortableDelay}=require('./coleta-runner');
const {REASONS}=require('./coleta-labels');
const {planBlockRecovery}=require('./coleta-block-recovery');
// 006 US5/AC4: bloqueio durante a coleta de links também espera o prazo e reverifica sozinho (máx. 3),
// preservando os registros já obtidos. Novo ciclo de orçamento não se aplica (uma página).
async function recoverLinks(workflow,first,{onStatus,delay,now,maxRechecks}){
 let result=first,rechecks=0;
 while(workflow.id&&result&&!['collected','saved','awaiting-save'].includes(result.status)){
  const view=await workflow.client('READ',{id:workflow.id});
  const plan=planBlockRecovery({state:view.state,reason:view.reason,until:view.eligibility?.until??null,now:now(),rechecks,maxRechecks});
  if(!['recheck','resume'].includes(plan.action)){
   if(plan.reason==='access_blocked_persistent'||plan.reason==='rate_limit_persistent')onStatus(REASONS[plan.reason]);
   return {...result,persistent:plan.reason};
  }
  if(plan.counts)rechecks++;
  onStatus((view.reason==='access_blocked'?'O site pediu uma verificação. Nova tentativa automática às ':'Aguardando o prazo do site. Nova tentativa automática às ')+new Date(plan.until).toLocaleTimeString('pt-BR')+'.');
  await delay(Math.max(1,plan.until-now()));
  result=await workflow.resume(workflow.id,plan.action==='recheck');
 }
 return result;
}
async function runLinksRunner({api=chrome,token,onStatus=()=>{},createWorkflow=createCollectionWorkflow,delay=ms=>abortableDelay(ms),now=Date.now,maxRechecks=3}){
 const send=(action,payload={})=>api.runtime.sendMessage({cmd:'AUTONOMA_LINKS_'+action,payload:{token,...payload}});
 let stage='claim',authorized=false;
 try{
  const claim=await send('CLAIM');
  if(!claim?.ok)throw Error('Executor indisponível');
  if(claim.result.status==='inactive'){onStatus('Execução inativa. Inicie ou retome pela aba Links.');return;}
  authorized=true;
  if(claim.result.status==='failed'){onStatus(REASONS[claim.result.reason]);return;}
  stage='start';
  const workflow=createWorkflow({api,mode:'links',autoSave:false,foreground:true,keepPage:true,
   onState(view,extra={}){onStatus(REASONS[extra.reason||view?.reason]||(view?.state==='awaiting-save'?'Localidades coletadas. Confira o resultado na aba Links.':'Coletando localidades. Acompanhe pela aba Links.'));}
  });
  // 006 D7: origem escolhida no background (página atual suportada ou nacional).
  const origin=claim.result.origin||{nome:'Localidades principais',url:'https://www.idealista.pt/arrendar-casas/#municipality-search'};
  // 006 (pedido do usuário): retomar uma coleta de links pausada a partir da última página confirmada.
  const result=claim.result.resumeId?await workflow.resume(claim.result.resumeId,claim.result.accessConfirmed===true):await workflow.start([{nome:origin.nome,url:origin.url}],claim.result.useProxy);
  if(!workflow.id)await send('FAILED',{stage,reason:result?.reason,until:result?.until});
  else await recoverLinks(workflow,result,{onStatus,delay,now,maxRechecks});
 }catch{
  if(authorized)await send('FAILED',{stage,reason:'collector_start_failed'}).catch(()=>{});
  onStatus('Não foi possível iniciar. Confira o motivo na aba Links.');
 }finally{if(authorized)await send('FINISHED').catch(()=>{});}
}
module.exports={runLinksRunner,recoverLinks};

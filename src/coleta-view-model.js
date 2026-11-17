const {REASONS,STATES}=require('./coleta-labels');
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
function buildCollectionView({run=null,filter='all',query='',ready={}}={}){
 const items=run?.items||[],counts={total:items.length,queued:0,inProgress:0,saved:0,empty:0,pending:0};
 for(const item of items){if(item.state==='queued')counts.queued++;else if(item.state==='saved')counts.saved++;else if(item.state==='empty')counts.empty++;else if(['running','waiting','saving'].includes(item.state))counts.inProgress++;else counts.pending++;}
 const state=run?.state||'ready';
 const actions={
  ready:ready.configured===false?['configure','Configurar pasta']:['start','Iniciar coleta'],
  discovering:['pause','Pausar coleta'],running:['pause','Pausar coleta'],waiting:['pause','Pausar coleta'],
  pausing:['none','Pausando…'],paused:['resume','Retomar coleta'],interrupted:['resume','Retomar coleta'],
  'finished-with-pending':['resume-pending','Retomar pendentes'],completed:['new','Nova coleta']
 };
 let [id,label]=actions[state]||['resolve','Resolver impedimento'];
 if(['paused','interrupted'].includes(state)){
  if(['permission_required','destination_unavailable','destination_collision'].includes(run?.reason)){id='resolve';label='Resolver destino';}
  else if(['run_budget','item_budget','session_duration','proxy_changed','proxy_error'].includes(run?.reason)){id='configure';label='Conferir configurações';}
  else if(run?.reason==='access_blocked')label='Conferir acesso e retomar';
  if(!items.length){id='new';label='Preparar nova coleta';}
 }
 const recoverable=items.filter(i=>i.state==='pending'&&i.recoverable!==false).length;
 const rows=items.filter(item=>(filter==='all'||filter==='completed'&&['saved','empty'].includes(item.state)||filter==='running'&&['running','waiting','saving'].includes(item.state)||item.state===filter)&&normalize(item.nome).includes(normalize(query)))
   .map(item=>({...item,stateLabel:STATES[item.state]||'Pendente',reasonLabel:REASONS[item.reason]||'',action:item.state==='pending'&&item.recoverable!==false?{id:item.stage==='save'?'save':'resume',label:item.stage==='save'?'Tentar salvar novamente':'Retomar coleta'}:null}));
 return {counts,progress:{value:counts.saved+counts.empty,max:counts.total,label:'Localidades concluídas',indeterminate:state==='discovering'||!counts.total},primaryAction:{id,label:id==='resume-pending'?label+' ('+recoverable+')':label,enabled:id!=='none'&&(id!=='resume-pending'||recoverable>0),reason:REASONS[run?.reason]||''},rows,state,stateLabel:STATES[state]||'Pronta para coletar',recoverable,blocked:counts.pending-recoverable};
}
module.exports={buildCollectionView};

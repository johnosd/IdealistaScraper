// Metadados de itens v2. A autoridade e as transações continuam no coordenador.
const copy=value=>structuredClone(value);
function initializeItems(s){
  s.schemaVersion=2;s.autonomous=true;s.runState=s.state==='saved'?'completed':s.state;
  s.itemStates={};
  s.items=s.items.map((item,index)=>({...item,id:item.id||`${s.id}-item-${index}`,originalIndex:index}));
  for(const item of s.items){
    const receipt=Object.values(s.receipts||{}).find(r=>r.itemIndex===item.originalIndex);
    const checkpoint=s.archivedCheckpoints?.[item.originalIndex]||(item.originalIndex===Math.min(s.itemIndex,s.items.length-1)?s.checkpoint:null);
    s.itemStates[item.id]={id:item.id,index:item.originalIndex,state:receipt?'saved':checkpoint?.confirmedPages?'pending':'queued',recoverable:!receipt,reason:receipt?null:s.reason||null,checkpoint:checkpoint?copy(checkpoint):null,receipt:receipt||null,saveIntent:null};
  }
  s.selection={ids:s.items.filter(i=>s.itemStates[i.id].state!=='saved').map(i=>i.id),cursor:0};
  if(s.items[s.itemIndex]&&['running','waiting','awaiting-save'].includes(s.state))s.itemStates[s.items[s.itemIndex].id].state='running';
}
function currentItem(s){return s.itemStates?.[s.items[s.itemIndex]?.id];}
function syncItem(s){
  if(['running','waiting','awaiting-save'].includes(s.state)&&s.runState!=='pausing')s.runState=s.state==='waiting'?'waiting':'running';
  else if(['paused','blocked','interrupted','cancelled'].includes(s.state)&&!['finished-with-pending','completed'].includes(s.runState))s.runState=s.state==='blocked'?'paused':s.state;
  const item=currentItem(s);if(!item)return;item.checkpoint=copy(s.checkpoint);item.saveIntent=s.saveIntent?copy(s.saveIntent):null;
  if(!['saved','empty','pending','discarded'].includes(item.state))item.state=['running','waiting','awaiting-save'].includes(s.state)?'running':s.state==='discovering'?'queued':'pending';
  if(['paused','blocked','interrupted','cancelled'].includes(s.state)&&!['saved','empty','discarded'].includes(item.state)){item.state=item.started||s.checkpoint.confirmedPages||s.checkpoint.complete?'pending':'queued';if(!['pending_items','selection_finished'].includes(s.reason))item.reason=s.reason;item.recoverable=true;}
}
function counts(s){const out={total:s.items.length,queued:0,inProgress:0,saved:0,empty:0,pending:0};for(const item of Object.values(s.itemStates||{})){if(item.state==='queued')out.queued++;else if(item.state==='saved')out.saved++;else if(item.state==='empty')out.empty++;else if(['running','waiting','saving'].includes(item.state))out.inProgress++;else out.pending++;}return out;}
function advance(s,d){
  syncItem(s);s.selection.cursor++;
  const next=s.selection.ids[s.selection.cursor];
  if(next){const item=s.itemStates[next];s.itemIndex=item.index;s.checkpoint=copy(item.checkpoint);s.saveIntent=item.saveIntent?copy(item.saveIntent):null;item.state='running';item.reason=null;s.state=s.checkpoint?.complete?'awaiting-save':'running';s.reason=null;s.runState='running';d.active=s.id;}
  else{const total=counts(s);s.state=total.saved+total.empty===total.total?'saved':'paused';s.runState=s.state==='saved'?'completed':total.queued?'paused':'finished-with-pending';s.reason=s.state==='saved'?null:total.queued?'selection_finished':'pending_items';if(d.active===s.id)d.active=null;}
}
module.exports={initializeItems,currentItem,syncItem,counts,advance};

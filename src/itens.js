const {mountCollectionUI}=require('./coleta-ui');
const {validateBatchURL}=require('./lote-input');
const {collectionDownloadName:filename}=require('./coleta-download');
const el=id=>document.getElementById(id);
const panel=mountCollectionUI({mode:'itens',showSettings:false,destination:filename,
  save:async view=>{
    const blob=new Blob([JSON.stringify(view.checkpoint.records,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename(view);document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    el('items-status').textContent='Download solicitado. Confira o arquivo e confirme em “Já baixei este resultado”.';
    return {status:'download-requested'};
  },
  onState(view,extra){el('items-start').disabled=panel.running;el('items-url').disabled=panel.running;el('items-proxy').disabled=panel.running;
    if(view)el('items-status').textContent=view.state==='saved'?'Resultado confirmado.':view.state==='awaiting-save'?'Resultado completo disponível para salvar/confirmar.':`Páginas confirmadas: ${view.checkpoint.confirmedPages}`;
  },
});
el('items-start').addEventListener('click',async()=>{
  el('items-start').disabled=true;
  try{const url=validateBatchURL(el('items-url').value);await chrome.storage.local.set({collectionItemsURL:url,usarProxy:el('items-proxy').checked?'true':'false'});
    await panel.start([{url,nome:'Resultado'}],el('items-proxy').checked);await panel.refreshSessions();
  }catch(error){el('items-status').textContent=error.message;}finally{el('items-start').disabled=false;}
});
chrome.storage.local.get(['collectionItemsURL','usarProxy']).then(data=>{el('items-url').value=data.collectionItemsURL||'';el('items-proxy').checked=data.usarProxy==='true';el('items-status').textContent='Pronto para iniciar ou selecionar uma sessão recuperável.';});

const SAVE_FAILURES=Object.freeze({
 permission_required:'Acesso à pasta não autorizado.',quota_exceeded:'Sem espaço para gravar o arquivo.',
 destination_unavailable:'Pasta ou arquivo indisponível.',writer_busy:'Outra tela está gravando nesse destino.',
 write_error:'Não foi possível gravar o arquivo.'
});
function classifySaveFailure(value){
 if(value?.status==='permission-required'||['NotAllowedError','SecurityError'].includes(value?.name))return 'permission_required';
 if(value?.name==='QuotaExceededError')return 'quota_exceeded';
 if(value?.name==='NotFoundError')return 'destination_unavailable';
 if(value?.status==='busy')return 'writer_busy';
 if(['saved','cancelled','empty','download-requested'].includes(value?.status))return null;
 return 'write_error';
}
module.exports={SAVE_FAILURES,classifySaveFailure};

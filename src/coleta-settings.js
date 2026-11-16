const {validatePolicy}=require('./coleta-policy');
function publicSettings(row){
 return {revision:row.revision,limits:structuredClone(row.limits),useProxy:row.useProxy===true,ipEnabled:row.ipEnabled===true,
  proxy:{host:row.proxy?.host||'',port:String(row.proxy?.port||''),user:row.proxy?.user||'',passwordConfigured:!!row.proxy?.password}};
}
function createCollectionSettings({repository,isActive=async()=>false}){
 return {
  async load(){return publicSettings(await repository.load());},
  async revealPassword({expectedRevision}={}){const row=await repository.load();return row.revision===expectedRevision?{status:'revealed',password:row.proxy?.password||''}:{status:'conflict'};},
  async save({expectedRevision,values}={}){
   const errors={};let limits;
   try{limits=validatePolicy(values?.limits);}catch{for(const [k,[min,max]]of Object.entries(require('./coleta-policy').RANGES)){const n=values?.limits?.[k];if(!Number.isSafeInteger(n)||n<min||n>max)errors[k]='Informe um valor inteiro entre '+min+' e '+max+'.';}}
   if(typeof values?.useProxy!=='boolean')errors.useProxy='Escolha a conexão.';
   if(typeof values?.ipEnabled!=='boolean')errors.ipEnabled='Escolha a opção de diagnóstico.';
   const p=values?.proxy;
   if(p&&['host','port','user','password'].some(k=>p[k]!==undefined&&typeof p[k]!=='string'))errors.proxy='Configuração inválida.';
   if(values?.useProxy){
    // Omitted fields retain their private stored values; validation also runs after merge.
    if(p?.host!==undefined&&!/^[a-z0-9.-]+$/i.test(p.host.trim()))errors.host='Informe o host sem protocolo ou caminho.';
    if(p?.port!==undefined&&(!/^\d+$/.test(p.port)||Number(p.port)<1||Number(p.port)>65535))errors.port='Informe uma porta entre 1 e 65535.';
   }
   if(Object.keys(errors).length)return {status:'invalid',errors};
   if(await isActive())return {status:'busy'};
   try{
    const previous=await repository.load();if(expectedRevision!==previous.revision)return {status:'conflict'};
    const proxy={...previous.proxy,...p};proxy.host=(proxy.host||'').trim();
    if(!p?.password)proxy.password=previous.proxy?.password||'';
    if(values.useProxy&&(!/^[a-z0-9.-]+$/i.test(proxy.host)||!/^\d+$/.test(String(proxy.port))||Number(proxy.port)<1||Number(proxy.port)>65535))return {status:'invalid',errors:{host:'Confira host e porta do proxy.'}};
    const next={revision:previous.revision+1,limits,useProxy:values.useProxy,ipEnabled:values.ipEnabled,proxy};
    const committed=await repository.commit(next,{expectedRevision});
    if(committed?.status&&committed.status!=='saved')return committed;
    return {status:'saved',settings:publicSettings(next)};
   }catch{return {status:'error',message:'Não foi possível salvar. Suas edições foram preservadas.'};}
  }
 };
}
module.exports={createCollectionSettings,publicSettings};

const {DEFAULT_POLICY}=require('./coleta-policy');
const KEY='config:005',DOMAIN='domain:idealista.pt';
function createSettingsRepository({store,storage}){
 const project=async row=>storage.set({proxyHost:row.proxy.host,proxyPort:String(row.proxy.port||''),proxyUser:row.proxy.user,proxyPass:row.proxy.password,usarProxy:String(row.useProxy),collectionIpEnabled:row.ipEnabled});
 return {
  async load(){
   const current=(await store.read([KEY]))[KEY];if(current)return current;
   const old=await storage.get(['proxyHost','proxyPort','proxyUser','proxyPass','usarProxy','collectionIpEnabled']);
   return store.transact([KEY,'policy'],rows=>{
    if(rows[KEY])return {writes:{},result:rows[KEY]};
    const row={revision:1,limits:rows.policy||structuredClone(DEFAULT_POLICY),useProxy:old.usarProxy===true||old.usarProxy==='true',ipEnabled:old.collectionIpEnabled===true,proxy:{host:old.proxyHost||'',port:String(old.proxyPort||''),user:old.proxyUser||'',password:old.proxyPass||''}};
    return {writes:{[KEY]:row,policy:row.limits},result:row};
   });
  },
  async commit(row,{expectedRevision}={}){
   const result=await store.transact([KEY,'policy',DOMAIN],rows=>{
    if(rows[DOMAIN]?.active)return {writes:{},result:{status:'busy'}};
    if(rows[KEY]?.revision!==expectedRevision)return {writes:{},result:{status:'conflict'}};
    return {writes:{[KEY]:row,policy:row.limits},result:{status:'saved'}};
   });
   if(result.status==='saved')try{await project(row);}catch{result.projectionPending=true;}
   return result;
  }
 };
}
module.exports={createSettingsRepository};

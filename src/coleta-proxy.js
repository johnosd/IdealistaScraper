// Estado privado do worker: só o contador opaco sai deste módulo.
function createProxyRevision(storage){
  return async function observe(actual,credentialRevision=''){
    const previous=(await storage.get(['proxyContextState'])).proxyContextState;
    const fingerprint=JSON.stringify([actual.levelOfControl,actual.value,credentialRevision]);
    if(previous?.fingerprint===fingerprint)return `context-${previous.serial}`;
    const serial=(previous?.serial||0)+1;
    await storage.set({proxyContextState:{fingerprint,serial}});return `context-${serial}`;
  };
}
module.exports={createProxyRevision};

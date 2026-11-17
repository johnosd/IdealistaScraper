async function probePublicIP({fetchImpl=fetch,signal,timeoutMs=5000,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>10000)throw new TypeError('Prazo inválido');
  const controller=new AbortController();let timer,finish;
  const unknown=()=>({status:'unknown'}),aborted=new Promise(resolve=>{finish=resolve;});
  function abort(){controller.abort();finish(unknown());}
  signal?.addEventListener('abort',abort,{once:true});
  timer=setTimer(abort,timeoutMs);
  try{
    if(signal?.aborted){abort();return unknown();}
    const operation=(async()=>{
      try{
        const response=await fetchImpl('https://api.ipify.org?format=json',{cache:'no-store',credentials:'omit',redirect:'error',signal:controller.signal});
        if(!response.ok)return unknown();const data=await response.json(),ip=data?.ip;
        const valid=typeof ip==='string'&&ip.length<=45&&(/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)&&ip.split('.').every(n=>Number(n)<=255)||/^[a-f0-9:]+$/i.test(ip)&&ip.includes(':'));
        return valid?{status:'verified',ip}:unknown();
      }catch{return unknown();}
    })();
    return await Promise.race([operation,aborted]);
  }finally{clearTimer(timer);signal?.removeEventListener('abort',abort);}
}
module.exports={probePublicIP};

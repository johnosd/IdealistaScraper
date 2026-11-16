// Read-only opt-in diagnosis. Secrets are read locally and passed to curl through stdin only.
const fs=require('node:fs'),{spawnSync}=require('node:child_process');
if(!process.argv.includes('--real')){console.log(JSON.stringify({status:'not-run',reason:'explicit --real required'}));process.exit(0);}
try{process.loadEnvFile('.env');}catch{console.log(JSON.stringify({status:'not-run',reason:'env unavailable'}));process.exit(1);}
const host=process.env.PROXY_CHEAP_IP?.trim(),port=process.env.PROXY_CHEAP_PORT?.trim(),user=process.env.PROXY_CHEAP_USER,password=process.env.PROXY_CHEAP_PASS;
if(!host||!port||!user||!password||![host,port,user,password].every(s=>!s.includes('\n')&&!s.includes('\r'))){console.log(JSON.stringify({status:'not-run',reason:'missing or invalid env variables'}));process.exit(1);}
function quote(s){return '"'+s.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';}
function request(proxy){
 const config=['url = "https://api.ipify.org?format=json"','connect-timeout = 8','max-time = 15','silent','show-error','noproxy = ""','write-out = "\\n%{http_code}"',
  'proxy = '+quote(proxy?'http://'+host+':'+port:''),...(proxy?['proxy-basic','proxy-user = '+quote(user+':'+password)]:[])].join('\n');
 const result=spawnSync('curl.exe',['--config','-'],{input:config,encoding:'utf8',timeout:18000,windowsHide:true});
 const lines=(result.stdout||'').trim().split('\n');const status=Number(lines.pop());let ip=null;try{ip=JSON.parse(lines.join('\n')).ip;}catch{}
 return {exit:result.status,httpStatus:status,ip,success:result.status===0&&status===200&&!!ip};
}
const direct=request(false),proxied=request(true);
const result={realNetwork:true,endpoint:'api.ipify.org',direct:{success:direct.success,exit:direct.exit,httpStatus:direct.httpStatus},proxy:{success:proxied.success,exit:proxied.exit,httpStatus:proxied.httpStatus},ipChanged:direct.success&&proxied.success?direct.ip!==proxied.ip:null};
fs.writeFileSync('.sdd/specs/005-experiencia-coleta-autonoma/validation/proxy-provider-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
if(!proxied.success)process.exitCode=1;


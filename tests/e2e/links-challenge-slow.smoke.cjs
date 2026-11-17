// 006 (validação real 2026-11-16): a página nacional veio com desafio Cloudflare (403, cf-mitigated: challenge,
// "Just a moment...") que o próprio site resolve após alguns segundos. O leitor não pode se vincular ao documento do
// desafio, e a observação passiva precisa durar o bastante; o app não recarrega nem tenta de novo por conta própria.
const {openBrowser,poll}=require('../fixtures/coleta-browser.cjs'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{const profile=await fs.mkdtemp(path.join(os.tmpdir(),'idealista006-challenge-slow-'));let b,requests=0;try{
 const html=(await fs.readFile(path.join(__dirname,'../fixtures/idealista-locations-2026-11-15.html'),'utf8')).replace(/<p>[\d.]+<\/p>/g,'<p>0</p>')/* 006 D16/R-020: contagem 0 = sem visita às páginas de distrito aqui; a expansão é coberta por links-district.smoke */;
 // Desafio: 403 + cf-mitigated; a própria página recarrega depois de 7 s: o leitor roda no documento do desafio
 // (o código antigo se vinculava a ele e recusava o documento real).
 const challenge='<!doctype html><html><head><meta charset="utf-8"><title>Just a moment...</title><meta http-equiv="refresh" content="7;url=/arrendar-casas/"></head><body><h1>www.idealista.pt</h1></body></html>';
 b=await openBrowser(profile,route=>{requests++;const first=requests===1;return route.fulfill({status:first?403:200,headers:first?{'cf-mitigated':'challenge'}:{},contentType:'text/html; charset=utf-8',body:first?challenge:'<!doctype html><html><head><meta charset="utf-8"><title>Localidades</title></head><body>'+html+'</body></html>'});});
 const p=await b.context.newPage();await p.goto(b.base+'sidepanel.html');await p.getByRole('tab',{name:'Links',exact:true}).click();await p.locator('#tool-links-open').click();
 const read=()=>p.evaluate(async()=>(await chrome.runtime.sendMessage({cmd:'AUTONOMA_LINKS_READ'})).result);
 let view;try{view=await poll(read,v=>['collected','paused','blocked','interrupted'].includes(v.state),{timeout:60000});}catch(e){console.error(JSON.stringify(await read()));throw e;}
 if(view.state!=='collected')console.error(JSON.stringify({state:view.state,reason:view.reason,status:view.status,requests}));
 assert.equal(view.state,'collected','desafio resolvido pelo próprio site deve concluir a coleta');assert.ok(view.total>=84);
 assert.equal(requests,2,'somente a navegação inicial e a transição do próprio site (sem retry do app)');
 assert.deepEqual(b.errors,[]);
 console.log(JSON.stringify({pass:true,proof:'real extension; controlled 403 cf-mitigated challenge resolved by site-owned refresh after 7s',requests,records:view.total}));
}finally{await b?.context.close();const resolved=path.resolve(profile);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep+'idealista006-challenge-slow-'));await fs.rm(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:300});}})().catch(e=>{console.error(e);process.exitCode=1;});

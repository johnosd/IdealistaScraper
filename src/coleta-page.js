// Fatos DOM somente; nenhuma navegação implícita ao carregar o módulo.
// Títulos de desafio observados no site real (006 site-inspection §7): "Just a moment..." e "Um momento…".
const CHALLENGE_TITLE = /just a moment|um momento|access denied|acesso negado|attention required|verifique que é humano/i;
// Total declarado da listagem: número inicial do h1 ("9.655 casas e apartamentos…"). Sem h1 confiável → null.
function readDeclaredTotal(doc) {
  const text = (doc.querySelector('h1')?.textContent || '').replace(/\s+/g, ' ').trim();
  const match = /^([\d.]+)\s+(?:casas|apartamentos|moradias|imóveis|quartos|escritórios|garagens|terrenos)\b/i.exec(text);
  if (!match || !/^\d{1,3}(?:\.\d{3})*$/.test(match[1])) return null;
  const value = Number(match[1].replace(/\./g, ''));
  return Number.isSafeInteger(value) ? value : null;
}
function inspectCollectionPage(doc) {
  const listing = !!doc.querySelector('section.items-container.items-list');
  const challenge = !listing && (!!doc.querySelector('#challenge-form, #challenge-running, #cf-challenge-running, iframe[src*="captcha"]') ||
    CHALLENGE_TITLE.test(doc.title || ''));
  const login = !listing && !!doc.querySelector('form input[type="password"]');
  const empty = !challenge && !login && /não foram encontrados|nenhum resultado/i.test(doc.querySelector('.not-found, .no-results')?.textContent || '');
  return { listing, challenge, login, empty };
}
function waitForCollectionDOM(doc,mode,extractLinks,signal,timeoutMs){
  if(typeof MutationObserver!=='function')return Promise.resolve();
  function ready(){const f=inspectCollectionPage(doc);return f.listing||f.challenge||f.login||f.empty||(mode==='links'?extractLinks().length>0:[...doc.querySelectorAll('a[href]')].some(a=>/^Ver\s+[\d.,\s]+\s+(casas|apartamentos|imóveis)\b/i.test(a.textContent.trim())));}
  if(ready())return Promise.resolve();
  return new Promise((resolve,reject)=>{
    let observer,timer;function done(error){observer?.disconnect();clearTimeout(timer);signal.removeEventListener('abort',abort);error?reject(error):resolve();}
    function abort(){done(new Error('Coleta interrompida'));}
    observer=new MutationObserver(()=>{if(ready())done();});observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true});
    timer=setTimeout(()=>done(),Math.min(10000,timeoutMs));signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
  });
}
function installCollectionExecutor(api, { extractItems, extractLinks, inspectLocalities, nextExpansionUrl }) {
  if(globalThis.__idealistaCollectionExecutor)return;
  globalThis.__idealistaCollectionExecutor=true;
  let context=null,active=null;
  async function validate(message,network){
    const response=await api.runtime.sendMessage({cmd:'COLETA_VALIDATE',payload:{id:message.sessionId,epoch:message.epoch,requestId:message.requestId,network}});
    if(!response?.ok||!response.result?.valid)throw new Error('Permissão de coleta inválida');
    context={sessionId:message.sessionId,epoch:message.epoch,documentId:response.result.documentId};return response.result.mode;
  }
  api.runtime.onMessage.addListener((message,sender,respond)=>{
    if(!['COLLECT_PAGE','COLETA_EXECUTOR_PROOF','COLETA_ABORT'].includes(message?.cmd))return;
    if(sender.id!==api.runtime.id)return;
    let controller=null;
    if(message.cmd==='COLLECT_PAGE'){
      if(active){respond({ok:false,code:'EXECUTOR_BUSY'});return;}
      controller=new AbortController();active=controller;
    }
    (async()=>{
      if(message.cmd==='COLETA_EXECUTOR_PROOF'){
        if(!context&&message.requestId)await validate(message,false);
        return context?.sessionId===message.sessionId&&context.epoch===message.epoch?context:{};
      }
      if(message.cmd==='COLETA_ABORT'){active?.abort();return {aborted:true};}
      // 006 (validação real): documento de desafio ("Just a moment…", "Um momento…") não se vincula à requisição;
      // só informa o desafio, para o documento real que o próprio site carregar em seguida poder ser validado.
      if(!message.fetch){const pre=inspectCollectionPage(document);if(pre.challenge){if(active===controller)active=null;return {status:null,finalUrl:location.href,...pre,transientChallenge:/just a moment|um momento/i.test(document.title||''),listing:false,records:[],nextUrl:null};}}
      const mode=await validate(message,message.fetch===true);
      if(controller.signal.aborted)throw new Error('Coleta interrompida');
      const timer=setTimeout(()=>controller.abort(),Math.min(120000,message.timeoutMs||30000));
      try{
        let doc=document,status=null,finalUrl=location.href,headers={};
        if(message.fetch){
          const url=new URL(message.url,location.href);if(url.origin!==location.origin||url.protocol!=='https:')throw new Error('Próxima página fora da origem');
          let response;
          try{response=await fetch(url.href,{credentials:'same-origin',signal:controller.signal});}
          catch{return {status:null,transportError:true,finalUrl:url.href,records:[]};}
          status=response.status;finalUrl=response.url;
          headers={retryAfter:response.headers.get('retry-after'),serverDate:response.headers.get('date'),mitigated:response.headers.get('cf-mitigated')};
          doc=new DOMParser().parseFromString(await response.text(),'text/html');
        }
        if(!message.fetch)await waitForCollectionDOM(doc,mode,extractLinks,controller.signal,message.timeoutMs||30000);
        const facts=inspectCollectionPage(doc);
        if(mode==='links'){
          // 006 FR-004: contagem visível × coletada, estratégia e excluídos (zonas/vizinhos) da mesma leitura.
          const view=inspectLocalities?inspectLocalities(doc):{strategy:null,records:extractLinks(),visible:null,excluded:null};
          // 006 D16/R-020: páginas de distrito na coleta de links contribuem com concelhos (cobertura dos distritos grandes)
          // e freguesias (lista de validação da Freguesia); a cadeia visita a página de todos os distritos (limite 0).
          const records=view.strategy==='distrito'?view.records.filter(r=>r.Tipo==='Município'||r.Tipo==='Freguesia'):view.records;
          // Página de distrito pedida pela cadeia (…/concelhos-freguesias): áreas pequenas redirecionam para a listagem
          // e não têm lista; isso é normal (nada a acrescentar) e a cadeia segue. A página de origem sem lista continua erro.
          let expansionPage=false;try{expansionPage=/\/concelhos-freguesias\/?$/.test(new URL(message.url).pathname);}catch{}
          return {status,finalUrl,documentId:context.documentId,...headers,...facts,listing:records.length>0||expansionPage&&!facts.challenge&&!facts.login,records,nextUrl:nextExpansionUrl?nextExpansionUrl(doc,0,message.url):null,linksAudit:{strategy:view.strategy,visible:view.visible,excluded:view.excluded}};
        }
        const output=extractItems(doc,finalUrl);
        if(!facts.listing&&!facts.challenge&&!facts.login){
          const destinations=[...new Set([...doc.querySelectorAll('a[href]')].filter(a=>/^Ver\s+[\d.,\s]+\s+(casas|apartamentos|imóveis)\b/i.test(a.textContent.trim())).map(a=>new URL(a.getAttribute('href'),finalUrl).href))];
          if(destinations.length===1)return {status,finalUrl,...headers,...facts,destinationUrl:destinations[0],records:[],nextUrl:destinations[0]};
        }
        return {status,finalUrl,documentId:context.documentId,...headers,...facts,listing:facts.listing&&output.itens.length>0,records:output.itens,nextUrl:output.nextUrl,declaredTotal:facts.listing?readDeclaredTotal(doc):null};
      }finally{clearTimeout(timer);if(active===controller)active=null;}
    })().then(value=>respond({ok:true,...value}),()=>{if(controller&&active===controller)active=null;respond({ok:false,error:'Falha ou interrupção na coleta da página'});});
    return true;
  });
}
module.exports = { inspectCollectionPage, installCollectionExecutor, readDeclaredTotal, CHALLENGE_TITLE };

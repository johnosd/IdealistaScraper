const {validateBatchURL}=require('./lote-input');
// Legado (005): somente o breadcrumb destacado. Mantido por compatibilidade; a descoberta usa o extrator único (006, D1).
// Serializada pelo Chrome: sem referências a imports/closures.
function extractDirectLocalities(doc=document){
  return [...doc.querySelectorAll('.breadcrumb-dropdown-element.highlighted ul.breadcrumb-dropdown-subitem-list > li')].flatMap(item=>{
    const anchor=item.querySelector('a'),count=item.querySelector('.breadcrumb-navigation-sidenote');
    if(!anchor)return [];
    const digits=count?.textContent?.replace(/[^\d]/g,'');
    return [{nome:anchor.textContent.trim(),url:anchor.href,quantidade:digits?Number(digits):null}];
  });
}
// Serializada: lê o extrator único exposto pelo content script linkExtractor (mesmo mundo isolado da extensão).
function readPageLocalities(){
  const api=globalThis.__idealistaLocalities;if(!api)return null;
  const view=api.inspectLocalities(document);
  return {strategy:view.strategy,visible:view.visible,excluded:view.excluded,items:view.records.map(record=>{
    const digits=String(record.Contagem||'').replace(/[^\d]/g,'');
    return {nome:record.Texto||record['Município']||record['Sub-região']||record['Região']||record.URL,url:record.URL,quantidade:digits?Number(digits):null,record};
  })};
}
async function readSourceLocalities(api,tabId){
  await api.scripting.executeScript({target:{tabId,frameIds:[0]},files:['dist/linkExtractor.bundle.js']});
  const [result]=await api.scripting.executeScript({target:{tabId,frameIds:[0]},func:readPageLocalities});
  return result;
}
async function identifySource(api,tabId){
  const tab=await api.tabs.get(tabId);validateBatchURL(tab.url);
  const [probe]=await api.scripting.executeScript({target:{tabId,frameIds:[0]},func:()=>location.href});
  if(!probe||probe.result!==tab.url)throw new Error('A página de origem mudou.');
  return {tabId,url:tab.url,...(probe.documentId?{documentId:probe.documentId}:{})};
}
async function discoverSource(api,source){
  const before=await identifySource(api,source.tabId);
  if(before.url!==source.url||source.documentId&&before.documentId!==source.documentId)throw new Error('A página de origem mudou.');
  const result=await readSourceLocalities(api,source.tabId);
  const tab=await api.tabs.get(source.tabId);
  if(!result||tab.url!==source.url||before.documentId&&result.documentId!==before.documentId)throw new Error('A página de origem mudou.');
  const view=result.result;
  return {source:{...source,...(result.documentId?{documentId:result.documentId}:{})},items:Array.isArray(view)?view:view?.items||[],strategy:view?.strategy||null,visible:view?.visible??null};
}
module.exports={extractDirectLocalities,readPageLocalities,readSourceLocalities,identifySource,discoverSource};

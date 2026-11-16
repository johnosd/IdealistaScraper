function collectionDownloadName(view){
  let slug=view.items[view.itemIndex].url.replace(/^https?:\/\/[^/]+\/geo\//,'').replace(/[?#].*$/,'').replace(/\/$/,'').replace(/\//g,'-');
  if(!slug)slug='resultado';
  return `${slug}-Paginas${view.checkpoint.confirmedPages}-${view.exportContext.downloadStamp}.json`;
}
function localExportContext(date){
  const p=n=>String(n).padStart(2,'0');
  return {yearMonth:`${date.getFullYear()}${p(date.getMonth()+1)}`,downloadStamp:`${date.getFullYear()}${p(date.getMonth()+1)}${p(date.getDate())}${p(date.getHours())}${p(date.getMinutes())}`};
}
module.exports={collectionDownloadName,localExportContext};

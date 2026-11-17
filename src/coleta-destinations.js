async function distinctDestination({directory,items,itemId,relativePath,load}){
 for(const item of items){
  if(item.id===itemId||item.receipt?.relativePath!==relativePath)continue;
  const previous=await load(item.receipt.directoryKey||undefined);
  if(!previous||!directory?.isSameEntry)throw Error('Não foi possível conferir o destino anterior.');
  if(await directory.isSameEntry(previous))return false;
 }
 return true;
}
module.exports={distinctDestination};

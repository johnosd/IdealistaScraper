const test=require('node:test'),assert=require('node:assert/strict');
const {mountCollectionUI}=require('../../src/coleta-ui');
const {createCollectionCoordinator}=require('../../src/coleta-coordinator');
const {MemoryCollectionStore}=require('../fixtures/coleta-store.cjs');
class Element{
 constructor(tag){this.tag=tag;this.children=[];this.handlers={};this.textContent='';}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}
 setAttribute(name,value){this[name]=value;}addEventListener(name,fn){this.handlers[name]=fn;}
}
test('painel mostra limites com rótulos e ajustes inválidos não apagam política',async()=>{
 const previous=global.document,main=new Element('main');main.dataset={};
 function find(id,node=main){if(node.id===id)return node;for(const child of node.children){const got=find(id,child);if(got)return got;}}
 global.document={body:main,createElement:tag=>{const el=new Element(tag);el.dataset={};return el;},querySelector:()=>main};
 try{
  const c=createCollectionCoordinator({store:new MemoryCollectionStore()});
  const api={runtime:{sendMessage:async m=>{try{return {ok:true,result:m.cmd==='COLETA_GET_POLICY'?{limits:await c.policy(),ipEnabled:false}:m.cmd==='COLETA_LIST'?[]:{limits:await c.updatePolicy(m.payload.limits)}};}catch{return {ok:false};}}}};
  mountCollectionUI({api,mode:'itens'});await new Promise(setImmediate);
  assert.equal(find('collection-minIntervalMs').value,10);
  find('collection-minIntervalMs').value=0;await find('collection-policy').handlers.submit({preventDefault(){}});
  assert.equal((await c.policy()).minIntervalMs,10000);
  find('collection-minIntervalMs').value=12;await find('collection-policy').handlers.submit({preventDefault(){}});
  assert.equal((await c.policy()).minIntervalMs,12000);
 }finally{global.document=previous;}
});

const test=require('node:test'),assert=require('node:assert/strict');
const {mountSidePanel,summaryText}=require('../../src/sidepanel');
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.handlers={};this.hidden=false;this.value='';this.textContent='';this.isConnected=true;this.open=false;}
 append(...nodes){for(const n of nodes){this.children.push(n);n.parent=this;}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 addEventListener(event,fn){(this.handlers[event]??=[]).push(fn);}
 removeEventListener(event,fn){this.handlers[event]=(this.handlers[event]||[]).filter(v=>v!==fn);}
 async fire(event){for(const fn of this.handlers[event]||[])await fn({preventDefault(){}});}
 setAttribute(k,v){this[k]=v;}removeAttribute(k){delete this[k];}
 remove(){this.parent.children=this.parent.children.filter(n=>n!==this);this.isConnected=false;}
 focus(){this.doc.activeElement=this;}
}
function fixture(run=null){
 const nodes=new Map();const el=id=>{if(!nodes.has(id)){const e=new Element('div');e.id=id;nodes.set(id,e);}return nodes.get(id);};
 const messages=[],storage={};const doc={hidden:false,getElementById:el,createElement:tag=>{const e=new Element(tag);e.doc=doc;e.isConnected=false;return e;},addEventListener(){},removeEventListener(){},defaultView:{location:{href:'chrome-extension://fixture/sidepanel.html'},scrollY:0,scrollTo(){},addEventListener(){},removeEventListener(){}}};
 const api={runtime:{getURL:p=>'chrome-extension://fixture/'+p,onMessage:{addListener(){},removeListener(){}},async sendMessage(m){messages.push(m);return {ok:true,result:m.cmd==='AUTONOMA_LIST'?(run?[run]:[]):run};}},storage:{local:{async get(){return storage;},async set(v){Object.assign(storage,structuredClone(v));}}},tabs:{async query(){return [{id:7,url:'https://www.idealista.pt/arrendar-casas/faro/'}];}}};
 const ui=mountSidePanel({api,doc,readDirectory:async()=>null});return {ui,doc,api,el,messages,storage};
}
const settle=async()=>{await new Promise(setImmediate);await new Promise(setImmediate);};
const run={id:'r',createdAt:'2026-11-14T12:00:00Z',state:'paused',items:Array.from({length:10},(_,i)=>({id:'i'+i,nome:i===9?'São Brás de Alportel muito comprido':'Cidade '+i,url:'https://www.idealista.pt/a/',state:i<6?'saved':i===6?'running':i<9?'queued':'pending',recoverable:true,checkpoint:{confirmedPages:1,recordCount:20}}))};
test('painel mantém nós, detalhes e foco ao filtrar e atualizar; totais independentes',async()=>{const f=fixture(run);try{await settle();const list=f.el('localities'),last=list.children[9],details=last.children[0];details.open=true;const button=details.children[1].children.at(-1).children[0];button.focus();f.el('search').value='sao bras';await f.el('search').fire('input');await f.ui.refresh();assert.equal(list.children[9],last);assert.equal(details.open,true);assert.equal(f.doc.activeElement,button);assert.equal(last.hidden,false);assert.equal(list.children[0].hidden,true);assert.match(f.el('run-counts').textContent,/6 de 10 concluídas/);assert.equal(f.el('list-total').textContent,'1 de 10');assert.ok(!f.messages.some(m=>m.cmd==='AUTONOMA_START'));}finally{f.ui.destroy();}});
test('navegar para configurações persiste o contexto antes de trocar de documento',async()=>{const f=fixture(run);try{await settle();f.el('search').value='Brás';await f.el('search').fire('input');await f.el('settings-link').fire('click');assert.equal(f.storage.autonomousUI.query,'Brás');assert.equal(f.storage.autonomousUI.selectedId,'r');assert.match(f.doc.defaultView.location.href,/configuracoes.html$/);}finally{f.ui.destroy();}});
test('origem parecida não se torna fonte e primeiro uso oferece configurar',async()=>{const f=fixture();try{f.api.tabs.query=async()=>[{id:7,url:'https://evilidealista.pt/'}];await settle();await f.ui.refresh();assert.equal(f.ui.getState().source,null);assert.equal(f.el('primary-action').textContent,'Configurar pasta');assert.equal(f.messages.some(m=>m.cmd==='AUTONOMA_START'),false);assert.match(summaryText({saved:6,empty:0,total:10,inProgress:1,queued:2,pending:1}),/6 de 10/);}finally{f.ui.destroy();}});

test('intervalo normal informa espera automática sem alerta genérico de intervenção',async()=>{const f=fixture({...run,state:'waiting',reason:'interval',eligibility:{until:Date.now()+60000}});try{await settle();assert.equal(f.el('run-reason').hidden,true);assert.match(f.el('wait-time').textContent,/automaticamente/);assert.equal(f.el('run-status').hidden,true);}finally{f.ui.destroy();}});

test('captura concluída não anuncia retomada por intervalo residual do domínio',async()=>{const f=fixture({...run,state:'completed',reason:null,eligibility:{until:Date.now()+60000}});try{await settle();assert.equal(f.el('wait-time').textContent,'');}finally{f.ui.destroy();}});
test('resposta antiga de Links não reativa botão nem apaga progresso após início confirmado',async()=>{
 const f=fixture();try{await settle();const original=f.api.runtime.sendMessage;let release,reads=0;
 f.api.runtime.sendMessage=async message=>message.cmd==='AUTONOMA_LINKS_READ'?{ok:true,result:++reads===1?await new Promise(resolve=>release=resolve):{state:'running',records:[],total:0}}:message.cmd==='AUTONOMA_LINKS_START'?{ok:true,result:{status:'accepted'}}:original(message);
 await f.el('tab-links').fire('click');await f.el('tool-links-open').fire('click');assert.equal(f.el('tool-links-open').disabled,true);
 release({state:'idle',records:[],total:0});await settle();assert.equal(f.el('tool-links-open').disabled,true);assert.match(f.el('links-status').textContent,/Navegando/);
 }finally{f.ui.destroy();}
});
test('troca de aba é persistida imediatamente, inclusive antes de fechar ou recarregar o painel',async()=>{
 const f=fixture();try{await settle();await f.el('tab-links').fire('click');assert.equal(f.storage.autonomousUI?.tab,'links');}finally{f.ui.destroy();}
});
test('bloqueio herdado sem sessão de Links oferece retomada no botão principal após prazo',async()=>{
 const f=fixture();try{await settle();const original=f.api.runtime.sendMessage;
 f.api.runtime.sendMessage=async message=>message.cmd==='AUTONOMA_LINKS_READ'?{ok:true,result:{state:'paused',reason:'access_blocked',recovery:'confirm-access',until:Date.now()+60000,records:[]}}:original(message);
 await f.el('tab-links').fire('click');await settle();assert.equal(f.el('tool-links-open').disabled,true);assert.match(f.el('tool-links-open').textContent,/espera/);
 f.api.runtime.sendMessage=async message=>message.cmd==='AUTONOMA_LINKS_READ'?{ok:true,result:{state:'paused',reason:'access_blocked',recovery:'confirm-access',until:null,records:[]}}:original(message);
 await f.ui.refresh();assert.equal(f.el('tool-links-open').disabled,false);assert.match(f.el('tool-links-open').textContent,/Conferir acesso/);
 assert.match(f.el('links-status').textContent,/tentativa anterior/);assert.match(f.el('links-status').textContent,/clique.*confirme/i);
 }finally{f.ui.destroy();}
});


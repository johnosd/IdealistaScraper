const test=require('node:test'),assert=require('node:assert/strict');
const {createCollectionClient,sendWithRetry}=require('../../src/coleta-protocol');

test('006 R-020: worker reiniciando (sem receptor) → repete e entrega na tentativa seguinte',async()=>{
  let calls=0;const api={runtime:{async sendMessage(){calls++;if(calls<3)throw new Error('Could not establish connection. Receiving end does not exist.');return {ok:true,result:{status:'ok'}};}}};
  assert.deepEqual(await createCollectionClient(api)('REGISTER',{id:'s'}),{status:'ok'});assert.equal(calls,3);
});

test('006 R-020: mensagem possivelmente entregue (port closed) ou erro de negócio não é repetida',async()=>{
  for(const message of ['The message port closed before a response was received.','Remetente recusado']){
    let calls=0;const api={runtime:{async sendMessage(){calls++;throw new Error(message);}}};
    await assert.rejects(sendWithRetry(api,{cmd:'X'},{delayMs:1}),new RegExp(message.slice(0,10)));assert.equal(calls,1,message);
  }
});

test('006 R-020: canal fechado no meio só repete ações idempotentes (leitura/registro), nunca REQUEST/REPORT',async()=>{
  const closed='A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received';
  for(const [action,expected] of [['REGISTER',2],['READ_HTTP',2],['REQUEST',1],['REPORT',1]]){
    let calls=0;const api={runtime:{async sendMessage(){calls++;if(calls===1)throw new Error(closed);return {ok:true,result:{status:'ok'}};}}};
    const client=createCollectionClient(api);
    if(expected===1)await assert.rejects(client(action,{}),/message channel closed/);else assert.deepEqual(await client(action,{}),{status:'ok'});
    assert.equal(calls,expected,action);
  }
});

test('006 R-020: desiste após o limite de tentativas sem receptor',async()=>{
  let calls=0;const api={runtime:{async sendMessage(){calls++;throw new Error('Could not establish connection. Receiving end does not exist.');}}};
  await assert.rejects(sendWithRetry(api,{cmd:'X'},{attempts:3,delayMs:1}),/Could not establish/);assert.equal(calls,3);
});

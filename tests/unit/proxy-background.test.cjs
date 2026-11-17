const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup(collection=false) {
  const state = { storage: {}, value: { mode: 'system' }, control: 'controllable_by_this_extension' };
  function boot() {
    let listener, auth, authMode, changed,port;
    const chrome = {
      action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
      storage: { local: {
        get: async keys => Object.fromEntries(keys.map(k => [k, state.storage[k]])),
        set: async data => { if (state.failStorage) throw Error('storage failed'); Object.assign(state.storage, data); },
      } },
      proxy: { settings: {
        onChange:{addListener(fn){changed=fn;}},
        set: async ({ value }) => { if (state.failSet) throw Error('set failed'); state.value = value; state.control = 'controlled_by_this_extension'; },
        clear: async () => { if (state.failClear) throw Error('clear failed'); state.value = { mode: 'system' }; state.control = 'controllable_by_this_extension'; },
        get: (options, cb) => { const d = { value: state.value, levelOfControl: state.control }; if (cb) cb(d); return Promise.resolve(d); },
      } },
      webRequest: { onAuthRequired: { addListener(fn, filter, modes) { auth = fn; authMode = modes[0]; }, removeListener() {} } },
      runtime: { onMessage: { addListener(fn) { listener = fn; } } },
    };
    if(collection){chrome.runtime.id='fixture';chrome.runtime.getURL=path=>'chrome-extension://fixture/'+path;}
    const load=name=>name==='./coleta-background'?{installCollectionBackground(api,p){port=p;return {busy:async()=>!!state.busy,proxyChanged:async revision=>{state.changed=revision;}};}}:require('../../src/'+name.slice(2));
    vm.runInNewContext(fs.readFileSync(require.resolve('../../src/background.js'), 'utf8'), { chrome,require:load, console: { log() {}, warn() {}, error() {} } });
    return {
      send: cmd => new Promise(resolve => listener(typeof cmd === 'string' ? { cmd } : cmd, collection?{id:'fixture',url:'chrome-extension://fixture/popup.html'}:{}, resolve)),
      change:details=>changed(details),get hasChangeListener(){return !!changed;},get port(){return port;},
      authenticate: details => new Promise(resolve => auth(details, resolve)),
      get registered() { return !!auth; }, get mode() { return authMode; },
    };
  }
  return { state, boot };
}
const config = { cmd: 'ENABLE_PROXY', host: 'proxy.invalid', port: 8080, username: 'fixture-user', password: 'fixture-secret' };
test('conexão direta remove o proxy próprio antes de criar outra coleta',async()=>{
 const f=setup(true),w=f.boot();await w.send(config);let enabledAtStart;
 const r=await w.port.begin(false,async()=>{enabledAtStart=f.state.value.mode==='pac_script';return {status:'started'};});
 assert.equal(r.status,'started');assert.equal(enabledAtStart,false);assert.equal((await w.send('PROXY_STATUS')).enabled,false);
});
test('início recusado por coleta ativa não altera PAC nem executa callback',async()=>{
 const f=setup(true),w=f.boot();await w.send(config);f.state.busy=true;let called=false;
 const r=await w.port.begin(false,async()=>{called=true;return {status:'started'};});
 assert.equal(r.status,'busy');assert.equal(called,false);assert.equal((await w.send('PROXY_STATUS')).enabled,true);
});
test('conexão direta não remove controle de outra extensão ou política',async()=>{
 const f=setup(true),w=f.boot();f.state.value={mode:'fixed_servers',rules:{singleProxy:{host:'external.invalid',port:80}}};f.state.control='controlled_by_other_extensions';let called=false;
 await assert.rejects(()=>w.port.begin(false,async()=>{called=true;}));assert.equal(called,false);assert.equal(f.state.value.mode,'fixed_servers');
});
test('aplicação explícita também é recusada durante coleta ativa',async()=>{
 const f=setup(true),w=f.boot();await w.send(config);f.state.busy=true;
 const r=await w.send({cmd:'APPLY_SAVED_CONNECTION',expectedRevision:1});assert.equal(r.ok,false);assert.equal((await w.send('PROXY_STATUS')).enabled,true);
});
test('worker registra autenticação no boot antes de mensagens', () => {
  const w = setup().boot(); assert.equal(w.registered, true); assert.equal(w.mode, 'asyncBlocking');
});
test('reinício restaura status e autenticação sem expor senha', async () => {
  const f = setup(); assert.equal((await f.boot().send(config)).ok, true);
  const w = f.boot(); assert.equal(w.registered, true);
  const auth = await w.authenticate({ isProxy: true, challenger: { host: config.host, port: config.port } });
  assert.equal(auth.authCredentials.username, config.username);
  const status = await w.send('PROXY_STATUS'); assert.equal(status.enabled, true);
  assert.equal(JSON.stringify(status).includes(config.password), false);
  assert.deepEqual(JSON.parse(JSON.stringify(await w.authenticate({ isProxy: false }))), {});
  assert.deepEqual(JSON.parse(JSON.stringify(await w.authenticate({ isProxy: true, challenger: { host: 'other.invalid', port: 8080 } }))), {});
});
test('status confere PAC efetivo e controle externo', async () => {
  const f = setup(); const w = f.boot(); await w.send(config);
  f.state.control = 'controlled_by_other_extensions'; assert.equal((await w.send('PROXY_STATUS')).enabled, false);
  f.state.control = 'controlled_by_this_extension'; f.state.value = { mode: 'direct' };
  assert.equal((await f.boot().send('PROXY_STATUS')).enabled, false);
});
test('falha de clear é propagada e estado ativo preservado', async () => {
  const f = setup(); const w = f.boot(); await w.send(config); f.state.failClear = true;
  assert.equal((await w.send('DISABLE_PROXY')).ok, false);
  assert.equal((await w.send('PROXY_STATUS')).enabled, true);
});
test('falha de persistência impede aplicação; falha de set não declara ativo', async () => {
  const f = setup(); const w = f.boot(); f.state.failStorage = true;
  assert.equal((await w.send(config)).ok, false); assert.equal(f.state.value.mode, 'system');
  f.state.failStorage = false; f.state.failSet = true;
  assert.equal((await w.send(config)).ok, false); assert.equal((await w.send('PROXY_STATUS')).enabled, false);
});
test('comandos concorrentes preservam ordem enable/disable e reinício', async () => {
  const f = setup(); const w = f.boot();
  const [on, off] = await Promise.all([w.send(config), w.send('DISABLE_PROXY')]);
  assert.equal(on.ok, true); assert.equal(off.ok, true); assert.equal((await f.boot().send('PROXY_STATUS')).enabled, false);
});
test('contexto observa PAC externo de mesmo modo e bloqueia edição durante coleta',async()=>{
 const f=setup(true),w=f.boot();assert.equal(w.hasChangeListener,true);
 await w.send(config);const a=await w.port.snapshot();f.state.busy=true;
 assert.equal((await w.send('DISABLE_PROXY')).ok,false);assert.equal((await w.send({...config,password:'new'})).ok,false);
 f.state.value={mode:'pac_script',pacScript:{data:'external'}};w.change({value:f.state.value,levelOfControl:f.state.control});
 const b=await w.port.snapshot();assert.notEqual(b.revision,a.revision);
 assert.equal((await f.boot().port.snapshot()).revision,b.revision);
});

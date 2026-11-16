// Both Links entry points launch capture; export is a separate explicit action.
const extractBtn = document.getElementById('extract');
if (extractBtn) extractBtn.addEventListener('click', async () => {
  extractBtn.disabled = true;
  const feedback=document.getElementById('links-feedback');
  if(feedback)feedback.textContent='Preparando coleta…';
  try{
    const response=await chrome.runtime.sendMessage({cmd:'AUTONOMA_LINKS_START'});
    if(!response?.ok)throw Error('Coletor indisponível');
    if(feedback)feedback.textContent=response.result.status==='busy'?'Outra coleta está ativa. Aguarde ou pause antes de iniciar.':response.result.status==='attention'?'Há uma coleta pendente. Confira o motivo e retome pela aba Links.':'Coleta iniciada. O Idealista será aberto; acompanhe pela aba Links do painel.';
  }catch{if(feedback)feedback.textContent='Não foi possível iniciar. Confira a aba Links do painel.';}
  finally{extractBtn.disabled=false;}
});
const exportLinksBtn=document.getElementById('export-links');
if(exportLinksBtn)exportLinksBtn.addEventListener('click',async()=>{
  exportLinksBtn.disabled=true;
  try {
    const url = chrome.runtime.getURL('localidades.html');
    const tabs = await chrome.tabs.query({ url });
    if (tabs.length) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      await chrome.windows.update(tabs[0].windowId, { focused: true });
    }
    else await chrome.tabs.create({ url, active: true });
  } catch (error) {
    alert('Não foi possível abrir a exportação de localidades.\n' + error.message);
  } finally { exportLinksBtn.disabled = false; }
});
// ============== Extrair Itens (com proxy) ==============
const itemsBtn = document.getElementById("extractItems");
const extractItemsLog = document.getElementById("extractItemsLog");
const toggleProxy = document.getElementById("toggleProxy");

function appendExtractLog(msg) {
  if (!extractItemsLog) return;
  const li = document.createElement('li');
  li.textContent = msg;
  li.style.padding = '2px 0';
  li.style.borderBottom = '1px solid #e5e7eb';
  extractItemsLog.insertBefore(li, extractItemsLog.firstChild);
}
function clearExtractLog() {
  if (extractItemsLog) extractItemsLog.innerHTML = "";
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'CRAWLER_LOG') appendExtractLog(msg.message);
});

if (itemsBtn) itemsBtn.addEventListener('click', async () => {
  itemsBtn.disabled = true;
  try {
    const customUrl = document.getElementById('extractItemsUrl')?.value?.trim();
    if (customUrl && !/^https:\/\/(?:www\.)?idealista\.pt\//.test(customUrl)) throw new Error('Informe uma página HTTPS do Idealista.');
    if (customUrl) await chrome.storage.local.set({collectionItemsURL:customUrl});
    const base=chrome.runtime.getURL('itens.html'),tabs=await chrome.tabs.query({url:base+'*'});
    if(tabs.length) await chrome.tabs.update(tabs[0].id,{active:true});
    else await chrome.tabs.create({url:base,active:true});
  }catch(error){alert(error.message);}finally{itemsBtn.disabled=false;}
});

// ============== Proxy: painel e status ==============
function initProxyPanel() {
  const hostInput = document.getElementById('proxyHost');
  const portInput = document.getElementById('proxyPort');
  const userInput = document.getElementById('proxyUser');
  const passInput = document.getElementById('proxyPass');
  const saveBtn = document.getElementById('saveProxyConfig');
  const testBtn = document.getElementById('testProxyBtn');
  const disableBtn=document.getElementById('disableProxy');
  if(!hostInput||!saveBtn||!testBtn)return;
  if(disableBtn)disableBtn.onclick=async()=>{
    disableBtn.disabled=true;const label=document.getElementById('proxyTestResult');
    try{const result=await chrome.runtime.sendMessage({cmd:'DISABLE_PROXY'});label.textContent=result?.ok?'Proxy desativado.':result?.error||'Não foi possível desativar o proxy.';await refreshProxyStatus();}
    catch{label.textContent='Não foi possível desativar o proxy.';}finally{disableBtn.disabled=false;}
  };

  // Carregar campos do chrome.storage.local
  chrome.storage.local.get(['proxyHost', 'proxyPort', 'proxyUser', 'proxyPass'], function(items) {
    hostInput.value = items.proxyHost || '';
    portInput.value = items.proxyPort || '';
    userInput.value = items.proxyUser || '';
    passInput.value = '';
  });

  saveBtn.onclick = async () => {
    const result=await chrome.runtime.sendMessage({cmd:'SAVE_PROXY_CONFIG',config:{
      proxyHost: hostInput.value.trim(),
      proxyPort: portInput.value.trim(),
      proxyUser: userInput.value.trim(),
      proxyPass: passInput.value.trim()
    }});
    alert(result?.ok?'Proxy salvo.':result?.error||'Não foi possível salvar o proxy.');
  };

  testBtn.onclick = async () => {
    const resultLabel = document.getElementById('proxyTestResult');
    resultLabel.textContent = 'Verificando IP com a configuração ativa...';testBtn.disabled=true;

    try {
      const response=await chrome.runtime.sendMessage({cmd:'COLETA_TEST_IP',payload:{}});
      if(!response?.ok)throw new Error('Sondagem indisponível.');
      resultLabel.textContent=response.result?.ip?`IP observado: ${response.result.ip}`:'IP não verificado. A configuração do proxy foi preservada.';
    } catch (err) {
      resultLabel.textContent = 'IP não verificado. A configuração do proxy foi preservada.';
    } finally {
      testBtn.disabled=false;
    }
  };
}

async function refreshProxyStatus() {
  try {
    const st = await chrome.runtime.sendMessage({ cmd: "PROXY_STATUS" });
    const el = document.getElementById("proxyState");
    if (el) el.textContent = st?.enabled ? "ativado" : "desativado";
  } catch (e) {
    console.warn('Falha ao obter status do proxy:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initProxyPanel();
  refreshProxyStatus();
  if (toggleProxy) {
    chrome.storage.local.get(['usarProxy'], items => { toggleProxy.checked = items.usarProxy === 'true'; });
    toggleProxy.addEventListener('change', () => chrome.storage.local.set({ usarProxy: toggleProxy.checked ? 'true' : 'false' }));
  }
  const open = document.getElementById('openLote');
  if (open) open.addEventListener('click', async () => {
    open.disabled = true;
    try {
      const base = chrome.runtime.getURL('lote.html');
      const existing = await chrome.tabs.query({ url: base + '*' });
      if (existing.length) {
        await chrome.tabs.update(existing[0].id, { active: true });
        await chrome.windows.update(existing[0].windowId, { focused: true });
      } else {
        const [source] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.create({ url: base + (source?.id ? '?sourceTabId=' + source.id : ''), active: true });
      }
    } catch { alert('Não foi possível abrir a extração em lote.'); }
    finally { open.disabled = false; }
  });
});

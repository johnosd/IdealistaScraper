// background.js — MV3 (Service Worker) com PAC seletivo e logs

let currentProxy = null;

// --- UI: badge no ícone quando proxy ligado ---
function updateBadge() {
  const on = !!currentProxy;
  chrome.action.setBadgeText({ text: on ? "PROX" : "" });
  if (on) chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
}

// --- Domínios base que DEVEM usar o proxy (podem ser expandidos em tempo de execução) ---
const PROXY_DOMAINS_BASE = [
  "idealista.pt",
  "*.idealista.pt",
  "api.ipify.org" // para o botão/checagem de IP
];
let currentProxyDomains = [...PROXY_DOMAINS_BASE];

// Gera o PAC para rotear apenas os domínios acima via PROXY; o resto DIRECT
function buildSelectivePacScript(host, port, domains = currentProxyDomains) {
  const pacChecks = domains.map(d =>
    `dnsDomainIs(host, "${d.replace(/^\*\./, "")}") || shExpMatch(host, "${d}")`
  ).join(" || ");

  // Dica: adicione outros hosts de CDN do site caso veja bloqueios de recursos
  // (ex.: "st*.idealista.pt", "img*.idealista.pt" já cobertos por *.idealista.pt)
  return `
    function FindProxyForURL(url, host) {
      if (${pacChecks}) { return "PROXY ${host}:${port}"; }
      return "DIRECT";
    }
  `;
}

async function enableProxy({ host, port, username, password, extraDomains = [] }) {
  console.log("[proxy] enableProxy:", { host, port, hasUser: !!username, hasPass: !!password });
  if (!host || !port) throw new Error("Host/port do proxy não informados.");

  currentProxy = { host, port, username, password };

  currentProxyDomains = [...PROXY_DOMAINS_BASE, ...extraDomains.filter(Boolean)];

  const pacScript = buildSelectivePacScript(host, port, currentProxyDomains);

  // Aplica PAC
  try {
    await chrome.proxy.settings.set({
      value: { mode: "pac_script", pacScript: { data: pacScript } },
      scope: "regular"
    });
    console.log("[proxy] PAC aplicado com sucesso.");
  } catch (e) {
    console.error("[proxy] Erro ao aplicar PAC:", e);
    currentProxy = null;
    throw e;
  }

  // Listener de autenticação (MV3: requer webRequest + webRequestAuthProvider)
  try {
    try { chrome.webRequest.onAuthRequired.removeListener(onAuthRequiredHandler); }
    catch (e) { console.warn('[proxy] Falha ao remover onAuthRequired:', e); }
    chrome.webRequest.onAuthRequired.addListener(
      onAuthRequiredHandler,
      { urls: ["<all_urls>"] },
      ["blocking"]
    );
    console.log("[proxy] onAuthRequired instalado.");
  } catch (e) {
    console.error("[proxy] Erro ao instalar onAuthRequired:", e);
    currentProxy = null;
    try { await chrome.proxy.settings.clear({ scope: "regular" }); }
    catch (ee) { console.warn('[proxy] Falha ao limpar PAC após erro:', ee); }
    throw e;
  }

  updateBadge();

  // Log do status final do proxy nas Configurações
  chrome.proxy.settings.get({ incognito: false }, (details) => {
    console.log("[proxy] Status atual do chrome.proxy.settings:", details);
  });
}

async function disableProxy() {
  console.log("[proxy] disableProxy chamado.");
  currentProxy = null;
  currentProxyDomains = [...PROXY_DOMAINS_BASE];

  try {
    await chrome.proxy.settings.clear({ scope: "regular" });
    console.log("[proxy] PAC limpo.");
  } catch (e) {
    console.error("[proxy] Erro ao limpar PAC:", e);
  }

  try { chrome.webRequest.onAuthRequired.removeListener(onAuthRequiredHandler); }
  catch (e) { console.warn('[proxy] Falha ao remover onAuthRequired:', e); }
  updateBadge();
}

function onAuthRequiredHandler(details) {
  // Dispara quando o servidor proxy exige autenticação
  if (!details.isProxy || !currentProxy) return {};
  const ch = details.challenger || {};
  console.log("[proxy] onAuthRequired:", `${ch.host || "?"}:${ch.port || "?"}`, "-> fornecendo credenciais.");
  return {
    authCredentials: {
      username: currentProxy.username || "",
      password: currentProxy.password || ""
    }
  };
}

// --- Mensageria (popup.js / outros) ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.cmd === "ENABLE_PROXY") {
    const { host, port, username, password, extraDomains } = msg;
    enableProxy({ host, port, username, password, extraDomains })
      .then(() => sendResponse({ ok: true }))
      .catch(err => {
        console.error("[proxy] ENABLE_PROXY falhou:", err);
        sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
      });
    return true; // async
  }

  if (msg?.cmd === "DISABLE_PROXY") {
    disableProxy()
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: String(err) }));
    return true; // async
  }

  if (msg?.cmd === "PROXY_STATUS") {
    sendResponse({ enabled: !!currentProxy, config: currentProxy || null, domains: currentProxyDomains });
    return;
  }
});

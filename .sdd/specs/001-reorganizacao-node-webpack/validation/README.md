# Evidências do aceite estrutural

Validação em 2026-11-13, sem ativar coleta ou proxy.

- `chromium-smoke.json`: Chromium 156.0.8078.4 fornecido pelo Playwright.
- `google-chrome-smoke.json`: Google Chrome instalado 157.0.8103.78.
- `popup-chromium.png` e `popup-google-chrome.png`: capturas do popup no build de produção.

Ambos usaram perfis temporários novos e foram encerrados após o teste.
O teste abriu `chrome-extension://<id>/popup.html`, alternou as quatro abas,
conferiu o service worker e enviou `STOP_AND_DOWNLOAD` ao script de conteúdo em
uma página HTTPS de fixture, com resposta vazia esperada e sem iniciar crawler.
As requisições de recursos externos e da fixture foram satisfeitas localmente
por interceptação de rede. Nenhuma página real do Idealista foi consultada.

O teste usou a instalação de Playwright e os binários de teste já existentes em
`screen recorder`, sem modificar aquele projeto ou adicionar essa dependência
ao projeto Idealista. O Chrome instalado foi iniciado separadamente, com
`channel: 'chrome'`, perfil temporário, pipe de depuração e carregamento via CDP.
As flags e o carregamento foram exclusivos do processo temporário de teste.

Referências técnicas consultadas:

- [Playwright: extensões Chrome](https://playwright.dev/docs/chrome-extensions).
- [Playwright: sessão CDP do navegador](https://playwright.dev/docs/api/class-browser#browser-new-browser-cdp-session).
- [Chromium: protocolo de carregamento de extensão por pipe](https://chromium.googlesource.com/chromium/src.git/+/225b2eaa7f23c33b7c4e30c1bfc58f1bd99cbe1c%5E%21/).

Limites: o carregamento e a navegação foram automatizados em headless, não
um teste manual do popup da barra de ferramentas. Coleta real, proxy real e
compatibilidade dos seletores com o site atual continuam fora desta evidência.

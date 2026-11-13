# Visão do repositório

Análise e reorganização em 2026-11-13. Revalidar referências e comportamento antes de alterar o código.

## Produto principal

O produto principal é a extensão Chrome Manifest V3, versão 1.5.0, para coletar
anúncios e links de localidades do Idealista.pt e exportar JSON. A feature
`001-reorganizacao-node-webpack` migrou as sete entradas de `Idealista_extensao_v1/`:
cinco JS em `src/`, manifesto/HTML na raiz e bundles Webpack em `dist/`.

- `manifest.json`: entradas, permissões e domínios autorizados.
- `popup.html`, `src/popup-ui.js`, `src/popup.js`: interface Links/Itens/Lote/Proxy e orquestração.
- `src/content.js`: extração do DOM, paginação com fetch, deduplicação e exportação.
- `src/linkExtractor.js`: extração de regiões, sub-regiões e municípios.
- `src/background.js`: service worker responsável pelo PAC e autenticação do proxy.

`IdealistaScraper.py` é um coletor Python separado no histórico, com Selenium, BeautifulSoup,
pandas, cookies e saída CSV. Não foi encontrada integração direta da extensão
com esse processo. `TrataArquivos.ipynb` contém tratamento de JSON com pandas.

## Achados da análise

1. O lote é orquestrado dentro do popup; resultados agregados ficam em
   `window.loteResultados`. A lista e os status são persistidos, mas o processo e
   os resultados não são restaurados integralmente ao reabrir o popup.
2. A parada parcial retorna `_itensCrawled`, preenchida somente ao final do
   crawler. Simulação local: um item já extraído, exportação parcial com zero
   itens e contador de duas páginas; após finalizar, o item aparece.
3. O proxy é aplicado após a navegação inicial, tanto no modo individual quanto
   no lote. Falhas na ativação podem ser ignoradas e a coleta prossegue.
4. `currentProxy` e o listener de autenticação dependem da execução corrente do
   service worker. Simulação de reinício: PAC mantido no mock das configurações,
   mas `PROXY_STATUS` informa desativado. Falta reconstrução do estado.
5. O botão `loteStopExport` existe no HTML, sem handler encontrado no JavaScript.
6. Erros de rede/HTTP interrompem a paginação, mas o crawler pode responder
   sucesso e o lote remover a entrada, sem distinguir coleta parcial de completa.
7. As entradas com erro são movidas ao final sem limite de tentativas.
8. O ZIP da extensão difere da pasta em `content.js`, `popup-ui.js`, `popup.html`
   e `popup.js`; não assumir que instalar o ZIP equivale a carregar a pasta.

## Evidência e limites

Todos os cinco arquivos JavaScript passaram em `node --check`; o manifesto foi
parseado e suas entradas existem. O Python passou em análise sintática via AST.
As simulações usaram Node VM e APIs mockadas, sem rede nem ativação real de proxy.
Na análise inicial não houve instalação ou teste no Chrome. A reorganização
posterior adicionou Node/npm, Webpack 5.112.2, webpack-cli 7.3.1 e dois testes
de contrato nativos Node em `tests/contracts/`, com lockfile e Node >=22.16.0.

Há alterações locais pré-existentes nas pastas de dados. Preservá-las; não
restaurar ou remover arquivos como parte de uma correção da extensão.

## Execução e validação da reorganização

- Comandos: `npm ci`, `npm test`, `npm run build:prod`, `npm run dev`.
- Instalação por lockfile e builds development/production aprovados; contratos
  2/2 verdes em ambos, trava íntegra. Watch recompilou alteração e restauração.
- Fontes comparadas com o backup: somente os caminhos previstos foram alterados.
  Interface, permissões, chaves de storage e oito itens de backlog preservados.
- Build de produção carregado no Chromium 156.0.8078.4 e Google Chrome instalado
  157.0.8103.78, headless e com perfis temporários isolados. Quatro abas navegáveis,
  service worker ativo e script de conteúdo respondendo em fixture local. Nenhum
  erro de JavaScript registrado. Fontes/imagens remotas fornecidas localmente.
- Chrome carregado via CDP `Extensions.loadUnpacked` com depuração por pipe,
  somente no perfil temporário; a instalação/perfil do usuário não foi alterada.
- Não há validação de coleta no site atual ou autenticação de proxy real.
- Evidências: `.sdd/specs/001-reorganizacao-node-webpack/validation/`.
- Revisão independente read-only sem achados Critical/Important/Minor.

## Alterações locais concorrentes

Na fase 1 os hashes dos quatro legados foram conferidos e estavam intactos.
No fechamento observou-se que `IdealistaScraper.py`, `IdealistaScraper.pyproj`,
`IdealistaScraper.sln`, `Idealista_extensao.zip`, `TrataArquivos.ipynb` e
`listaArrendar.json` haviam sido removidos do checkout
fora das operações desta migração. Não restaurar essas exclusões automaticamente.
A fotografia final está em `validation/preservation.json`; o status de Bases/.data
permaneceu igual ao baseline da migração. Essas exclusões concorrentes não foram
executadas nem revertidas pelo agente.

## Convergência da reorganização

`001-reorganizacao-node-webpack` convergida em 2026-11-13, sem achados acionáveis.
Builds dev/prod e contratos 2/2 revalidados, trava íntegra e sete entradas
comparadas ao backup, mantendo somente os ajustes previstos de caminhos.
Tasks mantidas byte-idênticas; README e status sincronizados.
O usuário relatou um primeiro teste bem-sucedido no Chrome e autorizou convergir.
O relato não detalha fluxos, URLs ou proxy e não amplia a evidência de coleta real.
Os oito itens do backlog continuam pendentes para trabalhos posteriores.

## Exportação de localidades em pasta autorizada

Feature `002-exportacao-localidades-pasta-autorizada` especificada em 2026-11-13.
O usuário escolheu autorizar `.data/localidades` no Chrome e substituir o arquivo
mensal somente após confirmação. Caminho relativo: `YYYYMM/links_localidades_YYYYMM.json`.
Cancelamento/recusa devem preservar o arquivo anterior; sem fallback para Downloads.
Apenas o fluxo de Links faz parte deste escopo; Itens, Lote e Proxy permanecem separados.
O navegador pode não revelar o caminho absoluto; não prometer validação automática
do caminho do repositório. Planejamento deve resolver autorização/persistência e
uma superfície que continue utilizável ao perder o foco do popup.
O item original foi promovido de Ideias Futuras para Features, com o texto
preservado na spec. Código da extensão ainda não alterado para esta melhoria.

Planejamento da 002 concluído: página durável `localidades.html`, handle em
IndexedDB próprio e writer protegido por Web Locks/confirm/write/close/abort.
14 tarefas em 4 fases. Cinco contratos novos e fixture travados; stub
`src/localidades-export.js` sem ligação com a UI. Baseline esperado: novos 0/5
com `not implemented`, antigos 2/2 verdes; build atual aprovado.
Execução deve adicionar Playwright dev-only para E2E opt-in. Não confundir
picker simulado/OPFS com o gate obrigatório de seleção nativa e escrita no disco.

Checkpoint de execução 002 em 2026-11-13: fase 1 concluída (T001/T002).
`src/localidades-export.js` implementa snapshot de mês local/dados, validação,
confirmação antes de writable, staged write/close/abort e Web Lock ifAvailable.
Contratos 002 5/5, unitários novos 8/8 e contratos 001 2/2; suíte 15/15 e builds
development/production aprovados, ambas as travas íntegras. Último bundle: production.
Nenhuma ligação à UI ainda; próxima fase 2 começa por store IndexedDB e coletor.
Execução pausada no checkpoint conforme modo padrão desta invocação, aguardando
continuidade. Testes de escrita foram em memória; gate de autorização nativa e
escrita externa em pasta temporária permanece pendente.

Continuação 002: usuário autorizou modo contínuo. Página/store/coletor e ligação
do botão Links implementados; npm test 20/20. E2E development passou oito cenários
com OPFS, incluindo recusa, substituição, recuperação, falha de persistência e
concorrência. E2E production ainda fica aguardando a coleta: fixture abre, scripts
injetados não começam; investigar waitForComplete/retorno de tabs.create no harness.
Fase 2 permanece aberta (T007). Controle Windows foi encerrado por não confirmar
URL; Chrome isolado aberto, sem seletor/autorizações nativos concluídos. Não declarar
feature implementada ou aceite nativo. Nenhum dado real foi usado como destino.

Encerramento da execução 002 em 2026-11-13: usuário respondeu “validado” ao roteiro
manual Chrome (seleção/gravação, recusa, confirmação e reabertura). Relato registrado
em validation/manual-chrome.md, sem afirmar inspeção automatizada dos bytes ou pasta.
E2E production resolvido alterando somente o harness: navegação por chrome.tabs.update
após anexação da aba em branco, em vez de Page.goto. Development/production agora
passam os oito cenários, zero downloads/pageerrors; npm ci e 20/20 testes nos dois
builds, travas 001/002 íntegras. Fontes Itens/Lote/Proxy comparadas ao backup e
preservadas. README e artefatos atualizados; último build production. Execução
concluída, próxima etapa sdd-converge. Bugs anteriores do backlog continuam pendentes.

Convergência 002 concluída em 2026-11-13, sem achados acionáveis. Requisitos,
decisões e constitution conferidos contra fontes; testes 20/20, ambos os builds
e oito cenários E2E por build revalidados. Travas 001/002 íntegras; tasks002
byte-idêntico (SHA256 11D1AE7988ABE6DBDCF6DF04E5A8DD395E6A5142DB4403D7B7C5F1A024E127FE).
Spec/backlog Convergida, 20/20. Resultado Final anexado ao plano e riscos marcados
Resolvido. README conferido e mantido porque já descrevia a funcionalidade.
Aceite nativo continua atribuído ao relato “validado” do usuário; testes OPFS são
simulados e não ampliam prova de proxy/site real. Sem edição de fontes ou commit.

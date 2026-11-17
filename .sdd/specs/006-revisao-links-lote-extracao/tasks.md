---
description: "Tasks da 006 — revisão ponta a ponta de Links, Lote e extração paginada"
---

# Tasks: Revisão ponta a ponta de Links, Lote e extração paginada validada no site real

**Input**: `.sdd/specs/006-revisao-links-lote-extracao/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, logic/*.md, quickstart.md, contract-tests.lock

**Organization**: por user story (P1 → P2 → P3). US1 (inspeção) bloqueia as demais (D12).

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

- Fontes em `src/` (CommonJS, empacotados por `webpack.config.js` a partir das entradas existentes; não criar entradas novas).
- HTML/manifest na raiz (`sidepanel.html`, `runner.html`, `manifest.json`); bundles em `dist/` apenas via `npm.cmd run build`/`build:prod`.
- Testes: `tests/unit/*.test.cjs`, `tests/contracts/006-…test.cjs` (travado), `tests/e2e/*.smoke.cjs`, fixtures em `tests/fixtures/`.
- Evidências: `.sdd/specs/006-revisao-links-lote-extracao/validation/`.

---

## Phase 1: Setup

**Purpose**: baseline e preservação antes de tocar no código.

- [X] T001 Registrar baseline em `.sdd/specs/006-revisao-links-lote-extracao/validation/baseline.md`: `git status --short` (inclui `.data/`), `node --test` (esperado 218 pass + 5 contratos 006 vermelhos), travas 001–006 íntegras, hash de `manifest.json`.
- [X] T002 Confirmar a ferramenta de inspeção (research R6, D15): Playwright MCP em modo extensão no Chrome real do usuário ou roteiro manual. O Chromium headless limpo é bloqueado (403 "Um momento…"); não usar evasão. Registrar no baseline a ferramenta escolhida e a limitação para `chrome-extension://`.

**Registro da Fase**:

- Status: Concluída (2026-11-16)
- Feito: baseline em `validation/baseline.md` (git 146 entradas, `.data/` 14 entradas listadas, hash do manifest, suíte, travas). Ferramenta: Playwright MCP indisponível nesta sessão; headless bloqueado; duas opções registradas para a Fase 2.
- Contrato: sem contrato nesta fase; `check-contract-tests.ps1` 001–006 íntegros.
- Testes executados: `npm.cmd run build` + `node --test` → 223 testes, 218 pass, 5 fail (contratos 006 esperados), 0 skip.
- Pendências: a Fase 2 depende do Chrome real do usuário (MCP em modo extensão ou roteiro manual).

---

## Phase 2: Foundational — US1 Inspeção do site real (Priority: P1) 🎯

**Objetivo**: saber o que as três páginas oferecem hoje e onde o app diverge (FR-001, FR-002). Sem correções de extrator nesta fase (D12).

**Independent Test**: relatório com contagens observadas × extraídas para as três páginas, e decisões de `research.md` preenchidas com evidência.

### Implementation

- [X] T003 [US1] Inspecionar `https://www.idealista.pt/arrendar-casas/#municipality-search`: HTTP, título, desafio. Contar os links de localidades visíveis por estrutura e executar `extractLinks` (de `src/linkExtractor.js`) e `extractDirectLocalities` (de `src/coleta-discovery.js`) no DOM real. Comparar as listas (faltantes/excedentes).
- [X] T004 [US1] Inspecionar `https://www.idealista.pt/arrendar-casas/braga-distrito/concelhos-freguesias` (confirmar a grafia real do caminho): estrutura da lista de concelhos/freguesias, contagens, os dois extratores atuais e a saída de `inspectCollectionPage` (`src/coleta-page.js`). Decidir research R1.
- [X] T005 [US1] Inspecionar a listagem `https://www.idealista.pt/arrendar-casas/braga-distrito/`, `pagina-2/`, a última página e a última+1. Registrar: anúncios por página, saída de `extrairDaRaiz` (`src/content.js`) vs. cards visíveis, seletor de próxima página, total declarado e seu seletor, limite de páginas, comportamento além da última. Decidir research R2. Intervalo ≥ 10 s entre páginas.
- [X] T006 [US1] Na mesma listagem, verificar se o card expõe freguesia de forma estruturada (research R4) e se `/geo/arrendar-casas/<região>/` é listagem ou hub (R5). Testar `deriveListingURL` mentalmente contra os links reais dos três níveis (região, sub-região, município) abrindo um de cada.
- [X] T007 [US1] Registrar sinais de bloqueio só se ocorrerem naturalmente (research R3): status, título, seletor, `cf-mitigated`, e se desapareceram sozinhos. Não provocar bloqueio. Proxy só se a conexão direta for bloqueada, sem registrar valores.
- [X] T008 [P] [US1] Salvar fixtures HTML sanitizadas (R-009: sem scripts, cookies, telefones ou ids de sessão) em `tests/fixtures/idealista-concelhos-braga-2026-11.html` e `tests/fixtures/idealista-listing-braga-p1-2026-11.html` (+ última página, se diferente). Se a página nacional mudou desde 2026-11-15, criar `tests/fixtures/idealista-locations-2026-11-16.html` sem alterar o antigo.
- [X] T009 [US1] Escrever `validation/site-inspection.md`: tabela por página (observado × extraído × divergência × correção proposta), contagens, nível de evidência N3. Atualizar `research.md` R1–R5 de "Provisório" para "Decidido (evidência: …)". Se R1/R2 contrariarem D2 (derivação), parar e perguntar ao usuário antes da Fase 5.

### Testes da Fase

- [X] T010 [P] [US1] Criar `tests/e2e/extractors-fixtures.smoke.cjs`: Playwright `page.setContent` com as fixtures de T008, avaliando os extratores a partir dos bundles (`dist/linkExtractor.bundle.js`/`content.bundle.js`) ou do fonte injetado. Asserções = contagens registradas em T009 (vermelho esperado até a Fase 3).

**Critério de Conclusão**: `validation/site-inspection.md` e decisões de `research.md` completos com evidência N3; fixtures salvas e sanitizadas; o smoke T010 existe e reflete as divergências encontradas.

**Registro da Fase**:

- Status: Concluída (2026-11-16)
- Feito: inspeção N3 no Chrome real via Playwright MCP (modo extensão). Página nacional: `extractLinks` 84/84, mas `extractDirectLocalities` (Lote) = 0 (D-1). Distrito: sem `nav` (`extractLinks` = 0, D-2); 14 concelhos no breadcrumb + 134 freguesias em `#location_list`; zonas (15) e vizinhos (3) excluídos. Listagem: 30/página, seletores de `extrairDaRaiz` OK, total no `h1`, próxima sem barra final, última = 29, além da última redireciona para p.1. Limite do site: 60 páginas/1.800 anúncios (p.100 = 404). `/geo/` é listagem direta. D2 confirmada para sub-região e concelho. Freguesia só no sufixo do título. Bloqueio: 403 "Just a moment..." liberou sozinho em cerca de 5 s. Fixtures `idealista-concelhos-braga-2026-11.html` e `idealista-listing-braga-p1-2026-11.html` sanitizadas (sem scripts/imagens/telefones). research R1–R5 decididos.
- Contrato: sem contrato nesta fase; trava 006 íntegra.
- Testes executados: `node tests/e2e/extractors-fixtures.smoke.cjs` → vermelho esperado (`inspectLocalities is not a function`).
- Pendências: confirmar com o usuário a regra de Freguesia (R4, para a Fase 8) e o escopo do distrito (zonas/vizinhos fora).

---

## Phase 3: US1 Correções dos extratores (Priority: P1)

**Objetivo**: extratores refletem o site real (FR-002, FR-003, FR-013, base do FR-015/027).

### Implementation

- [X] T011 [US1] Implementar `extractLocalities(doc)` em `src/linkExtractor.js` com as estratégias decididas em R1 (ordem: `nav.locations-list` → lista da página de concelhos → breadcrumb). Mesmo formato de registro de `extractLinks`, e `extractLinks` delegando a ela sem mudar a saída na página nacional (contratos 001/002 e `tests/fixtures/idealista-locations-2026-11-15.html`: 84 registros).
- [X] T012 [US1] Ajustar `extrairDaRaiz` em `src/content.js` (anúncios e `nextUrl`) conforme as divergências de T009. Não renomear nem remover campos.
- [X] T013 [US1] Acrescentar `declaredTotal` aos fatos de `COLLECT_PAGE` em `src/coleta-page.js` (seletor de R2, inteiro ou `null`) e ajustar `inspectCollectionPage` para os sinais de R3 confirmados.
- [X] T058 [US1] Incluir o título "Um momento" (sem depender de acento/reticências) nos padrões de desafio de `inspectCollectionPage` (`src/coleta-page.js`) e `inspectBatchDestination` (`src/lote-navigation.js`). Teste unitário em `tests/unit/coleta-page.test.cjs` com o título real (R-010, `validation/pre-plan-headless-probe.md`).
- [X] T014 [US1] Fazer `discoverSource` (`src/coleta-discovery.js`) usar `extractLocalities` (D1/D4), sem o breadcrumb como fonte primária.

### Testes da Fase

- [X] T015 [P] [US1] `tests/e2e/extractors-fixtures.smoke.cjs` verde nos builds dev e prod.
- [X] T016 [P] [US1] Testes unitários em `tests/unit/` para a lógica de seleção de estratégia e para o parse do total declarado (texto → inteiro, ex.: `2.389` → 2389), sem DOM real.

**Critério de Conclusão**: smoke de fixtures verde (dev/prod); `node --test` sem regressões; contagens do extrator = contagens observadas para as três páginas.

**Registro da Fase**:

- Status: Concluída (2026-11-16)
- Feito: `src/linkExtractor.js` agora tem as estratégias nacional e distrito. `extractLinks(doc, full)` continua **autocontida/serializável** (`localidades-collector` a injeta via `executeScript`), `inspectLocalities` devolve estratégia, visíveis e excluídos, e `globalThis.__idealistaLocalities` fica exposto ao mundo isolado. Na página nacional a saída é idêntica à histórica (84). `src/coleta-page.js`: `readDeclaredTotal` (número inicial do `h1`), `declaredTotal` nos fatos de `COLLECT_PAGE`, `CHALLENGE_TITLE` com "um momento"/"acesso negado". `src/lote-navigation.js`: mesmo padrão. `src/coleta-discovery.js`: `readSourceLocalities`/`readPageLocalities` (injeta o bundle e lê o extrator único); `discoverSource` e o "carregar da página" de `src/lote.js` deixaram de usar só o breadcrumb. T012: `extrairDaRaiz` sem divergência no site real (30/30), sem alteração de código.
- Contrato: sem contrato nesta fase; `check-contract-tests.ps1` 001–006 íntegros.
- Testes executados: `npm.cmd run build` + `node --test` → 227 testes, 222 pass, 5 fail (contratos 006 das fases 5–7), 0 skip; `npm.cmd run build:prod` + `node --test` → idem. `node tests/e2e/extractors-fixtures.smoke.cjs` → OK (independe do build: fontes injetadas). Smokes dev: links-one-click, links-inherited-block, links-popup-navigation, autonoma-tabs, localidades, lote OK; autonoma **1 falha (`strictEqual`) e 3 aprovações** em 4 execuções. Smokes prod: os 7 OK. Iteração intermediária: `extractLinks` delegando a outra função quebrou `localidades-collector.test` (serialização); corrigido mantendo a função autocontida.
- Pendências: intermitência de `autonoma.smoke` em dev (1/4), compatível com a R-020 da 005 e não atribuída a esta fase; continua aberta (R-008).

---

## Phase 4: US2 Coletar todos os links com um clique (Priority: P1)

**Objetivo**: Links coleta todos os links da página de origem, sem telas da extensão, e valida a contagem (FR-003–007, FR-028).

### Implementation

- [X] T017 [US2] `src/sidepanel.js` envia a origem atual (`source` já detectado) em `LINKS_START`. `src/links-collection.js` grava a origem no launch, e `src/links-runner.js` usa a origem quando o caminho é suportado (D7), senão a página nacional. A origem usada aparece em `LINKS_READ`.
- [X] T018 [US2] Validação de contagem (FR-004): o executor de links devolve `visibleCount` (âncoras de localidade no container escolhido) junto aos registros. `LINKS_READ` expõe `visible` e `collected`, e o painel mostra "N de M links" com aviso quando diferir.
- [X] T019 [US2] Auditoria FR-005/007 em `src/sidepanel.js`, `src/links-collection.js` e `src/coleta-autonoma-background.js`: nenhum `tabs.create`/`location.href` para páginas da extensão sem clique explícito. Configuração ausente mostra requisito + botão "Abrir Configurações", sem navegação automática.
- [X] T020 [US2] A coleta de links navega na aba Idealista visível (o `foreground:true` existente em `links-runner.js`), sem `fetch` de páginas. Confirmar em smoke.

### Testes da Fase

- [X] T021 [P] [US2] `tests/e2e/links-district.smoke.cjs`: origem = fixture `concelhos-freguesias`. Asserções: contagem coletada = visível, nenhuma aba `chrome-extension://…(configuracoes|localidades).html` criada, origem exibida. Dev e prod.
- [X] T022 [P] [US2] Unitário da regra D7 (caminhos suportados) e de `LINKS_READ` com `visible`/`collected` em `tests/unit/links-collection.test.cjs`.
- [X] T023 [US2] Reexecutar `links-one-click`, `links-popup-navigation`, `links-start-errors`, `links-connection-error`, `links-inherited-block` (dev/prod).

**Critério de Conclusão**: T021–T023 verdes nos dois builds; a página nacional continua com os 84 do fixture antigo; o distrito retorna o total observado em T004.

**Registro da Fase**:

- Status: Concluída (2026-11-16)
- Feito: `chooseLinksOrigin` (D7) em `src/links-collection.js`. O painel envia a origem atual em `LINKS_START`, o launch guarda a origem, `LINKS_CLAIM` a entrega, `links-runner` coleta a origem escolhida e `LINKS_READ` expõe `origin` e `audit`. Em `src/coleta-page.js`, o modo links usa `inspectLocalities` e devolve `linksAudit` (estratégia, visíveis, excluídos); `src/coleta-coordinator.js` guarda `s.linksAudit` (sanitizado, só no modo links); `src/content.js` passa `inspectLocalities`. O painel mostra "Origem", "N de M links" e os não incluídos, com aviso de divergência (`linksAuditText`). Auditoria FR-005/007: toda abertura de tela da extensão (`configuracoes`, `localidades`, `lote`, `itens`) vem de clique explícito (sidepanel `configure`/restart/export/details, botões do popup legado); runner e abas técnicas `active:false`; configuração ausente mostra a ação "Configurar pasta" sem navegação automática. A coleta de links já navegava na aba Idealista visível (`foreground:true`), confirmado pelo `links-one-click`.
- Contrato: sem contrato nesta fase; `check-contract-tests.ps1` 001–006 íntegros.
- Testes executados: `node --test tests/unit/links-origin-006.test.cjs` 3/3. `npm.cmd run build` e `npm.cmd run build:prod` + `node --test` → 230 testes, 225 pass, 5 fail (contratos 006), 0 skip. Smokes dev **e** prod: links-district (novo: 148 = 14 + 134, origem Braga, 148 de 148, 15 zonas e 3 vizinhos excluídos, nenhuma tela da extensão), links-one-click, links-popup-navigation, links-start-errors, links-connection-error, links-inherited-block, links-navigation-transition, todos OK. Ajuste: `tests/unit/links-collection.test.cjs` (não travado) passou a esperar `origin` no claim, mantendo a verificação de ausência de segredo.
- Pendências: nenhuma nova; R-008 (`autonoma.smoke` dev intermitente) continua aberta.

---

## Phase 5: US3 Carregar cada localidade no Lote (Priority: P1)

**Objetivo**: links coletados viram fila preparada no Lote com listagem derivada (FR-008–010, FR-026 contexto).

### Contrato da Fase

- `C1 US3 FR-008/009/010 US7 FR-026: links viram uma entrada por listagem…`
- Comando: `node --test tests/contracts/006-revisao-links-lote-extracao.test.cjs`

### Implementation

- [X] T024 [US3] Implementar `deriveListingURL` e `buildBatchQueue` em `src/lote-queue.js` conforme `logic/fila-e-listagem.md` §1–2 → contrato: C1.
- [X] T025 [US3] Ao concluir uma coleta de links (`src/links-collection.js`/`coleta-autonoma-background.js`), gravar `lote:prepared` (`{linksSessionId, createdAt, entries, rejected}`) em `chrome.storage.local` (data-model).
- [X] T026 [US3] Aba Lote em `src/sidepanel.js` (+ `sidepanel.html` se necessário): mostrar a fila preparada (nome, URL de listagem, aliases, rejeitados com motivo) e a ação primária **Iniciar coleta** via `src/coleta-view-model.js`. Sem importação manual de JSON.
- [X] T027 [US3] `START` em `src/coleta-autonoma-background.js` aceita `{fromPrepared:true}` e o runner (`src/runner.js`) usa um `discover` que devolve as entradas preparadas (`quantidade:null`, `context`, `aliases`; R-007). Sem fila preparada, usa `discoverSource` + `buildBatchQueue` da página atual.
- [X] T028 [US3] `normalizeItems` (`src/coleta-autonoma.js`) e `coordinator.start` (`src/coleta-coordinator.js`) preservam `context` validado (data-model). `publicRun` expõe `context`.

- [X] T061 [US3] (Descoberta durante T026) `src/sidepanel.js`: quando `START` voltava `needs-configuration`, o painel navegava sozinho para `configuracoes.html` (FR-005/007). Passou a mostrar a orientação e a deixar "Configurar pasta" como ação primária, sem navegação automática.

### Testes da Fase

- [X] T029 [P] [US3] `tests/unit/lote-queue.test.cjs`: query/hash, barra final, URL inválida, `Contagem` sem efeito na ordem, 84 registros do fixture 2026-11-15 → número de entradas esperado (Algarve+Faro fundidos).
- [X] T030 [P] [US3] `tests/unit/autonoma-context.test.cjs`: `context` sobrevive a `start`/`read`/retomada e rejeita chaves extras.

**Critério de Conclusão**: `node --test tests/contracts/006-revisao-links-lote-extracao.test.cjs` → C1 verde, `check-contract-tests.ps1 -Slug 006-revisao-links-lote-extracao` íntegro; contratos 005 C1–C5 verdes; fila visível no Lote após links (smoke na Fase 6).

**Registro da Fase**:

- Status: Concluída (2026-11-16)
- Feito: `src/lote-queue.js` (`deriveListingURL`, `buildBatchQueue`: primeira ocorrência vence, `aliases`/`linkUrls`, `contagem`, `freguesia` fora do `context`). `prepareBatchFromLinks` em `src/links-collection.js` grava `lote:prepared` em `LINKS_FINISHED` e de forma preguiçosa em `LINKS_READ`, idempotente por sessão. O painel mostra a fila preparada (lista, aliases, ignorados, "Descartar fila preparada") e inicia com `START {fromPrepared:true}`. O background aceita a fila preparada como origem sem aba (`source.linksSessionId`). `discoverBatch` em `src/runner.js` usa a fila preparada ou `discoverSource` + `buildBatchQueue` na página atual (`quantidade:null`, R-007). `normalizeItems` e `coordinator.start` (`itemContext`) preservam o `context` validado (3 chaves) e `freguesia`. T061 ad-hoc: sem navegação automática para Configurações em `needs-configuration`.
- Contrato: `node --test tests/contracts/006-revisao-links-lote-extracao.test.cjs` → **C1 verde** (1/5; C2–C5 das fases 6–7 seguem vermelhos); `check-contract-tests.ps1` 001–006 íntegros; contratos 005 verdes na suíte.
- Testes executados: `node --test tests/unit/lote-queue.test.cjs tests/unit/autonoma-context.test.cjs` → 7/7 (inclui o fixture nacional real: 84 links → 83 entradas). `npm.cmd run build` e `npm.cmd run build:prod` + `node --test` → 237 testes, 233 pass, 4 fail (C2–C5), 0 skip. Smokes dev e prod: autonoma, autonoma-ui, autonoma-tabs, links-district, links-one-click, links-inherited-block, lote, todos OK.
- Pendências: a jornada de UI links → fila no Lote → coleta é coberta pelo smoke `lote-from-links` (T040, Fase 6). R-008 aberto (sem falha nesta rodada).

---

## Phase 6: US4 Extrair todas as páginas, uma entrada após a outra (Priority: P1)

**Objetivo**: navegação visível página a página até o fim, gravação antes da próxima entrada, completude, dedup e contexto nos arquivos (FR-005/006/011–016, FR-026).

### Contrato da Fase

- `C2 US4 FR-011/012/014/015 US7 FR-026: cada entrada percorre todas as páginas…`
- `C4 US4 FR-016: resumo deduplica anúncios por id…`
- `C5 US2/US4 FR-005/006/011: uma aba Idealista visível…`
- Comando: `node --test tests/contracts/006-revisao-links-lote-extracao.test.cjs`

### Implementation

- [X] T031 [US4] `createPageTransport(api,{foreground})` em `src/coleta-runner.js`: com `foreground:true`, uma aba por execução, `active:true` só na criação, reaproveitada entre entradas, `prepare` sempre `navigation` (D5) → contrato: C5. Sem a opção, comportamento atual inalterado.
- [X] T032 [US4] Implementar `runQueue` em `src/coleta-autonoma.js`, por enquanto sem `autoRecovery` (equivale a `drive`) → contratos: C2, C4.
- [X] T033 [US4] `assessListing`/`withContext` em `src/coleta-completeness.js`. No `drive`: guardar `declaredTotal` no checkpoint (primeiro válido, via `coordinator.reportPage`); ao resolver o item, gravar `completeness`; enriquecer os registros só em `options.write` (D11) → contrato: C2.
- [X] T034 [US4] `item_budget` no modo v2 conclui o item como `limited` (D9) em `src/coleta-coordinator.js` (`requestPage`), mantendo a pausa em v1 (contrato 004).
- [X] T035 [US4] Deduplicação: chave `seen:<runId>`, `itemStates[id].dedup`, `publicRun.dedup` e remoção no `discard` (`logic/fila-e-listagem.md` §6) → contrato: C4.
- [X] T036 [US4] `src/runner.js` usa `createPageTransport(api,{foreground:true})` e `service.runQueue`, e não chama `FINISHED` enquanto `runQueue` estiver ativo.
- [X] T037 [US4] Painel (`src/sidepanel.js`, `src/coleta-labels.js`): completude por item ("limitada pelo site: X de Y"), `limitedCount` no resumo, dedup ("N anúncios únicos · M repetidos"), sem "captura integral" para itens limitados.

### Testes da Fase

- [X] T038 [P] [US4] `tests/unit/coleta-completeness.test.cjs`: tolerância, `declaredTotal` nulo, `item_budget`, `withContext` preserva campos e ordem.
- [X] T039 [P] [US4] `tests/unit/coleta-transport-foreground.test.cjs`: aba fechada pelo usuário → item pendente com progresso preservado (edge case), sem recriar em foco.
- [X] T040 [US4] `tests/e2e/lote-from-links.smoke.cjs`: links (fixture) → Lote preparado → Iniciar → 2 entradas × 2 páginas via navegação → 2 arquivos com contexto. Asserções: uma aba Idealista, nenhuma tela da extensão aberta, ordem das requisições, arquivo antes da próxima entrada. Dev e prod.
- [X] T062 [US4] (Descoberta durante T041, desvio aprovado pelo usuário, fora do escopo original) `createCollectionWorkflow.resume` em `src/coleta-runner.js`: `RESUME` com `wait`/`interval` agora aguarda o prazo (abortável, até 5 vezes) e tenta de novo, como o início já fazia. As demais esperas continuam manuais. Teste `tests/unit/coleta-resume-interval-006.test.cjs` (R-015).
- [X] T041 [US4] Reexecutar `autonoma.smoke`, `autonoma-tabs.smoke`, `autonoma-ui.smoke`, `coleta.smoke`, `lote.smoke` (dev/prod). Registrar intermitências R-008 sem fechar por retry.

**Critério de Conclusão**: contrato C2, C4, C5 verdes + C1; trava 006 íntegra; contratos 001–005 verdes; T038–T041 verdes nos dois builds.

**Registro da Fase**:

- Status: Concluída (2026-11-16)
- Feito: `createPageTransport(api,{foreground:true})`: uma aba Idealista por execução, `active:true` só na criação, reaproveitada entre entradas, toda página por navegação; re-registro via `about:blank` quando o epoch muda; `COLLECTION_TAB_CLOSED` se o usuário fechar a aba. `runQueue` (por ora = `drive`). `assessListing`/`withContext` (contexto no fim do registro, só na gravação; digest do intent sobre os registros enriquecidos). `declaredTotal` no checkpoint; `item_budget` v2 conclui como `limited` e a fila segue. Dedup `seen:<id>` (idempotente, removido no descarte). `publicRun` com `completeness`, `dedup`, `limitedCount` (fora de `summary`). Freguesia por fonte verificável (R4) já aplicada em `freguesiaFor`. O runner usa o transporte visível e `runQueue`. O painel mostra completude por item, únicos/repetidos/limitadas e "Coleta concluída com N listagens limitadas". Rótulos `collection_tab_closed` e `site_limit`. **Correção inline (bloqueava T040)**: `VALIDATE` em `src/coleta-background.js` recusava o 2º documento da mesma aba (antes, da página 2 em diante a coleta usava `fetch` no mesmo documento). Agora uma requisição de navegação **nova** vincula o documento que criou (`executor.documentRequestId`); documento anterior da mesma requisição continua recusado (R-014).
- Contrato: `node --test tests/contracts/006-revisao-links-lote-extracao.test.cjs` → C1, C2, C4, C5 verdes (4/5; C3 é da Fase 7); `check-contract-tests.ps1` 001–006 íntegros.
- Testes executados (rodada final, após T062): `npm.cmd run build` e `npm.cmd run build:prod` + `node --test` → 247 testes, 246 pass, 1 fail (C3, Fase 7), 0 skip; **os 20 smokes de `tests/e2e/*.smoke.cjs` OK em dev e em prod**, incluindo `coleta.smoke`. Unitários novos: `coleta-completeness` 4/4, `coleta-transport-foreground` 3/3, `coleta-navigation-documents-006` 1/1, `coleta-resume-interval-006` 2/2. Rodada anterior (antes de T062): 19/20 smokes OK, incluindo `lote-from-links` (novo: Links → fila → 2 entradas × 2 páginas numa única aba, `site_limit`, dedup 6, arquivos completos com contexto, nenhuma tela da extensão). **`coleta.smoke` falha 4/4 em dev e em prod** (Itens legado): instrumentação mostrou o "Retomar" clicado 2,6 s após a página 3, com intervalo de 3 s → `RESUME` = `wait` → `createCollectionWorkflow.resume` desiste em vez de aguardar. Reverter a mudança do `VALIDATE` não alterou a falha. Passava na 005 (logs de 11-15).
  O usuário decidiu corrigir agora (T062): `coleta.smoke` passou a 2/2 em dev e 20/20 smokes nos dois builds.
- Pendências: nenhuma da fase. R-008 (`autonoma.smoke` dev intermitente) sem nova falha nesta rodada; continua aberta.

---

## Phase 7: US5 Atravessar bloqueios temporários sem intervenção (Priority: P2)

**Objetivo**: esperar e reverificar automaticamente, com limite e sem contornar (FR-017–021).

### Contrato da Fase

- `C3 US5 FR-017/018/019/020: bloqueio temporário retoma sozinho…`
- Comando: `node --test tests/contracts/006-revisao-links-lote-extracao.test.cjs`

### Implementation

- [X] T042 [US5] `planBlockRecovery` em `src/coleta-block-recovery.js` (tabela de `logic/recuperacao-de-bloqueio.md`) → contrato: C3.
- [X] T043 [US5] `runQueue` com `autoRecovery` (espera via `waitUntil`, `resume` com `accessConfirmed` só em `recheck`, contador persistido e zerado após página confirmada, `stop` → `access_blocked_persistent`/`rate_limit_persistent`) → contrato: C3.
- [X] T044 [US5] `src/runner.js` passa `autoRecovery:{maxRechecks:3}` e `waitUntil` abortável pela pausa. Rótulos novos em `src/coleta-labels.js`. O painel mostra motivo, horário da próxima verificação e "seguirá automaticamente".
- [X] T059 [US5] `coordinator.renewCycle` em `src/coleta-coordinator.js` e checagem de `run_budget`/`session_duration` relativa a `cycle` em `requestPage` (`logic/recuperacao-de-bloqueio.md` §Novo ciclo, D13). `planBlockRecovery` devolve `renew`; `runQueue` executa. O painel mostra ciclo e total de páginas (R-011).
- [X] T060 [P] [US5] `tests/unit/coleta-cycle.test.cjs`: sem `cycle`, regra idêntica (v1 e v2); com `cycle`, continua após 200 páginas/6 h; `d.events`/intervalo/janela preservados entre ciclos; `renewCycle` recusado em v1 e fora de `run_budget`/`session_duration`.
- [X] T045 [US5] `src/links-runner.js`: mesma política para a coleta de links (US5 AC4), preservando os registros já obtidos.

### Testes da Fase

- [X] T046 [P] [US5] `tests/unit/coleta-block-recovery.test.cjs`: todas as linhas da tabela, pausa do usuário sempre `stop`, `until` no passado.
- [X] T047 [P] [US5] `tests/unit/links-block-recovery.test.cjs`: links 403→200 retoma e 403 persistente para, com os registros preservados.
- [X] T048 [US5] Variantes 403→200 e 403 persistente em `tests/e2e/lote-from-links.smoke.cjs` com prazo preparado só no perfil temporário (padrão de `links-inherited-block.smoke.cjs`). Dev e prod.

**Critério de Conclusão**: contrato C3 verde (5/5 no arquivo 006), travas 001–006 íntegras, 004 C2 e 005 C5 ainda verdes, T046–T048 verdes.

**Registro da Fase**:

- Status: Concluída (2026-11-16)
- Feito:
  - `planBlockRecovery` (tabela completa: recheck/resume/renew/stop). `runQueue` com `autoRecovery`:
    - espera abortável pela pausa;
    - `resume` com `accessConfirmed` só no recheck;
    - contador persistido em `session.autoRecovery`, zerado após página confirmada;
    - `access_blocked_persistent`/`rate_limit_persistent`;
    - transporte fechado só no fim da fila, para não recriar a aba nem o foco.
  - Descoberta na execução: `maxAttempts` (004) limita as verificações (limite efetivo `min(maxRechecks, maxAttempts−1)` = 2). `attempts_exhausted` após reverificação é apresentado como bloqueio persistente (documentado em `logic/recuperacao-de-bloqueio.md`).
  - `coordinator.renewCycle` + orçamentos relativos ao ciclo (`cycleStart`/`requestedInCycle`): sem ciclo, a regra é idêntica; o domínio (ritmo/janela/bloqueio) não é tocado.
  - Runner: `autoRecovery:{maxRechecks:3}` e `waitUntil` em blocos de 5 s relendo a elegibilidade.
  - Rótulos persistentes; painel com "Nova verificação automática às HH:MM… nenhuma ação é necessária" (`autoWaitText`) e "ciclo N · páginas confirmadas no total".
  - Links: `recoverLinks` no `links-runner` (mesma política, registros preservados); `LINKS_READ.auto` + texto "Nova tentativa automática… não é preciso clicar".
  - T048 realizado como smoke dedicado `tests/e2e/lote-block-recovery.smoke.cjs` (variantes 403→200 e 403 persistente com "Um momento…"), em vez de variantes dentro de `lote-from-links`, para isolar o prazo semeado.
  - Smokes da 005 atualizados para o comportamento aprovado: `links-start-errors` (executor de Links fica vivo aguardando a verificação automática; nenhuma requisição antes do prazo) e `autonoma-ui` (pausa pelo usuário durante o intervalo, já que `run_budget` agora renova o ciclo — D13).
- Contrato: `node --test tests/contracts/006-revisao-links-lote-extracao.test.cjs` → **5/5 verdes**; `check-contract-tests.ps1` 001–006 íntegros (004 C2 e 005 C5 verdes na suíte).
- Testes executados: unitários novos `coleta-block-recovery` 4/4, `links-block-recovery` 3/3, `coleta-cycle` 3/3. Gate final: `npm.cmd run build` e `npm.cmd run build:prod` + `node --test` → **257/257, 0 skip**; **21/21 smokes em dev e em prod**. Após o ajuste de exibição do ciclo: 257/257 e `autonoma-ui`/`autonoma-tabs`/`lote-from-links` OK nos dois builds. Iterações: smoke persistente esperava 4 requisições (maxAttempts levou a 3 e foi corrigida a apresentação do motivo); 2 smokes da 005 falharam pela mudança de comportamento aprovada e foram atualizados.
- Pendências: a espera real de 30 min não é provada pelos smokes (prazo vencido só no perfil temporário); fica para a validação N4 (Fase 9), se um bloqueio ocorrer naturalmente.

---

## Phase 8: US7 Anúncios com contexto geográfico — Freguesia (Priority: P3)

**Objetivo**: `Freguesia` preenchida só com fonte estruturada comprovada (FR-027). `Região`/`Sub-região`/`Município` já entram na Fase 6.

- [X] T049 [US7] Se research R4 = fonte estruturada: extrair `Freguesia` em `extrairDaRaiz` (`src/content.js`) como campo novo ao final. Senão, documentar em `validation/site-inspection.md` que fica `null` e encerrar a fase sem código.
- [X] T050 [P] [US7] Se T049 implementou: caso no `tests/e2e/extractors-fixtures.smoke.cjs` e verificação de que os campos antigos são idênticos (SC-010).

**Critério de Conclusão**: decisão R4 aplicada e registrada; SC-010 verificado no smoke de fixtures.

**Registro da Fase**:

- Status: Concluída (2026-11-16)
- Feito: a decisão R4 do usuário foi aplicada na gravação, sem alterar `extrairDaRaiz` (a fonte é o título validado pela fila, não um campo do card). `matchFreguesia` em `src/coleta-completeness.js` é usada por `freguesiaFor` (`src/coleta-autonoma.js`). Decisão e números registrados em `validation/site-inspection.md` §6.
- Contrato: sem contrato nesta fase; trava 006 íntegra (5/5 verdes na suíte).
- Testes executados: `extractors-fixtures.smoke` §6 com dados reais (28/30 anúncios de Braga com Freguesia validada, campos antigos idênticos — SC-010). Unitário novo em `autonoma-context` (entrada prevalece; sufixo desconhecido → null). `npm.cmd run build` e `npm.cmd run build:prod` + `node --test` → 258/258, 0 skip; `extractors-fixtures` e `lote-from-links` OK nos dois builds.
- Pendências: nenhuma.

---

## Phase 9: US6 Prova em site real com a extensão instalada (Priority: P2)

**Objetivo**: evidência N4 ou pendência explícita (FR-024, FR-025, SC-009).

- [X] T064 [US3] (Correção do usuário durante T051, FR-029/030/D16) `nextExpansionUrl(doc)` em `src/linkExtractor.js` (distritos > 1.800 em ordem de URL, a partir da nav nacional ou do breadcrumb do distrito); modo links em `src/coleta-page.js` devolve esse `nextUrl`; `linksAudit` só da 1ª página (`src/coleta-coordinator.js`); `createCollectionWorkflow` navega toda página quando `foreground`.
- [X] T065 [US3] `planCoverageQueue(records,{limit:1800})` em `src/lote-queue.js` (sub-regiões, expansão por concelhos, fallback, `path`); `prepareBatchFromLinks` passa a usá-la; painel mostra o caminho e o resumo "N distritos/ilhas + M concelhos".
- [X] T066 [P] [US3] Testes: `tests/unit/lote-coverage.test.cjs` (planejamento), caso `nextExpansionUrl` em `tests/e2e/extractors-fixtures.smoke.cjs` (fixtures reais) e `tests/e2e/links-district.smoke.cjs` (nacional → 3 distritos grandes → fila de cobertura). Dev e prod.
- [X] T067 [US5] (Descoberta durante T051, validação real) A página nacional veio com desafio Cloudflare (`cf-mitigated: challenge`, "Just a moment…") e a coleta de Links terminou em `unexpected_content` (HTTP 200). Causa: o leitor se vinculava ao documento do desafio, e o documento real era recusado; além disso, a janela de transição era de 10 s. Correção: em `src/coleta-page.js` o documento de desafio responde sem validar/vincular (`transientChallenge`); em `src/coleta-runner.js` (`readNavigatedPage`) a janela vai a 12 s só para desafio transitório (título ou `cf-mitigated`), e os demais 403 mantêm 10 s (20 e 15 s testados quebravam a detecção de bloqueio persistente de `coleta`/`lote.smoke`). Smoke novo `tests/e2e/links-challenge-slow.smoke.cjs` (403 + `cf-mitigated`, liberado pelo site após 7 s; RED sem a correção, GREEN com ela, verificado). Smokes que servem a página nacional para qualquer URL passaram a neutralizar as contagens no teste (sem expansão D16).
- [X] T068 [US2] (Pedido do usuário durante T051) A aba Links mostrava a leitura bruta (84 da página nacional + 50 concelhos = 134), o que confundia. Agora ela mostra a **mesma fila final do Lote** (ex.: 69 = 19 distritos/ilhas + 50 concelhos), com caminho completo e URL da listagem; a leitura bruta fica como detalhe da auditoria. `LINKS_READ.prepared.queue`/`summary` (`src/links-collection.js`), `queueText` e lista em `src/sidepanel.js`. Smokes de Links (`one-click`, `connection-error`, `inherited-block`, `navigation-transition`, `district`) ajustados à nova exibição; a exportação JSON de localidades segue com a leitura bruta. 262/262 e 9 smokes de Links/Lote verdes em dev e prod.
- [X] T063 [US6] (Descoberta durante T051, correção do usuário) Na validação real, "Coletar links" a partir de `braga-distrito/concelhos-freguesias` coletou 149 links do distrito; o usuário espera **sempre** a página nacional (base completa). `chooseLinksOrigin` retorna sempre a página nacional; o painel não envia mais a origem; spec FR-028/D7 corrigidos (R-018). `links-district.smoke` reescrito (do distrito → abre a nacional, 84/84, fila 83) e `lote-from-links.smoke` com navegação nacional mínima; `tests/unit/links-origin-006.test.cjs` atualizado.
- [ ] T069 [US7] (Decisão do usuário após a validação real, R-020) Freguesia vazia em 1.246/1.246 anúncios reais. A coleta de Links passa a visitar a página `concelhos-freguesias` de todos os distritos (`src/coleta-page.js`: `nextExpansionUrl(doc,0)`, mantendo concelhos **e** freguesias); `planCoverageQueue` devolve `freguesias` (pares nome/sub-região, não entradas); `lote:prepared.freguesias` → `source.freguesias` no `START` (`src/coleta-autonoma-background.js`); `knownFreguesias`/`matchFreguesia` (`src/coleta-completeness.js`) validam o sufixo do título contra as freguesias **do distrito da entrada**. Testes: `lote-coverage` (lista e validação por distrito), `autonoma-context` (arquivo com Freguesia validada; freguesia de outro distrito → null), `links-district.smoke` reescrito (22 distritos visitados em ordem, 44 freguesias como lista), smokes com contagem neutralizada para 0.
- [X] T070 [US5] (Desvio aprovado pelo usuário, defeito anterior R-020 da 005) `autonoma.smoke` falhava de forma intermitente (dev e, na última rodada, também prod) com `execution_failed` antes da 1ª requisição: a mensagem `REGISTER` ao background caía no instante em que o service worker MV3 reiniciava. `sendWithRetry` em `src/coleta-protocol.js` (usado por `createCollectionClient` e por `request` em `src/runner.js`) repete até 3× (200/400 ms) **somente** quando a mensagem não foi entregue ("Could not establish connection/Receiving end does not exist"); "port closed" e erros de negócio não repetem. Teste `tests/unit/coleta-protocol-retry-006.test.cjs`. **2ª iteração** (diagnóstico em cópia isolada da extensão, com o erro registrado em `execution_error` nos eventos da sessão): o erro real era "message channel closed before a response" (mensagem entregue, worker desligado antes de responder). Ações idempotentes (`READ`, `READ_HTTP`, `REGISTER`, `GET_POLICY`, `LIST`; no runner `ATTACH`, `PROXY_SNAPSHOT`, `CHANGED`, `FINISHED`) repetem também nesse caso; `REQUEST`/`REPORT`/`START`/`RESUME` nunca. Retry 4/4; `autonoma.smoke` 8/8 em build de produção isolado (antes cerca de 1 falha a cada 3).
- [X] T071 [US2/US5] (Validação real e pedidos do usuário, 2026-11-16)
  - (a) **Porto Santo**: a página `…/porto-santo/porto-santo/concelhos-freguesias` redireciona para a listagem (área pequena, sem lista), e os Links paravam em `unexpected_content`. Página de distrito pedida pela cadeia sem lista agora é "nada a acrescentar"; o próximo distrito é calculado pela URL **pedida** (`nextExpansionUrl(doc,0,message.url)`); o modo links não pausa por `no_new_records`. `links-district.smoke` com 302 → listagem: RED na dist antiga, GREEN após a correção.
  - (b) "Ver detalhes e retomar" abria a tela antiga de exportação (pedia pasta de localidades e "não acontecia nada"). Agora, com coleta de links pausada, o botão principal vira **"Retomar coleta de links"** e retoma ali mesmo (`resumeId` no launch/claim; `links-runner` usa `workflow.resume`; bloqueio de acesso pede confirmação). "Ver detalhes" só aparece no limite de sessões. Testes `links-resume-006` 2/2; dois testes da 005 atualizados ao comportamento pedido (clique retoma, sem nova requisição e sem renavegar a página).
  - (c) **Pasta de anúncios no próprio painel**: "Configurar pasta" abre o seletor do sistema ali mesmo e salva (sem ir a Configurações). Smoke novo `lote-folder-picker.smoke.cjs`; `autonoma-ui.smoke` passou a abrir Configurações pelo link do cabeçalho.
  - (d) **Contador regressivo** em toda espera com prazo (Links e Lote; `remainingText`), atualizado a cada 1 s.
- [X] T072 [US4/US5] (Pedido do usuário, validação real) O Lote parava de vez com "A página não apresentou o conteúdo esperado". Agora, em `reportPage` (`src/coleta-coordinator.js`), conteúdo inesperado no Lote autônomo e nos Links é falha passageira: espera com backoff (30 s, 60 s) e nova tentativa na mesma página, até `maxAttempts` (3). Esgotado no Lote, a localidade vai **1× para o fim da fila** (`advanceItem`: re-enfileira, limpa as tentativas daquela localidade, preserva checkpoint/páginas confirmadas) e a fila segue; se falhar de novo, fica pendente recuperável e a execução termina normalmente (`finished-with-pending`). Nos Links, esgotado, pausa como antes. Rótulos `requeued_after_unexpected` e `unexpected_content` atualizados. Teste novo `tests/unit/unexpected-retry-006.test.cjs` (3/3: retry passageiro com 30/60 s; fim da fila retomando da página 2; segunda falha → pendente). `tests/unit/autonoma-blockers.test.cjs` (005): o caso `{status:200,listing:false}` saiu da lista de "condições globais" (decisão do usuário).
- [X] T073 [US5] (Tela do usuário, validação real) No limite de 60 páginas/hora o painel mostrava "Pausando com segurança…" com o botão preso em "Pausando…", "retome manualmente" e sem contador, e recusava retomar durante a espera; o runner, na verdade, aguardava automaticamente. `publicRun` (`src/coleta-autonoma.js`) passa a exibir `waiting` quando o executor está vivo numa espera automática do `runQueue` (`autoWaiting`); o painel esconde o motivo "retome manualmente" quando há espera automática (o contador explica) e permite **Retomar** durante janela/limite (o runner segue com o `runQueue`, que espera sozinho; `src/runner.js` aceita `wait` na retomada). Teste `tests/unit/auto-wait-display-006.test.cjs` 2/2; 275/275; smokes do Lote/painel verdes em prod.
- [X] T074 [US5] (Tela do usuário, descoberto em T073, "mais de 2 horas e não inicia") Sessão parada pelo limite por hora com `runnerLive=true` e executor morto (extensão recarregada → `runId` novo, ou aba do runner fechada) ficava em "Pausando…" para sempre: `cleanupDead` (`src/coleta-autonoma-background.js`) só verificava sessões ativas. Agora também verifica sessões não finais marcadas com executor vivo e libera (`runnerLive=false`) quando o executor não existe; a retomada volta a ficar disponível. Teste `tests/unit/dead-runner-paused-006.test.cjs` RED 2/3 → GREEN 3/3; 278/278; smokes autonoma, autonoma-ui, autonoma-tabs, lote-from-links, lote-block-recovery, lote-folder-picker e coleta verdes em prod.
- [X] T075 [US5] (Tela do usuário, "pausei a coleta e quando clico em retomar ele não retomou") Retomar depois de uma pausa do usuário enquanto o limite por hora ainda não liberou: `selectItems` responde `wait`, o motivo continuava `paused` e o `runQueue` parava na hora (planner: `paused` → stop); o executor fechava sem fazer nada. `service.resume` (`src/coleta-autonoma.js`) agora troca o motivo pelo da espera real (`window_budget`, `server_wait`, `access_blocked`) ou `session_duration`, e `src/runner.js` segue com o `runQueue` nesses casos (aguarda com contador ou renova o ciclo). Teste `tests/unit/resume-after-user-pause-006.test.cjs` RED (motivo `paused`) → GREEN; 279/279; smokes do Lote/painel verdes em prod.
- [X] T076 [US5] (Tela do usuário, "o proxy pago esgotou, deixei conexão direta e cliquei em retomar; não retoma e não informa nada") A sessão guarda a revisão da conexão; com a conexão trocada, `selectItems` recusava toda retomada (`incompatible_context`) e o aviso só aparecia na aba técnica do executor. Agora a retomada pedida pelo usuário (`connectionConfirmed`, enviada por `src/runner.js`) adota a conexão atual e registra `connection_confirmed`; a retomada automática continua recusando troca de conexão. Recusa da retomada do usuário passa a ficar como motivo visível no painel. Executor vivo também segue com o `runQueue` quando a retomada responde espera. Teste `tests/unit/resume-connection-change-006.test.cjs` RED → GREEN 3/3; 282/282; trava íntegra; smokes autonoma, autonoma-ui, autonoma-tabs, lote-from-links, lote-block-recovery, lote-folder-picker e coleta verdes em prod.
- [X] T051 [US6] Executar `quickstart.md` Q5 com a extensão instalada (build production): links do distrito, Lote preparado e pelo menos uma entrada pequena até a última página (de preferência duas, para ver o encadeamento).
- [X] T052 [US6] Escrever `validation/real-validation.md` com níveis N1–N4 separados, contagens, páginas, caminho relativo do arquivo e uso de proxy (sim/não), sem valores. Se não for possível, registrar o motivo (Q6) e manter a feature Em Execução.
- [X] T053 [US6] Se a execução real revelar divergência nova, voltar à fase correspondente (registrar em Execution Notes) em vez de ajustar só a evidência.

**Critério de Conclusão**: `real-validation.md` com N4 aprovado, ou pendência explícita que impede o aceite.

**Registro da Fase**:

- Status: Concluída (2026-11-16): N4 aprovado pelo usuário ("está funcionando") e conferido no disco
- Feito: validação real no Chrome do usuário (build production, sem proxy). Quatro divergências reveladas e corrigidas antes do aceite (T063 origem nacional, T064–T066 fila de cobertura, T067 desafio Cloudflare transitório, T068 lista final na aba Links). 12 entradas coletadas em sequência e gravadas em `.data/municipios/202611/` com todas as páginas, sem ids repetidos e com o contexto correto; Faro coletado pelos concelhos. Evidência em `validation/real-validation.md`.
- Contrato: 5/5 verdes; `check-contract-tests.ps1` 001–006 íntegros.
- Testes executados: `npm.cmd run build:prod` + `node --test` → 262/262; 9 smokes de Links/Lote em dev e prod após T068; gate completo anterior (T067): 22/22 smokes em prod, 21/22 em dev (`autonoma.smoke`, R-008).
- Pendências: (1) **Freguesia vazia em 1.246/1.246** anúncios reais: a regra R4 depende de freguesias na fila, e a fila de cobertura não as contém; aguarda decisão do usuário. (2) Ilhas fora da página nacional (cerca de 15 anúncios). (3) Espera real de 30 min da US5 não observada em site real. (4) R-008 aberta.

---

## Phase 10: Polish & Cross-Cutting

- [ ] T054 README.md: fluxo Links → Lote, aba de coleta visível, recuperação automática de bloqueio, campos de contexto e limites (R-003).
- [ ] T055 Auditoria FR-023: buscar nomes e valores de credenciais/tokens em `.sdd/specs/006-*`, `tests/`, `src/`. Nenhum valor presente.
- [ ] T056 Conferir `manifest.json` sem permissões novas e `.data/` igual ao baseline T001.
- [ ] T057 Atualizar `plan.md` (Estado Atual, Riscos), `handoff.md`, `.planning/backlog.md` (`update-feature-status.ps1`) e `.planning/memory/` com as descobertas do site.

### Checklist de Release

- [X] Fase 2 (US1 inspeção) concluída
- [X] Fase 3 (US1 correções) concluída
- [X] Fase 4 (US2) concluída
- [X] Fase 5 (US3) concluída
- [X] Fase 6 (US4) concluída
- [X] Fase 7 (US5) concluída
- [X] Fase 8 (US7) concluída
- [X] Fase 9 (US6) concluída com N4, ou pendência registrada e feature mantida Em Execução
- [ ] Testes de contrato 006 5/5 verdes na suíte completa, e `check-contract-tests.ps1` íntegro para 001–006
- [ ] `npm.cmd run build` + `node --test` e `npm.cmd run build:prod` + `node --test`: 0 fail, 0 skip
- [ ] Smokes do `quickstart.md` Q2 verdes em dev e prod (intermitências R-008 registradas, não mascaradas)
- [ ] Extensão recarregada no Chrome e fluxo validado (Q5)
- [ ] `quickstart.md` executado; níveis de evidência N1–N4 reportados separadamente

---

## Dependencies & Execution Order

- Fase 1 → Fase 2 (inspeção) → Fase 3 → {Fase 4, Fase 5} → Fase 6 → Fase 7 → Fase 8 → Fase 9 → Fase 10.
- Fase 5 (T024) pode começar logo após a Fase 2 se D2 for confirmada, porque é função pura.
- Fase 6 depende das Fases 3 (`declaredTotal`), 4 (links) e 5 (fila preparada).
- Fase 9 depende de todas as anteriores; a Fase 8 pode ser pulada se R4 = sem fonte (registrar).

### Parallel Opportunities

- T008/T010; T015/T016; T021/T022; T029/T030; T038/T039; T046/T047.

## Implementation Strategy

1. Inspeção primeiro (Fase 2). Nenhum extrator muda sem evidência.
2. MVP = Fases 3–6: links completos → fila no Lote → extração sequencial visível.
3. Depois a recuperação automática (Fase 7), a Freguesia (Fase 8) e a prova real (Fase 9).

## Notes

- Contratos 006 travados: não editar `tests/contracts/006-revisao-links-lote-extracao.test.cjs` nem `tests/fixtures/autonoma.cjs`.
- Rastreabilidade FR → tasks: FR-001/002 T003–T009; FR-003/004 T011, T017, T018; FR-005/006 T019, T020, T031; FR-007 T019; FR-008–010 T024–T028; FR-011–015 T012, T013, T031–T034; FR-016 T035; FR-017–021 T042–T045, T058; FR-022 T023, T041, T059, T060 + travas; FR-023 T055; FR-024/025 T051–T053; FR-026 T028, T033; FR-027 T049; FR-028 T017.
- SC → tasks: SC-001 T015/T021; SC-002 T021/T040; SC-003 T024/C1; SC-004 C2/T040; SC-005 C2/T040; SC-006/007 C3/T048; SC-008 C2/T037; SC-009 T051/T052; SC-010 T050/C2.

<!-- sdd-converge anexa "## Phase N: Convergence" abaixo desta linha -->

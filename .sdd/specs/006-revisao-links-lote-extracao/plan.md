# Implementation Plan: Revisão ponta a ponta de Links, Lote e extração paginada validada no site real

**Slug**: `006-revisao-links-lote-extracao` | **Date**: 2026-11-16 | **Spec**: `.sdd/specs/006-revisao-links-lote-extracao/spec.md`

## Summary

Começar por uma inspeção real das três páginas (nacional, `braga-distrito/concelhos-freguesias`,
listagem `braga-distrito/`) e corrigir os extratores com base nela. Depois ligar **Links → Lote**: os links
coletados viram uma fila preparada (`buildBatchQueue`), uma entrada por listagem derivada sem
`/concelhos-freguesias`, com contexto geográfico. O Lote percorre cada entrada página a página por
**navegação real numa aba Idealista visível** (em foco só ao abrir), conclui e grava antes da próxima.
Ele sinaliza listagens limitadas, deduplica no resumo e, via `runQueue`, espera e reverifica bloqueios
temporários sozinho, um número limitado de vezes. O aceite exige validação real com a extensão instalada.

Achados da exploração que motivam as correções (evidência no código, a confirmar no site real):

1. **Dois extratores de localidades divergentes**: Links usa `extractLinks` (`nav.locations-list`), enquanto
   o Lote autônomo descobre pelo breadcrumb (`extractDirectLocalities` em `coleta-discovery.js`). O que
   Links coleta não é o que o Lote processa.
2. **Links ignora a página atual**: `links-runner.js` coleta sempre `…/arrendar-casas/#municipality-search`.
3. **Links não alimenta o Lote**: não há ligação dos registros de Links com a fila do Lote.
4. **Paginação por `fetch` numa aba inativa**: `createPageTransport` cria `about:blank` com `active:false`,
   recria a aba a cada item e pagina com `COLLECT_PAGE fetch:true`. O usuário não vê a navegação, e o
   site vê requisições diferentes de navegação.
5. **Fila para no meio**: `maxPagesPerItem` (100) e `window_budget` (60/h) **pausam a execução inteira**,
   e o bloqueio exige confirmação manual. Por isso "ao concluir, iniciar o próximo" não acontece sozinho.
6. Sem total declarado, não há como distinguir listagem completa de truncada.

## Technical Context

**Language/Version**: JavaScript (CommonJS nos fontes, empacotado por Webpack 5.112.2) para Chrome MV3, Chrome ≥ 141.

**Primary Dependencies**: APIs `chrome.tabs`, `chrome.scripting`, `chrome.runtime`, `chrome.storage`,
`chrome.sidePanel`, `chrome.webRequest` (evidência HTTP), File System Access API (pasta de anúncios),
Web Locks. Dev: Node ≥ 22.16, `node:test`, Playwright 1.65.0.

**Storage**: IndexedDB via `createCollectionStore` (`src/coleta-store.js`) para sessões/páginas/domínio;
`chrome.storage.local`/`session` para preferências, launch e fila preparada; arquivos em
`.data/municipios/AAAAMM/` via handle autorizado.

**Testing**: `node --test` (unit + contratos em `tests/`), smokes Playwright em `tests/e2e/*.cjs` com a
extensão carregada em perfil temporário e rede roteada para fixtures; inspeção real via Playwright MCP
ou Playwright local (N3) e roteiro com a extensão instalada (N4).

**Target Platform**: extensão Chrome MV3 (service worker `dist/background.bundle.js`, side panel, runner
`runner.html` como dono da execução).

**Performance Goals**: N/A além do ritmo da 004 (≥ 10 s entre páginas, 60 páginas/h por padrão).

**Constraints**: nenhuma permissão nova; não contornar bloqueios; contratos 001–005 travados devem
continuar verdes (em especial 004 C2 e 005 C5: retomada após desafio exige `accessConfirmed`);
credenciais fora de artefatos; `.data/` preservado.

**Scale/Scope**: página nacional ~84 links (2026-11-15), listagens de distrito com centenas a milhares de
anúncios (ex.: Faro 2.389), ou seja, dezenas de páginas por entrada.

## Decisões Invariantes

- **D1 — Um único extrator de localidades.** `src/linkExtractor.js` passa a exportar `extractLocalities(doc)`
  com estratégias ordenadas definidas pela inspeção (research R1). `extractLinks` continua exportado com o
  mesmo formato de registro, para compatibilidade com 001/002. Links e descoberta do Lote usam o mesmo extrator.
- **D2 — Listagem = link sem sufixo final `/concelhos-freguesias`** (`deriveListingURL`). Nenhuma outra
  reescrita de caminho. Hubs (`/geo/…`) seguem o fluxo de destino "Ver N casas" existente.
- **D3 — Uma entrada por listagem**, com a primeira ocorrência vencendo (nome/tipo/contexto) e `aliases`/`linkUrls`
  acumulados. Homônimos nunca são fundidos pelo nome. Nenhuma expansão automática para municípios.
- **D4 — Fila preparada.** Ao concluir Links, o background grava `lote:prepared` (chrome.storage.local).
  A aba Lote mostra essa fila e o botão **Iniciar coleta**. O `START` autônomo usa a fila preparada quando ela
  existir. Sem ela, descobre na página atual com o mesmo extrator + `buildBatchQueue`. O breadcrumb vira só
  uma estratégia de fallback do extrator.
- **D5 — Navegação real e visível.** No modo autônomo, `createPageTransport(api,{foreground:true})` cria **uma**
  aba Idealista por execução (`active:true` só na criação), a reaproveita em todas as entradas e carrega
  **toda** página via `tabs.update` (`kind:'navigation'`). Nada de `fetch:true` nesse modo. O transporte de
  Itens/legado mantém o comportamento atual (sem opção).
- **D6 — Nenhuma tela da extensão em primeiro plano durante o processamento.** `runner.html` continua
  sendo o dono técnico, sempre `active:false`. `configuracoes.html`/`localidades.html` só abrem por clique
  explícito. Com configuração ausente, o painel mostra o requisito e a ação **Abrir Configurações**, sem
  navegar sozinho.
- **D7 — Origem do Links = página atual** se o caminho for `/arrendar-casas/` (raiz) ou
  `/arrendar-casas/<x>/concelhos-freguesias`. Caso contrário, usa a página nacional. A origem usada é exibida.
- **D8 — Recuperação automática só em `runQueue`** (opt-in via `autoRecovery:{maxRechecks:3}` no runner).
  O coordenador não muda suas regras de bloqueio. Ver `logic/recuperacao-de-bloqueio.md`.
- **D13 — Orçamento por execução vira ciclo (A-02).** No modo autônomo, `run_budget`/`session_duration`
  disparam `coordinator.renewCycle` via `runQueue`, e a fila continua. Intervalo mínimo e limite por janela
  permanecem intactos entre ciclos. Sem `cycle`, a regra antiga vale (contratos 004/005).
- **D14 — Aba técnica aceita (A-03).** `runner.html` continua inativa durante a execução e fecha ao
  terminar. Não é tela em primeiro plano para efeito do FR-005.
- **D15 — Inspeção só no Chrome real.** O Chromium automatizado limpo recebe 403 "Um momento…" (evidência
  em `validation/pre-plan-headless-probe.md`). A inspeção usa o Chrome do usuário, sem técnicas de evasão.
- **D9 — `item_budget` conclui o item como `limited`** no modo autônomo (schemaVersion 2). Execuções v1 mantêm a pausa.
- **D10 — Estados de item inalterados.** Completude é o atributo `completeness` sobre `saved`/`empty`.
  `counts()`/`summary` não ganham categorias.
- **D11 — Contexto e deduplicação só na gravação/resumo.** Páginas no store permanecem como extraídas.
  Arquivos mantêm a listagem completa por entrada. Ver `logic/fila-e-listagem.md`.
- **D12 — Inspeção antes de corrigir.** Nenhuma alteração em extratores (`linkExtractor.js`, `content.js`,
  `coleta-page.js`) antes de `validation/site-inspection.md` existir com as decisões de `research.md`.

## Constitution Check

| Princípio | Pré-Design | Pós-Design | Notas |
| --- | --- | --- | --- |
| I. Escopo explícito | ✅ | ✅ | Escopo da spec 006. Itens do backlog (exportação parcial, `loteStopExport`) fora. Enriquecimento (US7) incluído por decisão do usuário registrada em Clarifications. |
| II. Fontes e saídas separadas | ✅ | ✅ | Código novo em `src/`, testes em `tests/`, evidências em `.sdd/specs/006-…/validation/`. `dist/` só via build. Nenhuma entrada Webpack nova (módulos novos são importados por entradas existentes). |
| III. Compatibilidade | ✅ | ✅ | MV3/CSP mantidos. Nenhuma permissão nova (`tabs`, `scripting`, `webRequest` já existem). `tabs.update(active)` não exige permissão nova. |
| IV. Preservação | ✅ | ✅ | Schema dos anúncios só ganha 4 campos opcionais ao final (aditivo). Contratos 001–005 intactos (recuperação automática em camada opt-in). `.data/` não é tocado por testes. Proxy/token nunca em artefatos. |
| V. Qualidade com evidências | ✅ | ✅ | Níveis N1–N4 separados (quickstart). Aceite exige N4 ou pendência explícita (FR-025). Builds dev e prod, suíte e smokes nos dois. |

Sem violações, então Complexity Tracking fica vazio.

## Project Structure

### Documentation (this feature)

```text
.sdd/specs/006-revisao-links-lote-extracao/
├── spec.md
├── plan.md
├── research.md            # incertezas resolvidas pela inspeção real (R1–R6)
├── data-model.md          # acréscimos aditivos ao modelo v2
├── quickstart.md          # Q1–Q6, níveis de evidência N1–N4
├── logic/
│   ├── fila-e-listagem.md
│   └── recuperacao-de-bloqueio.md
├── contract-tests.lock
├── tasks.md
├── handoff.md
└── validation/            # criado pelo sdd-execute (site-inspection.md, real-validation.md, logs)
```

### Source Code (repository root)

```text
manifest.json  sidepanel.html  runner.html  configuracoes.html  lote.html  localidades.html  itens.html  popup.html
webpack.config.js  package.json
src/
├── linkExtractor.js            # D1: + extractLocalities (estratégias); extractLinks compatível
├── content.js                  # extrairDaRaiz (anúncios/próxima página); Freguesia (US7, se R4)
├── coleta-page.js              # inspectCollectionPage/COLLECT_PAGE; + declaredTotal (R2)
├── coleta-runner.js            # createPageTransport(api,{foreground}) — D5 (contrato C5)
├── coleta-autonoma.js          # runQueue, contexto, completude, dedup, item_budget (C2–C4)
├── coleta-coordinator.js       # start preserva context; item_budget v2; declaredTotal no checkpoint
├── coleta-items.js             # advance/sync — sem novos estados (D10)
├── coleta-discovery.js         # discover usa extractLocalities + buildBatchQueue (D4)
├── coleta-autonoma-background.js # START com fila preparada; notify; links→lote:prepared
├── links-collection.js         # LINKS_START com origem atual (D7); conclusão → lote:prepared
├── links-runner.js             # origem dinâmica; recuperação com planBlockRecovery
├── runner.js                   # usa runQueue + transport foreground
├── sidepanel.js                # Lote preparado, contagem visível×coletada, completude/dedup, sem navegação automática p/ Configurações
├── coleta-labels.js            # novos REASONS (access_blocked_persistent, rate_limit_persistent, limited)
├── coleta-view-model.js        # ação primária com fila preparada
├── lote-queue.js               # NOVO (stub): deriveListingURL, buildBatchQueue — C1
├── coleta-completeness.js      # NOVO (stub): assessListing, withContext — C2
└── coleta-block-recovery.js    # NOVO (stub): planBlockRecovery — C3
tests/
├── contracts/006-revisao-links-lote-extracao.test.cjs   # travado, 5 casos
├── unit/*.test.cjs                                      # novos testes complementares por fase
├── e2e/*.smoke.cjs                                      # + extractors-fixtures, links-district, lote-from-links
└── fixtures/                                            # + HTML capturado na inspeção (sanitizado)
```

**Structure Decision**: extensão única. Lógica nova em módulos puros em `src/` importados pelos
entry points existentes (`background`, `runner`, `sidepanel`, `content`). Nenhuma entrada Webpack nova.

## Complexity Tracking

| Violação | Por que é necessária | Alternativa mais simples rejeitada porque |
| --- | --- | --- |

## Estratégia de Testes

Prioridade: unitário → contrato/integração → E2E → manual (último recurso).

Comandos-base:

```powershell
npm.cmd run build ; node --test
npm.cmd run build:prod ; node --test
node --test tests/contracts/006-revisao-links-lote-extracao.test.cjs
.\.planning\scripts\powershell\check-contract-tests.ps1 -Slug 006-revisao-links-lote-extracao
```

Smokes: `node tests/e2e/<nome>.smoke.cjs` após cada build (dev e prod), conforme `quickstart.md` Q2.
O runner (`node --test`) conta casos de forma confiável; o script de trava analisa `.cjs` e impõe ≤ 5.

### Testes de Contrato

Arquivos travados em `contract-tests.lock`: `tests/contracts/006-revisao-links-lote-extracao.test.cjs`
(reusa, sem alterar, `tests/fixtures/autonoma.cjs`, travado pela 005).

Comando: `node --test tests/contracts/006-revisao-links-lote-extracao.test.cjs`

| Teste | Origem | Fase | Vermelho esperado (antes do execute) |
| --- | --- | --- | --- |
| C1 links viram uma entrada por listagem… | US3 FR-008/009/010, US7 FR-026 | Fase 5 (US3) | `error: 'not implemented'` (`deriveListingURL`) |
| C2 cada entrada percorre todas as páginas… | US4 FR-011/012/014/015, US7 FR-026 | Fase 6 (US4) | `error: 'not implemented'` (`runQueue`) |
| C3 bloqueio temporário retoma sozinho… | US5 FR-017/018/019/020 | Fase 7 (US5) | `error: 'not implemented'` (`runQueue`) |
| C4 resumo deduplica anúncios por id… | US4 FR-016 | Fase 6 (US4) | `error: 'not implemented'` (`runQueue`) |
| C5 uma aba Idealista visível… | US2/US4 FR-005/006/011 | Fase 6 (US4) | `AssertionError: expected 'navigation', actual 'pagination'` |

Vermelho confirmado em 2026-11-16: 5/5 falhando pelos motivos acima; suíte anterior 218/218 verde
com os stubs; travas 001–005 íntegras.

Stubs criados pelo plan (ponto de partida do execute, não travados): `src/lote-queue.js`,
`src/coleta-completeness.js`, `src/coleta-block-recovery.js`, método `runQueue` em `src/coleta-autonoma.js`.

## Estado Atual

| Área | Estado |
| --- | --- |
| Fase 1 Setup | Concluída: baseline registrado |
| Fase 2 Inspeção (N3) | Concluída: `validation/site-inspection.md`, research R1–R5 decididos, 2 fixtures novas |
| Fase 3 Correções de extrator | Concluída: extrator único (nacional 84 / distrito 148), `declaredTotal`, "Um momento", descoberta do Lote e do lote legado pelo extrator único |
| Fase 4 US2 Links | Concluída: origem = página atual (D7), auditoria visível × coletada, nenhuma tela da extensão sem clique |
| Fase 5 US3 Lote | Concluída: fila preparada (`lote:prepared`) a partir dos Links, exibida no Lote, START sem aba de origem, `context`/`freguesia` preservados |
| Fase 6 US4 Extração | Próxima: transporte em aba visível (C5), `runQueue` (C2/C4), completude, `item_budget`, dedup, contexto na gravação, smoke `lote-from-links` |
| Smokes | extractors-fixtures, 7 de Links e autonoma/autonoma-ui/autonoma-tabs/lote verdes em dev/prod |
| Contratos 006 | 1/5 (C1) verde; C2–C5 vermelhos esperados; trava íntegra |
| Suíte | 233/237 (4 = C2–C5), dev e prod; R-008 sem nova falha |

## Riscos e Decisões

| ID | Risco/Decisão | Impacto | Mitigação/Encaminhamento |
| --- | --- | --- | --- |
| R-001 | Estrutura real das páginas pode diferir do fixture de 2026-11-15 e das hipóteses de `research.md` | Alto: extratores e derivação podem estar errados | D12: inspeção (Fase 2) antes de qualquer correção de extrator. Derivação D2 sustentada por research R7 (A-01): só afeta sub-regiões, mesmo tipo de Braga confirmado pelo usuário. Se falhar em algum distrito/ilha, consultar o usuário; nunca editar o C1 |
| R-010 | Detectores de desafio não reconhecem o título "Um momento…" (evidência headless 2026-11-16) | Desafio servido com 200 ou sem status observado vira "conteúdo inesperado", não bloqueio | Task T058: incluir o padrão em `coleta-page.js` e `lote-navigation.js`, com teste |
| R-012 | Site limita listagens a 60 páginas / 1.800 anúncios (Lisboa 9.655, Porto 4.548, Faro 2.394, Norte 6.027 ficam truncados) | Distritos grandes nunca saem completos numa entrada | Decisão do usuário: só sinalizar (`site_limit`). As entradas de concelho/freguesia da mesma fila cobrem parte do restante, e a dedup no resumo mostra a sobreposição |
| R-013 | Acima da página 60 o site responde 404 com conteúdo; em v2, 404 marca a entrada como falha local | Pedido acima de 60 viraria pendência falsa | Não ocorre no fluxo normal (página 60 sem próxima). Se ocorrer, o teste da Fase 6 deve cobrir |
| R-011 | Novo ciclo (D13) remove a parada de segurança por execução | Coleta pode rodar dias | Decisão do usuário. Ritmo, bloqueio persistente e pausa manual continuam parando a fila. O painel mostra ciclo atual e páginas totais |
| R-002 | Contratos 004 C2/005 C5 exigem confirmação manual após desafio | Recuperação automática poderia quebrá-los | D8: camada `runQueue` opt-in que envia `accessConfirmed` após o prazo, com limite de verificações |
| R-003 | Limites padrão (`maxPagesPerRun` 200, `maxSessionMs` 6 h, 60 pág/h) param a fila inteira em execuções grandes (84 entradas) | Fila não chega ao fim sozinha | Resolvido no plano (A-02, decisão do usuário 2026-11-16): `runQueue` espera `window_budget` e renova o ciclo em `run_budget`/`session_duration` (D13). O ritmo de 60 pág/h continua, então filas grandes levam horas ou dias, mas não param. Validação N4 usa entrada pequena |
| R-004 | Playwright MCP indisponível na sessão ou proibido de abrir `chrome-extension://` (visto na 005) | Sem N4 automatizado | Quickstart Q6: roteiro manual com o usuário. Sem N4, a feature não é aceita (FR-025) |
| R-005 | Navegar toda página (sem fetch) muda o perfil de requisições e o tempo por página | Possível bloqueio ou lentidão | Ritmo da 004 mantido. Inspeção registra comportamento. Bloqueio tratado pela US5 |
| R-006 | Abrir a aba de coleta em foco pode atrapalhar o usuário | UX | Decisão do usuário: foco só na criação. Nunca mais `active:true` (C5) |
| R-007 | Ordem da fila: `normalizeItems` ordena por `quantidade`; entradas da fila preparada vêm sem quantidade | Ordem diferente da página | Fila preparada mantém a ordem do DOM (`quantidade:null`). Discover da 005 continua ordenando como antes |
| R-008 | Intermitências conhecidas da 005 (R-019/R-020: `coleta.smoke` dev e `autonoma.smoke` após `stopWorker`) | Falsos vermelhos no Polish | Não fechar por retry. Registrar em Execution Notes |
| R-009 | Captura de HTML real pode conter dados pessoais de anunciantes ou tokens de sessão | Constitution IV | Fixtures sanitizadas (remover scripts, cookies, ids de sessão, telefones). Manter só a estrutura necessária |

## Execution Notes

| Data | Fase/Story | Resumo | Pendência Principal |
| --- | --- | --- | --- |
| 2026-11-16 | Fase 1 Setup | Baseline (git, `.data/`, manifest, 218 pass + 5 contratos vermelhos, travas 001–006). MCP Playwright ausente na sessão | Fase 2 precisa do Chrome real do usuário |

| 2026-11-16 | Fase 2 US1 inspeção | N3 no Chrome real via MCP: Lote descobre 0 na página nacional (D-1); Links coleta 0 no distrito (D-2); 14 concelhos + 134 freguesias; limite do site de 60 páginas; `h1` com total; `/geo/` é listagem; D2 confirmada; desafio transitório de cerca de 5 s | Confirmar regra de Freguesia (R4) e escopo do distrito |

| 2026-11-16 | Fase 3 US1 correções | Extrator único serializável; `declaredTotal`; "Um momento"; descoberta do Lote via extrator único (bundle injetado + global no mundo isolado). 222/227 dev/prod; 7 smokes verdes em prod | `autonoma.smoke` dev intermitente 1/4 (R-008/R-020) |

| 2026-11-16 | Fase 4 US2 Links | Origem atual (D7), `linksAudit` (visível × coletada, excluídos), painel com origem/contagem/aviso, auditoria FR-005/007 sem achados. `links-district.smoke` novo verde; 7 smokes de Links dev/prod OK; 225/230 | — |

| 2026-11-16 | Fase 5 US3 Lote | C1 verde. Fila preparada dos Links (83 entradas no fixture nacional; Algarve+Faro fundidos), painel com lista/descartar, START `fromPrepared`, `context` validado no coordenador. T061 ad-hoc: painel não navega mais sozinho para Configurações. 233/237 dev/prod | Jornada de UI completa fica para o T040 |

**PRÓXIMO**: Fase 6 (T031–T041): `createPageTransport(api,{foreground})` (C5), `runQueue` sem recuperação (C2/C4), `assessListing`/`withContext`, `item_budget` v2, dedup `seen:<runId>`, runner com transporte visível, painel com completude/dedup, smoke `lote-from-links`.

## Arquivos Principais

- `src/coleta-runner.js` (`createPageTransport`, C5)
- `src/coleta-autonoma.js` (`runQueue`, completude, dedup, contexto na gravação; C2/C4)
- `src/coleta-completeness.js` (stub), `src/coleta-coordinator.js` (`declaredTotal`, `item_budget` v2)
- `src/runner.js`, `src/sidepanel.js`, `src/coleta-labels.js`

## Cuidados para Retomada

- `extractLinks` em `src/linkExtractor.js` é **serializada** por `localidades-collector.js` (`executeScript({func})`): não tirar helpers de dentro dela (`localidades-collector.test` verifica). Para chamar o extrator de outro ponto via `executeScript`, injete `files:['dist/linkExtractor.bundle.js']` e leia `globalThis.__idealistaLocalities` (`coleta-discovery.readPageLocalities`).
- Fingerprint do comando `START` é calculado igual em `coleta-autonoma-background.js` e em `coordinator.reserveLaunch`; nunca acrescentar campos só de um lado (a repetição de clique vira `command_conflict`).
- Fila preparada (`lote:prepared`) vence a página atual no botão Iniciar. Para voltar a usar a página atual, o usuário clica em "Descartar fila preparada".
- `extractors-fixtures.smoke.cjs` injeta as fontes de `src/` (não os bundles); rodá-lo após cada mudança de extrator, independe do build.

- 2026-11-16: Playwright MCP adicionado no escopo **local** deste projeto (`claude mcp add playwright --scope local … -- cmd /c npx -y @playwright/mcp@latest --extension`), com status Connected. As ferramentas `mcp__playwright__*` só aparecem numa sessão nova (ou após reconectar em `/mcp`). O token fica em `~/.claude.json` (local) e no `.env` (ignorado pelo git); nunca copiar para artefatos. Exige a extensão "Playwright MCP Bridge" ativa no Chrome do usuário.

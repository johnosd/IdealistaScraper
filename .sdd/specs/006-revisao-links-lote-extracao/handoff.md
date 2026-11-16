# Handoff — 006-revisao-links-lote-extracao

## Contexto

- Repositório IdealistaScraper, branch `feature/004-coleta-resiliente`. Extensão Chrome MV3 em JS/CommonJS + Webpack 5, testes `node:test` + Playwright 1.65.
- Próximo comando: `/sdd-execute 006-revisao-links-lote-extracao`. Backlog: **Planejada**, 0/73 itens (60 tasks + checklist de release).
- A 005 segue **Em Execução** (58/64). A 006 se apoia nela, sem reabri-la. O checkout tem muitas alterações não commitadas da 004/005 e dados em `.data/`: preservar tudo.
- `spec.md` foi editada nesta sessão (Clarifications sdd-plan; FR-016 resolvida; FR-026–028; US7; SC-010). Releia-a.

## O que a feature entrega

- US1/P1: inspeção real das 3 páginas **antes** de qualquer correção (D12), seguida de extratores corrigidos com base nela.
- US2/P1: Links coleta da **página atual** quando suportada (antes: sempre a página nacional fixa), com contagem visível × coletada e nenhuma tela da extensão aberta sozinha.
- US3/P1: links → fila preparada no Lote (`lote:prepared`), **uma entrada por listagem** (link sem `/concelhos-freguesias`). Algarve+Faro se fundem em uma entrada; homônimos não.
- US4/P1: cada página é carregada por **navegação real** numa aba Idealista visível (em foco só na criação, reaproveitada entre entradas; **sem fetch**). A entrada é gravada antes da próxima. Listagem truncada fica `completeness: limited`, e o estado continua `saved`. A deduplicação aparece **só no resumo**: cada arquivo mantém a listagem completa (decisão do usuário).
- US5/P2: espera + reverificação automática limitada (`runQueue`, `maxRechecks:3`). Esgotado o limite → `access_blocked_persistent`. Nada de contornar.
- US7/P3: 4 campos aditivos no anúncio (`Região`, `Sub-região`, `Município`, `Freguesia`). `Freguesia` só se a inspeção achar fonte estruturada.
- US6/P2: aceite exige validação N4 (site real + extensão instalada). Sem ela a feature continua Em Execução.

## Leitura obrigatória, em ordem

1. `spec.md`: requisitos e decisões do usuário (Clarifications).
2. `plan.md`: os 6 achados da exploração, as Decisões Invariantes D1–D12 e os riscos R-001–R-009.
3. `tasks.md`: 10 fases e rastreabilidade FR/SC → tasks.
4. `logic/fila-e-listagem.md`: derivação, fila, completude, contexto e dedup (pseudocódigo).
5. `logic/recuperacao-de-bloqueio.md`: `runQueue`/`planBlockRecovery` e por que não mexer no coordenador.
6. `data-model.md`: só acréscimos (`context`, `completeness`, `dedup`, `seen:<runId>`, `lote:prepared`, `limitedCount` fora de `summary`).
7. `research.md`: R1–R5 provisórios, a decidir na Fase 2.
8. `quickstart.md`: níveis de evidência N1–N4 e roteiros Q1–Q6.
9. `.planning/memory/constitution.md`.

## Testes de contrato

- `tests/contracts/006-revisao-links-lote-extracao.test.cjs`: 5 casos, travados. C1 → Fase 5; C2, C4, C5 → Fase 6; C3 → Fase 7.
- Comando: `node --test tests/contracts/006-revisao-links-lote-extracao.test.cjs`.
- Integridade: `.\.planning\scripts\powershell\check-contract-tests.ps1 -Slug 006-revisao-links-lote-extracao`.
- Vermelho confirmado: C1–C4 com `not implemented`; C5 com `AssertionError` (`pagination` ≠ `navigation`). Suíte anterior 218/218 verde.
- Pode quebrar as travas **004** (C2: desafio exige retomada explícita) e **005** (C5: idem; fixture `tests/fixtures/autonoma.cjs` travado e reutilizado pela 006). Também 001/002 (formato de `extractLinks`). Rodar o check de 001–006 a cada fase.

## Stubs criados

- `src/lote-queue.js`: `deriveListingURL`, `buildBatchQueue` (lançam `not implemented`).
- `src/coleta-completeness.js`: `assessListing`, `withContext`.
- `src/coleta-block-recovery.js`: `planBlockRecovery`.
- `src/coleta-autonoma.js`: método `runQueue` (stub no fim do objeto `service`). Sem `autoRecovery`, deve equivaler a `drive`.

## Armadilhas já mapeadas

- **Não mudar a regra de bloqueio do coordenador**: 004 C2/005 C5 exigem `accessConfirmed`. A automação mora em `runQueue`, que é opt-in.
- `counts()`/`summary` não podem ganhar chaves nem estados (a view-model 005 e testes comparam objetos). Use `completeness` e `limitedCount` no nível da execução.
- O contexto entra **só na gravação**. Páginas no store e o digest permanecem como extraídos. No C2 os campos de contexto vêm **depois** dos originais.
- O fixture `autonoma.cjs` monta URLs com `url(name)` em minúsculas e as fontes com `faro-distrito`. `normalizeItems` ordena por `quantidade`, e a fila preparada deve passar `quantidade:null` para manter a ordem do DOM.
- `createPageTransport` sem opção deve manter o comportamento antigo (Itens/legado e `coleta.smoke`). O `foreground` só vale para o runner autônomo.
- `item_budget` conclui o item como `limited` somente em `schemaVersion 2`. Em v1 continua pausando (contrato 004).
- Hoje o breadcrumb (`extractDirectLocalities`) é a descoberta do Lote e `extractLinks` é a do Links. Essa divergência é o achado central; unificar em `extractLocalities` (D1) mantendo a saída de `extractLinks` na página nacional (84 registros no fixture 2026-11-15).
- O Playwright MCP pode não estar disponível, e na 005 recusou abrir `chrome-extension://`. O Playwright local **headless é bloqueado** (403 "Um momento…"), então N3 e N4 exigem o Chrome real do usuário (MCP em modo extensão) ou roteiro manual (Q6).
- `renewCycle` (D13) só vale para v2 e não toca em `d.events`/`lastStarted`/`blockedUntil`. Sem `cycle`, `requestPage` precisa ser byte-equivalente em comportamento (contratos 004 C1 e 005).
- Credenciais de proxy/token só existem no `.env` local ou na tela de Configurações. Não copiar valores para lugar nenhum. Fixtures HTML precisam ser sanitizadas (R-009).
- Intermitências conhecidas da 005 (R-019/R-020): não fechar por retry.
- Usar `npm.cmd` no PowerShell.

## Pendências do Analyze

Nenhuma aberta. Resolvidas em 2026-11-16 (ver Clarifications da spec):

- A-01: derivação sustentada por research R7 (só sub-regiões; Braga confirmado pelo usuário). Confirmar em T004/T006; se falhar, consultar o usuário e nunca editar o C1.
- A-02: o usuário escolheu "esperar e continuar sozinho". Isso virou D13, `renewCycle` e as tasks T059/T060. Ritmo intacto entre ciclos.
- A-03: `runner.html` aceita em segundo plano (D14).
- A-04: ordem mantida (Fase 8 Freguesia antes da Fase 9 validação real).

Achado novo na sondagem headless (`validation/pre-plan-headless-probe.md`): o Chromium limpo recebe 403 "Um momento…", e os detectores não reconhecem esse título (R-010 → T058). A inspeção precisa do Chrome real do usuário, sem evasão (D15).

## Gate de pronto

- Contratos 006 5/5 e travas 001–006 íntegras.
- `npm.cmd run build` + `node --test` e `npm.cmd run build:prod` + `node --test`: 0 fail, 0 skip.
- Smokes do quickstart Q2 em dev e prod, incluindo os novos `extractors-fixtures`, `links-district` e `lote-from-links`.
- Evidências `validation/site-inspection.md` (N3) e `validation/real-validation.md` (N4). **N4 é gate**: sem ela, manter Em Execução.
- Polish: README, `plan.md`/`tasks.md`/backlog/handoff, memória do projeto. Manifest sem permissões novas e `.data/` igual ao baseline.

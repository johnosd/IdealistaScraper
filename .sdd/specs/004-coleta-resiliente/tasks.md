# Tasks: Coleta resiliente com controle de ritmo e retomada persistente

**Input**: `.sdd/specs/004-coleta-resiliente/`.
**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/coleta-runtime.md e ambos logic/*.md.
**Organization**:42 tasks com IDs +13 gates de release. Os registros abaixo refletem a execução concluída em2026-11-14.

## Path Conventions

- Fontes em src/ CommonJS, HTML/manifest/webpack na raiz, testes node em tests/unit e tests/contracts, harness opt-in em tests/e2e. dist gerado, nunca editar.
- Estado novo em coleta-store/coordinator; coordenador usa porta injetada travada. Writers e stores de handles002/003 são reutilizados.
- Contratos004 e fixture coleta-store estão prontos e TRAVADOS; não são tarefas de escrita. Outros contratos/travas também imutáveis na execução.
- [P] só indicaria independência real; não há promessa de paralelizar mudanças no coordenador/worker/UI compartilhados. Não criar agentes/branches sem necessidade.

## Phase 1: Infraestrutura compartilhada

**Objetivo**: implementar porta de persistência e transporte sem disparar coleta no boot.

### Implementation

- [X] T001 Implementar adapter IndexedDB lazy em `src/coleta-store.js`, read/transact com chaves declaradas, mutator síncrono, rollback e resolução após oncomplete, conforme `data-model.md`/D-001; não alterar bancos existentes.
- [X] T002 Implementar envelopes, erros sanitizados e validação de sender/origem/URL em `src/coleta-protocol.js` e `src/coleta-background.js`, conforme `contracts/coleta-runtime.md`; listeners síncronos, zero rede no read/list/startup.
- [X] T003 Preparar runners de uma página em `src/coleta-runner.js` e `src/coleta-page.js`, portas de transporte/relógio/storage canceláveis e separação dos writers, mantendo módulos novos lazy e sem substituir comportamento existente prematuramente.

### Testes da Fase

- [X] T004 Adicionar `tests/unit/coleta-store.test.cjs` e `tests/unit/coleta-protocol.test.cjs`: commit/abort, mutator async recusado, owner arbitrário rejeitado, permissões/boot sem I/O; cobertura real IndexedDB complementada emT037.

**Critério de Conclusão**: testes novos de infraestrutura verdes,65 testes antigos verdes, cinco contratos004 ainda vermelhos conhecidos; sem import/runtime novo que quebre baseline. Nenhum teste travado alterado.

**Registro da Fase**:
- Status: Concluída em 2026-11-14.
- Feito: Portas de persistência e transporte lazy/cancelável; sender validado.
- Contrato: trava004 íntegra; sem contrato nesta fase
- Testes executados: node --test testes antigos+coleta-store/protocol:69/69; contratos004 esperados5red.
- Pendências: Phase2/US1, T005.

## Phase 2: US1 — Ritmo compartilhado (P1)

**Objetivo**: controlar toda solicitação própria e expor limites antes de iniciar.

### Contrato da Fase

C1 `intervalo e orçamento sobrevivem a troca de modo e coordenador` (FR-001/004/005/006).
Comando: `node --test --test-name-pattern '^C1 ' tests/contracts/004-coleta-resiliente.test.cjs`.

### Implementation

- [X] T005 [US1] Implementar defaults/faixas/validação/restore em `src/coleta-policy.js` e updatePolicy no stub `src/coleta-coordinator.js`, conforme `logic/coordenacao-e-ritmo.md`; FR-002/003 → contrato:C1.
- [X] T006 [US1] Implementar start/request/report básicos, janela móvel/histórico24h, reserva atômica e idempotência em `src/coleta-coordinator.js`; consumo ANTES de envio, sem devolução por crash; FR-004/005 → contrato:C1.
- [X] T007 [US1] Integrar gate inicial/CTA/paginação/próximo item em `src/coleta-runner.js`, `src/lote-collector.js`, `src/lote-navigation.js`, `src/localidades-collector.js`; aguardar decisão antes de tabs.update/fetch; FR-001/006 → contrato:C1.
- [X] T008 [US1] Criar `itens.html`/`src/itens.js`, entry em `webpack.config.js`, launcher em `src/popup.js` e painel `src/coleta-ui.js` em `lote.html`/`localidades.html`; preservar URL/proxy, mostrar defaults/limites/consumo e ajustes; FR-003.

### Testes da Fase

- [X] T009 [US1] Adicionar `tests/unit/coleta-policy.test.cjs`, `tests/unit/coleta-rate.test.cjs`, `tests/unit/coleta-ui.test.cjs`; testar limites inválidos/extremos, mudança de janela/política sem reset, minInterval na navegação inicial/entre municípios e bootstrap Itens; SC-001.

**Critério de Conclusão**: comando C1 →1/1 verde e trava004 íntegra; fluxos todos passam pelo gate e continuam com schemas/destinos anteriores. Suíte completa reporta explicitamente contratos ainda pendentes.

**Registro da Fase**:
- Status: Concluída em 2026-11-14.
- Feito: Ritmo persistente e telas integradas; Itens em página durável.
- Contrato: trava004 íntegra; resultados descritos em Testes executados
- Testes executados: npm.cmd test:77/77; C1 e demais contratos5/5; node tests/e2e/coleta.smoke.cjs:4cenários/2requests/0pageerrors.
- Pendências: Phase3 respostas; núcleoC2 já verde pela implementação compartilhada, ampliar integração.

## Phase 3: US2 — Limites, bloqueios e falhas (P1)

**Objetivo**: classificar respostas e pausar/repetir somente conforme política explícita.

### Contrato da Fase

C2 `429 persistente e desafio exigem retomada explícita` (FR-008/010/011).
Comando: `node --test --test-name-pattern '^C[12] ' tests/contracts/004-coleta-resiliente.test.cjs`.

### Implementation

- [X] T010 [US2] Implementar classificação pura em `src/coleta-classification.js`, fatos DOM em `src/coleta-page.js` e reuso em `src/lote-navigation.js`, segundo `logic/respostas-proxy-e-gravacao.md`; FR-007/011 → contrato:C2.
- [X] T011 [US2] Implementar Retry-After segundos/data/inválido, blockers persistentes,30min/manual403,429 sem autoretry, backoff transitório30/60s e3tentativas totais em `src/coleta-coordinator.js`; FR-008/009/010 → contrato:C2.
- [X] T012 [US2] Observar HTTP das abas próprias em `src/coleta-background.js`, integrando `src/background.js`: listeners webRequest observacionais e correlação persistente por reserva/tab/document, allowlist de headers, unknown e redirects em cadeia; FR-011, sem permissão nova.
- [X] T013 [US2] Migrar coleta produtiva de `src/content.js`/`src/coleta-page.js` e consumidores para uma página/comando com deadline/AbortController; retorno parcial distinto de completo em Itens e Lote, sem fallback funcional que recoleta; FR-012.

### Testes da Fase

- [X] T014 [US2] Criar `tests/unit/coleta-classification.test.cjs`, `tests/unit/coleta-retry.test.cjs` e `tests/unit/coleta-page.test.cjs`:403/429/503/407/200challenge/login/zero válido, headers ausentes e data longa/clock; tentativa/cancel/duração finitos, sem falsa conclusão; SC-002/003/004.

**Critério de Conclusão**: comando C1/C2 →2/2 verdes e trava004 íntegra; nenhuma insistência automática após recusa; navegação inicial e intermediárias classificadas sem inventar status.

**Registro da Fase**:
- Status: Concluída em 2026-11-14.
- Feito: Classificação e limites persistentes; coleta de uma página e HTTP observacional.
- Contrato: trava004 íntegra; resultados descritos em Testes executados
- Testes executados: node --test contratos004+classificação/retry/page:9/9; C2 já verde pela transação compartilhada; correção HTTP requestId validada no smoke.
- Pendências: Phase4 exclusividade, fencing e aborto.

## Phase 4: US3 — Exclusividade e fencing (P1)

**Objetivo**: impedir execução duplicada mesmo com owner desaparecido e worker reiniciado.

### Contrato da Fase

C3 `corrida, execução ainda viva e proprietário antigo não duplicam coleta` (FR-013/014).
Comando: `node --test --test-name-pattern '^C[123] ' tests/contracts/004-coleta-resiliente.test.cjs`.

### Implementation

- [X] T015 [US3] Implementar acquire/release atômico domain+session, epoch, requestId/token one-shot e comandos tardios em `src/coleta-coordinator.js`, validando sender em `src/coleta-background.js`; FR-013 → contrato:C3.
- [X] T016 [US3] Implementar prova de vida owner/executor, browserRunId, recover e abort ACK em `src/coleta-background.js`/`src/coleta-runner.js`/`src/coleta-page.js`; nunca takeover por timer nem fechar aba não comprovada; FR-014 → contrato:C3.
- [X] T017 [US3] Ligar pausar/cancelar/conflito/owner em `src/coleta-ui.js`, `src/itens.js`, `src/lote.js`, `src/localidades.js`; rejeitar START_CRAWL duplicado em `src/content.js`, sem reset de memória; FR-015.

### Testes da Fase

- [X] T018 [US3] Criar `tests/unit/coleta-ownership.test.cjs`/`tests/unit/coleta-cancel.test.cjs`: corrida entre modos, executor ainda vivo, suspensão worker, tabId reciclado, ACK/permissão perdida e mensagem epoch antigo; SC-005. Não confundir VM com restart real.

**Critério de Conclusão**: comando C1–C3 →3/3 verdes e trava004 íntegra; um executor próprio por domínio; pausa/cancelamento funcionam durante espera e fetch, sem reset de custo.

**Registro da Fase**:
- Status: Concluída em 2026-11-14.
- Feito: Propriedade e fences persistentes, prova de executor e cancelamento integrados.
- Contrato: trava004 íntegra; resultados descritos em Testes executados
- Testes executados: node --test coleta-runtime/ownership/cancel/proxy-content+contratos004:11/11; check-contract-tests.ps1:trava íntegra. Restart de worker simulado; browser real permanece emT038.
- Pendências: Phase5 checkpoints e reconciliação de arquivo.

## Phase 5: US4 — Checkpoints e retomada manual (P1)

**Objetivo**: preservar progresso e escrita pendente após fechar tela/navegador.

### Contrato da Fase

C4 `checkpoint de três páginas retoma após reconstrução sem refazer progresso`; C5 `falha de commit preserva checkpoint e resultado salvo é idempotente` (FR-021/022/023/024/026/027).
Comando: `node --test tests/contracts/004-coleta-resiliente.test.cjs`.

### Implementation

- [X] T019 [US4] Implementar deltas/hash/manifest e checkpoint atômico em `src/coleta-store.js`/`src/coleta-coordinator.js`, fail closed no erro/quota e report idempotente; FR-021/026 → contratos:C4,C5.
- [X] T020 [US4] Implementar list/read/resume manual e reconstrução do próximo destino em `src/coleta-runner.js`/`src/coleta-ui.js`, ligando `src/itens.js`/`src/lote.js`/`src/localidades.js`; preservação de consumo/mês/nextUrl sem refetch de confirmadas; FR-022/023/024 → contrato:C4.
- [X] T021 [US4] Envolver sessão/fila Lote em `src/coleta-runner.js`/`src/lote.js`, preservando assinatura de `src/lote-session.js` e writer `src/lote-export.js`; persistir resultado awaiting-save e avanço somente pós-receipt; FR-027 → contrato:C5.
- [X] T022 [US4] Implementar intent/digest/receipt e reconciliação manual no wrapper `src/coleta-runner.js`, integrando `src/localidades.js`/`src/itens.js`; manter `src/localidades-export.js` e suas confirmações; Downloads unknown requer decisão explícita; FR-027 → contrato:C5.
- [X] T023 [US4] Validar schema/hashes/origem/revisão proxy/idade7dias, capacidade/quotas e falha de checkpoint em `src/coleta-coordinator.js`/`src/coleta-store.js`/`src/coleta-ui.js`; nenhum descarte silencioso; FR-025/026.

### Testes da Fase

- [X] T024 [US4] Criar `tests/unit/coleta-checkpoint.test.cjs`/`tests/unit/coleta-save.test.cjs`, reusando `tests/fixtures/localidades-filesystem.cjs`:3páginas/restart lógico, mês/timezone, resultado completo sem rede, quota/corrupção/versão, crash após close/receipt, idempotência e Downloads unknown; SC-006/007/008. IndexedDB/browser reais emT037/T038.

**Critério de Conclusão**: contratos004 completos →5/5 verdes e todas as travas íntegras; dados/fila/writers preservados; nenhuma rede automática ao reabrir, nenhum avanço sem arquivo confirmado. Gate real de browser ainda pendente de Polish.

**Registro da Fase**:
- Status: Concluída em 2026-11-14.
- Feito: Checkpoint com hash/capacidade, mês e nomes preservados; intent/receipt e Downloads desconhecido recuperáveis.
- Contrato: trava004 íntegra; resultados descritos em Testes executados
- Testes executados: node --test coleta-checkpoint/save+contratos004:11/11 (save isolado3/3); trava004 íntegra. Falha/quota simulada mantém página e custo; reconciliação usa writer real com filesystem em memória.
- Pendências: Phase6 proxy estável; restart/browser e gesto nativo seguem emT037–T039.

## Phase 6: US5 — Proxy estável (P2)

**Objetivo**: prender configuração à sessão e parar diante de alteração relevante.

### Implementation

- [X] T025 [US5] Acrescentar revisão opaca e observação settings.onChange em `src/background.js`/`src/coleta-background.js`, preservando snapshot/auth/rollback e sem deadlock de filas; FR-016/017.
- [X] T026 [US5] Conferir PAC/revisão em start/resume/reserva/dispatch e bloquear alteração externa da própria UI ativa em `src/coleta-runner.js`/`src/popup.js`/`src/coleta-background.js`; pausar antes de save/enable/disable concorrente, sem DIRECT deliberado; FR-017/018.
- [X] T027 [US5] Remover reconnect10páginas e reaplicação por município em `src/content.js`/`src/lote-collector.js`; inicializar uma vez por contexto confirmado sem mudar política de exportação; FR-016.

### Testes da Fase

- [X] T028 [US5] Atualizar `tests/unit/proxy-background.test.cjs`/`tests/unit/proxy-content.test.cjs` e criar `tests/unit/coleta-proxy.test.cjs`:100páginas estáveis sem enable por contagem, revisão/alteração no meio/PAC externo/worker boot; SC-009 (parte proxy), sem editar contratos travados.

**Critério de Conclusão**: contratos0045/5 e unitários proxy/coleta verdes; smoke proxy existente mantém restart/status/auth de baseline; nenhuma alegação de IP/comercial validado.

**Registro da Fase**:
- Status: Concluída em 2026-11-14.
- Feito: Proxy estável com revisão efetiva opaca, onChange e guards de configuração/reserva/dispatch.
- Contrato: trava004 íntegra; resultados descritos em Testes executados
- Testes executados: node --test lote-collector/coleta-proxy/proxy-background/proxy-content+contratos004:23/23; build dev; node tests/e2e/proxy.smoke.cjs:6cenários/0pageerrors, worker real parado/recuperado. Trava004 íntegra.
- Pendências: Phase7 sondagem IP opt-in limitada; nenhum proxy comercial consultado.

## Phase 7: US6 — Diagnóstico de IP limitado (P2)

**Objetivo**: reduzir consultas auxiliares e manter pause/cancel utilizáveis.

### Implementation

- [X] T029 [US6] Implementar `src/coleta-ip.js` e marker persistente session+proxyRevision no coordinator/store, endpoint fixo via background, automático opt-in e sem retry na falha; FR-019.
- [X] T030 [US6] Integrar timeout/abort5s e IP unknown em `src/coleta-ui.js`/`src/popup.js`/`src/coleta-background.js`, remover probe automático por página em `src/content.js`; teste manual não desativa/reativa proxy de coleta; FR-020.

### Testes da Fase

- [X] T031 [US6] Criar `tests/unit/coleta-ip.test.cjs`:100páginas/uma consulta, marker antes do fetch, restart sem repetir, mudança efetiva permite uma nova, timeout/falha não vira proxy-off e cancel utilizável; SC-009(parteIP)/012.

**Critério de Conclusão**: contratos e unitários verdes; sondagem conta separadamente e não depende de CORS do site; zero chamada pública de IP nos testes locais.

**Registro da Fase**:
- Status: Concluída em 2026-11-14.
- Feito: Sondagem IP fixa e opt-in, marker antes do fetch, prazo5s e cancelamento independente; teste manual preserva proxy.
- Contrato: trava004 íntegra; resultados descritos em Testes executados
- Testes executados: node --test coleta-ip/proxy-popup+contratos004:12/12;100páginas/1marker e restart lógico; timeout/fetch simulados, zero chamadas públicas. Trava004 íntegra.
- Pendências: Phase8 ciclos/diagnóstico; depois gates de navegador e exportações.

## Phase 8: US7 — Diagnóstico e prevenção de ciclos (P2)

**Objetivo**: parar repetições e explicar progresso/consumo sem segredos.

### Implementation

- [X] T032 [US7] Completar visited/URLsame-origin/redirect final/maxPages/maxNoNewPages em `src/coleta-coordinator.js`/`src/coleta-page.js`/`src/coleta-runner.js`; FR-028/029.
- [X] T033 [US7] Implementar eventos allowlisted e ring/retencão/capacidade em `src/coleta-store.js`/`src/coleta-coordinator.js`, sem query/HTML/Error/config/segredos; FR-030/031.
- [X] T034 [US7] Expor resumo/diagnósticos recuperáveis e razões distintas em `src/coleta-ui.js`, `itens.html`, `lote.html`, `localidades.html`, sem expor implementação ao usuário; FR-032.

### Testes da Fase

- [X] T035 [US7] Criar `tests/unit/coleta-cycles.test.cjs`/`tests/unit/coleta-diagnostics.test.cjs`:ciclo antes do envio, sem novos anúncios, URLfora/login/vazio, retenção sem apagar checkpoint e sanitização com valores sentinela; SC-010/011.

**Critério de Conclusão**:contratos e unitários verdes, diagnóstico persistente distingue coleta/persistência/arquivo/IP e não contém sentinelas secretas; parada por teto/ciclo não é complete.

**Registro da Fase**:
- Status: Concluída em 2026-11-14.
- Feito: Ciclos de paginação/CTA/redirect e destinos inválidos pausam; diagnóstico sanitizado e retenção terminal preservam dados.
- Contrato: trava004 íntegra; resultados descritos em Testes executados
- Testes executados: node --test coleta-cycles/diagnostics/ui/proxy-content+contratos004:13/13; checkpoint/cycles/diagnostics+contratos004:13/13; trava004 íntegra. Três regressões inicialmente red corrigidas na própria fase.
- Pendências: PolishT036–T042: E2E de três modos/restart real, compatibilidade de writers e validação nativa.

## Phase 9: Polish & Cross-Cutting Concerns

**Objetivo**: comprovar integração/restart real, compatibilidade de exportação e sincronizar documentação.

### Implementation

- [X] T036 Preservar/adaptar consumidores e harnesses não travados `tests/e2e/localidades.smoke.cjs`, `tests/e2e/lote.smoke.cjs`, `tests/unit/lote-popup.test.cjs`, `tests/unit/proxy-popup.test.cjs`, `tests/unit/listing-fields.test.cjs` se necessário às novas entradas; manter intenção/schema/gestos002/003 e limites reais válidos, sem atalhos produtivos; FR-033.
- [X] T041 Atualizar `README.md`, instruções nas páginas e status/artefatos da004 com comportamento final e limitações de recuperação/Downloads/prova local; preservar outras features e backlog não relacionado.
- [X] T042 Atualizar `handoff.md`/seções de execução de `plan.md` e `tasks.md` com resultados reais, arquivos, bloqueios residuais e níveis de evidência; SC-013. Sugerir commit, não criar commit automaticamente.

### Testes da Fase

- [X] T037 Criar `tests/e2e/coleta-store.smoke.cjs` com IndexedDB e runtime reais:quota/abort/revisão, fences/sender, owner morto com executor vivo, headers iniciais correlacionados e intent/receipt; SC-005/007/008/011. Perfil temporário e rede externa bloqueada.
- [X] T038 Criar `tests/e2e/coleta.smoke.cjs`:três modos, ritmo/race/bloqueio inicial e intermediário, worker encerrado e navegador fechado/reaberto no MESMO perfil; somente resume manual para página4 sem refetch1–3; SC-001/002/003/005/006/012. Registrar URLs efetivas e zero pageerrors em dev/prod.
- [X] T039 Executar roteiro nativo alterado de `quickstart.md` em pasta temporária autorizada:gesto de reautorização/Links confirmação/Lote mês fixo/Itens download desconhecido; SC-008. Preservar dados/perfil do usuário e distinguir OPFS/real.
- [X] T040 Rodar `npm.cmd ci`, `npm.cmd test`, build dev/prod, `node --test`, quatro travas, E2E localidades/lote/proxy/coleta-store/coleta nos dois builds e `git diff --check`; conferir entradas/permissões e preservação de dados/legados; FR-033. Registrar saídas sem segredos em validation/.

### Checklist de Release

- [X] Infraestrutura (Phase1) concluída.
- [X] US1 ritmo (Phase2) concluída.
- [X] US2 respostas (Phase3) concluída.
- [X] US3 exclusividade (Phase4) concluída.
- [X] US4 retomada (Phase5) concluída.
- [X] US5 proxy (Phase6) concluída.
- [X] US6 IP (Phase7) concluída.
- [X] US7 diagnóstico (Phase8) concluída.
- [X] Contratos todos verdes, travas001/002/003/004 íntegras e suíte completa sem falhas omitidas.
- [X] Builds development/production e E2E aprovados, último artefato production, sem edição manual de dist/.
- [X] MV3/CSP/permissões e restart REAL do navegador no perfil temporário aprovados, nenhuma coleta automática.
- [X] Quickstart/gesto nativo alterado aprovados, dados/arquivos e regras002/003 preservados.
- [X] README/status/evidências sincronizados, limitações e qualquer checagem not-run explícitas; sem prova comercial inventada.

**Critério de Conclusão**: todos os gates acima aprovados; falha/nativo pendente impede declarar aceite completo. Site/proxy comercial fora do gate e requer autorização específica se solicitado.

**Registro da Fase**:
- Status: Concluída em2026-11-14; gates automatizados e T039 nativo aprovados.
- Feito: Três telas integradas, exports compatíveis, migração dos harnesses, revisão independente e correções RED→GREEN; README e roteiro atualizados.
- Contrato: node --test nos dois builds:17/17 contratos verdes dentro de112/112 testes; check-contract-tests.ps1 nas001/002/003/004:travas íntegras.
- Testes executados: npm.cmd ci (0vulnerabilidades); npm.cmd test:112/112; npm.cmd run build:prod; node --test:112/112. node tests/e2e/{localidades,lote,proxy,coleta-store,coleta}.smoke.cjs:8+14+6+5+7=40cenários em CADA build,0pageerrors. Restart real no mesmo perfil sem refetch1–3. git diff --check:exit0, apenas avisosLF/CRLF. preservation.json:11artefatos preservados.
- Validação nativa: node tests/e2e/coleta.native.cjs:exit0 na tentativaZV9730. Picker e confirmações humanos; Links4registros, recusa/substituição sem alteração de bytes; Lote1registro/17campos/mês202611 sem Downloads; Itens save-unknown observado após reabertura, confirmação humana e apenas1Download;0pageerrors. native-result.json e três hashes conferidos. Gestos trusted/active; evidências de reautorização002/003 preservadas conforme plano.
- Pendências: nenhuma do execute. Tentativas anteriores incompletas estão em validation/native-attempts.md; exports preservados. Sem prova comercial, sem commit. Próxima etapa sugerida:sdd-converge.

## Dependencies & Execution Order

Infraestrutura→US1→US2→US3→US4→US5→US6→US7→Polish. Stories têm valor verificável próprio, mas os módulos de coordenação compartilhados exigem essa sequência incremental. C1 deve permanecer verde ao adicionarC2/C3/C4/C5. Após US4 todos os5contratos são gate permanente.

Não alterar contratos/helper travados. Testes adicionais podem ser escritos antes da implementação de cada task. Cada fase atualiza estado/registro/backlog conforme skill; interromper em gate real com diagnóstico, nunca mascarar. Não inferir autorização contínua para implementação ou chamadas externas a partir do planejamento.

## Traceability

| Requisitos | Tasks |
| --- | --- |
| FR-001 | T007 |
| FR-002 | T005 |
| FR-003 | T005,T008 |
| FR-004,FR-005 | T006 |
| FR-006 | T007 |
| FR-007 | T010 |
| FR-008,FR-009,FR-010 | T011 |
| FR-011 | T010,T012 |
| FR-012 | T013 |
| FR-013 | T015 |
| FR-014 | T016 |
| FR-015 | T017 |
| FR-016 | T025,T027 |
| FR-017,FR-018 | T025,T026 |
| FR-019 | T029 |
| FR-020 | T030 |
| FR-021 | T019 |
| FR-022,FR-023,FR-024 | T020 |
| FR-025 | T023 |
| FR-026 | T019,T023 |
| FR-027 | T021,T022 |
| FR-028,FR-029 | T032 |
| FR-030,FR-031 | T033 |
| FR-032 | T034 |
| FR-033 | T036,T040 |
| SC-001 | T009,T038 |
| SC-002,SC-003,SC-004 | T014,T038 |
| SC-005 | T018,T037,T038 |
| SC-006,SC-007,SC-008 | T024,T037,T038,T039 |
| SC-009 | T028,T031 |
| SC-010,SC-011 | T035,T037 |
| SC-012 | T031,T038 |
| SC-013 | T042 |

## Implementation Strategy

MVP após infraestrutura+US1:controle compartilhado e UI durável. Próximas fases adicionam classificação, exclusividade reforçada e retomada, sem prometer feature004 entregue antes dos gates completos. Executar por fase, manter documentação e fazer review do diff antes do release. Não commitar sem pedido do usuário.

<!-- sdd-converge anexa fases de convergência sem reescrever tasks anteriores -->

## Phase 10: Convergence

**Origem**: sdd-converge em2026-11-14; achadosC-001/C-002/C-003, todosMEDIUM.
A fase anterior permanece como registro histórico da execução. Relatório completo:
`validation/convergence-findings.md`. Nenhum código alterado durante a auditoria.

- [X] T043 [C-001][MEDIUM] Completar o feedback de conflito entre modos: resposta START deve permitir identificar a sessão/modo responsável; o painel deve informar conflito e execução ativa em vez de Pronta para coletar. Origem:FR-013,SC-005,US3/AC1,contracts/coleta-runtime.md (UI). Validar no runtime/painel e em duas telas que o segundo início não navega, não reserva nem altera dados/contadores da sessão ativa.
- [X] T044 [C-002][MEDIUM] Completar diagnóstico consultável com duração, tentativas e contagem de novos anúncios, persistindo as métricas faltantes por evento/página e exibindo-as após selecionar/reabrir a sessão. Origem:FR-030/032,US7/AC3. Preservar sanitização/retencão; testar sucesso deduplicado e retry com relógio controlado, reconstrução e renderização real do painel.
- [X] T045 [C-003][MEDIUM] Registrar de forma durável e sanitizada falha observada de gravação do arquivo e apresentá-la ao reabrir a sessão, distinguindo coleta, persistência e gravação. Origem:FR-032,SC-011. Preservar checkpoint/intent e reconciliação segura; falha não autoriza recoleta, confirmação fictícia ou download automático. Validar erro/resultado de falha do writer, reconstrução e retry/reconciliação sem perda; executar os gates aplicáveis e atualizar o registro desta fase no sdd-execute.

**Critério de Conclusão**: três achados comprovadamente corrigidos com testes
adicionais não travados, contratos íntegros e gates aplicáveis aprovados. Manter
separadas evidências simuladas, browser, gesto nativo e site/provedor comercial.

**Registro da Fase**:
- Status: Concluída em2026-11-14; T043/T044/T045 aprovadas,58/58 checkboxes.
- Feito: Feedback de conflito identifica modo/horário; tentativas por URL, duração e novos anúncios persistem e aparecem no painel; falha de writer usa categoria sanitizada durável, preservando intent/checkpoint. RED→GREEN adicional em convergence-t043/044/045-red.log e convergence-targeted.log.
- Contrato: node --test nos dois builds:17/17 contratos dentro de117/117 testes; check-contract-tests.ps1 nas001/002/003/004:travas íntegras.
- Testes executados: npm.cmd test:117/117; npm.cmd run build:prod e node --test:117/117. Cinco smokes em dev/prod:8+14+6+5+8=41cenários/build,0pageerrors. Cinco regressões adicionais RED→GREEN, incluindo preservação sanitizada de NotAllowedError para reautorizar. E2E confere conflito sem mutação, métricas após reload, falha injetada em createWritable e retry sem recoleta. Revisão independente confirmou correção e barreira de sincronização do restart. Dois problemas de harness registrados/corrigidos: observação de exatamente3commits era transitória; retry de arquivo criado antes da falha exigia aceitar a confirmação OPFS. Sem timeout afrouxado nem falha classificada como flake. Logs brutos e detalhes em validation/convergence-execute-summary.md.11artefatos protegidos e três hashes nativos anteriores conferidos; handlers/writers nativos preservados. git diff --check:exit0.
- Pendências: Nenhuma do execute; repetir sdd-converge para reauditarC-001/C-002/C-003. Sem commit ou prova comercial.

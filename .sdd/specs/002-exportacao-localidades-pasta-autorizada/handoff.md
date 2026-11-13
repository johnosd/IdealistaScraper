# Handoff — 002-exportacao-localidades-pasta-autorizada

## Contexto

IdealistaScraper, branch `main`, Chrome MV3/JavaScript/Node/Webpack. Status:
**Planejada**. Próximo comando:
`$sdd-execute .sdd/specs/002-exportacao-localidades-pasta-autorizada`.
Preservar configurações locais não versionadas e exclusões concorrentes de legados.

## Entrega

- US1/P1: pasta autorizada, JSON `YYYYMM/links_localidades_YYYYMM.json`, sem Downloads.
- US2/P1: substituir somente após confirmação; recusa preserva bytes anteriores.
- US3/P2: recuperar pasta persistida e renovar autorização sem perder registros coletados.

## Leitura obrigatória

`spec.md` (aceite) → `plan.md` (decisões/testes) → `tasks.md` (14 tarefas/4 fases)
→ `research.md` (fontes/limites) → `data-model.md` (handle/estados)
→ `contracts/localidades-export.md` (interfaces) → `logic/escrita-mensal.md`
(algoritmo) → `quickstart.md` (gates) → `.planning/memory/constitution.md`.

## Contratos

002: `tests/contracts/002-exportacao-localidades-pasta-autorizada.test.cjs`, cinco
casos, fase 1; fixture `tests/fixtures/localidades-filesystem.cjs` também travada.
Comando: `node --test tests/contracts/002-exportacao-localidades-pasta-autorizada.test.cjs`.
Integridade: `.planning/scripts/powershell/check-contract-tests.ps1 -Slug 002-exportacao-localidades-pasta-autorizada`.
Preservar também a trava e os dois contratos da feature 001.

## Stubs

`src/localidades-export.js`: getMonthlyDestination/exportLocalities lançam
`not implemented`. Não está importado pela UI. Baseline: cinco vermelhos esperados,
dois contratos antigos verdes; suíte total intencionalmente vermelha até implementar.

## Armadilhas

- Página durável `localidades.html`; popup apenas abre/reutiliza.
- Picker/requestPermission diretamente no clique; handle pré-carregado em IndexedDB.
- Mês local inicial; não usar UTC. Base já é localidades, sem duplicar pastas.
- Confirmar antes de writable; aguardar close, abortar em falha e liberar Web Lock.
- Coleta em aba própria; fechar somente a criada. extractLinks deve ser autônomo.
- Playwright 1.65.0 será instalado na execução; scripts E2E ainda não existem.
- OPFS/picker simulado não comprovam autorização nativa ou escrita no disco externo.

## Pendências do Analyze

Nenhuma acionável. Constitution Check pré/pós: cinco princípios PASS.
Presença das APIs foi verificada no Chrome; autorização/escrita reais ainda não.

## Gate de pronto

Contratos 002 5/5 e 001 2/2, unitários, ambas as travas, npm ci, npm test,
build:prod e E2E opt-in nos dois builds. Lint/type-check inexistentes: não aplicáveis.
Gate obrigatório: seletor nativo Chrome, pasta temporária, bytes no disco,
recusa/aceite e reabertura. Sem essa prova, não declarar aceite completo.
Atualizar README, memória e backlog; não corrigir Itens/Lote/Proxy nesta feature.

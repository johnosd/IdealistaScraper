# Convergência final — 004-coleta-resiliente

2026-11-14. Resultado: **Convergida**,58/58itens. Nenhuma lacuna acionável.
Reauditoria após execução deT043/T044/T045. Sem alterações de código/testes/bundles,
contratos, tasks ou README; sem commit/merge.

## Convergence Findings

| ID | Tipo de Lacuna | Severidade | Origem | Evidência | Trabalho Restante |
| --- | --- | --- | --- | --- | --- |
| C-001 | Resolvida | — | FR-013;SC-005;US3/AC1 | coleta-background93–101 retorna activeSession; coleta-ui41 apresenta modo/horário; teste de duas telas preserva sessão ativa | Nenhum |
| C-002 | Resolvida | — | FR-030/032;US7/AC3 | coordinator104 registra attempt/durationMs/newRecords; UI46 exibe campos; reconstrução com retry/deduplicação testada | Nenhum |
| C-003 | Resolvida | — | FR-032;SC-011 | recordSaveFailure184–188 cerca intent/epoch/owner/allowlist; runner56–66 sanitiza e preserva nome DOM; UI mostra falha após reabertura | Nenhum |

## Confirmação de requisitos e invariantes

Os demais requisitos permanecem cobertos pelo mapeamento da primeira auditoria
em convergence-findings.md e pelas evidências da execução. A reauditoria
conferiu novamente as decisões invariantes e as áreas alteradas: nenhuma
mudança em limites, blockers, reserva one-shot, ownership, schema, writer,
intent/receipt ou regra de exportação foi introduzida para fechar os achados.
Diagnóstico persistido usa allowlist e não copia Error/mensagem bruta.
Não foram encontrados atalhos por valores de fixture ou ambiente de teste.

## Verificações desta passagem

- check-prerequisites.ps1 -Stage converge -Slug004:PASS.
- node --test tests/contracts/004-coleta-resiliente.test.cjs
  tests/unit/coleta-convergence.test.cjs:10/10,0falhas/skip/todo.
- check-contract-tests.ps1 para001/002/003/004:quatro travas íntegras.
-11artefatos protegidos conferidos contra planning-baseline.json.
- Três hashes de arquivos reais conferidos contra native-result.json;
  a prova nativa anterior registra1Download e0pageerrors.
- Logs da implementação corrigida:117/117 testes e41E2E por build, sem falhas
  omitidas; consolidation em convergence-gates.json. Builds/E2E não foram
  repetidos integralmente nesta passagem sem mudança produtiva.
- Revisão estreita independente e correção do nome DOM confirmadas no
  convergence-code-review.md. A barreira do teste de restart retém uma leitura
  real depois do terceiro commit; não fabrica progresso nem altera storage.
- tasks.md permanece SHA256
  c73b38afcee659a733e065c46b1061aa3a76b5f98fc1f7b3c097158bcdcbd484.
  convergence-final-preservation.json registra88arquivos preservados,
  incluindo código, testes, bundles, tasks, README e trava004.

## Sincronização documental

spec.md recebeu somente Status:Convergida. plan.md recebeu uma única seção
Resultado Final, mantendo o histórico, e marcadores Resolvido nas mitigações
confirmadas. Backlog atualizado para Convergida,58/58. README já descrevia
capacidades, retomada, limites e diagnóstico; ficou byte-idêntico.

Coleta no site atual e proxy comercial permanecem fora da prova obtida.
Resultados locais não são anunciados como eficácia contra bloqueios reais.

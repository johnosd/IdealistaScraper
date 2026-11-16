# Execução Phase10 — correções de convergência004

2026-11-14. Branch feature/004-coleta-resiliente. T043/T044/T045 concluídas;
45tasks +13gates =58/58. Sem commit, merge ou validação comercial.

## Correções

- C-001/T043: START recusado retorna activeSession mínimo com id/modo/horário.
  O painel informa a execução responsável. Testes de duas telas e Chromium
  verificam que o conflito não altera registros/counters nem navega.
- C-002/T044: eventos expõem tentativa por URL/item, duração e quantidade de
  novos registros deduplicados. Painel consultável após reconstrução/reload;
  campos ausentes em eventos antigos não recebem valores inventados.
- C-003/T045: writer que lança erro ou retorna falha registra categoria
  allowlisted via SAVE_FAILURE, cercada por sender/owner/epoch/intentId.
  Diagnóstico sobrevive à reabertura; intent/checkpoint continuam disponíveis.
  Reconciliação confirma sem regravar; sucesso limpa razão atual e mantém histórico.
  Error/mensagem bruta não entra no evento. Nomes DOM permitidos continuam
  disponíveis ao chamador para reautorização.

## Gates observados

| Comando/checagem | Resultado | Evidência |
| --- | --- | --- |
| npm.cmd test |117/117,0fail/skip/todo | convergence-test-development.log |
| npm.cmd run build:prod | PASS,último buildproduction | convergence-build-production.log |
| node --test emproduction |117/117,0fail/skip/todo | convergence-test-production.log |
| Cinco smokes emdev |8+14+6+5+8=41,0pageerrors | convergence-dev-final-*.log; coleta final em convergence-dev-checkpoint-barrier.log |
| Cinco smokes emprod |41,0pageerrors | convergence-prod-*.log |
| Quatro check-contract-tests.ps1 | Travas001/002/003/004 íntegras;17contratos verdes dentro da suíte | Saída verificada nesta execução |
| Preservação |11/11 hashes contra planning-baseline.json | preservation.json; conferência nesta execução |
| git diff --check | exit0,apenas avisosLF/CRLF | Saída verificada nesta execução |
| Revisão independente |1MEDIUM encontrado e corrigido; confirmação5/5 e sincronização do harness aprovadas | convergence-code-review.md |

Comandos E2E: node tests/e2e/localidades.smoke.cjs,
node tests/e2e/lote.smoke.cjs, node tests/e2e/proxy.smoke.cjs,
node tests/e2e/coleta-store.smoke.cjs e node tests/e2e/coleta.smoke.cjs.
convergence-gates.json agrega os resultados brutos, sem substituir os logs.

Cinco testes adicionais verificam conflito, métricas/retry/deduplicação,
erro/resultado de falha e categoria DOM. REDs preservados em
convergence-t043-red.log, convergence-t044-red.log, convergence-t045-red.log
e convergence-permission-red.log. Não houve edição de contrato travado.

## Iterações do navegador e limites da prova

A primeira leva registrou timeout ao observar exatamente o terceiro checkpoint,
sem snapshot suficiente para atribuir a causa daquele evento. Não se declarou
flake aceitável. A inspeção mostrou que o poll dependia de um estado transitório;
o harness passou a reter uma resposta READ real do runner após o terceiro commit,
antes da quarta reserva. LIST, READfull, IndexedDB, worker parado, prova do executor
vivo e restart no mesmo perfil continuam reais. Não há alteração de policy,
relógio, timers ou progresso. A sincronização foi revisada e aprovada, e os gates
dev/prod completos ficaram verdes. Logs anteriores foram preservados.

A reprodução isolada também expôs confirmação de substituição no retry: a
criação do arquivo precede createWritable, cuja falha foi injetada. O harness
passou a aceitar explicitamente o diálogo OPFS na tentativa autorizada de retry.
Não houve mudança de writer/regra de substituição nem timeout ampliado.

O E2E novo injeta QuotaExceededError na API FileSystem real do Chromium; testa
persistência do diagnóstico e retry sem rede após reload. Não comprova disco
fisicamente cheio. A prova nativa humana ZV9730 permanece separada em
native-result.json: seus três hashes foram reconferidos. Não houve novo roteiro
humano nesta Phase10 porque writers, picker, requestPermission e confirmações
existentes foram preservados. O novo catch mantém nomes DOM necessários a esse
fluxo. Site atual/proxy comercial não foram usados.

Próximo:sdd-converge para reauditar as três correções; não executar commit/merge
automaticamente. Sugestão de commit: fix: completar feedback e diagnosticos da coleta.

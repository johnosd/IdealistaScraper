# Convergence Findings — 004-coleta-resiliente

Data:2026-11-14. Resultado: **Convergência Pendente**,55/58 checkboxes.
Escopo: spec004, plano/decisões, tasks, contratos e constitution1.0.0.
Nenhum código-fonte, teste, contrato, bundle, README ou corpo do plano foi alterado.
Os55 checkboxes existentes foram preservados; Phase10/T043–T045 foi anexada.

## Achados acionáveis

| ID | Tipo de Lacuna | Severidade | Origem | Evidência | Trabalho Restante |
| --- | --- | --- | --- | --- | --- |
| C-001 | partial | MEDIUM | FR-013;SC-005;US3/AC1;contrato UI | src/coleta-background.js:93 retorna busy+id; src/coleta-runner.js:119 encaminha ao painel; src/coleta-ui.js:38 mostra Pronta para coletar, sem execução responsável | T043: feedback explícito de conflito e identificação da sessão/modo ativo; preservar exclusividade |
| C-002 | partial | MEDIUM | FR-030/032;US7/AC3 | src/coleta-coordinator.js:76/103 persiste attempt/durationMs; src/coleta-ui.js:43 só mostra hora/código/status/caminho; nenhum evento registra contagem de novos anúncios e o resumo não a mostra | T044: completar métricas persistidas e consultáveis após reconstrução |
| C-003 | partial | MEDIUM | FR-032;SC-011 | src/coleta-runner.js:55/56 chama writer sem persistir falha; erro vai ao estado transitório em114; src/coleta-ui.js:31 apresenta erro só na tela. Após falha, READ mantém reason:null e eventos sem falha de gravação | T045: registrar falha sanitizada, mantê-la consultável após reabertura e preservar intent/checkpoint/reconciliação |

Nenhum achadoCRITICAL/HIGH confirmado. C-001 afeta feedback de uma storyP1,
mas não bloqueia sua exclusividade: o segundo START continua sem autorização
de coleta. C-002/C-003 afetam a observabilidade exigida; não foi comprovada
perda dos registros ou liberação de coleta após bloqueio.

## Reprodução observada

Comandos Node inline, sem escrever testes ou dados no perfil do usuário. Foram
usados os módulos reais mountCollectionUI/createCollectionWorkflow e
installCollectionBackground, com MemoryCollectionStore e portas Chrome do
runtimeFixture existentes. O DOM mínimo usa a mesma estrutura do teste de UI.
Esses resultados são simulados; não representam uma falha física de disco.

1. Iniciar uma sessão pelo runtime e tentar outra pelo painel:
   primeiro START=started; segundo={status:busy,id:<id opaco da primeira>}.
   O painel fica data-state=busy, mas o texto visível é `Pronta para coletar. `.
2. Reservar/confirmar uma página com1registro e selecionar a sessão:
   eventos persistidos incluem request/attempt:1 e success/status:200/durationMs:5;
   a UI mostra hora/request/caminho e hora/success/HTTP200/caminho, sem duração,
   tentativas ou novos anúncios. Os5ms são o resultado desta reprodução,
   não um limite ou valor contratual. O checkpoint permanece disponível.
3. Preparar resultado completo e chamar workflow.save(true) com writer que
   lança `Sem espaco para gravar`: a Promise rejeita; READ completo retorna
   state:awaiting-save,reason:null,intentExists:true e somente os eventos
   started/request/success. A causa de gravação não é recuperada do storage.

## Mapeamento de intenção auditado

| Área | Evidência examinada | Resultado |
| --- | --- | --- |
| US1/FR-001–006 | coleta-policy; coordinator.requestPage/waitLimit; runner.drive; contratosC1; smokes Links/Lote/Itens | Limites finitos, reserva antes da rede, consumo persistente e intervalo/esperas preservados |
| US2/FR-007–012 | classification; page.inspectCollectionPage; reportPage; runner; contratoC2; E2E initial/intermediate403/429/challenge | Pausas obrigatórias, retry finito, dados parciais não finalizados; sem bypass |
| US3/FR-013–015 | protocolo, background.alive/stopExecutor, coordinator.recover/epoch, runtime/ownership e contratoC3 | Exclusividade/fences confirmados; feedback parcialC-001 |
| US4/FR-021–027 | store.transact/oncomplete; delta/hash/read/recovery; saveIntent/receipt/pendingProjection/ACK; contratosC4/C5 | Commit atômico, checkpoint anterior, mês original e projeção de fila preservados; diagnóstico de gravação parcialC-003 |
| US5/FR-016–018 | background.prepare/begin/snapshot/onChange; coleta-proxy; REQUEST/VALIDATE; proxy tests | Revisão opaca, snapshot/auth recuperáveis e guard de configuração; sem reconexão por contagem |
| US6/FR-019–020 | reserveIP, PROBE_IP/TEST_IP, coleta-ip; testes IP e100páginas | Marker persistido antes do probe, timeout e cancelamento separados; sem reaplicar proxy |
| US7/FR-028–032 | destinos same-origin, visited/routes/noNew, retenção/log allowlist e UI | Ciclos/limites/sanitização confirmados; métricas e erro de gravação parciaisC-002/C-003 |
| FR-033/ConstitutionI–V | manifest/packages/writers/stores, webpack, entradas, logs dev/prod e prova nativa | Preservação/empacotamento/provas separados; nenhum desvio de escopo adicional confirmado |

## Verificações desta auditoria

- check-prerequisites.ps1 -Stage converge -Slug004:PASS.
- node --test tests/contracts/004-coleta-resiliente.test.cjs:5/5,0fail/skip/todo.
- check-contract-tests.ps1 nas001/002/003/004:quatro travas íntegras.
- Inspeção dos módulos produtivos não encontrou condição NODE_ENV/fixture nem
  valores dos contratos usados como atalho para obter verde.
- native-result.json:pass:true,1Download,0pageerrors; três arquivos reais com
  SHA256 conferido. Aprovação nativa anterior permanece válida para seu roteiro.
-11artefatos protegidos conferidos contra planning-baseline.json.
- Logs anteriores de desenvolvimento e produção registram112/112 e40E2E/build.
  Não se repetiram todos os builds/E2E nesta auditoria sem alteração produtiva;
  contratos foram executados novamente conforme gate obrigatório da skill.
- convergence-preservation.json confirma que a fase foi apenas anexada e que
  78arquivos de fontes/testes/README/plano/trava ficaram byte-idênticos.

## Encaminhamento

ExecutarT043–T045 pelo sdd-execute e repetir sdd-converge. O status de spec/backlog
foi atualizado para Convergência Pendente. Não foi anexado Resultado Final nem
alterado README, pois a auditoria encontrou trabalho acionável. Sem commit/merge.
Site atual e proxy comercial continuam sem validação; eficácia contra bloqueios
não é inferida de fixtures, contratos ou escrita nativa local.

## Encaminhamento executado em2026-11-14

T043/T044/T045 foram implementadas e validadas pelo sdd-execute.117/117 testes
e41cenários E2E por build, revisão e quatro travas aprovados;58/58checkboxes.
Ver convergence-execute-summary.md. Os achados acima preservam o retrato da
auditoria anterior; sua reauditoria ainda cabe ao próximo sdd-converge.

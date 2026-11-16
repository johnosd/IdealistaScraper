# Execução004 — evidências

Registro histórico das fases1–9. Resultado atual após Phase10:
[convergence-execute-summary.md](convergence-execute-summary.md),117/117 testes
e41E2E por build,58/58checkboxes. Os resultados abaixo preservam a execução original.

Data:2026-11-14. Branch:feature/004-coleta-resiliente. Execute concluído,
42tasks e13gates aprovados. Não há commit, merge ou prova comercial.

| Gate | Resultado observado | Evidência |
| --- | --- | --- |
| npm.cmd ci | PASS;0vulnerabilidades | npm-ci.log |
| npm.cmd test | PASS112/112,0skip/0todo/0cancel | test-development.log |
| npm.cmd run build:prod | PASS | build-production.log |
| node --test no buildproduction | PASS112/112,0skip/0todo/0cancel | test-production.log |
| Travas001/002/003/004 | PASS17contratos íntegros | lock-001.log até lock-004.log |
| node tests/e2e/localidades.smoke.cjs | PASS8cenários em dev/prod | dev-localidades.log / prod-localidades.log |
| node tests/e2e/lote.smoke.cjs | PASS14cenários em dev/prod | dev-lote.log / prod-lote.log |
| node tests/e2e/proxy.smoke.cjs | PASS6cenários em dev/prod | dev-proxy.log / prod-proxy.log |
| node tests/e2e/coleta-store.smoke.cjs | PASS5cenários em dev/prod | dev-coleta-store.log / prod-coleta-store.log |
| node tests/e2e/coleta.smoke.cjs | PASS7cenários em dev/prod | dev-coleta.log / prod-coleta.log |
| Manifest/packages/writers/stores/legados | PASS11hashes preservados | preservation.json |
| git diff --check | exit0;avisosLF/CRLF | diff-check.log |
| Revisão independente |2Important corrigidos;0Critical | code-review.md |
| Native picker/confirmação/Downloads | PASS;exit0,1Download,0pageerrors; três hashes conferidos | coleta.native.cjs; native-result.json; native-attempts.md |

Cada build aprovou40cenários E2E e0pageerrors. O teste reinicia o processo real do
Chromium no mesmo perfil/path, sem limpeza/reinstalação, preserva três checkpoints
e retoma somente a página4. As quatro URLs foram registradas uma vez, com ritmo
real válido. Headers/status iniciais e intermediários provêm de fixtures HTTP no
Chrome;429/403/challenge persistem após worker encerrado. Um erro QuotaExceeded
é injetado sobre a transação IndexedDB real: prova atomicidade/fail closed, não
quota física/comportamento de um provedor comercial.

## Iterações e limites

Contratos travados não foram editados/regravados durante execute. O baseline do
plan já incluía alterações de001/proxy. Correções de integração permanecem dentro
da004, com testes adicionais sem afrouxar contratos: one-shot/reentrância,
requestId HTTP separado, pausa de close, projeção de fila, domínio liberado em
pausa, readonly Web Lock003, descarte de owner encerrado e teto de metadados.

Não se classificou falha em suíte como flake aceitável. A regressão de reativação
após o guard readonly foi preservada em dev-lote-authority-followup-red.log e
corrigida antes de reexecutar o gate inteiro, verde em dev/prod.

A primeira tentativa nativa em AppData/Temp foi recusada como diretório sensível
pelo seletor do Chrome (relato do usuário); nenhum arquivo foi escrito. O helper
foi realocado para pasta nova do projeto, sem alterar fontes/bundle. Essa tentativa
não conta como PASS nativo. OPFS/simuladores não substituem o gate interativo.

A tentativa finalZV9730 aprovou o roteiro completo: Links com4registros,
recusa/substituição verificadas; Lote com1registro/17campos no mês202611;
Itens reaberto, gravação desconhecida observada antes da confirmação humana e
nenhum segundo Download. Três arquivos reais e seus hashes foram conferidos
contra native-result.json; gestos trusted/active e0pageerrors. Exports preservados
em .data/validacao-nativa-004/idealista-coleta-native-ZV9730. Reautorização002/003
reutiliza evidências nativas anteriores dos handlers preservados, conforme plano.
Uma tentativa intermediária confirmou diretamente sem verificar save-unknown;
isso foi registrado como incompleto e o banner dividido em duas etapas antes
da repetição aprovada. Não houve alteração produtiva após os gates dev/prod.

# Evidências automatizadas — 003

Execução em 2026-11-13, Windows/Node22.16.0, Chromium158.0.8127.18.
Nenhum site público/proxy real foi usado nestes testes. Perfis temporários
isolados, removidos ao encerrar; arquivos de teste no OPFS desses perfis.

| Comando | Resultado |
| --- | --- |
| npm.cmd test | Build desenvolvimento + 48/48 testes, zero falhas/skips |
| npm.cmd run build:prod | Sete bundles minificados gerados, sem alterações manuais |
| node --test tests/contracts/001-reorganizacao-node-webpack.test.cjs (após produção) | 2/2 verdes; referências/CSP/permissões preservadas |
| node tests/e2e/localidades.smoke.cjs (build produção) | Oito grupos de cenários; zero Downloads/pageerrors |
| node tests/e2e/lote.smoke.cjs (build produção) | Onze grupos; zero Downloads do lote, um esperado de Itens, zero pageerrors |
| check-contract-tests.ps1 -Slug 001-reorganizacao-node-webpack | Trava íntegra, dois casos |
| check-contract-tests.ps1 -Slug 002-exportacao-localidades-pasta-autorizada | Trava íntegra, cinco casos + fixture |
| check-contract-tests.ps1 -Slug 003-exportacao-lote-municipios | Trava íntegra, cinco casos + fixture |
| git diff --check | Sem erros de whitespace |

Os comandos npm.cmd run test:e2e:lote também passaram durante as fases sobre
build desenvolvimento. Para manter o bundle final de produção, os dois scripts
E2E foram executados diretamente após build:prod. Contratos não foram alterados.

## Cobertura relevante

- C1–C3: destino local mensal, normalização segura, snapshot, substituição integral,
  preservação em acesso negado/vazio/write/close e exclusão de escrita concorrente.
- C4–C5: fila só consumida após save/commit, retry sem recoleta e mês fixo,
  reentrada ocupada e commit falho com recibo preservado.
- E2E: popup abre página durável; abas próprias/CTA; duas páginas; escrita real
  em OPFS; seletor cancelado, handle IDB separado e persistência falha; prompt e
  autorização por gesto; falhas write/close/commit; troca de base após commit
  falho conserva identificação do destino já gravado; overwrite menor sem cauda.
- E2E: erro HTTP503, transporte, HTML inesperado e página seguinte vazia impedem
  gravação parcial; arquivo anterior e fila preservados. Sem reinjeção/recoleta
  automática de falhas funcionais. Repetir coleta após erro é ação do usuário.
- E2E: pausa/retomada e virada de mês, campos originais da fila preservados,
  segunda tela somente leitura, foco e close aguardado.
- Extrator real: fotos atuais/legadas/ausentes/malformadas e garagem atual/legada/
  ausente, preservando 17 chaves. E2E verifica DOM e HTML parseado e fluxo Itens.

## Limites e gate restante

Picker, permissão, relógio e falhas de colaboradores são simulados. E2E usa
APIs Chrome, crawler, writer, Web Locks e IDB reais; não prova seleção da pasta
externa/reautorização nativas do usuário. T021 e checklist manual permanecem
abertos até essa validação. Coleta pública e proxy real são evidências distintas.

Inspeção real anterior de Alvor e campos não coletados: listing-audit.md. Não
houve tentativa de contornar403 nem coleta real nova nesta implementação.
Dados existentes preservados; catálogo local mantém SHA256
57349C6A31FD606DE474FF27F8E37B4587986BBF994EB0B7DB8F6E8D2758C7A0,
igual ao snapshot de entrada registrado no planejamento. Nenhum commit/push.

Primeiras iterações do harness corrigiram binding de StorageArea e Date falso
incompatível com structuredClone. Jornadas finais passaram completas; nenhuma
falha classificada como flake aberto.

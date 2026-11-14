# Correção da fase5 — carregamento automático

Achados C001/HIGH e C002/MEDIUM da convergência003 tratados em T024/T025.

src/lote.js voltou a selecionar todos os li de
`.breadcrumb-dropdown-element.highlighted ul.breadcrumb-dropdown-subitem-list > li`
e a ler contagem de `.breadcrumb-navigation-sidenote`. Mantidos origem validada
por sourceTabId, URLs absolutas, nome UTF-8, ordenação decrescente e persistência.
Não foram alterados writer/session/store/collector, permissões ou credenciais.

## Regressão executável

tests/e2e/lote.smoke.cjs abre página de origem com breadcrumb anterior contendo
dois itens, contagens17 e1.234 e um span irrelevante anterior à contagem. Um
breadcrumb fora do contêiner highlighted serve de distração e deve ser ignorado.
O popup recebe a aba web de origem como no popup de ação, abre lote.html, e o
teste aciona o botão real com a tela de extensão ativa. A função injetada e a
persistência Chrome são as do produto, sem mock da unidade testada.

- Antes de T024: regressão RED — campo da lista vazio, esperado dois itens.
- Depois: dois itens ordenados por quantidade1234 e17, nome São João preservado,
  URLs corretas, array no texto e em chrome.storage.local semanticamente iguais.
- Origem sem itens e exceção simulada de scripting preservam texto e fila.
- Foi corrigida a asserção do teste novo para não exigir ordem das chaves do JSON
  após o transporte da API Chrome; a ordem dos itens e seus valores é verificada.
  O texto já carregado deve permanecer byte a byte em vazio/erro.

## Gates finais

| Comando | Resultado |
| --- | --- |
| node --test tests/contracts/003-exportacao-lote-municipios.test.cjs | 5/5 verdes antes e depois; nenhum contrato novo na fase |
| npm.cmd test | Build desenvolvimento aprovado,51/51 testes verdes |
| npm.cmd run build:prod | Build produção aprovado |
| node tests/e2e/lote.smoke.cjs (produção) | 14 grupos verdes, zero Downloads do lote, um esperado em Itens, zero pageerrors |
| node tests/e2e/localidades.smoke.cjs (produção) | Oito grupos verdes, zero Downloads/pageerrors |
| check-contract-tests.ps1 para slugs001/002/003 | Três travas íntegras, sem regravação |
| git diff --check | Sem erro de whitespace |

dist final permanece em produção. Nenhum teste desta fase chamou site público.
Aceite nativo anterior em validation/manual-chrome.md preservado; sem solicitar
nova validação de pasta, pois esse comportamento não mudou. Sem commit/push.
Próximo estágio: sdd-converge para reavaliar C001/C002.

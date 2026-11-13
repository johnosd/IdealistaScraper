# Implementation Plan: Exportação de localidades em pasta autorizada

**Slug**: `002-exportacao-localidades-pasta-autorizada` | **Date**: 2026-11-13
**Spec**: `.sdd/specs/002-exportacao-localidades-pasta-autorizada/spec.md`

## Summary

O botão Extrair Links passa a abrir/reutilizar `localidades.html`, página da
extensão que permanece aberta durante seleção de pasta e coleta. Essa página
autoriza a pasta, preserva os registros em memória, coleta os mesmos links e
grava o JSON mensal com confirmação antes de substituir. Sem Node auxiliar,
download de reserva ou mudanças funcionais em Itens/Lote/Proxy.

## Technical Context

- **Language/Version**: JavaScript CommonJS, Chrome MV3; Node >=22.16.0 no desenvolvimento.
- **Primary Dependencies**: Webpack 5.112.2 e webpack-cli 7.3.1 existentes; APIs
  File System Access, IndexedDB e Web Locks nativas, sem dependências de runtime.
- **Storage**: novo banco IndexedDB `idealista-localidades` v1; não alterar o
  chrome.storage existente. Registros da extração ficam na memória da página.
- **Testing**: node:test já usado; adicionar Playwright 1.65.0 como devDependency
  exata para E2E reproduzível separado. Versão/engine consultadas no registry:
  Playwright requer Node >=20, compatível com o mínimo do projeto.
- **Target Platform**: Chrome desktop, Windows do usuário; fallback de capacidade
  é mensagem clara, sem gravar automaticamente em Downloads.
- **Performance Goals**: uma extração e uma escrita por página; sem paralelismo
  de escrita na origem. Timeout de navegação e de DOM: 30 segundos cada.
- **Constraints**: pasta escolhida pelo usuário; não presumir caminho absoluto,
  permissão permanente ou validade de handles ao reabrir.
- **Scale/Scope**: um JSON por mês, formato existente sem envelope/merge.

## Decisões Invariantes

1. Manter a plataforma e estrutura aprovadas: HTML na raiz, JS em src/, bundles
   dist/ e testes tests/. Sexta entrada Webpack: `localidades`.
2. `src/popup.js` somente abre/reutiliza a página normal de exportação. Retirar
   o download/extração do handler de Links, sem alterar handlers de Itens/Lote/Proxy.
3. `src/linkExtractor.js` exporta `{extractLinks}` por CommonJS. Reutilizar sua
   função autônoma via scripting.executeScript; não reproduzir o extrator em
   outro módulo nem capturar imports dentro de uma função injetada.
4. O coletor cria uma aba própria inativa no URL de localidades atual. Fecha
   somente essa aba em finally, inclusive em erro; não altera abas do usuário.
5. Seleção e reautorização são botões da página durável. Chamar APIs de prompt
   imediatamente no clique; carregar o handle antes, nunca buscar IndexedDB
   ou esperar trava antes de requestPermission/showDirectoryPicker.
6. Persistir somente o DirectoryHandle em IndexedDB por structured clone.
   Nenhuma nova permissão de manifesto, web_accessible_resource ou servidor.
7. Writer implementa exclusivamente a interface/stub e algoritmo documentados
   em contracts/localidades-export.md e logic/escrita-mensal.md.
8. Data local capturada no início da extração. Se houver nova autorização após
   coleta, salvar o mesmo snapshot e mês, sem forçar coleta duplicada.
9. Web Lock global da origem `idealista-localidades:write`, exclusiva e
   ifAvailable=true: ocupado é resultado visível, não uma escrita enfileirada.
10. Preservar os contratos da feature 001 e o storage existente. Os stubs da 002
    ainda não são importados por nenhuma entrada ativa da extensão no planejamento.

## Constitution Check

| Princípio | Pré-Design | Pós-Design | Notas |
| --- | --- | --- | --- |
| I. Escopo explícito | PASS | PASS | Apenas Links; demais bugs/fluxos fora da feature |
| II. Fontes e saídas separadas | PASS | PASS | HTML raiz, sexta entrada, testes e lockfile |
| III. Compatibilidade | PASS | PASS | APIs verificadas no Chrome; nenhuma permissão nova |
| IV. Preservação | PASS | PASS | Consentimento, confirmação, escrita staged e dados externos intactos |
| V. Qualidade com evidências | PASS | PASS | Contratos, integração, E2E simulado e gate nativo separados |

## Project Structure

### Estrutura existente inspecionada

```text
manifest.json   popup.html   webpack.config.js   package.json   package-lock.json
src/background.js   src/content.js   src/linkExtractor.js
src/popup.js   src/popup-ui.js
tests/contracts/001-reorganizacao-node-webpack.test.cjs
.planning/memory/constitution.md   .planning/backlog.md
.sdd/specs/001-reorganizacao-node-webpack/
.data/localidades/ (destino do usuario; nao manipular durante testes automatizados)
```

### Arquivos da feature

```text
localidades.html                       # novo HTML da página durável
src/localidades.js                     # novo controlador e UI
src/localidades-export.js              # stub existente do writer
src/localidades-directory-store.js     # novo IndexedDB
src/localidades-collector.js           # novo coletor/navegação
src/linkExtractor.js                   # export CommonJS, seletores preservados
src/popup.js                           # somente ação Links
webpack.config.js                      # nova entrada localidades
tests/contracts/002-exportacao-localidades-pasta-autorizada.test.cjs
tests/fixtures/localidades-filesystem.cjs
tests/unit/localidades-export.test.cjs
tests/fixtures/localidades-list.html
tests/e2e/localidades.smoke.cjs
```

**Structure Decision**: módulos pequenos por responsabilidade, sem modificar
background/content nem o manifesto. Contratos e fake do filesystem já existem;
os demais arquivos são tarefas da execução. Nenhum arquivo de dados será criado
pelo planejamento; exemplos usam diretórios/perfis de teste.

## Complexity Tracking

Sem violação da constitution. Página durável é necessária porque o popup é
descartável e o seletor exige foco/gesto. IndexedDB persiste referência opaca;
Web Locks coordena páginas. Não introduzir framework, background de escrita,
helper nativo ou backend para substituir essas responsabilidades.

## Estratégia de Testes

### Baseline e contratos

Contrato 002: cinco casos em
`tests/contracts/002-exportacao-localidades-pasta-autorizada.test.cjs`, mais fixture
`tests/fixtures/localidades-filesystem.cjs` travada (zero casos adicionais).
Stub: `src/localidades-export.js`, ainda sem ligação com a UI.

Comando: `node --test tests/contracts/002-exportacao-localidades-pasta-autorizada.test.cjs`.

| Teste | Origem | Fase | Vermelho esperado/confirmado |
| --- | --- | --- | --- |
| grava JSON UTF-8 no mes local capturado sem duplicar a pasta base | US1, FR-003/004/005/009 | 1 | not implemented |
| recusar substituicao preserva os bytes e todos os arquivos existentes | US2, FR-006/007 | 2 | not implemented |
| substituicao confirmada elimina residuos e preserva outros meses | US2, FR-005/006/009 | 2 | not implemented |
| sem dados ou permissao nao grava e erros de escrita preservam o anterior | FR-008/010/011, Constitution IV/V | 2 | not implemented |
| gravacao concorrente retorna ocupado e libera a trava apos cancelamento | FR-013 | 2 | not implemented |

Resultado basal: 0/5, todos por `not implemented`; nenhum erro de importação ou
sintaxe. Contratos da feature 001: 2/2 verdes. Não há outras suítes ativas da área.
Após o planejamento, `npm test` ficará vermelho por esses stubs até implementá-los;
isso é intencional e não deve ser escondido com skip, exclusões ou ajustes de teste.

### Gates da execução

```powershell
npm.cmd ci
node --test tests/contracts/002-exportacao-localidades-pasta-autorizada.test.cjs
node --test tests/contracts/001-reorganizacao-node-webpack.test.cjs
npm.cmd test
npm.cmd run build:prod
node --test
./.planning/scripts/powershell/check-contract-tests.ps1 -Slug 002-exportacao-localidades-pasta-autorizada
./.planning/scripts/powershell/check-contract-tests.ps1 -Slug 001-reorganizacao-node-webpack
```

Os comandos npm/test/build existentes continuam válidos. Lint e type-check não
existem; não adicionar gates fictícios nesta feature JavaScript.

### Integração/E2E e aceite nativo

Na execução, acrescentar scripts `test:e2e:install=playwright install chromium`
e `test:e2e=npm run build && node tests/e2e/localidades.smoke.cjs`.
O script smoke usa assert nativo e Playwright, sem outro test runner; nome
`.smoke.cjs` mantém o E2E opt-in, fora da descoberta dos testes unitários.

Perfil temporário, extensão MV3 real em Chromium, rotas locais para o site e
recursos externos. O seletor simulado retorna DirectoryHandle nativo de OPFS,
permitindo testar IndexedDB real sem autorizar o disco do usuário. A simulação
verifica userActivation no instante da chamada. Não usar branch de teste em
produção, não substituir o writer e não chamar isso de autorização nativa.

E2E deve cobrir fechamento do popup antes de exportar, nova página, primeira
gravação, recusa/aceite, reabertura com handle, reautorização simulada, duas abas,
erro de coleta e zero eventos de download. Confirmar CSP e funções injetadas
no build de produção também. Regressão: quatro abas antigas continuam acessíveis.

**Gate real obrigatório**: selecionar pasta temporária via diálogo nativo do
Chrome e conferir o arquivo no disco, recusa/aceite e reabertura. Pode usar
coleta servida por fixture local: essa prova é de permissão/escrita, não de site
real. Sem essa evidência, manter aceite nativo pendente, mesmo com E2E verde.
Roteiro em quickstart.md. Não sobrescrever dados atuais em .data durante testes.

## Estado Atual

| Área | Estado |
| --- | --- |
| Fase 1 — writer | Concluída; T001/T002, cinco contratos e oito unitários verdes |
| Regressão/build | 001 2/2, suíte 20/20 nos dois builds; npm ci e travas aprovados |
| UI/coleta/persistência | Implementadas e verificadas; E2E development/production PASS com oito cenários |
| Aceite nativo | Usuário respondeu “validado” ao roteiro manual do Chrome; sem nova inspeção do disco pelo agente |
| Execução | Quatro fases concluídas em modo contínuo; pronta para sdd-converge |

## Riscos e Decisões

| ID | Risco/Decisão | Impacto | Mitigação/Encaminhamento |
| --- | --- | --- | --- |
| R-001 | Prompt após operação assíncrona perde gesto | SecurityError e pasta não autorizada | Resolvido: Botões diretos com handle pré-carregado; E2E de ativação e aceite nativo |
| R-002 | Handle persiste, permissão não | Escrita falha após reabrir | Resolvido: Query sem prompt; Reautorizar e manter registros em memória |
| R-003 | Popup perde foco e é destruído | Exportação interrompida | Resolvido: Página durável, popup só abre/reutiliza |
| R-004 | Escrita truncada ou confirmação tardia | Perda do retrato anterior | Resolvido: Confirmar antes de createWritable, staged write/close e abort em falha |
| R-005 | Abas concorrentes | Substituição silenciosa | Resolvido: Web Lock ifAvailable; sem promessa de coordenação com programas externos |
| R-006 | Função injetada captura módulo após minificação | Extração quebra em produção | Resolvido: extractLinks autônomo e E2E nos dois builds |
| R-007 | E2E simulado confundido com gravação autorizada real | Aceite inflado | Resolvido: Gate nativo separado, evidência de pasta temporária e bytes no disco |
| R-008 | Checkout contém mudanças concorrentes/legados removidos | Perda de trabalho local | Resolvido: Não restaurar, limpar dados, regravar contratos 001 ou alterar o backlog fora deste escopo |
| R-009 | Navegação do harness por Page.goto deixa espera Chrome pendente | Falso negativo no E2E production | Resolvido: anexar aba em branco e navegar por tabs.update; oito cenários passam nos dois builds sem alterar o coletor real |

## Execution Notes

| Data | Fase/Story | Resumo | Pendência Principal |
| --- | --- | --- | --- |
| 2026-11-13 | Fase 1 / US1-US2 | Writer implementado após RED 0/5; contratos 5/5, unitários 8/8, regressão 2/2 e builds aprovados; travas íntegras | Integrar jornada durável na fase 2; gate nativo posterior |
| 2026-11-13 | Fase 2 em andamento | Página/store/coletor/popup implementados; npm test 20/20; E2E development PASS com oito cenários e zero downloads; revisão corrigiu foco entre janelas | E2E production aguarda coleta; native picker não testado; Computer Use encerrado por não confirmar URL |
| 2026-11-13 | Fase 2 concluída | Corrida de navegação do harness corrigida com tabs.update após anexar target; ambos os builds passam E2E; fontes de Itens/Lote/Proxy preservadas | Recuperação/aceite final |
| 2026-11-13 | Fase 3 concluída | Reabertura, prompt/denied, gesto, dados pendentes, persistência falha e concorrência cobertos nos dois builds | Documentar prova manual |
| 2026-11-13 | Fase 4 concluída | npm ci, 20/20 nos dois builds, travas e E2E PASS; README/memória atualizados; usuário validou roteiro Chrome | sdd-converge; sem commit/publicação |

**PRÓXIMO**: sdd-converge para auditoria final contra spec/plano/tasks. Não criar
commit/publicar automaticamente. Evidências em validation/automated.md e manual-chrome.md.

## Arquivos Principais

- `src/localidades-export.js`: destino mensal e writer protegido ligado à página.
- `tests/unit/localidades-export.test.cjs`: oito casos adicionais de validação/falhas/snapshot.
- `tests/contracts/002-exportacao-localidades-pasta-autorizada.test.cjs`: cinco casos travados, preservados.
- `src/localidades.js`, `src/localidades-directory-store.js`, `src/localidades-collector.js`,
  `localidades.html`: jornada integrada com recuperação de acesso e dados pendentes.
- `tests/e2e/localidades.smoke.cjs`: harness OPFS e rotas locais, aprovado nos dois builds.

## Cuidados para Retomada

- Fase 1 validada somente com filesystem/locks em memória; não equivale a seletor
  nativo ou OPFS. R-004/R-005 mitigados no nível unitário; manter os gates de navegador/disco.
- Último build gerado é production. Recarregar a extensão após mudar bundles.
- Revalidar as duas travas ao retomar; não regravar hashes ou alterar contratos.
- Primeiro ensaio E2E escapou da interceptação na navegação inicial da aba criada
  pela extensão; corrigido no harness com domínio bloqueado no DNS e abertura em
  branco/anexação antes da navegação roteada. Development passou depois desse ajuste.
- Chrome 157 isolado foi aberto para gate nativo, sem seleção/autorização de pasta.
  Computer Use interrompeu ao não conseguir confirmar a URL. Depois o usuário
  executou o roteiro manual e respondeu “validado”; essa é a origem do aceite nativo.

## Resultado Final

Convergida em 2026-11-13, sem achados acionáveis. FR-001–FR-014,
SC-001–SC-006, três user stories e dez decisões invariantes conferidos contra
o código e as evidências, sob os cinco princípios da constitution.

Entregue página durável de exportação, pasta escolhida/reautorizada por gesto,
handle em IndexedDB próprio, coleta em aba própria e JSON no mês local inicial.
Writer valida/serializa antes de IO, confirma substituição antes de abrir stream,
aguarda close, aborta em falha e usa Web Lock exclusiva sem fila. Recusa, vazio,
erro e acesso pendente não produzem download alternativo ou sucesso falso.
Dados coletados podem ser salvos após recuperar acesso sem repetir a coleta.

Revalidação nesta convergência: `npm.cmd test` (build development e 20/20),
`node tests/e2e/localidades.smoke.cjs` (oito cenários PASS),
`npm.cmd run build:prod`, `node --test` (20/20) e E2E production (oito cenários
PASS). Zero downloads/pageerrors; travas 001/002 íntegras. Chromium 158.0.8127.18.
Fontes background/content/popup-ui e trecho Itens/Lote/Proxy comparados ao backup,
preservando somente os caminhos de bundle já previstos na migração 001.
Sem atalhos para valores dos testes ou branches de ambiente no writer/coletor.

Os ajustes acumulados foram o foco da janela ao reutilizar a página e a navegação
de fixture no harness por tabs.update após anexar a aba em branco. Preservam
a arquitetura aprovada; nenhuma dependência de runtime/permissão foi acrescentada.
O bloqueio anterior do E2E production foi resolvido durante a execução; notas
históricas sobre sua investigação não representam pendência atual.

Aceite nativo apoiado na resposta “validado” do usuário ao roteiro manual Chrome,
conforme validation/manual-chrome.md. O agente não inspecionou os bytes no disco
ou o diálogo autorizado do usuário. E2E usa fixture/OPFS e não comprova coleta
atual no site nem proxy real. Esses limites permanecem explícitos.

README conferido, sem necessidade de alteração: já descreve destino mensal,
confirmação, recuperação, comandos e distinção entre teste simulado e manual.
tasks.md mantido byte-idêntico (SHA256
11D1AE7988ABE6DBDCF6DF04E5A8DD395E6A5142DB4403D7B7C5F1A024E127FE).
Nenhum código-fonte editado nesta convergência; nenhum commit/publicação realizado.

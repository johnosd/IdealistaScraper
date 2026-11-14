# Implementation Plan: Exportação mensal do lote em pasta de municípios

**Slug**: `003-exportacao-lote-municipios` | **Date**: 2026-11-13 | **Spec**: `.sdd/specs/003-exportacao-lote-municipios/spec.md`

## Summary

Mover o controle do lote do popup para página de extensão durável, com seleção
de base municipios independente de localidades. Writer mensal substitui sem
confirmação; sessão só consome fila após close e persistência do consumo, mantendo
resultado pendente para retry. Corrigir fotos/garagem comprovadamente perdidas e
documentar também informações ainda sem campo próprio; manter as 17 chaves.

## Technical Context

**Language/Version**: JavaScript CommonJS; Node >=22.16.0 (ambiente 22.16.0).
**Primary Dependencies**: Webpack 5.112.2, webpack-cli 7.3.1; Chrome tabs/scripting,
runtime/storage; File System Access, IndexedDB e Web Locks nativos. Sem novas libs.
**Storage**: handle IndexedDB separado; fila/status chrome.storage.local; resultado
pendente apenas em memória da página lote.html. Arquivos JSON UTF-8 na base autorizada.
**Testing**: node:test; Playwright 1.65.0 com extensão MV3 em perfil temporário,
fixtures sem rede e OPFS para arquivos; seletor/permissão simulados no E2E.
**Target Platform**: Chrome desktop MV3, Windows como ambiente do usuário.
**Performance Goals**: uma coleta/escrita por vez; não recoletar para retry de
gravação. Sem meta artificial de throughput ou ampliação de paralelismo.
**Constraints**: CSP sem inline/eval em produto; nenhuma nova permissão. Node
somente build/test. Sem Downloads de reserva ou backend. Sem suporte prometido
após fechar página dona. Fila inválida não modifica dados existentes.
**Scale/Scope**: um lote por origem da extensão; um arquivo por item. Sem limite
novo de municípios; registros de um item em memória como crawler atual.

Exploração: lote hoje dentro de src/popup.js navega aba ativa, marca sucesso e
retira item mesmo se download falha. Feature002 já tem página durável, writer,
handle IDB e fakes reutilizáveis; manter sua confirmação e destino intactos.
Nenhuma ADR encontrada em .sdd/adr. Nenhuma incerteza de biblioteca exige research.md.

## Decisões Invariantes

- D-001: lote.html na raiz, entry src/lote.js, bundle dist/lote.bundle.js gerado.
  Aba Lote do popup vira launcher; não duplicar dois orquestradores.
- D-002: destino recomendado .data/municipios, IDB idealista-municipios isolado;
  picker não garante caminho absoluto pelo nome e não pode escolher pelo usuário.
- D-003: YYYYMM local capturado uma vez; nome NFC seguro + -PaginasN.json;
  colisões sobrescrevem automaticamente. Não apagar variantes/arquivos antigos.
- D-004: writer sem UI, snapshot antes de await, lock exclusivo ifAvailable,
  sem truncamento antecipado, saved apenas após close. Erros preservam original.
- D-005: estado pendente não avança fila; retry usa dados e data capturados;
  falha de commit após escrita tenta apenas commit. Sem retry infinito.
- D-006: lock batch mantém dono enquanto pausado/pendente; segunda tela não
  altera storage. Coleta usa aba própria e resolve CTA existente, sem navegar UI.
- D-007: fotos e estacionamento corrigidos no extrator compartilhado, com
  formatos antigo/atual/ausente e regressão Itens/Lote. Não adicionar chaves.
- D-008: inventário cobre campos ausentes também; candidatos novos e dados
  exclusivos de detalhe ficam documentados para decisão posterior (FR-019).
- D-009: preservar proxy/configuração/credenciais e parser de entrada existente;
  não ampliar escopo aos demais bugs. Reportar limites do crawler legado.

## Constitution Check

| Princípio | Pré-Design | Pós-Design | Notas |
| --- | --- | --- | --- |
| I. Escopo explícito | PASS | PASS | FR-019/020 esclarecem revisão; novos campos só inventariados |
| II. Fontes e saídas separadas | PASS | PASS | src/tests/dist e HTML raiz, nenhuma dependência nova |
| III. Compatibilidade | PASS | PASS | MV3/CSP, APIs nativas, mesmas permissões |
| IV. Preservação | PASS | PASS | Dados anteriores, fila pendente e configurações preservados |
| V. Qualidade com evidências | PASS | PASS | Contratos, regressão, builds, E2E e gate Chrome separados |

## Project Structure

### Documentation (this feature)

```text
.sdd/specs/003-exportacao-lote-municipios/
  spec.md, listing-audit.md, plan.md, tasks.md, handoff.md
  data-model.md, quickstart.md, contract-tests.lock
  contracts/lote.md
  logic/lote.md
```

### Source Code (repository root)

```text
manifest.json, popup.html, localidades.html, webpack.config.js, package.json
src/
  background.js, content.js, popup.js, popup-ui.js, linkExtractor.js
  localidades.js, localidades-export.js, localidades-directory-store.js
  localidades-collector.js, lote-input.js, lote-navigation.js
  lote-export.js, lote-session.js                 # stubs criados no plan
tests/
  contracts/001-reorganizacao-node-webpack.test.cjs
  contracts/002-exportacao-localidades-pasta-autorizada.test.cjs
  contracts/003-exportacao-lote-municipios.test.cjs # criado no plan
  fixtures/localidades-filesystem.cjs, localidades-list.html
  unit/localidades-*.test.cjs, lote-*.test.cjs
  e2e/localidades.smoke.cjs, lote.smoke.cjs
dist/                                          # gerado, não editar
```

**Structure Decision**: preservar estrutura real; executar criará lote.html,
src/lote.js, src/lote-collector.js, src/lote-directory-store.js; testes novos
tests/unit/lote-export.test.cjs, lote-session.test.cjs, lote-collector.test.cjs,
listing-fields.test.cjs. HTML referencia apenas bundle externo gerado.

## Complexity Tracking

Sem violações a justificar. Página e dois locks isolam vida útil da UI e escrita;
não introduzem serviço/backend nem alteram a arquitetura da extensão.

## Estratégia de Testes

Prioridade: unitário → contrato/integração → E2E → manual para picker real.
Comandos-base (na raiz):

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run build:prod
npm.cmd run test:e2e
npm.cmd run test:e2e:lote
node --test tests/contracts/003-exportacao-lote-municipios.test.cjs
.\.planning\scripts\powershell\check-contract-tests.ps1 -Slug 003-exportacao-lote-municipios
.\.planning\scripts\powershell\check-contract-tests.ps1 -Slug 001-reorganizacao-node-webpack
.\.planning\scripts\powershell\check-contract-tests.ps1 -Slug 002-exportacao-localidades-pasta-autorizada
```

Sem lint/tsc configurados. npm test completo ficará vermelho no planejamento;
stubs não importados pelo app. Baseline confirmada: build dev e 31/31 testes
anteriores verdes via `node --test tests/unit/*.test.cjs tests/contracts/001-reorganizacao-node-webpack.test.cjs tests/contracts/002-exportacao-localidades-pasta-autorizada.test.cjs`.

### Testes de Contrato

5 de 5, sem skip/only/todo. Travados: tests/contracts/003-exportacao-lote-municipios.test.cjs
e fixture reutilizada tests/fixtures/localidades-filesystem.cjs (zero casos).
Comando: `node --test tests/contracts/003-exportacao-lote-municipios.test.cjs`.

| Teste (prefixo único no nome executável) | Origem | Fase | Vermelho confirmado |
| --- | --- | --- | --- |
| C1 caminho mensal seguro e substituição integral com snapshot | FR-001/002/005/006/007 | 1 | Error: not implemented |
| C2 acesso, vazio e falhas preservam arquivo anterior | FR-003/012 | 1 | Error: not implemented |
| C3 segunda escrita ocupada não altera destino | FR-013 | 1 | Error: not implemented |
| C4 permissão mantém pendente e retry não recoleta nem muda mês | FR-008/009/010/011 | 2 | Error: not implemented |
| C5 close precede commit, reentrada busy e falha commit preserva resultado | FR-008/009/013 | 2 | Error: not implemented |

Resultado antes de execute: cinco falhas not implemented; zero erros de import,
sintaxe, cancelados ou testes desabilitados. Stubs não travados: src/lote-export.js
(getMunicipalityDestination/writeMunicipality), src/lote-session.js (createBatchSession).
P2 fotos/garagem e inventário cobertos por unitários/E2E adicionais e listing-audit.md;
orçamento de contratos reservado às duas stories P1 e preservação de dados.

E2E lote deve substituir expectativa antiga de 3 Downloads por arquivos OPFS e
zero Downloads, usando extensão real/CDP loadUnpacked, perfis descartáveis e
bloqueio externo. Reutilizar padrão do E2E localidades; novas abas podem navegar
antes de context.route anexar: criar about:blank, aguardar binding e navegar por
chrome.tabs.update no harness, sem alterar produto só para teste. Manual Chrome
com pasta temporária é gate real; coleta/proxy real nunca inferidos do harness.

## Estado Atual

<!-- Sobrescrita a cada checkpoint pelo sdd-execute. Vazia na criação. -->

| Área | Estado |
| --- | --- |
| US1 | Writer mensal e store implementados; contratos C1-C3 e 4 unitários verdes |
| US2 | Sessão/UI completas; falhas parciais bloqueadas, E2E11 verde |
| US3 | Fotos/garagem corrigidas; 2/2 testes DOM e E2E11 verdes; inventário sem novas chaves |
| Polish | Concluído: 51/51, builds/E2E aprovados; usuário confirmou escrita real, reabertura/reutilização e reautorização |
| Convergence (fase5) | T024/T025 concluídas; autoload anterior restaurado; E2E lote14/localidades8 verdes em produção |

## Riscos e Decisões

| ID | Risco/Decisão | Impacto | Mitigação/Encaminhamento |
| --- | --- | --- | --- |
| R-001 | Popup fecha ao perder foco | Perda de pendente | Resolvido: D-001, página durável e aba de coleta própria |
| R-002 | Close/storage falha | Consumo falso | Resolvido: D-004/005, recibo e retry; C2/C4/C5 |
| R-003 | Duas telas alteram fila | Perda/corrida | Resolvido: Lock batch distinto do writer; E2E duas páginas |
| R-004 | Site muda/bloqueia | Auditoria parcial | Resolvido: Evidência temporal, 403 complementar registrado; não contornar |
| R-005 | Crawler antigo retorna parcial como sucesso | Risco de overwrite parcial | Decisão do usuário: propagar falhas e impedir gravação parcial na 003; Resolvido: A001 implementado e testado para falhas HTTP/rede/HTML inesperado |
| R-006 | Normalização colide nomes | Sobrescrita | Resolvido: Destino visível e last write wins autorizado; não remover outros nomes |
| R-007 | Descoberta de campos cresce escopo | Schema incompatível | Resolvido: Inventário explícito, somente fotos/garagem corrigidos |
| R-008 | Erro genérico fecha página sem evidência | Causa da falha nativa indeterminada | Resolvido: T023: aguardar DOM, distinguir bloqueio, título/URL e aba preservada; não afirmar causa original sem evidência |
| R-009 | Migração alterou seletor do autoload sem teste do controle | Lista vazia no formato anterior | Resolvido: T024 restaura seletor/contagem; T025 prova botão/origem/todos os itens/persistência e preservação em vazio/erro |

## Execution Notes

<!-- Tabela append-only, mantida pelo sdd-execute. -->

| Data | Fase/Story | Resumo | Pendência Principal |
| --- | --- | --- | --- |
| 2026-11-13 | US1 | Writer/store concluídos, C1-C3 e 4 unitários verdes, trava íntegra | Fase2 |
| 2026-11-13 | US2 | UI/sessão/collector, propagação de falhas aprovada; C1-C5 e E2E9 verdes | US3 e gate manual |
| 2026-11-13 | US3 | Fotos/garagem corrigidas, schema17; 2 testes DOM e E2E11 verdes | Polish e validação nativa |
| 2026-11-13 | Polish | 48/48; builds dev/prod, E2E localidades8/lote11 e travas íntegras; docs sincronizadas | T021 nativo Chrome |
| 2026-11-13 | T021/T023 | Usuário reportou Terceira; CTA reconhecido na inspeção; diagnóstico/DOM/aba tratados, 51/51 e E2E13 verdes | Repetir aceite nativo |
| 2026-11-13 | T021 parcial | Usuário confirmou processamento de um item e gravação em pasta real; validation/manual-chrome.md | Reabertura/reautorização nativas não informadas |
| 2026-11-13 | T021/Release | Usuário confirmou reabertura/reutilização e reautorização; checklist fechado e travas001/002/003 íntegras | sdd-converge |
| 2026-11-13 | Phase5/T024/T025 | Autoload RED→GREEN, compatibilidade e cobertura C001/C002 tratadas; 51/51, builds, E2E lote14/localidades8 e travas íntegras | Reavaliar convergência |

**PRÓXIMO**: sdd-converge da feature003 para reavaliar C001/C002; 33/33 concluídas, sem commit/push.

## Arquivos Principais

- src/lote.js; tests/e2e/lote.smoke.cjs; validation/autoload-convergence.md; README.md

## Cuidados para Retomada

- Harness Chrome StorageArea exige binding em interceptações; Date falso deve preservar protótipo após structuredClone. Testes offline simulam picker, não seleção nativa.

- No E2E de autoload, comparar o array JSON semanticamente: o transporte de scripting pode reordenar chaves. Preservação em erro/vazio compara o texto anterior exato.

## Resultado Final

Feature convergida em 2026-11-13, com 33/33 tarefas concluídas e sem lacunas
acionáveis após a segunda auditoria. A exportação do lote grava na pasta
`.data/municipios/{anomes}` autorizada no Chrome, substitui sem confirmação e
mantém fila/dados pendentes para nova tentativa quando a gravação falha. A página
durável, as abas próprias de coleta e os locks preservam o fluxo e evitam corridas.

Conforme as Execution Notes e a decisão explícita do usuário, falhas de paginação
são propagadas no lote para impedir gravação parcial. O inventário de uma
localidade resultou em correções de fotos/garagem, preservando as 17 chaves do
schema; campos adicionais ficaram documentados como recomendações. T023 ampliou
o diagnóstico e a recuperação da navegação. A causa original da falha nativa em
Terceira permanece indeterminada; não se atribui a ela o bloqueio observado em
outra navegação. T024/T025 restauraram o autoload anterior e cobriram seu botão,
origem, contagens e preservação em vazio/erro, encerrando C001/C002.

Evidências acumuladas: 51/51 testes Node, builds de desenvolvimento e produção,
E2E de produção lote14/localidades8 e travas001/002/003 íntegras. Nesta auditoria,
contratos003 novamente 5/5 e E2E lote14 aprovados, sem pageerrors e sem Downloads
do lote. O aceite manual do usuário cobre gravação em pasta real, reabertura,
reutilização e reautorização. Isso não comprova todas as localidades, proxy real
ou disponibilidade futura do site. Não houve ampliação para páginas individuais.

README conferido e já compatível com a entrega; nenhuma alteração adicional.
`tasks.md` preservado byte a byte; nenhuma alteração de código nesta convergência.

# Tasks: Exportação mensal de localidades

**Input**: spec.md, plan.md, research.md, data-model.md,
contracts/localidades-export.md, logic/escrita-mensal.md e constitution.
Status inicial: planejamento; nenhum fluxo ativo da extensão foi alterado.

## Path Conventions

- HTML em `localidades.html`; fontes em `src/localidades*.js`; bundle `dist/localidades.bundle.js`.
- Reutilizar `src/linkExtractor.js`; mudança do popup restrita à ação Links.
- Testes em `tests/contracts/`, `tests/unit/`, `tests/e2e/` e `tests/fixtures/`.
- Não editar os contratos e fixture travados da feature 002 ou o contrato 001.

## Phase 1: Foundational — escrita protegida (US1/US2, P1)

**Objetivo**: Implementar o writer que protege o destino antes de ligar a UI.

### Contrato da Fase

Cinco testes de `tests/contracts/002-exportacao-localidades-pasta-autorizada.test.cjs`:
primeira gravação mensal, recusa, substituição, erros/permissão e concorrência.
Comando: `node --test tests/contracts/002-exportacao-localidades-pasta-autorizada.test.cjs`.
Baseline confirmado: 0/5, todos com `not implemented`.

### Implementation

- [X] T001 [US1][US2] Implementar `getMonthlyDestination` e `exportLocalities` no
  stub `src/localidades-export.js`, seguindo `logic/escrita-mensal.md` e o contrato
  de módulo. Usar snapshot serializado, mês local, consulta sem criação, confirmação,
  staged write/close, abort e Web Lock exclusiva/ifAvailable. → todos os cinco contratos.

### Testes da Fase

- [X] T002 [US1][US2] Criar `tests/unit/localidades-export.test.cjs` com datas de
  janeiro/dezembro, data inválida, dados inválidos/cíclicos, confirmação que lança
  erro, lock liberada após falha e propagação de erro de acesso que não é NotFoundError.
  Verificar ausência de mutações e de sucesso falso pela interface pública.

**Critério de Conclusão**: Contratos 5/5 verdes, unitários passando, trava 002
íntegra e contratos 001 2/2 ainda verdes. Nenhuma integração de UI exigida nesta base.

**Registro da Fase**:

- Status: Concluída em 2026-11-13; T001 e T002 implementadas.
- Feito: Writer com snapshot de mês/dados, validação antes de IO, consulta sem
  criação, confirmação explícita, escrita staged/close/abort e Web Lock exclusiva.
  Oito testes unitários adicionais; nenhuma integração de UI nesta fase.
- Contrato: `node --test tests/contracts/002-exportacao-localidades-pasta-autorizada.test.cjs`
  passou 5/5; ambas as travas íntegras, contratos 001 passaram 2/2.
- Testes executados: RED inicial 002 0/5 por `not implemented`; unitários novos
  inicialmente 0/8 com stub. `node --test tests/contracts/002-exportacao-localidades-pasta-autorizada.test.cjs tests/unit/localidades-export.test.cjs`
  passou 13/13 após implementação. `npm.cmd test` passou build development e
  15/15; `npm.cmd run build:prod` compilou e `node --test` passou 15/15 após
  incluir rejeição de listas esparsas. `check-contract-tests.ps1 -Slug` para
  001 e 002: PASS. Uma implementação do core; sem alteração dos arquivos travados.
- Pendências: Fase 2 (store, coleta, página e E2E). Autorização nativa e escrita
  em disco externo ainda não verificadas; testes desta fase usam colaboradores em memória.

## Phase 2: US1 e US2 — exportar e confirmar substituição (P1)

**Objetivo**: Entregar a jornada utilizável em página durável, com escrita protegida.

### Contrato da Fase

Os cinco contratos da fase 1 devem permanecer verdes. Comando idêntico; trava
íntegra. A integração visual recebe testes adicionais nesta fase, não alterações
dos contratos existentes.

### Implementation

- [X] T003 [US1] Criar `src/localidades-directory-store.js` com loadDirectory e
  saveDirectory conforme `data-model.md`: banco/store próprios e confirmação de
  transaction.complete. Não alterar chrome.storage existente nem JSON-serializar handle.
- [X] T004 [US1] Criar `src/localidades-collector.js` e exportar `{extractLinks}`
  de `src/linkExtractor.js`, mantendo seletores/campos. Coletar em aba própria,
  aguardar navegação/DOM e fechar somente essa aba em finally; funções injetadas
  autônomas e timeouts com cleanup. Ver `contracts/localidades-export.md`.
- [X] T005 [US1][US2] Criar `localidades.html` e `src/localidades.js` com escolha
  de pasta por gesto direto, destino relativo, Extrair e salvar, estados/erros,
  confirmação com pasta/caminho, snapshot de mês/dados e bloqueio de cliques
  duplicados. Conectar writer e store. Sem blob/download no site ou no popup.
- [X] T006 [US1] Alterar somente o handler Links em `src/popup.js` para
  abrir/reutilizar `localidades.html`; retirar o fluxo antigo dessa ação e seu
  helper de DOM se ficar sem consumidores. Acrescentar entrada localidades em
  `webpack.config.js`; não mudar manifesto, permissões ou handlers Itens/Lote/Proxy.

### Testes da Fase

- [X] T007 [US1][US2] Adicionar Playwright 1.65.0 dev-only em `package.json` e
  atualizar lockfile; scripts `test:e2e:install` e `test:e2e` definidos no plano.
  Criar `tests/e2e/localidades.smoke.cjs` e `tests/fixtures/localidades-list.html`.
  Extensão real em perfil temporário, site interceptado e picker simulado por
  handle OPFS nativo: primeira gravação, acentos, recusa byte-idêntica, confirmação
  com JSON menor e zero downloads. Fechar popup após abrir página e continuar.
  Testar ativação de usuário no instante do picker e executar os cenários com
  bundle development e production, sem bypass de CSP.
- [X] T008 [US1] Criar `tests/unit/localidades-collector.test.cjs` com sucesso,
  falha/timeout e aba removida; verificar que somente a aba criada é encerrada e
  listeners/timers são limpos. Rodar regressão 001, conferir quatro abas antigas
  e mudanças restritas aos blocos de Links; nenhum comando de proxy acionado.

**Critério de Conclusão**: Contratos 5/5 e 001 2/2, unitários, builds e E2E US1/US2
verdes; UI funciona sem manter popup aberto. Picker OPFS é prova simulada, não
substitui o gate nativo da fase 4.

**Registro da Fase**:

- Status: Concluída em 2026-11-13; modo contínuo autorizado.
- Feito: T003-T006/T008 implementadas. Página durável, store próprio, coletor com
  cleanup, sexta entrada Webpack e botão Links abrindo/reutilizando a página.
  Revisão read-only apontou foco entre janelas; corrigido dentro de T006.
- Contrato: 002 5/5 e 001 2/2; ambas as travas PASS, sem alterações.
- Testes executados: `node --test tests/unit/localidades-collector.test.cjs`
  passou 5/5; `npm.cmd test` passou 20/20 e build development. E2E development
  passou oito cenários via `node tests/e2e/localidades.smoke.cjs`. Build production
  compila, mas E2E production falha aguardando saved: fixture pronta, scripts ainda
  não iniciados. Não classificado como flake. Harness bloqueia DNS externo e anexa
  aba em branco antes de navegar, corrigindo escape de rede do primeiro ensaio.
- Testes de fechamento: `npm.cmd ci`, `npm.cmd test` (20/20),
  `node tests/e2e/localidades.smoke.cjs` em development e, após
  `npm.cmd run build:prod`, `node --test` (20/20) e E2E production: PASS.
  Oito cenários, Chromium 158.0.8127.18, zero downloads e pageerrors em ambos.
  A corrida do harness foi corrigida navegando a aba anexada por chrome.tabs.update,
  em vez de Page.goto, mantendo os eventos Chrome de carregamento. Código de
  produção não recebeu workaround de teste. Itens/Lote/Proxy comparados ao backup:
  byte-idênticos após normalizar quebras de linha e caminhos já previstos na 001.
- Pendências: Nenhuma da fase. Aceite nativo registrado separadamente por relato do usuário.

## Phase 3: US3 — reutilizar e recuperar autorização (P2)

**Objetivo**: Reabrir o destino quando permitido e recuperar acesso sem perder dados.

### Implementation

- [X] T009 [US3] Completar inicialização e recuperação em `src/localidades.js`:
  carregar handle antes das ações, queryPermission sem prompt, botão Reautorizar
  com requestPermission direto no clique, troca de pasta sem mover arquivos e
  cancelamento que mantém a seleção anterior.
- [X] T010 [US3] Implementar retomada de registros/data coletados com Salvar JSON
  após reautorizar ou trocar pasta. Informar erro de persistência do destino sem
  anunciar que foi memorizado; não apagar handle anterior em transação abortada.
  Avisar antes de fechar página com operação/dados pendentes, sem impedir troca de foco.

### Testes da Fase

- [X] T011 [US3] Ampliar `tests/e2e/localidades.smoke.cjs`: IndexedDB real com
  handle OPFS, reabrir página e reutilizar, prompt/denied simulados, reautorizar
  por gesto com dados preservados, cancelar troca, falha de persistência, duas
  páginas tentando gravar e erro de coleta sem substituir arquivo anterior.
  Verificar status acessível e ausência de download/limpeza de dados.

**Critério de Conclusão**: `npm.cmd test` e E2E ampliado verdes, ambas as travas
íntegras. Nenhuma permissão permanente presumida ou alteração em dados de outros fluxos.

**Registro da Fase**:

- Status: Concluída em 2026-11-13.
- Feito: Handle pré-carregado, consulta de acesso, reautorização direta no clique,
  troca/cancelamento, registros/data mantidos para salvar sem nova coleta,
  aviso de fechamento e erro explícito quando a pasta não é memorizada.
- Contrato: 002 5/5 e 001 2/2; check-contract-tests.ps1: ambas as travas PASS.
- Testes executados: `npm.cmd test` 20/20; E2E ampliado
  `node tests/e2e/localidades.smoke.cjs` PASS nos builds development/production.
  IndexedDB/OPFS nativos; prompt/denied e renovação simulados, gesto verificado,
  recusa de troca, falha de persistência, concorrência e erro de coleta cobertos.
  Status usa role=status e aria-live; zero downloads/pageerrors.
- Pendências: Nenhuma da fase; prova de filesystem externo é o relato manual separado.

## Phase 4: Polish e aceite nativo

**Objetivo**: Validar autorização e escrita em disco real e fechar documentação fiel.

### Implementation

- [X] T012 Atualizar `README.md` com abertura da página, seleção de
  `.data/localidades` como base, YYYYMM, confirmação, recuperação, limites e
  comandos E2E. Separar claramente mocks/OPFS de autorização nativa real.

### Testes da Fase

- [X] T013 Executar suíte completa, builds e E2E nos dois modos conforme
  `quickstart.md`, com travas 001/002 íntegras. Realizar gate Chrome com seletor
  nativo para pasta temporária, arquivo no disco, recusa/aceite e reabertura.
  Registrar evidência sem tocar no perfil/dados reais do usuário; se indisponível,
  registrar pendência e não declarar aceite completo.
- [X] T014 Atualizar `.planning/memory/repository-overview.md`, registros das
  fases e backlog com o nível real de prova. Não marcar bugs anteriores como
  corrigidos. Concluir como Implementada somente com todos os gates exigidos.

### Checklist de Release

- [X] Fases 1, 2 e 3 concluídas e registros preenchidos.
- [X] Contratos 002 5/5 e 001 2/2 verdes, ambas as travas íntegras.
- [X] Unitários e builds development/production aprovados; npm ci reproduzível.
- [X] E2E simulado aprovado em ambos os builds, sem rede externa ou downloads.
- [X] Chrome com autorização nativa e escrita em pasta temporária real validados.
- [X] README/memória/status atualizados; dados, storage antigo e backlog preservados.

**Critério de Conclusão**: Todos os itens acima. Se o gate nativo estiver pendente,
manter a pendência explícita e não usar E2E simulado como substituto.

**Registro da Fase**:

- Status: Concluída em 2026-11-13.
- Feito: README, evidências automatizadas/manuais, memória e status sincronizados.
  Usuário respondeu “validado” após o roteiro de seleção, gravação, recusa/aceite
  e reabertura no Chrome. Gate manual aceito por relato do usuário, não por inspeção
  automatizada do disco. Navegador/pasta efetivos não foram fornecidos.
- Contrato: 001 2/2 e 002 5/5, ambas as travas PASS; nenhum contrato editado.
- Testes executados: `npm.cmd ci` PASS; `npm.cmd test` build development e 20/20;
  `node tests/e2e/localidades.smoke.cjs` development PASS; `npm.cmd run build:prod`
  PASS; `node --test` production 20/20; E2E production PASS. Instalação do Chromium
  via `npm.cmd run test:e2e:install` realizada. Oito cenários/zero downloads e
  pageerrors nos dois builds. Ver validation/automated.md e manual-chrome.md.
- Pendências: Nenhuma da execução aprovada. sdd-converge é o próximo estágio.
  Relato manual não comprova proxy nem cenários além do roteiro apresentado.

## Dependencies & Execution Order

Fase 1 → fase 2 → fase 3 → fase 4. Execução direta é adequada porque a mesma
jornada conecta core, coleta e UI. Respeitar o modo de pausas do sdd-execute
pedido pelo usuário ao executar; não inferir modo contínuo de uma feature anterior.
Não criar worktree que descarte configurações/arquivos locais ainda não versionados.
Não fazer commit ou publicar sem autorização.

## Rastreabilidade

| Requisito/Resultado | Tasks |
| --- | --- |
| FR-001 | T004, T005, T006, T007 |
| FR-002 | T003, T005, T009 |
| FR-003 | T001, T002, T005 |
| FR-004 | T001, T007 |
| FR-005 | T001, T004, T007 |
| FR-006 | T001, T005, T007 |
| FR-007 | T001, T005, T009, T011 |
| FR-008 | T001, T004, T011 |
| FR-009 | T001, T005, T007 |
| FR-010 | T001, T005, T010, T011 |
| FR-011 | T003, T009, T010, T011 |
| FR-012 | T005, T006, T007 |
| FR-013 | T001, T005, T011 |
| FR-014 | T006, T008, T014 |
| SC-001 | T001, T007, T013 |
| SC-002 | T001, T007, T013 |
| SC-003 | T001, T007, T013 |
| SC-004 | T001, T011, T013 |
| SC-005 | T009, T011, T013 |
| SC-006 | T006, T008, T013 |

# Tasks: Reorganização com Node/npm e Webpack

**Input**: spec.md, plan.md e constitution.md aprovados quanto ao escopo/princípios.
Execução autorizada via $sdd-execute; modo contínuo autorizado pelo usuário em 2026-11-13.

## Path Conventions

- Origem: sete arquivos em `Idealista_extensao_v1/`.
- Destino: cinco JS em `src/`, `manifest.json` e `popup.html` na raiz.
- Ferramentas na raiz; bundles em `dist/`; testes em `tests/`.
- Contratos existentes e travados não podem ser editados pelo executor.

## Phase 1: User Story 1 — Migração e build (P1)

**Objetivo**: Produzir a extensão na organização confirmada com entradas válidas.

### Contrato da Fase

- Os dois testes de `tests/contracts/001-reorganizacao-node-webpack.test.cjs`.
- Comando: `node --test tests/contracts/001-reorganizacao-node-webpack.test.cjs`.
- Baseline: 0/2; ambos falham por ausência do manifesto na raiz.

### Implementation

- [x] T001 [US1] Mover os cinco arquivos JS de `Idealista_extensao_v1/` para `src/`
  e `manifest.json`/`popup.html` para a raiz, usando operações de caminho explícito.
  Preservar conteúdo exceto caminhos de bundles; não remover recursivamente pastas.
  → contratos: ambos; FR-002/005/007, SC-005.
- [x] T002 [US1] Criar `package.json`, `package-lock.json` e `webpack.config.js`
  conforme versões, entradas, scripts e CSP definidos em `plan.md`; acrescentar
  `/node_modules/` e `/dist/` em `.gitignore`. Instalar dependências somente locais.
  → contratos: ambos; FR-001/003/006, SC-001.
- [x] T003 [US1] Ajustar `manifest.json`, `popup.html` e as duas injeções por files
  em `src/popup.js` para os bundles. Preservar permissões, ordem dos scripts,
  chaves de storage, interface e lógica dos fluxos. → contratos: ambos; FR-004/005.

### Testes da Fase

- [x] T004 [US1] Executar `npm.cmd ci`, `npm.cmd test`, `npm.cmd run build:prod`
  e os contratos diretamente após o build de produção. Conferir ausência de eval
  e caminhos das duas reinjeções; verificar hashes de `preservation-baseline.json`.

**Critério de Conclusão**: Contratos 2/2 verdes nas duas modalidades, trava íntegra,
reinstalação pelo lockfile bem-sucedida, reinjeções resolvíveis e legados preservados.

**Registro da Fase**:

- Status: Concluída em 2026-11-13. Continuação em modo contínuo autorizada posteriormente.
- Feito: T001–T004; sete arquivos migrados, Node/Webpack configurados, lockfile
  gerado e caminhos do manifesto/HTML/reinjeções atualizados.
- Contrato: `node --test tests/contracts/001-reorganizacao-node-webpack.test.cjs`
  → 2/2 verdes em development e production; trava íntegra.
- Testes executados: baseline 0/2 com falha esperada; `npm.cmd ci --no-audit --no-fund`
  → 77 pacotes instalados; `npm.cmd test` → build development e 2/2 testes;
  `npm.cmd run build:prod` → sucesso; contratos após produção → 2/2;
  `check-contract-tests.ps1 -Slug 001-reorganizacao-node-webpack -Json` → PASS.
  Comparação byte a byte das sete entradas passou, com alterações somente nos
  caminhos previstos; quatro legados com SHA256 intacto, status de Bases/.data
  preservado, duas reinjeções resolvíveis e produção sem eval/source maps.
- Pendências: Fases 2 e 3, incluindo README, watch e validação no Chrome.

## Phase 2: User Story 2 — Documentação e fluxo de desenvolvimento (P2)

**Objetivo**: Permitir edição, testes, recompilação e carregamento sem ambiguidade.

### Implementation

- [x] T005 [US2] Criar `README.md` com requisitos, instalação, comandos,
  estrutura, carregamento da raiz no Chrome e recarga da extensão/página.
  Explicar testes nativos Node, ZIP histórico, Python separado e bugs no backlog.
  Não orientar reinstalar/remover extensão existente ou apagar storage.
  FR-003/009, US2-AC2.

### Testes da Fase

- [x] T006 [US2] Confirmar `npm.cmd run dev` ativo e recompilação observável
  após alteração temporária e reversível em uma fonte. Restaurar o conteúdo
  original antes de encerrar o watch. Conferir comandos do README e rodar
  novamente os contratos após o último build. FR-003/008/009, SC-003.

**Critério de Conclusão**: Instruções correspondem aos comandos reais; watch
recompila; testes permanecem verdes sem rede durante sua execução.

**Registro da Fase**:

- Status: Concluída em 2026-11-13; continuação automática para fase 3.
- Feito: README criado e conferido; modo watch validado sem alteração permanente da fonte.
- Contrato: sem contrato novo nesta fase; contrato existente 2/2 verde e trava íntegra.
- Testes executados: `npm.cmd run dev` compilou em 146 ms, recompilou a alteração temporária em 25 ms e a restauração em 18 ms. Watch encerrado pelo processo criado para o teste. `node --test tests/contracts/001-reorganizacao-node-webpack.test.cjs` → 2/2; verificador de trava → PASS.
- Pendências: Smoke de navegador e documentação final na fase 3.

## Phase 3: Polish e aceite

**Objetivo**: Verificar a extensão reorganizada e registrar evidências distintas.

### Implementation

- [x] T007 Atualizar `.planning/memory/repository-overview.md` e os status
  da feature, preservando os oito itens pendentes no backlog.

### Testes da Fase

- [x] T008 Executar `quickstart.md`; validar carregamento no Chrome com perfil
  isolado sem dados do usuário quando disponível. Verificar quatro abas e erros
  de carregamento. Registrar pendência se a ferramenta não permitir validação.
  Não ativar proxy ou coleta real. FR-004/005/007, SC-004.

### Checklist de Release

- [x] Fase 1 concluída e lockfile reproduzível.
- [x] Fase 2 concluída e README conferido.
- [x] Contratos 2/2 verdes e `check-contract-tests.ps1` íntegro.
- [x] Builds development e production aprovados.
- [x] Hashes de legados preservados; dados e alterações locais intactos.
- [x] Carregamento no Chrome e quatro abas verificados (gate de aceite completo).
- [x] Nenhuma correção do backlog incorporada inadvertidamente.
- [x] Documentação e status refletem o nível de evidência obtido.

**Critério de Conclusão**: Todos os gates aplicáveis passam. Pendência de
carregamento no Chrome impede declarar aceite completo ou convergência total.

**Registro da Fase**:

- Status: Concluída em 2026-11-13; T001–T008 e checklist de release completos.
- Feito: Memória e README atualizados; Chrome/Chromium em perfis isolados validados; evidências em validation/. Revisão independente read-only sem achados.
- Contrato: `node --test tests/contracts/001-reorganizacao-node-webpack.test.cjs` → 2/2 verdes no build de produção; trava íntegra.
- Testes executados: `npm.cmd test` → build development e 2/2; `npm.cmd run build:prod` → sucesso; contratos produção → 2/2; `git diff --check` limpo. Chrome instalado 157.0.8103.78 e Chromium 156.0.8078.4 carregaram MV3, service worker, quatro abas e script de conteúdo em fixture local. Zero erros registrados, proxy desativado e storage vazio nos perfis temporários.
- Pendências: Nenhuma da reorganização. Coleta real e proxy real não validados, conforme fora de escopo. Os oito itens do backlog permanecem. Durante o fechamento, os quatro legados do baseline foram removidos externamente do checkout; não restaurados. Haviam sido conferidos intactos na fase 1. Status de Bases/.data permaneceu igual ao baseline; evidência detalhada em validation/preservation.json.

## Dependencies & Execution Order

### Rastreabilidade

| Requisito | Tasks |
| --- | --- |
| FR-001 | T002, T004 |
| FR-002 | T001, T003 |
| FR-003 | T002, T005, T006 |
| FR-004 | T003, T004, T008 |
| FR-005 | T001, T003, T008 |
| FR-006 | T002 |
| FR-007 | T001, T004, T008 |
| FR-008 | T004, T006 |
| FR-009 | T005, T006 |
| SC-001 | T002, T004 |
| SC-002 | T003, T004 |
| SC-003 | T004, T006 |
| SC-004 | T008 |
| SC-005 | T001, T004 |

Executar fases 1 → 2 → 3, com tasks na ordem. Migração e configuração compartilham
entradas; execução direta nesta sessão é recomendada, sem paralelismo por tarefa.
Não criar worktree que descarte as configurações locais ainda não versionadas.
Não realizar commit, push ou publicação sem instrução do usuário.

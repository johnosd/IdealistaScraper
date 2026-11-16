# Tasks: Coleta em um clique com acompanhamento e recuperação por localidade

**Input**: .sdd/specs/005-experiencia-coleta-autonoma/
**Prerequisites**: spec.md, plan.md, research.md, data-model.md, contracts/autonoma.md, logic/*.md e quickstart.md.
**Organization**: quatroP1, com US3 antes de US2 para estabilizar o estado exibido; cada story possui cenário independente.

## Format

TNNN [USn] descrição e caminho. Itens de Testes da Fase são adicionais, nunca reescrita dos contratos travados.
Não há [P] entre mutações compartilhadas do coordenador/background. Testes em arquivos distintos podem ser preparados independentemente após definir a API, mas sua execução depende da fase.

## Path Conventions

- src/: CommonJS, CSS fonte e módulos; raiz: HTML/manifest; dist/: somente gerado.
- tests/contracts/005-experiencia-coleta-autonoma.test.cjs e fixtures listadas na trava são imutáveis.
- tests/unit/ e tests/e2e/: cobertura adicional; não enfraquecer testes anteriores para migrar a UI.
- validation/ desta feature: logs, hashes e evidências sanitizadas; sem credenciais/dados reais.
- Não criar outra branch/worktree nem restaurar alterações locais neste planejamento; execução deve registrar seu baseline antes de modificar o checkout.

## Phase 1: Foundation

**Objetivo**: Preparar estado, ownership e compatibilidade sem mudar as entradas atuais do produto.

### Contrato da Fase

Infraestrutura: preservar contratos001–004 e a trava005; ainda sem obrigação de tornar todos os casos005 verdes.

### Implementation

- [X] T001 Registrar baseline e conferir travas001–005 em .sdd/specs/005-experiencia-coleta-autonoma/validation/ antes de alterar fontes; preservar o checkout/branch atual.
- [X] T002 Estender src/coleta-coordinator.js e src/coleta-store.js com sessõesv2, itemStates, selection e commits atômicos, seguindo data-model.md e logic/execucao-e-recuperacao.md; conservar assinaturasv1 → contratos C1/C3/C5.
- [X] T003 Estender src/lote-directory-store.js com binding de destino por execução e exceção explícita por item, sem remover directory nem alterar o banco de localidades → contratos C1/C3.
- [X] T004 Implementar reserva launch/commandId e ownership cercado em src/coleta-coordinator.js, com vida comprovada e liberação segura; não duplicar domínio/consumo → contratos C1/C5.
- [X] T005 Adicionar adaptação de leitura e promoção manualv1 em src/coleta-coordinator.js, preservando receipts/manifests/counters/mês e enumeração de páginas no descarte → contrato C3.

### Testes da Fase

- [X] T006 Cobrir rollback, promoção/corrupção, accounting, limites, duas reservas concorrentes e dadosv1 em tests/unit/autonoma-store.test.cjs, reutilizando fixtures imutáveis.

**Critério de Conclusão**: node --test tests/unit/autonoma-store.test.cjs e suíte001–004 verdes; schema aditivo e nenhuma nova entrada de produto ativa. Os cinco contratos005 restantes continuam reportados como RED, sem alterar sua trava.

**Registro da Fase**:

- Status: Concluída
- Feito: Sessões v2, reservas e promoção manual preservando v1; vínculos de pasta por execução.
- Contrato: trava005 íntegra; contratos aplicáveis verificados.
- Testes executados: node --test tests/unit/autonoma-store.test.cjs tests/contracts/004-coleta-resiliente.test.cjs: 10/10 verdes; contratos005 intactos.
- Pendências: sem pendência nesta fase.

## Phase 2: US1 — Início em um clique (P1)

**Objetivo**: Descobrir o escopo da página e executar toda a sequência normal com um comando.

### Contrato da Fase

C1 um comando fixa origem, deduplica e coleta a fila.

Comando: node --test --test-name-pattern='^C1 ' tests/contracts/005-experiencia-coleta-autonoma.test.cjs → 1/1 verdes e check-contract-tests.ps1 -Slug 005-experiencia-coleta-autonoma íntegro. Filtro seleciona casos desta fase; não é aceitação da suíte completa.

### Implementation

- [X] T007 [US1] Criar src/coleta-discovery.js e compartilhar extrator com src/lote.js: breadcrumb direto atual/legado, quantidade desconhecida, deduplicação, documentId/URL congelados e erro de origem alterada → contrato C1.
- [X] T008 [US1] Implementar start e drive de src/coleta-autonoma.js pelo coordenador comum, preflight, fila e caminho de sucesso/empty, conforme contratos/autonoma.md e logic/execucao-e-recuperacao.md → contrato C1.
- [X] T009 [US1] Refatorar transporte público compartilhado em src/coleta-runner.js, mantendo createCollectionWorkflow e reserve/dispatch/validate/reportv1, e reusar no005 → contrato C1.
- [X] T010 [US1] Criar src/coleta-autonoma-background.js e ligar src/background.js: namespace AUTONOMA_, launch ACK curto, criação única do runner e autorização por sender/binding; sem coleta em startup → contrato C1.
- [X] T011 [US1] Criar runner.html/src/runner.js e entrada webpack.config.js: aba técnica inativa, prova de vida/runId, writer/reconcile locais, sem auto-drive quando aba é restaurada → contrato C1.
- [X] T012 [US1] Ligar comando Iniciar coleta da página em lote.html/src/lote.js como entrada mínima demonstrável, mantendo importação e fluxo anterior acessíveis até a migração do painel → contrato C1.

### Testes da Fase

- [X] T013 [US1] Adicionar tests/unit/autonoma-discovery.test.cjs para breadcrumb antigo/novo, falta de contagem, URLs inválidas, homônimos, duplicatas, vazio e troca de documento.
- [X] T014 [US1] Adicionar tests/unit/autonoma-launch.test.cjs para primeiro uso, autorização ausente, clique duplicado, falha de criação de runner, pausa na descoberta e ausência de exportação intermediária.

**Critério de Conclusão**: C1 verde e trava005 íntegra; um comando pela entrada mínima coleta/grava a fila sem tocar na aba do usuário, com pré-requisitos/erro úteis. Testes adicionais e anteriores verdes.

**Registro da Fase**:

- Status: Concluída
- Feito: Início integrado ao navegador, runner em segundo plano e descoberta direta compartilhada.
- Contrato: trava005 íntegra; contratos aplicáveis verificados.
- Testes executados: C1 verde; unitários de lançamento/descoberta verdes; node tests/e2e/autonoma.smoke.cjs: 4 grupos, 3 arquivos OPFS, 0 pageerrors; corrigida identidade canônica do gesto após serialização Chrome.
- Pendências: sem pendência nesta fase.

## Phase 3: US3 — Recuperação por localidade (P1)

**Objetivo**: Continuar após falhas locais comprovadas e recuperar somente o trabalho escolhido.

### Contrato da Fase

C3 falhas locais e retomadas preservam checkpoints; C5 429 e desafio pausam todo domínio.

Comando: node --test --test-name-pattern='^C3 |^C5 ' tests/contracts/005-experiencia-coleta-autonoma.test.cjs → 2/2 verdes e check-contract-tests.ps1 -Slug 005-experiencia-coleta-autonoma íntegro. Filtro seleciona casos desta fase; não é aceitação da suíte completa.

### Implementation

- [X] T015 [US3] Implementar classify/advanceItem no caminho autônomo de src/coleta-autonoma.js/src/coleta-coordinator.js conforme a allowlist de logic/execucao-e-recuperacao.md; dados ambíguos pausam → contratos C3/C5.
- [X] T016 [US3] Implementar resume/selectItems/pause em src/coleta-autonoma.js e encaminhamento em src/coleta-autonoma-background.js: remaining/pending/itemId, busy, incompatibilidade e confirmação de acesso → contratos C3/C5.
- [X] T017 [US3] Integrar intent/receipt/reconcile por item em src/coleta-autonoma.js/src/runner.js e binding de destino: save-only, empty, pausa duranteclose e colisão explícita sem trocar nomes003 → contrato C3.
- [X] T018 [US3] Adaptar projeção do005 em src/lote.js e src/coleta-background.js para estados reais; manter caminho e contratosv1 sem inferir sucesso de índice no005 → contrato C3.

### Testes da Fase

- [X] T019 [US3] Criar tests/unit/autonoma-recovery.test.cjs para remaining versus pending, seleção individual, manifests incompatíveis, ID estável, contadores/attempts preservados e descarte confirmado.
- [X] T020 [US3] Criar tests/unit/autonoma-save.test.cjs para save-only sem rede, close falho/ambíguo, reconciliação por digest, empty, mês original, recibo duplicado e colisão de paths com outra pasta por item.
- [X] T021 [US3] Criar tests/unit/autonoma-blockers.test.cjs para403/429/401/407, precedência global sobre404, Retry-After, tentativas esgotadas não locais, limites e falha de checkpoint sem avanço.

**Critério de Conclusão**: C3/C5 verdes e trava005 íntegra; B pode falhar sem bloquear C quando comprovadamente local, mas nenhum outro item evade uma condição global. Retomadas aproveitam checkpoint/dados graváveis; testes adicionais e anteriores verdes.

**Registro da Fase**:

- Status: Concluída
- Feito: Retomada por item e grupo, save-only, falhas locais, bloqueios globais e resumo por estado real.
- Contrato: trava005 íntegra; contratos aplicáveis verificados.
- Testes executados: C3/C5 verdes; 15 testes adicionais de recuperação/gravação/bloqueios verdes; checkpoint corrompido recusado antes de rede.
- Pendências: sem pendência nesta fase.

## Phase 4: US2 — Painel e acompanhamento (P1)

**Objetivo**: Acompanhar e controlar a coleta pelo painel lateral sem depender dele para continuar.

### Contrato da Fase

C2 observação descartável não controla execução e resumo separa pendências.

Comando: node --test --test-name-pattern='^C2 ' tests/contracts/005-experiencia-coleta-autonoma.test.cjs → 1/1 verdes e check-contract-tests.ps1 -Slug 005-experiencia-coleta-autonoma íntegro. Filtro seleciona casos desta fase; não é aceitação da suíte completa.

### Implementation

- [X] T022 [US2] Implementar src/coleta-view-model.js conforme contrato e matriz da spec: contadores exclusivos, barra rotulada, estados/ações, seleção e filtros sem alterar fila → contrato C2.
- [X] T023 [US2] Criar sidepanel.html/src/sidepanel.js/src/coleta.css com hierarquia definida em logic/interface-e-configuracoes.md, origem/destino e Outras ferramentas; emitir CSS local pelo webpack.config.js → contrato C2.
- [X] T024 [US2] Alterar manifest.json/src/background.js para side_panel.default_path, somente permissão sidePanel, mínimo141, action sem popup, openPanelOnActionClick e badge/title recuperáveis sem som/foco → contrato C2.
- [X] T025 [US2] Implementar READ/LIST/READ_ITEM sanitizados e avisos AUTONOMA_CHANGED em src/coleta-autonoma-background.js/src/sidepanel.js; poll1s visível, sem dados/segredos ou retomada por leitura → contrato C2.
- [X] T026 [US2] Implementar busca/filtros, linhas estáveis, histórico/execução ativa, expansão e preferências de leitura em src/sidepanel.js; reabertura preserva contexto → contrato C2.
- [X] T027 [US2] Implementar foco/dialogs/live region/movimento reduzido e matriz de ações em src/sidepanel.js/src/coleta.css, inclusive Pausando, impedimentos visíveis, alcance da retomada e Nova coleta sem rede → contrato C2.

### Testes da Fase

- [X] T028 [US2] Adicionar tests/unit/autonoma-view.test.cjs e tests/unit/autonoma-panel.test.cjs para contagens6/10, filtros, nomes longos, mensagens vazias/erro, labels e foco sem depender de detalhes privados.
- [X] T029 [US2] Adicionar tests/unit/autonoma-runtime.test.cjs para fechamento do observador, worker reconstruído, runner restaurado inerte, aba reciclada e conflito entre modos.

**Bloqueio em T024 resolvido (2026-11-14)**: emenda mínima do contrato001 aprovada explicitamente e aplicada; teste2/2 verde e trava001 atualizada. Demais contratos/travas preservados. Evidência histórica em validation/contract001-ui-conflict.md.

**Critério de Conclusão**: C2 verde e trava005 íntegra; painel emite intenções e representa corretamente a execução. Teste de função não substitui os gates de painel nativoT043 e acessibilidadeT045.

**Registro da Fase**:

- Status: Concluída; gate5b resolvido por emenda001 explicitamente aprovada.
- Feito: Painel lateral incremental, busca/filtros/histórico, contexto/foco preservados e observação passiva; runner restaurado inerte.
- Contrato: C2 verde;001 emendado2/2; travas001–005 íntegras.
- Testes executados: node --test tests/unit/autonoma-panel.test.cjs tests/unit/autonoma-runtime.test.cjs tests/unit/autonoma-view.test.cjs; build development aprovado. Ver também E2E/nativo da fase6.
- Pendências: Gates de acessibilidade/filesystem separados na fase6; nenhuma taskT022–T029 aberta.

## Phase 5: US4 — Configurações dedicadas (P1)

**Objetivo**: Concentrar ajustes em uma tela própria mantendo valores e contexto seguros.

### Contrato da Fase

C4 configurações reutilizam valores, validam antes de salvar e não expõem segredo.

Comando: node --test --test-name-pattern='^C4 ' tests/contracts/005-experiencia-coleta-autonoma.test.cjs → 1/1 verdes e check-contract-tests.ps1 -Slug 005-experiencia-coleta-autonoma íntegro. Filtro seleciona casos desta fase; não é aceitação da suíte completa.

### Implementation

- [X] T030 [US4] Implementar src/coleta-settings.js: load público sem senha, validação integral, atividade, CAS, senha omitida preservada e resultado confirmado → contrato C4.
- [X] T031 [US4] Criar src/coleta-settings-repository.js; adaptar src/coleta-background.js/src/background.js/src/coleta-policy.js para config:005+policy atômicos e importação/projeções compatíveis conforme data-model.md → contrato C4.
- [X] T032 [US4] Criar configuracoes.html/src/configuracoes.js e entrada webpack.config.js: Pastas/Conexão/Limites, avançados, draft, Save, erro por campo, dirty/conflict, retorno ao painel e sem START ao salvar → contrato C4.
- [X] T033 [US4] Ligar seleção/reautorização de pasta em src/configuracoes.js usando stores existentes e gesto direto, vinculando destino recuperado à execução/item quando aplicável → contrato C4.
- [X] T034 [US4] Centralizar acesso a configurações em src/popup.js/src/coleta-ui.js e popup.html/lote.html/localidades.html/itens.html, retirando formulários de ajustes do acompanhamento sem remover outras ferramentas → contrato C4.

### Testes da Fase

- [X] T035 [US4] Adicionar tests/unit/autonoma-settings.test.cjs para importação legada concorrente, atomicidade rollback, CAS, alterações ativas, senha privada e projeções compatíveis.
- [X] T036 [US4] Adicionar tests/unit/autonoma-settings-ui.test.cjs para dirty/voltar/invalid/erro, resultado confirmado, labels/unidades e autorização separada sem perder rascunho.
- [X] T037 [US4] Cobrir senders e bloqueio de alterações por interfaces antigas em tests/unit/autonoma-settings.test.cjs e tests/unit/coleta-protocol.test.cjs, preservando contratos anteriores.

**Critério de Conclusão**: C4 verde e trava005 íntegra; todos ajustes existentes ficam em Configurações, sem credencial pública ou mudança silenciosa de contexto; os quatroP1 têm funcionalidade implementada.

**Registro da Fase**:

- Status: Concluída
- Feito: Configuracoes dedicadas com draft, senha privada, CAS atomico, destinos explicitos e adaptadores legados comuns.
- Contrato: trava005 íntegra; contratos aplicáveis verificados.
- Testes executados: C4 verde;21 testes de settings/UI/protocolo/legado verdes; build development aprovado.
- Pendências: sem pendência nesta fase.

## Phase 6: Polish & Release

**Objetivo**: Validar integração, superfícies nativas, acessibilidade e documentação com provas separadas.

### Contrato da Fase

C1/C2/C3/C4/C5 completos.

Comando: node --test tests/contracts/005-experiencia-coleta-autonoma.test.cjs → 5/5 verdes e check-contract-tests.ps1 -Slug 005-experiencia-coleta-autonoma íntegro. Filtro seleciona casos desta fase; não é aceitação da suíte completa.

### Implementation

- [X] T038 Conferir limpeza de listeners/timers/abas e diagnósticos sanitizados em src/coleta-autonoma-background.js/src/runner.js/src/sidepanel.js, cobrindo fluxo adversarial em tests/unit/autonoma-security.test.cjs.
- [X] T046 Executar .sdd/specs/005-experiencia-coleta-autonoma/quickstart.md e atualizar README.md, plan.md, tasks.md, handoff.md e .planning/backlog.md com resultados, limitações e arquivos de evidência em validation/.
- [X] T047 Ad-hoc em FR-023, encontrada na revisãoT038: nova preparação sem fila após descoberta falha; preparar lote individual explicitamente em src/sidepanel.js/src/lote.js sem apagar checkpoint anterior; checagem física isSameEntry antes de recuperar/gravar homônimos; regressões view/destinations/runtime.
- [X] T048 Ad-hoc US4, relato do usuário: diagnóstico/aplicação explícita da conexão salva, diferença entre salvo/ativo, conexão direta remove proxy próprio e não altera coleta ativa; regressões e prova real autorizada via .env sem expor credenciais. Ver validation/proxy-assessment.md.
- [X] T049 Ad-hoc US4, feedback do usuário: resultado visível junto à conexão, progresso imediato e erro acionável; Salvar e testar conexão em um clique explícito; preservar Salvar sem aplicar/START e Verificar IP observacional. Regressão de viewport/pendência/sucesso/falha/conflito/atividade sem segredos. Ver validation/proxy-feedback.md.
- [X] T050 US4, pedido explícito do usuário: indicar senha persistida e botão de olho para mostrar/ocultar senha digitada ou salva; leitura privada apenas por ação em Configurações, revisão conferida, GET_SETTINGS permanece sanitizado. Validar persistência após reabrir, alternância acessível, ausência de edição ao revelar e preservação ao salvar outros campos.
- [X] T051 US2, feedback explícito de regressão visual: recuperar abas Links/Itens/Lote e acesso visível a Configurações; tornar fila/processamento observáveis sem rolagem excessiva, item atual destacado com páginas/anúncios e ação para localizá-lo. Trocar aba preserva contexto/execução e não inicia coleta. Regressões de teclado, continuidade, progresso e viewport; manter painel nativo e recuperação.
- [ ] T052 Correção relatada pelo usuário: Links deve iniciar navegação/coleta das localidades principais no Idealista, sem abrir configuração/exportação. Reutilizar motor/coordenador de links com executor durável, progresso/resultado na aba Links, exportação separada e sem exigir pasta para capturar. Gesto único, exclusividade, proxy salvo, anti-replay após restart e confirmação por jornada completa; corrigir teste anterior que aceitava apenas abrir tela.

### Testes da Fase

- [X] T039 Criar tests/e2e/autonoma.smoke.cjs reutilizando tests/fixtures/coleta-browser.cjs: início real, mudanças de origem, falhas/retomada, save-only, quota, fechamento do painel/worker e restart real sem rede automática.
- [X] T040 Criar tests/e2e/autonoma-ui.smoke.cjs: primeiro uso, drafts, navegação,308itens, filtros/detalhes/foco,320px/zoom200%, badge e ferramentas antigas; distinguir página de teste de painel nativo.
- [X] T041 Executar npm.cmd test, npm.cmd run build:prod, node --test e integridade das cinco travas; validar referências/manifest/CSP/ausência de segredos sem editar dist manualmente.
- [X] T042 Executar todos smokes antigos e novos do quickstart em development e production; sem chamadas externas, Downloads indevidos ou pageerrors.
- [X] T043 Validar painel lateral REAL, action, recolhimento/reabertura, foco e continuidade no Chrome>=141, com perfil temporário; registrar em validation/native-panel.md.
- [ ] T044 Validar picker e gravação em pasta externa TEMPORÁRIA, reuso/recusa/reautorização e save-only nativos no Chrome; registrar em validation/native-filesystem.md.
- [ ] T045 Validar teclado, leitor de tela Windows, foco/announcements, movimento reduzido,320px e zoom200% no painel/configurações; registrar em validation/accessibility.md.

**Critério de Conclusão**: node --test tests/contracts/005-experiencia-coleta-autonoma.test.cjs →5/5 verdes, travas001–005 íntegras; T001–T046 e todos gates abaixo concluídos. Se prova nativa nova faltar, manter Em Execução com pendência específica, sem declarar implementação aceita.

**Registro da Fase**:

- Status: Parcial;58/64 checkboxes, T052 parcial e demais gates anteriores abertos; manter Em Execução.
- Feito: Integração/revisão/segurança/QA e documentação; T047 nova preparação/colisões, T048/T049 conexão com feedback local, T050 senha salva/olho. T051 recuperou abas Links/Itens/Lote e fila compacta com município atual destacado, progresso e resultado, sem interromper execução ao navegar. Build final production.
- Contrato: node --test tests/contracts/005-experiencia-coleta-autonoma.test.cjs:5/5; check-contract-tests.ps1 para001–005:PASS. Emenda001 aprovada; demais travas intactas.
- Testes executados: T052 npm.cmd test e buildprod + node --test:194/194 dev/prod. Jornada Links:navegação,4 registros extraídos, zero configuração prévia/download/anúncios, reload sem replay e exportação sem recoleta. Localidades/coleta/autonoma verdes dev/prod. Site real falhou407 no coletor e403 em navegação simples/curl; proxy ipify200. Não equivale a aceite real; links-flow-fix.md.
- Correção posterior T052: mensagem exata reproduzida após403 e segundo clique. Motivo descartado/lançamento escondendo sessão anterior corrigidos; diagnóstico por etapa, HTTP/prazo, sessão preservada e detalhes para retomada manual. Builddev/prod + Node200/200 em ambos; três jornadas Links e tabs passaram nos dois builds, sem rede pública. Ver links-start-fix.md.
- Correção do screenshot T052 (2026-11-15): retirado localidades.html do início; runner técnico dedicado abre Idealista ativo. Entrada antiga também inicia coleta, com exportação separada.208/208 Node dev/prod; quatro jornadas Links, abas e exportação legada passaram em ambos. Regressões RED/GREEN para leitura antiga, aba não persistida, runner pendingUrl e destaque de página pendente. Ver links-direct-navigation.md. T052 permanece aberta por captura real/R-018.
- T052 bloqueio herdado/MCP (2026-11-15): reprodução de Lote403 impedindo Links antes de criar sessão; recuperação manual agora visível sem ID e respeita espera/relógio/orçamento.212/212 dev/prod; smoke herdado nos dois builds e quatro jornadas Links em produção. MCP Playwright abriu URL real HTTP200, extrator retornou84/84 links e handler também84 com validação do coordenador simulada. MCP recusou acesso chrome-extension; clique instalado/proxy407/403 ainda pendentes. Ver validation/links-mcp-live.md. Nenhum gate novo fechado.
- Screenshot posterior T052: texto de recuperação agora distingue tentativa anterior da página atual e orienta confirmação. Smoke ampliado com elegibilidade vencida preparada em perfil temporário: confirmação inicia motor real e exibe84 links do HTML público congelado, preservando Lote bloqueado.212/212 e smoke completo dev/prod; nenhuma espera ou dado do perfil pessoal alterados. Clique pessoal pelo MCP permanece sem prova;58/64.
- T052 transição403→200: usuário confirmou que o próprio site depois abre normal; falha reproduzida e corrigida no runner/observador/prova do documento. Observação passiva até10s, sem reload/fetch adicional, mantendo403 persistente/429.218/218 dev/prod; variantes da transição, quatro jornadas Links, coleta e autonoma passaram nos dois builds. MCP releu página real HTTP200/84 links. Corrida de runner pendingUrl também coberta por RED/GREEN. Ver validation/links-transition-fix.md;58/64 e gates anteriores mantidos.
- R-020 novo: autonoma.smoke teve0 em vez de2 salvos após stopWorker, em dev e numa rodadaprod; diagnóstico sanitizado e rodada finalprod verdes não fecham a intermitência. Sem regressão de acesso/identidade relaxada nem afrouxamento de testes.
- Pendência nova R-019: coleta.smoke dev falhou antes da primeira requisição na variante initial-403; isolado e produção instrumentada passaram. Causa não determinada, não fechar por retry; separada de R-013. Captura real e58/64 permanecem parciais.
- Pendências: T052/R-018:captura real e divergência407/403 não resolvidas; correção do clique verificada localmente, não marcar concluída. T044 picker/pasta externa/reautorização nativos; T045 leitor de tela/teclado/zoom real. R-013 timeout antigo de download ainda sem causa; rodadas atuais verdes não fecham o gate por retry. Roteiro --manual de filesystem preparado.

### Checklist de Release

- [X] Fase1 Foundation concluída.
- [X] Fase2 US1 concluída.
- [X] Fase3 US3 concluída.
- [X] Fase4 US2 concluída.
- [X] Fase5 US4 concluída.
- [X] Todos os cinco contratos005 verdes e travas001–005 íntegras.
- [X] Suíte Node e builds development/production aprovados.
- [ ] Smokes antigos e novos aprovados nos dois builds.
- [X] Chrome instalado com painel lateral real, action/permissão/manifest/CSP aprovados.
- [ ] Picker/escrita/reuso/reautorização nativos em pasta de teste aprovados.
- [ ] Teclado/leitor de tela/zoom/movimento reduzido aprovados.
- [X] Quickstart e documentação/status atualizados com provas separadas.

## Dependencies & Execution Order

Fase1 bloqueia a integração. Fase2 entrega início demonstrável pela entrada de lote atual. Fase3 depende da sessão/runner de2. Fase4 consome estados consolidados de3; seu cenário independente pode usar início legado. Fase5 migra ajustes e depende dos adapters de1–3; pode ser demonstrada com os pontos de entrada existentes. Fase6 exige os quatroP1. A ordem prioriza dependências técnicas sem transformar histórias independentes em escopo opcional.

MVP incremental US1 não é aceite da feature completa. Não iniciar implementação com contratos/helper alterados. Commits/integração seguem autorização da sessão de execução, preservando trabalho preexistente.

## Traceability

| Requisito/resultado | Tasks |
| --- | --- |
| FR-001 | T007, T008, T012, T014, T039 |
| FR-002 | T007, T013, T039 |
| FR-003 | T007, T014, T039 |
| FR-004 | T007, T013, T020 |
| FR-005 | T008, T014, T033 |
| FR-006 | T008, T012, T039 |
| FR-007 | T023, T034, T040 |
| FR-008 | T023, T024, T043 |
| FR-009 | T022, T023, T025, T028 |
| FR-010 | T015, T022, T028 |
| FR-011 | T021, T022, T027 |
| FR-012 | T010, T011, T029, T039, T043 |
| FR-013 | T009, T011, T039, T043 |
| FR-014 | T005, T025, T029, T039 |
| FR-015 | T016, T027, T029 |
| FR-016 | T015, T019, T039 |
| FR-017 | T015, T021, T039 |
| FR-018 | T015, T021 |
| FR-019 | T026, T028, T040 |
| FR-020 | T016, T019, T027, T039 |
| FR-021 | T002, T005, T016, T019, T039 |
| FR-022 | T017, T020, T039, T044 |
| FR-023 | T005, T019, T027 |
| FR-024 | T004, T010, T021, T029 |
| FR-025 | T022, T025, T028, T040 |
| FR-026 | T030, T032, T034, T040 |
| FR-027 | T030, T031, T035, T036 |
| FR-028 | T003, T033, T044 |
| FR-029 | T002, T016, T019, T020, T021 |
| FR-030 | T003, T017, T020, T041, T044 |
| FR-031 | T027, T028, T040, T045 |
| FR-032 | T025, T030, T035, T038 |
| FR-033 | T022, T028, T040 |
| FR-034 | T022, T023, T027, T040 |
| FR-035 | T012, T014, T032, T033, T040 |
| FR-036 | T016, T022, T028 |
| FR-037 | T026, T028, T040 |
| FR-038 | T016, T027, T029 |
| FR-039 | T030, T031, T032, T035, T036 |
| FR-040 | T024, T025, T040, T043 |
| FR-041 | T027, T040, T045 |
| FR-042 | T019, T027, T040 |
| SC-001 | T014, T039 |
| SC-002 | T013, T039 |
| SC-003 | T025, T040, T043 |
| SC-004 | T029, T039, T043 |
| SC-005 | T019, T039 |
| SC-006 | T016, T019, T039 |
| SC-007 | T021, T039 |
| SC-008 | T029, T039, T043 |
| SC-009 | T020, T039, T044 |
| SC-010 | T022, T028, T039 |
| SC-011 | T032, T034, T036, T040 |
| SC-012 | T040, T045 |
| SC-013 | T035, T038, T041, T042 |
| SC-014 | T014, T033, T036, T040 |
| SC-015 | T019, T022, T028 |
| SC-016 | T026, T040 |
| SC-017 | T014, T027, T036, T040 |
| SC-018 | T019, T036, T040 |
| SC-019 | T040, T045 |
| SC-020 | T024, T040, T043 |

<!-- sdd-converge anexa fases adicionais abaixo; não reescrever tasks existentes. -->

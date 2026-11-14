# Tasks: Exportação mensal do lote em pasta de municípios

**Input**: `.sdd/specs/003-exportacao-lote-municipios/`
**Prerequisites**: spec.md, plan.md, data-model.md, contracts/lote.md, logic/lote.md.

## Path Conventions

- Lógica em src/, testes em tests/, HTML/manifest na raiz, bundles em dist/.
- Contratos 003 e fixture compartilhada já existem/travados; nunca editar.
- IDs T são únicos; checklists de release são gates adicionais. Não editar
  .data/localidades nem descartar alterações anteriores para facilitar execução.

## Fase 1 — US1 (P1): writer mensal e base independente

**Objetivo**: entregar gravação mensal segura, automática e isolada de localidades.

### Contrato da Fase

C1 caminho mensal/snapshot, C2 preservação em falha, C3 concorrência.
`node --test --test-name-pattern="C[123] " tests/contracts/003-exportacao-lote-municipios.test.cjs`.
Filtro somente para checkpoint; release roda todos os contratos sem filtro.

### Implementation

- [x] T001 [US1] Implementar getMunicipalityDestination e writeMunicipality em src/lote-export.js conforme contracts/lote.md e logic/lote.md, snapshot pré-await, overwrite sem diálogo → contratos C1/C2/C3. FR-001/002/005/006/007/012/013; SC-001/002.
- [x] T002 [US1] Criar src/lote-directory-store.js com handle em IDB idealista-municipios, sem modificar localidades-directory-store.js. FR-003/004/018; SC-004.

### Testes da Fase

- [x] T003 [US1] Criar tests/unit/lote-export.test.cjs para datas inválidas, nomes extremos, JSON inválido, erro diferente de NotFoundError, close pendente, abort falho e ausência de locks; testar API pública. FR-007/008/012/013.

**Critério de Conclusão**: comando acima → C1/C2/C3 verdes, trava003 íntegra;
testes T003 verdes, módulo independente sem Downloads/confirmação. O store será
exercitado com a UI na fase 2; não confundir este checkpoint com aceite da jornada.

**Registro da Fase**:
- Status: Concluída.
- Feito: T001/T002/T003; writer e store isolados.
- Contrato: node --test --test-name-pattern="C[123] " tests/contracts/003-exportacao-lote-municipios.test.cjs → 3/3; trava íntegra.
- Testes executados: node --test tests/unit/lote-export.test.cjs → 4/4.
- Pendências: T004 na fase2 para testar IDB com a UI.

## Fase 2 — US2 (P1): sessão durável, fila e recuperação

**Objetivo**: integrar a gravação sem consumir itens antes do arquivo e sem perder pendente ao trocar foco.

### Contrato da Fase

C4 retry sem recoleta/mês fixo; C5 close/commit, reentrada e falha de persistência.
`node --test tests/contracts/003-exportacao-lote-municipios.test.cjs`.

### Implementation

- [x] T005 [US2] Implementar createBatchSession em src/lote-session.js, advance/getState, snapshots, recibo de save, commit e fila por posição conforme logic/lote.md → contratos C4/C5. FR-002/008/009/010/011/013.
- [x] T006 [US2] Criar src/lote-collector.js a partir do caminho real de coleta em src/popup.js; aba própria, wait finito/cleanup, lote-input/lote-navigation existentes e mensagens do content bundle. Manter comportamento/configuração de proxy, não adicionar credenciais/logs. FR-018; US2-AC4.
- [x] T007 [US2] Criar lote.html e src/lote.js, adicionar entry lote em webpack.config.js e launcher em popup.html/src/popup.js; remover apenas orquestração antiga duplicada. Migrar colar lista, autoload com sourceTabId, status/log, pause/continuar e preferências aplicáveis do lote. Controle parcial indisponível explicitamente; não implementar bug antigo. FR-001/006/011/018; SC-001/004.
- [x] T008 [US2] Integrar picker/reautorização em src/lote.js diretamente nos cliques; destino/estado visíveis, cancelamento conserva pasta antiga, handle utilizável mesmo se IDB falhar. Ligar writer ao handle atual. FR-003/004/010/011; SC-003/004 → contrato C4.
- [x] T009 [US2] Implementar lock de dono idealista-municipios:batch, desabilitar mutações de outra tela, preservar lock em pause/pendente e liberar ao fim em src/lote.js. FR-009/013 → contrato C5 (reentrada local) e E2E duas telas (origem).
- [x] T010 [US2] Integrar commit aguardado de fila/status e botão tentar salvar em src/lote.js; interromper avanço em falha/vazio/permissão, sem download nem sucesso antecipado. Preservar registros originais restantes; aviso de fechamento; não prometer retomada após fechar página. FR-008/009/010/011/012 → contratos C4/C5; SC-003.

- [x] T022 [US2] Propagar falhas HTTP/rede/HTML sem listagem em src/content.js, rejeitar resultado parcial no coletor e testar preservação do arquivo em tests/e2e/lote.smoke.cjs. Decisão explícita do usuário para A001; FR-012.

### Testes da Fase

- [x] T004 [US2] Testar store separado/restauração e falha de persistência no harness tests/e2e/lote.smoke.cjs, sem tocar fixtures/travas 002. FR-004/018.
- [x] T011 [US2] Criar tests/unit/lote-session.test.cjs e tests/unit/lote-collector.test.cjs: fila vazia/duplicatas, snapshots defensivos, falha de coleta/save/commit, cleanup só aba própria e parser inválido sem efeitos. FR-009/010/012/018.
- [x] T012 [US2] Adaptar tests/unit/lote-popup.test.cjs para launcher durável, preservando regressões de URL/Texto e CTA por testes do coletor; manter tests/unit/lote-input.test.cjs e lote-navigation.test.cjs aplicáveis.
- [x] T013 [US2] Adaptar tests/e2e/lote.smoke.cjs à extensão real com OPFS/picker simulado: dois itens, overwrite menor, zero Downloads/diálogo, invalid input, foco, cancelamento, readwrite/reautorização, write/close/commit falhos e retry sem recoleta, mês fixo e duas telas sem mutação concorrente. Concluir T004. Reutilizar isolamento e anexação about:blank do E2E002; sem rede pública. FR-001–013/018; SC-001–004.

**Critério de Conclusão**: comando de contratos completo → 5/5 verdes e trava003
íntegra; unitários e E2E lote verdes; fila/arquivos preservados, nenhuma navegação
da própria UI e nenhuma alteração de autorização/confirmação de localidades.

**Registro da Fase**:
- Status: Concluída.
- Feito: Página durável, aba própria, locks, autorização e retry; A001 resolvido com propagação HTTP/rede/HTML inesperado.
- Contrato: node --test tests/contracts/003-exportacao-lote-municipios.test.cjs → 5/5; trava íntegra.
- Testes executados: node --test tests/contracts/003-exportacao-lote-municipios.test.cjs tests/unit/lote*.test.cjs → 26/26; npm.cmd run test:e2e:lote → 9 grupos de cenários verdes, zero Downloads/erros. Duas correções do harness (binding StorageArea e Date/structuredClone) antes da aprovação, sem flake aberto.
- Pendências: Gate nativo de pasta no Chrome em T021.

## Fase 3 — US3 (P2): qualidade e informações não coletadas

**Objetivo**: corrigir perdas comprovadas e tornar explícita a cobertura dos dados.

### Implementation

- [x] T014 [US3] Corrigir imagens em src/content.js: total do contador atual, fallback legado, nunca concatenar 1/ e 9 em 19; preservar null. FR-015/016/017; SC-006.
- [x] T015 [US3] Corrigir estacionamento em src/content.js: suporte a texto explícito de garagem/estacionamento em .item-detail e seletor anterior; preservar texto e null, sem inferir por silêncio. FR-016/017/020; SC-008.
- [x] T016 [US3] Revisar/completar listing-audit.md com inventário solicitado: 17 campos, dados em texto composto, fotos/URL, vídeo, terreno, elevador, data e atributos do anunciante; separar candidato novo de falha e dado só de detalhe. Registrar limite complementar de 20 cards e 403; não repetir acesso bloqueado ou alegar completude universal. FR-014/019; SC-005/007. Evidência inicial já existe; não inventar nova coleta.

### Testes da Fase

- [x] T017 [US3] Criar tests/unit/listing-fields.test.cjs exercitando extrairDaRaiz real (sem copiar lógica) com DOM/colaboradores adequados: fotos atual/legado/ausente/malformado, garagem atual/antiga/ausente e igualdade das demais 15 chaves. Usar Playwright já instalado quando DOM real for necessário, sem dependência nova. FR-015/016/017/020; SC-006/008.
- [x] T018 [US3] Em tests/e2e/lote.smoke.cjs, cobrir primeiro DOM e página seguinte HTML parseada pelo crawler, corrigindo imagens/estacionamento em ambos; exercitar também fluxo Itens em popup.html, respeitando seu download atual. Zero Downloads aplica-se somente ao lote. FR-014/017; SC-005/006/008.

**Critério de Conclusão**: T017/T018 verdes, inventário completo nos limites da
amostra; JSON mantém 17 chaves e só valores comprovados mudam. Nenhum contrato
P2 novo: cinco slots priorizam preservação P1; não relaxar contratos existentes.

**Registro da Fase**:
- Status: Concluída.
- Feito: Fotos atual/legado e estacionamento corrigidos; inventário preservado sem ampliar schema.
- Contrato: Sem contrato exclusivo P2; contratos003 mantidos e íntegros.
- Testes executados: node --test tests/unit/listing-fields.test.cjs → 2/2, antes RED com null em fotos/garagem; npm.cmd run test:e2e:lote → 11 grupos, incluindo Itens e página seguinte parseada. Zero Downloads do lote, um Download esperado de Itens, zero pageerrors.
- Pendências: Validação nativa de pasta no Chrome permanece T021.

## Fase 4 — Polish e release

**Objetivo**: reunir evidências e documentação sem inflar o aceite.

### Implementation

- [x] T019 Atualizar README.md com destino, autorização, overwrite automático, página durável, retry e limites de memória/crawler; atualizar .planning/memory/exportacao-lote-municipios.md e status SDD sem reescrever evidências antigas.

- [x] T023 Diagnóstico de Terceira no aceite: distinguir bloqueio, aguardar DOM, informar contexto e preservar/reutilizar aba própria em falha de resolução; regressão unitária/E2E em src/lote-navigation.js, src/lote-collector.js e tests/. Descoberta durante T021.

### Testes da Fase

- [x] T020 Rodar npm.cmd test, npm.cmd run build:prod, npm.cmd run test:e2e e npm.cmd run test:e2e:lote, e integridade das travas 001/002/003 conforme plan.md; revisar entradas/CSP/permissões sem acrescentar necessidade inexistente.
- [x] T021 Executar quickstart.md com pasta temporária real no Chrome; registrar separadamente carregamento, picker, permissão, retomada e inspeção real já feita. Se validação manual pendente, manter gate aberto explicitamente.

### Checklist de Release

- [x] Fase 1 concluída.
- [x] Fase 2 concluída.
- [x] Fase 3 concluída e inventário de campos ausentes documentado.
- [x] Todos os contratos verdes e check-contract-tests.ps1 íntegro para 001/002/003.
- [x] Testes e builds desenvolvimento/produção aplicáveis verdes; dist gerado.
- [x] E2E lote/localidades verdes, sem rede pública por padrão.
- [x] Extensão carregada no Chrome e pasta real/reautorização validadas; quickstart executado.
- [x] Dados/credenciais/alterações anteriores preservados; docs e evidências sincronizadas.

**Critério de Conclusão**: todos os gates acima satisfeitos; testes simulados
não equivalem a coleta/proxy real. Sem commit/push automático. Após execução,
usar sdd-converge para auditoria final.

**Registro da Fase**:
- Status: Concluída; aceite nativo confirmado pelo usuário.
- Feito: T019/T020/T021/T023; README, memória e evidências atualizados; gravação real, reabertura e reautorização confirmadas pelo usuário.
- Contrato: 5/5 na suíte completa; travas001/002/003 íntegras.
- Testes executados: npm.cmd test → 51/51 + build dev; npm.cmd run build:prod → PASS; E2E em produção → localidades8/lote13, zero pageerrors; travas001/002/003 novamente íntegras no fechamento. Prova nativa do usuário em validation/manual-chrome.md; histórico em validation/automated.md e validation/terceira-navigation.md.
- Pendências: Nenhuma task de execução. Auditoria sdd-converge é o próximo estágio. Manter limites: um item real não comprova catálogo inteiro nem proxy real.

## Dependencies & Execution Order

Fase1 → Fase2 → Fase3 → Fase4. T014/T015 podem ser feitos juntos na fase3
porque alteram o mesmo extrator. Sem delegação necessária. T004 pertence à fase2
porque depende da UI durável para verificar persistência de handles reais.

## Rastreabilidade

| Requisitos | Tasks |
| --- | --- |
| FR-001/002/005/006/007 | T001/T007/T013 |
| FR-003/004 | T002/T004/T008/T013 |
| FR-008/009/010/011 | T005/T008/T009/T010/T011/T013 |
| FR-012/013 | T001/T003/T005/T009/T010/T011/T013 |
| FR-014/019 | T016/T018 |
| FR-015/016/017/020 | T014/T015/T017/T018 |
| FR-018 | T002/T006/T007/T011/T020 |
| SC-001/002/003/004 | T001/T008/T010/T013/T021 |
| SC-005/007 | T016/T018 |
| SC-006/008 | T014/T015/T017/T018 |


## Phase 5: Convergence

**Objetivo**: restaurar o carregamento automático da página de origem preservado
pela T007, sem alterar o fluxo de gravação já aceito pelo usuário.

### Contrato da Fase

Nenhum contrato novo; os cinco contratos003 existentes continuam obrigatórios e
travados. Comando: `node --test tests/contracts/003-exportacao-lote-municipios.test.cjs`.

### Implementation

- [x] T024 [US2] Corrigir o carregamento automático em src/lote.js para suportar a estrutura anterior `.breadcrumb-dropdown-element.highlighted ul.breadcrumb-dropdown-subitem-list > li`, lendo contagem de `.breadcrumb-navigation-sidenote`, nome e URL dos itens; não limitar a coleta ao primeiro link de um contêiner. Preservar sourceTabId e validação da origem, ordenação por quantidade e fila anterior em caso vazio/erro. Origem: C001/HIGH, T007, FR-018, plan D-009. Não modificar módulos de exportação nem contratos travados.

### Testes da Fase

- [x] T025 [US2] Acrescentar regressão em tests/e2e/lote.smoke.cjs ou teste adicional equivalente que execute a função real do autoload e acione o botão na jornada com extensão: fixture com dois itens no breadcrumb anterior, nomes UTF-8, contagens distintas e URLs válidas. Verificar ambos os itens, ordem/quantidades, texto e chrome.storage.local, usando a aba de origem mesmo com a tela do lote ativa. Confirmar RED antes de T024 e GREEN depois; repetir contratos e testes/builds aplicáveis. Origem: C002/MEDIUM, T007/T013 e FR-018. Não usar fixture de classe alterada apenas para fazer o seletor atual passar.

**Critério de Conclusão**: regressão do breadcrumb verde e cenário E2E do botão
passando; `node --test tests/contracts/003-exportacao-lote-municipios.test.cjs`
→ 5/5 e trava íntegra; testes aplicáveis e builds dev/produção verdes. A prova
manual anterior de gravação/reabertura/reautorização permanece válida no escopo
em que foi relatada; esta fase não deve exigir sua repetição sem motivo novo.
Rodar sdd-converge novamente após executar T024/T025.

**Registro da Fase**:
- Status: Concluída.
- Feito: T024/T025; seletor anterior e contagem específica restaurados; C001/C002 tratados.
- Contrato: node --test tests/contracts/003-exportacao-lote-municipios.test.cjs → 5/5 já verdes antes da fase e mantidos; travas001/002/003 íntegras.
- Testes executados: E2E RED antes da correção (lista vazia); após a correção, ajuste da asserção do teste novo para comparar JSON semanticamente, sem exigir ordem de chaves do transporte Chrome. Jornada dev GREEN. npm.cmd test → 51/51; npm.cmd run build:prod → PASS; node tests/e2e/lote.smoke.cjs em produção → 14 grupos; localidades.smoke.cjs → 8 grupos; zero pageerrors e zero Downloads do lote.
- Pendências: Nenhuma task de execução; repetir sdd-converge. Aceite manual anterior preservado. Ver validation/autoload-convergence.md.

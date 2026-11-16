# Implementation Plan: Coleta em um clique com acompanhamento e recuperação por localidade

**Slug**: 005-experiencia-coleta-autonoma | **Date**: 2026-11-14 | **Spec**: .sdd/specs/005-experiencia-coleta-autonoma/spec.md

## Summary

Painel lateral nativo com acompanhamento e tela dedicada de Configurações. Executor desacoplado em aba técnica inativa mantém a coleta com o painel fechado, usando o transporte/coordenador existente. Uma sessão v2 preserva estados e checkpoints de todas as localidades, sem reiniciar orçamento por item; falhas comprovadamente locais são puladas e recuperáveis. Configuração privada e política passam a commit conjunto, mantendo handles e writers002/003.

Quatro stories P1; seis fases: fundação → início US1 → recuperação US3 → acompanhamento US2 → configurações US4 → Polish. Planejamento inclui apenas três stubs não conectados ao bundle, cinco contratos e documentos. Não implementa produto nem altera dependências.

## Technical Context

**Language/Version**: JavaScript CommonJS/browser MV3; Node22.16.0/npm10.9.2 verificados, engines>=22.16.0.
**Primary Dependencies**: Webpack5.112.2/webpack-cli7.3.1/Playwright1.65.0 já travados; Chrome tabs/runtime/storage/proxy/webRequest/scripting, IndexedDB, Web Locks, File System Access; nova API sidePanel, sem framework/biblioteca.
**Storage**: idealista-coleta-v1/records; esquema de sessão v2 opt-in, sem alterar versão do DB; config:005 privado+policy transacionais. Handles nos bancos originais; browserRunId em storage.session, preferências visuais não autoritativas em storage.local.
**Testing**: node:test/assert e fixtures de colaboradores; Playwright em perfis temporários sem rede externa. Não há lint/tsc configurados; não inventar gates desses comandos.
**Target Platform**: Chrome desktop MV3>=141, necessário ao fechamento programático do painel. Chrome instalado/nativo é gate separado.
**Performance Goals**: ACK visual<=1s, progresso<=2s com navegador responsivo;308 localidades consultáveis; resumo sem dataset; atualização incremental e poll1s somente visível.
**Constraints**: CSP sem script inline/eval/CDN novo; adicionar somente sidePanel; nenhuma execução no boot/restauração do navegador; uma autoridade de domínio, sem perda de dados/credenciais/alterações locais.
**Scale/Scope**:4P1,42FR,20SC; manter50MiB/sessão,100MiB agregado,100mil registros,1MiB metadata,10 sessões e validade7dias004. Esses limites podem pausar uma fila nacional; não prometer que um clique elimina limites já escolhidos.

### Context Synthesis

- coleta-runner.js mantém laço na página de controle; transferir o caminho autônomo para runner.html sem mudar semântica v1.
- coleta-background.js exige sender.tab para START e calcula owner por aba; sidepanel não é owner. Adaptador autenticado encaminha comandos ao runner real.
- coleta-coordinator.js mantém checkpoint atual/archived, itemIndex crescente e receipts; precisa de branch v2 e promoção manual v1, não uma sessão por item.
- lote.js projeta sucesso por índice; novo caminho deve projetar por estado real e separar fila/importação legada.
- loteAutoLoad descarta links sem contagem; novo extrator inclui destinos válidos com quantidade desconhecida e congela documento de origem.
- writers e bancos de handles já funcionam; manter APIs, nomes, mês e confirmação após close. Nenhuma pasta real será escrita pelo planejamento.
- .sdd/adr não existe. Constitution1.0.0 é a autoridade. Checkout contém numerosas alterações pré-existentes da004: não limpar, restaurar, commitar ou trocar branch neste estágio documental.

## Decisões Invariantes

- **D-001**: Painel global nativo sidePanel; abrir pelo gesto da action, remover default_popup da entrada principal somente na execução. Nova permissão sidePanel e mínimo141 são necessários; sem offscreen/alarms/notifications.
- **D-002**: Runner é aba técnica própria active:false e autoDiscardable:false, separada da origem e da aba própria de conteúdo. Painel não controla lifetime. Fechar runner/executor causa interrupção preservada, nunca encerramento de aba do usuário por ID sem prova.
- **D-003**: Autoridade continua no store/coordenador004. Sessão v2 opt-in por execução completa; custos, limites, domínio e proxy não reiniciam ao trocar item/seleção. Sem segunda implementação paralela de políticas.
- **D-004**: commandId idempotente e reserva durável de lançamento antes de descoberta/runner. Owner/runId/document/token/epoch cercam callbacks antigos. Restauro do Chrome/READ/LIST não autoriza drive.
- **D-005**: Descoberta só do DOM atual do breadcrumb direto; validar documento antes/depois. Quantidade desconhecida não exclui localidade. URL sem fragmento é deduplicação, nome não é identidade.
- **D-006**: Por item, preservar manifest/intent/receipt e índice original. Troca/seleção/receipt só em transação; resumo por estados exclusivos e progress=(saved+empty)/total.
- **D-007**: Allowlist local e precedência global estão em logic/execucao-e-recuperacao.md; desconhecido pausa.429/challenge continuam exigindo ação manual mesmo após prazo.
- **D-008**: Reter domain.active enquanto005 grava, inclusive intervalo coleta→receipt. Save ambíguo reconcilia antes de repetir; vazio válido é empty sem arquivo/receipt; mês original sempre fixo.
- **D-009**: Writers/schema/nomes002/003 inalterados. Destino vinculado à execução; colisão exata entre itens da mesma execução preserva pending e pede outra pasta explicitamente para aquele resultado.
- **D-010**: Configuração privada config:005 e policy no mesmo commit, CAS revisão e domain.active. Handles ficam nos bancos existentes; gesto nativo na UI. Senha omitida conserva valor e nunca sai em load público/diagnóstico.
- **D-011**: Centralizar adapters legados de config/proxy/policy, mantendo comportamento anterior se config:005 ainda não existir. Não permitir que formulário legado burle bloqueio de atividade.
- **D-012**: DOM/CSS local, render incremental por itemId, filtros sem alterar fila, contexto de leitura preservado, foco previsível e detalhes sob demanda. Não usar innerHTML de anúncios/mensagens.
- **D-013**: Os três stubs novos do planejamento são coleta-autonoma.js, coleta-view-model.js e coleta-settings.js; não conectá-los ao bundle antes da execução. Contratos005 e fixtures listadas na trava são imutáveis; travas001–004 preservadas.
- **D-014**: Aprovação exige quatroP1; independência de teste não remove funcionalidades do aceite final. Níveis unitário/contrato/E2E/Chrome nativo/leitor de tela/site/proxy real são distintos.

## Constitution Check

| Princípio | Pré-Design | Pós-Design | Notas |
| --- | --- | --- | --- |
| I. Escopo explícito | PASS | PASS | QuatroP1 e decisões confirmadas preservados; sem recursão nacional ou novo backend/provedor |
| II. Fontes e saídas separadas | PASS | PASS | Fontes src, testes tests, HTML/manifest raiz, dist gerado; nenhuma dependência nova |
| III. Compatibilidade | PASS | PASS | MV3/CSP; sidePanel justificado pelo painel escolhido, mínimo141 documentado; hosts existentes |
| IV. Preservação | PASS | PASS | Branch/código anterior mantidos, registros v1/handles/writers preservados; config privada separada de logs |
| V. Qualidade com evidências | PASS | PASS | CincoRED funcionais,117 testes anteriores verdes, buildsdev/prod; novos gates nativos documentados |

## Project Structure

### Documentation (this feature)

~~~text
.sdd/specs/005-experiencia-coleta-autonoma/
  spec.md plan.md tasks.md handoff.md research.md data-model.md quickstart.md
  contracts/autonoma.md
  logic/execucao-e-recuperacao.md
  logic/interface-e-configuracoes.md
  contract-tests.lock
  validation/contracts-red.log build-dev.log build-prod.log planning-baseline.json planning-suite.log
~~~

### Source Code (repository root)

Estrutura relevante verificada; a árvore inclui os novos stubs/contratos desta etapa, não componentes futuros ficticiamente existentes.

~~~text
src/
  background.js content.js popup.js popup-ui.js linkExtractor.js
  localidades.js localidades-collector.js localidades-export.js localidades-directory-store.js
  lote.js lote-input.js lote-navigation.js lote-session.js lote-collector.js lote-export.js lote-directory-store.js
  itens.js coleta-background.js coleta-coordinator.js coleta-protocol.js
  coleta-store.js coleta-policy.js coleta-classification.js coleta-runner.js coleta-page.js
  coleta-ui.js coleta-digest.js coleta-save-failure.js coleta-proxy.js coleta-ip.js coleta-download.js
  coleta-autonoma.js coleta-view-model.js coleta-settings.js       # stubs novos
tests/
  contracts/001-*.test.cjs 002-*.test.cjs 003-*.test.cjs 004-*.test.cjs
  contracts/005-experiencia-coleta-autonoma.test.cjs                # novo
  fixtures/coleta-store.cjs localidades-filesystem.cjs coleta-runtime.cjs coleta-browser.cjs
  fixtures/autonoma.cjs                                          # novo, travado
  unit/*.test.cjs
  e2e/localidades.smoke.cjs lote.smoke.cjs proxy.smoke.cjs coleta.smoke.cjs
  e2e/coleta-store.smoke.cjs coleta.native.cjs
manifest.json popup.html localidades.html lote.html itens.html
webpack.config.js package.json package-lock.json README.md
dist/                                                           # gerado/ignorado
~~~

**Structure Decision**: preservar estrutura plana. Execute criará runner.html/sidepanel.html/configuracoes.html na raiz e src/runner.js, sidepanel.js, configuracoes.js, coleta-autonoma-background.js, coleta-discovery.js, coleta-settings-repository.js e coleta.css. Entradas Webpack adicionais runner/sidepanel/configuracoes; CSS emitido como asset local sem dependência nova. Novos testes fora dos contratos são enumerados em tasks.md.

## Complexity Tracking

Nenhuma violação da constitution; sem exceção. Aba técnica, branch de schema e adaptação de configurações são necessidades das garantias de lifetime, retomada aleatória e consistência. Alternativas rejeitadas e limites em research.md.

| Violação | Por que é necessária | Alternativa mais simples rejeitada porque |
| --- | --- | --- |

## Estratégia de Testes

Prioridade: unitário → contrato/integração → E2E → manual. Nunca editar contratos para acomodar implementação. Contratos usam API pública e colaboradores injetados; comprovam lógica, não o painel nativo ou a integração Chrome. O orçamento5 já está completo, uma storyP1 por contrato e um caso global de bloqueio.

Comandos existentes e gate de execução:
~~~powershell
npm.cmd test
npm.cmd run build:prod
node --test
node --test tests/contracts/005-experiencia-coleta-autonoma.test.cjs
.\.planning\scripts\powershell\check-contract-tests.ps1 -Slug 005-experiencia-coleta-autonoma
node tests/e2e/localidades.smoke.cjs
node tests/e2e/lote.smoke.cjs
node tests/e2e/proxy.smoke.cjs
node tests/e2e/coleta-store.smoke.cjs
node tests/e2e/coleta.smoke.cjs
~~~
Novos smokes a criar emT039/T040: node tests/e2e/autonoma.smoke.cjs e node tests/e2e/autonoma-ui.smoke.cjs. Executar em development e production. npm ci somente se for necessário recompor dependências; lockfile não muda por esta feature.

### Testes de Contrato

Arquivo tests/contracts/005-experiencia-coleta-autonoma.test.cjs (5casos). Fixtures imutáveis: tests/fixtures/autonoma.cjs, coleta-store.cjs e localidades-filesystem.cjs. Estas duas últimas são reutilizadas sem alteração, também protegidas pelas travas anteriores quando aplicável.

| Teste (prefixo estável) | Origem | Fase | Vermelho confirmado |
| --- | --- | --- | --- |
| C1 um comando fixa origem, deduplica e coleta a fila | US1/AC1/2/5/6;FR001–006/024 | 2 | Error: not implemented |
| C2 observação descartável não controla execução e resumo separa pendências | US2/AC1/4;FR008/009/012/014/033/036 | 4 | Error: not implemented |
| C3 falhas locais e retomadas individual/em grupo preservam checkpoints | US3/AC1/2/3/7;FR016/020/021/029 | 3 | Error: not implemented |
| C4 configurações reutilizam valores e não expõem segredo | US4/AC2/3/4;FR026/027/032/039 | 5 | Error: not implemented |
| C5 429 e desafio pausam todo domínio | US1/US3;FR017/024/029;ConstitutionIV | 3 | Error: not implemented |

C3 também exige writer003 real com MemoryDirectory e confirma B-Paginas2.json no mês original. Recuperação exclusivamente de gravação permanece teste adicional obrigatório, pois o nome do contrato não substitui uma asserção não presente.

Comando real executado: node --test --test-reporter=tap tests/contracts/005-experiencia-coleta-autonoma.test.cjs →0pass/5fail, todas error:not implemented, zero cancelados/skip/todo. Imports e sintaxe válidos. Evidência validation/contracts-red.log.

Suíte prévia executada sem005:
~~~powershell
$tests005 = @(Get-ChildItem tests/unit -Filter '*.test.cjs' | ForEach-Object FullName)
$tests005 += @(Get-ChildItem tests/contracts -Filter '*.test.cjs' | Where-Object Name -notlike '005-*' | ForEach-Object FullName)
node --test @tests005
~~~
Resultado117/117,0falhas. Builddev e prod passaram; stubs não fazem parte das entradas. Planejamento deixa a suíte completa intencionalmente vermelha pelos cinco novos contratos. Não reportar feature implementada. Último bundle de validação production; fontes produtivas não foram alteradas.

Trava005: check-contract-tests.ps1 -Write -Paths com os quatro arquivos acima,5/5 casos. Travas001/002/003/004 devem continuar íntegras. Baseline SHA dos arquivos anteriores, status e evidências em validation/. E2E e nativo não foram executados no planejamento porque o produto005 ainda é stub.

## Estado Atual

| Área | Estado |
| --- | --- |
| Execução | Em Execução;58/64 checkboxes; T052 parcial, fases1–5 concluídas e fase6 parcial |
| Implementação | T052 removeu localidades.html do início:runner técnico dedicado abre Idealista ativo; painel e entrada antiga iniciam captura, exportação é botão separado. Resultado/checkpoint preservados; leituras antigas não sobrescrevem estado e abas persistem imediatamente. |
| Validação |218/218 Node dev/prod; transição403→200 coleta84 links no Chrome controlado, bloqueio persistente/429 mantidos. Quatro jornadas Links e motores legado/autônomo verdes nos dois builds. MCP: página real HTTP200/84 links, sem prova do clique instalado. Travas001–005 íntegras; proxy407/403 e R-013/R-019/R-020 permanecem pendentes. Build final production. |
| Próximo | T052: validar clique no painel instalado; esclarecer407/403. Extração real isolada comprovada em links-mcp-live.md. T044/T045/R-013/R-019/R-020 continuam abertos. |

## Riscos e Decisões

<!--
  IDs estáveis (R-001, R-002...), nunca deletados. Item resolvido ganha
  prefixo "Resolvido:" na célula de Mitigação em vez de sumir da tabela.
-->

| ID | Risco/Decisão | Impacto | Mitigação/Encaminhamento |
| --- | --- | --- | --- |
| R-001 | Lifetime do runner/worker e restauração de abas | Duplicidade ou retomada não autorizada | Binding com runId/document/token, sem drive no boot; testar fechamento/restart e aba reciclada |
| R-002 | Sessão v2 e promoção manual de v1 | Perda de checkpoints/consumo | Adapter aditivo, commit atômico, fixtures anteriores travadas e testes de rollback |
| R-003 | Configuração dividida entre policy e storage.local | Preferências inconsistentes ou credencial exposta | Registro privado config:005+policy atômico e adaptadores comuns; view sanitizada |
| R-004 | FSA e permissão com painel nativo | Coleta sem destino ou falso aceite | Picker em gesto na UI, query no runner; gate nativo novo, sem reutilizar aceite002/003 |
| R-005 | Falha local confundida com bloqueio geral | Insistência indevida ou interrupção excessiva | Allowlist404/410 sem sinais globais; desconhecido pausa; C5 e unitários |
| R-006 | Homônimos/caminho colidente na mesma execução | Sobrescrita de resultado de outro item | Pending stage=save, resolver destino por item explicitamente sem mudar nomes/schema |
| R-007 | Nova permissão e mínimoChrome141 | Instalações incompatíveis | Justificativa sidePanel/close; Chrome instalado, manifesto/CSP e legado como gates |
| R-008 | Orçamento de apenas5contratos não certifica UI | Aprovação excessiva baseada só em funções | DOM/E2E complementares e gates nativos/acessibilidade separados no quickstart |
| R-009 | Contrato001 exigia default_popup e permissões exatas sem sidePanel, em conflito com D-001/T024 | Fase4 bloqueada até emenda autorizada | Resolvido: usuário aprovou explicitamente a emenda mínima e continuidade; contrato001 aceita entrada lateral, mantém validações/popup legado e permite somente sidePanel adicional.2/2 verdes; trava001 regravada. Demais contratos intactos. |
| R-010 | IDs novos não comprovam pasta física diferente | Homônimos poderiam sobrescrever resultado de outro item | Resolvido: isSameEntry antes de reconciliar/gravar e na escolha; receipt guarda chave de handle imutável; staging publicado por CAS ocioso. |
| R-011 | Recuperação impossível ou nova captura explícita | Beco após descoberta vazia/incompatível | Resolvido: preparação sem rede para fila vazia; preparar lote individual confirmado, início separado e checkpoint anterior preservado. T047 sem alterar contratos. |
| R-012 | Estado terminal antes de encerrar runner | Retomar imediatamente retornava busy apesar da UI pausada | Resolvido: runnerLive mantém Pausando até FINISHED; recuperação de dono morto limpa sinal; runtime/E2E production RED/GREEN. |
| R-013 | Primeiro coleta.smoke dev expirou aguardando download após restart | Estabilidade do smoke antigo sem causa demonstrada | Aberto: diagnóstico adicional sem afrouxar assert/timeout; repetições e rodadas finais dev/prod verdes. Gate de smokes segue aberto, ver final-evidence.md. |
| R-014 | Proxy salvo confundido com aplicado; conexão direta mantinha PAC anterior | Teste de IP continuava direto após salvar, ou nova coleta direta usava proxy antigo | Resolvido em T048: Aplicar conexão salva explícito com revisão/bloqueio de atividade; status salvo/ativo separados; direto remove só PAC próprio e recusa controle externo. Salvar e TEST_IP preservam semântica anterior. Prova real limitada a api.ipify.org, sem Idealista. |
| R-015 | Resultado global de Configurações fica fora do viewport; aplicar não confirma a rede | Usuário não vê resposta ao clicar e pode confundir PAC aplicado com autenticação funcionando | Resolvido em T049: resultado local persistente, progresso imediato e Salvar e testar conexão explícito; sucesso somente após IP verificado/estado consistente. Rascunho editado não recebe confirmação da conexão antiga. Teste real do novo botão e regressão de viewport. |
| R-016 | Usuário pede persistir senha e olho para conferir a credencial salva | Campo vazio parecia senha perdida; revelar por leitura comum exporia segredo desnecessariamente | Resolvido em T050: persistência existente preservada, máscara fixa/aviso Senha salva e olho. Comando explícito restrito a Configurações principal e revisão atual; GET_SETTINGS/status continuam sanitizados. Revelar não suja draft; ocultar remove valor salvo do campo, edição manual permanece. Pedido do usuário autoriza apenas essa revelação explícita. |
| R-017 | Navegação anterior por abas escondida e resumo empurra fila para baixo | Usuário perde acesso familiar e visibilidade dos municípios em processamento | Resolvido em T051: usuário pediu abas anteriores e confirmou acompanhamento dos municípios. Links/Itens/Lote visíveis, Configurações dedicada, resumo compacto e item atual destacado; mesma execução segue ao alternar. Não reintroduzir configuração misturada nem criar motor paralelo. Espera normal não exibe alerta de intervenção; terminal não sugere retomada por intervalo residual. |
| R-018 | Links era somente launcher de exportação; teste aceitava tela aberta como sucesso | Clique não coletava localidades e usuário via configuração em vez do site | Correção de fluxo aplicada em T052 e jornada completa local passou; aceite real parcial:Chrome/coletor407, Chrome simples403 e curl CONNECT200/HTTP403. Proxy em ipify continua HTTP200/IP alterado. Não atribuir407/403 a senha sem prova nem afirmar coleta real aceita; divergência e acesso seguem abertos em links-flow-fix.md. |
| R-019 | coleta.smoke dev falhou no início da variante initial-403, antes da primeira requisição | Sessão running com requested=confirmed=0 e mensagem genérica do protocolo v1 | Diagnóstico isolado e produção instrumentada passaram; causa não demonstrada. Não confundir com R-013 nem fechar por retry. Ver links-start-fix.md. |
| R-020 | autonoma.smoke:0 em vez de2 salvos após stopWorker na variante local, intermitente | Reinício durante preparação ainda não está aceito irrestritamente | Regressão independente de pendingUrl corrigida, sem eliminar todas as falhas observadas. Diagnóstico sanitizado adicionado; rodada finalprod passou. Manter aberto, ver links-direct-navigation.md. |

## Execution Notes

<!--
  Tabela append-only, mantida pelo sdd-execute. Quando passar de ~40 linhas,
  arquivar as mais antigas (exceto as ~10 mais recentes) em history.md,
  substituindo por uma linha de resumo consolidado aqui.
-->

| Data | Fase/Story | Resumo | Pendência Principal |
| --- | --- | --- | --- |

| 2026-11-14 | Fase 1 | Sessões v2, reservas e promoção manual preservando v1; vínculos de pasta por execução. | Fase2: descoberta e início autônomo. |

| 2026-11-14 | Fase 2 | Início integrado ao navegador, runner em segundo plano e descoberta direta compartilhada. | Fase3: recuperação e gravação por item. |

| 2026-11-14 | Fase 3 | Retomada por item e grupo, save-only, falhas locais, bloqueios globais e resumo por estado real. | Fase4: painel lateral, progresso e acessibilidade. |

| 2026-11-14 | Fase4/T024 | Build aprovado; painel parcial e view/proxy11/11. Contrato001 falha2/2 por popup obrigatório; exige também permissões anteriores. Travas001/005 íntegras. | Gate5b: decisão sobre emenda do contrato001. |

| 2026-11-14 | Emenda R-009 | Aprovação explícita recebida; contrato001 emendado e trava atualizada,2/2 verdes. | Concluir fase4 e seguir configurações. |

| 2026-11-14 | Fase 4 | Painel lateral incremental, busca/filtros/historico, contexto e foco preservados; observacao passiva e runner recarregado inerte. | Fase5: configuracoes dedicadas e adaptadores legados. |

| 2026-11-14 | Fase 5 | Configuracoes dedicadas com draft, senha privada, CAS atomico, destinos explicitos e adaptadores legados comuns. | Fase6: integracao E2E, revisao, gates nativos e documentacao. |

| 2026-11-14 | Fase6 parcial |181 testes/5 contratos e7 smokes finais verdes nos dois builds; revisão corrigiu4 Important; painel real Chrome157 aprovado. Emenda001 aprovada, demais travas preservadas. | T044/T045 humanos e R-013 estabilidade de download antigo. |

| 2026-11-14 | Ad-hoc T048/US4 | Relato do proxy reproduzido e corrigido; aplicar salvo separado de salvar/testar.185/185 dev/prod e4 smokes afetados verdes em ambos. Chrome157 real autenticou proxy do .env e restaurou conexão direta; nenhum segredo/IP nos artefatos. | Gates T044/T045 e R-013 permanecem abertos. |

| 2026-11-14 | Ad-hoc T049/US4 | Resultado estava y=-993 fora da tela; novo fluxo salvar/aplicar/testar em um clique com feedback local e trava durante espera.185/185 Node e3 smokes afetados dev/prod verdes. Chrome157 real confirmou botão, mudança de IP, resultado visível e retorno ao sistema. | T044/T045 e R-013 seguem abertos; ver proxy-feedback.md. |

| 2026-11-14 | T050/US4 | Pedido de olho/senha salva: máscara e aviso persistidos, revelação explícita com revisão/remetente restritos.187/187 e password/feedback/autonoma-ui verdes dev/prod. | Gates T044/T045/R-013 anteriores; evidência proxy-password.md. |

| 2026-11-14 | T051/US2 | Abas Links/Itens/Lote recuperadas e fila visível com atual destacado, posição/páginas/anúncios/resultados.189/189 e tabs/UI/core verdes dev/prod;2 regressões de espera/terminal corrigidas. | T044/T045 e R-013 anteriores; validação detalhada em tabs-review.md. |

| 2026-11-14 | T052 parcial | Clique Links passou de launcher a navegação/captura real pelo motor004.194/194 e jornada local captura/exportação/reload/anti-replay aprovados dev/prod; defaults legados preservados. Utilitário de navegação também recusa complete antigo/pendingUrl, com2 regressões. | Captura real bloqueada407/403 e divergência ainda não explicada; não marcar T052 concluída. |

| 2026-11-14 | T052 diagnóstico | Mensagem exata reproduzida após403/segundo clique; manter sessão pendente, razões/etapas/prazos sanitizados, HTTP e detalhes para retomada manual. Erro legado recuperável e conexão do Chrome distinguida.200/200 dev/prod e jornadas Links/tabs verdes. | Captura real/R-018 e gates anteriores abertos; R-019 novo em teste legado dev, ainda sem causa. Ver links-start-fix.md. |

| 2026-11-15 | T052 navegação direta | Screenshot revelou localidades.html indevidamente usada como executor e entrada antiga abrindo exportação. Runner dedicado, Idealista ativo e exportação separada, com jornadas de ambas entradas.208/208 dev/prod. Corridas UI e runner pendingUrl reproduzidas/corrigidas em unidades. | R-020 worker-stop intermitente permanece aberta, mesmo com rodada finalprod verde; captura real e demais gates mantidos. |

| 2026-11-15 | T052 bloqueio herdado e MCP | Bloqueio de Lote antes de existir sessão de Links deixava a UI sem recuperação; nova confirmação manual respeita espera/relógio/orçamento e preserva sessões.212/212 dev/prod e smoke de recuperação nos dois builds. MCP Playwright abriu página real HTTP200 e extraiu84/84 links usando função do projeto; handler também retornou84, com validação do coordenador simulada. | MCP recusou chrome-extension com Not allowed; clique instalado e diagnóstico407/403 não comprovados. Ver validation/links-mcp-live.md;58/64, sem novos gates concluídos. |

**PRÓXIMO**: Esclarecer R-018/T052 e validar clique no painel instalado; extração isolada no DOM real já comprovada. Validar T044/T045 e investigar R-013/R-019/R-020. Manter Em Execução.

Screenshot posterior: o aviso de recuperação passou a identificar bloqueio de tentativa anterior e orientar o botão/confirmar. Smoke de bloqueio herdado agora testa também sucesso após confirmação com prazo elegível preparado somente na fixture de perfil temporário; motor e painel exibem84 links a partir do HTML público capturado.212/212 e smoke completo dev/prod; sem alterar waits/dados do perfil pessoal. Ver adendo em validation/links-mcp-live.md. Status/gates inalterados.

Relato posterior confirmou403 inicial seguido de página normal. Causa reproduzida: primeiro requestId/documentId eram fixados e o executor terminava antes da transição. Observação passiva limitada a10s usa documento final comprovado, sem reload/fetch/navegação adicional pelo app;403 persistente e429 continuam pausando. Também corrigido runner pendingUrl confundido com fechado.218/218 e smokes Links/legado/autônomo dev/prod. Ver validation/links-transition-fix.md. Sem desbloquear execuções anteriores/perfil pessoal nem fechar R-018 por inferência.

## Arquivos Principais

- src/links-collection.js, src/localidades.js, coleta-autonoma-background.js e coleta-runner.js: lançamento/claim, captura sem exportar, navegação/anti-replay.
- sidepanel.html/src/sidepanel.js/coleta.css: clique e resultados reais de Links; tests/e2e/links-one-click.smoke.cjs e unit/links-collection/coleta-navigation.
- validation/links-flow-fix.md e links-*.json/log/PNG: prova local e falhas reais separadas. Gates anteriores preservados.

## Cuidados para Retomada

<!-- Armadilhas operacionais específicas desta feature, anexadas conforme descobertas. -->

- Emenda001 já aprovada/aplicada; não regravar outras travas. Trava íntegra confirma imutabilidade, não passagem dos testes. Preservar checkout anterior, dados e perfis reais.
- Binding de pasta é referência imutável por CAS; token não identifica pasta física. Manter isSameEntry e receipt.directoryKey também antes de reconciliar.
- runnerLive controla Pausando até FINISHED; documentId/token anteriores são limpos no bindOwner. Catch de descoberta usa epoch atual, nunca fixar1.
- .env não integra o bundle/configuração da extensão. Diagnósticos reais são opt-in --real, perfis temporários e somente api.ipify.org. Não imprimir valores/credenciais/IPs, nem copiar segredos para artefatos. Aplicar conexão salva recebe revisão, nunca credenciais na resposta; não enfileirar novamente dentro da operação já serializada.

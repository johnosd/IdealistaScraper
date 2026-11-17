# Implementation Plan: Coleta resiliente com controle de ritmo e retomada persistente

**Slug**: `004-coleta-resiliente` | **Date**: 2026-11-14 | **Spec**: `.sdd/specs/004-coleta-resiliente/spec.md`

## Summary

Coordenador transacional local compartilha ritmo/orçamento/ownership entre Links, Itens e Lote. UI durável orquestra uma página por vez, persiste checkpoint antes da próxima e recupera manualmente após restart. Classificação comum pausa diante de limites/desafios e usa retries finitos para falhas transitórias. Proxy fica estável, IP é diagnóstico limitado e exportação mantém contratos002/003.

Nove fases originais e Phase10 de convergência concluídas:45tasks e13gates de release aprovados. O stub inicial foi implementado e integrado às três telas. Phase10 completa feedback de conflito, métricas e diagnóstico durável de gravação; evidências atuais em validation/convergence-execute-summary.md e histórico original em validation/execute-summary.md.

## Technical Context

**Language/Version**: JavaScript CommonJS/browser Chrome MV3; Node22.16.0 e npm10.9.2 observados, engines>=22.16.0.
**Primary Dependencies**: Chrome tabs/runtime/storage/proxy/webRequest/webRequestAuthProvider/scripting existentes; IndexedDB, File System Access e Web Locks; Webpack5.112.2, webpack-cli7.3.1, Playwright1.65.0 do lockfile. Sem biblioteca/servidor/permissão nova.
**Storage**: novo IndexedDB idealista-coleta-v1 para transações e deltas de páginas; storage.session só browserRunId; chrome.storage.local preservado para campos legados/proxy e projeções da fila. Handles continuam nos bancos existentes.
**Testing**: node:test/assert/VM e fixtures injetadas; fakes filesystem existentes; novo fake transacional travado; Playwright E2E opt-in em perfil temporário com rede externa bloqueada. Sem lint/typecheck configurado.
**Target Platform**: Chrome MV3 desktop com APIs já usadas. Manter CSP e empacotamento; novo entry itens será criado na execução. Suporte mínimo numérico não inventado: verificar APIs disponíveis no gate do navegador.
**Performance Goals**:50MiB/sessão e100MiB agregados;100mil registros/sessão; não reescrever dataset a cada reserva. Nenhuma espera longa dentro de transação ou dependência de lifetime do worker. Mensagens normais da UI usam resumo, não dataset inteiro.
**Constraints**: uma execução própria por grupo idealista.pt, estado persistente, parada manual por bloqueio, destino/schema/month inalterados, sem provedor pago/rede real nesta etapa. Registro síncrono de listeners, DB lazy.
**Scale/Scope**:7 stories/33FR/13SC. Valores/faixas completos em logic/coordenacao-e-ritmo.md; padrão10s/60solicitações por hora/200por sessão/100páginas por item/3tentativas/30srequest/6h sessão. Perfil é escolha operacional, não aceitação do site.

## Decisões Invariantes

- **D-001**: Estado autoritativo em IndexedDB, commit atômico de domínio/sessão/página; fake emula somente storage. Globais/timers/storage.session não são progresso.
- **D-002**: Coordenação pública e assinaturas no contracts/coleta-runtime.md; rede fora do núcleo. Permit one-shot antes do envio, custo não devolvido após incerteza. Idempotência não reautoriza dispatch.
- **D-003**: Todos subdomínios autorizados compartilham domínio idealista.pt. Reservas contam navegações/CTA/fetch emitidos pela extensão, incluindo falhas/retries; sub-recursos/redirects automáticos e IP são separados. Não prometer bloqueá-los.
- **D-004**: Uma página por comando; runner em página durável. Novo itens.html substitui dependência do popup para execução, sem redesign geral; Links/Lote mantêm superfícies existentes.
- **D-005**: Waiting de intervalo pode avançar numa execução consentida ativa; paused por429/budget/bloqueio/erro final exige ação. Read/list/recover/startup não coletam.
- **D-006**: Ownership/epoch persiste; lease expirada não permite takeover. Confirmar executor encerrado/abortado antes; sender real e browserRunId cercam mensagens antigas.
- **D-007**: Checkpoint válido por página/etapa com delta/hash. Quota preserva anterior e impede nova página. Mês original e resultados awaiting-save recuperáveis sem rede; nenhum dado apagado por retenção implícita.
- **D-008**: Proxy revision opaca não contém senha/hash de senha. Check antes de dispatch; snapshot/auth do bug anterior preservados. Sem reconexão por contagem, testeIP não muda proxy em sessão ativa.
- **D-009**: Classificação/retry/prioridades/prazos em logic/respostas-proxy-e-gravacao.md. 403/challenge:30min+confirmação manual;429 Retry-After não truncado, fallback15min; transient:3tentativas30/60s. Não rotação/bypass.
- **D-010**: Manter writers002/003 e suas assinaturas; wrappers duráveis usam intent/receipt. Crash ambíguo de filesystem compara digest; Downloads Itens exige decisão humana, sem permissão extra/exactly-once fictício.
- **D-011**: Capacidade/retencão e elegibilidade7dias em data-model.md; acima disso não apagar resultados. Logs por allowlist, sem query/HTML/segredos. Dados de anúncios preservam schema.
- **D-012**: Só src/coleta-coordinator.js é stub do plan, não importado em bundle. Contratos004+fixture ficam imutáveis na execução; travas001/002/003 também. Tests unit/E2E não travados podem adaptar UI com rastreabilidade, sem enfraquecimento.

## Constitution Check

| Princípio real | Pré-Design | Pós-Design | Notas |
| --- | --- | --- | --- |
| I. Escopo explícito | PASS | PASS | Sete itens aprovados; sem provedor/rotação/CAPTCHA/redesign; decisões técnicas locais, sem ADR existente a contrariar. |
| II. Fontes e saídas separadas | PASS | PASS | src/tests/dist e lockfile mantidos; build gera bundles; docs em004. |
| III. Compatibilidade | PASS | PASS | MV3/CSP e permissões existentes; sem blocking/DNR/offscreen/alarms/unlimitedStorage. |
| IV. Preservação | PASS | PASS | Novo DB, dados/handles/legados preservados; baseline SHA de fontes prévias; logs sem segredos; writers mantidos. |
| V. Qualidade com evidências | PASS | PASS | Contratos red confirmados; baseline65verdes; gates de ambos builds/Chrome/restart/nativo separados de site/provedor. |

## Project Structure

### Documentation (this feature)

```text
.sdd/specs/004-coleta-resiliente/
  spec.md plan.md tasks.md handoff.md
  research.md data-model.md quickstart.md contract-tests.lock
  contracts/coleta-runtime.md
  logic/coordenacao-e-ritmo.md
  logic/respostas-proxy-e-gravacao.md
  validation/planning-baseline.json contracts-red.log planning-suite.log
```

### Source Code (repository root)

Estrutura relevante encontrada, sem dados/legados enumerados:

```text
src/
  background.js content.js linkExtractor.js popup.js popup-ui.js
  localidades.js localidades-collector.js localidades-export.js localidades-directory-store.js
  lote.js lote-input.js lote-navigation.js lote-collector.js lote-session.js lote-export.js lote-directory-store.js
  coleta-coordinator.js                 # novo stub desta etapa
tests/
  contracts/001-*.test.cjs 002-*.test.cjs 003-*.test.cjs 004-coleta-resiliente.test.cjs
  fixtures/localidades-filesystem.cjs coleta-store.cjs
  unit/*.test.cjs
  e2e/localidades.smoke.cjs lote.smoke.cjs proxy.smoke.cjs
popup.html localidades.html lote.html manifest.json
webpack.config.js package.json package-lock.json README.md
dist/                                  # gerado, ignorado por Git
```

**Structure Decision**: manter estrutura plana atual. Execute criará src/coleta-policy.js, coleta-store.js, coleta-classification.js, coleta-background.js, coleta-protocol.js, coleta-runner.js, coleta-page.js, coleta-ui.js, coleta-ip.js, itens.js e itens.html; novo smoke tests/e2e/coleta.smoke.cjs. Só itens adiciona entry Webpack. Não criar app/framework/backend novo. Mecanismos de coordenador/estado são módulos, não novos serviços.

## Complexity Tracking

Nenhuma violação da constitution. Coordenação transacional e fencing são complexidade necessária para FR-004/014/026, não exceção ao gate. Read-modify-write simples e lease por timer foram rejeitados em research.md.

| Violação | Por que é necessária | Alternativa mais simples rejeitada porque |
| --- | --- | --- |

## Estratégia de Testes

Prioridade: unitário → contrato/integração → E2E → manual (último recurso). UI nativa alterada tem gate real; site/proxy comercial não são gates desta feature nem estão autorizados. Não pedir de novo validação nativa antiga para fluxo byte-identical, mas nova superfície Itens e controles alterados devem ser conferidos.

Comandos-base:

```powershell
npm.cmd test
npm.cmd run build:prod
node --test
node --test tests/contracts/004-coleta-resiliente.test.cjs
./.planning/scripts/powershell/check-contract-tests.ps1 -Slug 004-coleta-resiliente
node tests/e2e/localidades.smoke.cjs
node tests/e2e/lote.smoke.cjs
node tests/e2e/proxy.smoke.cjs
node tests/e2e/coleta.smoke.cjs
```

Último smoke será criado emT038. Gates completos/roteiro e comandos das outras travas em quickstart.md. Unitários novos nos arquivos apontados nas tasks; testar limites, retries, epoch tardio, real IDB e crash de save separadamente. Não há alterações de dependência previstas; npm ci só no gate de execução.

### Testes de Contrato

Travados: tests/contracts/004-coleta-resiliente.test.cjs (5casos) e tests/fixtures/coleta-store.cjs (0casos). Fixture filesystem existente será reutilizada nos testes adicionais de writer; não foi copiada nem alterada. Stub não travado: src/coleta-coordinator.js, nenhuma integração produtiva.

| Teste | Origem | Fase | Vermelho confirmado |
| --- | --- | --- | --- |
| C1 intervalo e orçamento sobrevivem a troca de modo e coordenador | US1;FR-001/004/005/006 | 2 | Error:not implemented |
| C2 429 persistente e desafio exigem retomada explícita | US2;FR-008/010/011 | 3 | Error:not implemented |
| C3 corrida, execução ainda viva e proprietário antigo não duplicam coleta | US3;FR-013/014 | 4 | Error:not implemented |
| C4 checkpoint de três páginas retoma após reconstrução sem refazer progresso | US4;FR-021/022/023/024 | 5 | Error:not implemented |
| C5 falha de commit preserva checkpoint e resultado salvo é idempotente | US4;FR-026/027;ConstitutionIV | 5 | Error:not implemented |

Comando `node --test tests/contracts/004-coleta-resiliente.test.cjs` →0/5verdes,5falhas not implemented,0cancelados (validation/contracts-red.log). Comando npm.cmd test →build development aprovado,65/70verdes; apenas os5novos falham (validation/planning-suite.log). Não confundir com feature implementada nem alterar contratos para obter verde.

Trava criada com `./.planning/scripts/powershell/check-contract-tests.ps1 -Slug 004-coleta-resiliente -Write -Paths @('tests/contracts/004-coleta-resiliente.test.cjs','tests/fixtures/coleta-store.cjs')`. Runner conta5/5 com proibição de testes desabilitados. Fases verificam apenas os contratos que já devem passar, mas suíte completa não pode ocultar falhas restantes; relatório registra estado incremental.

### Cobertura e riscos de integração

Tarefas mapeiam FR/SC no texto e em tabela de rastreabilidade de tasks.md. US5/6/7 têm unitários de risco e E2E, orçamento dos5contratos prioriza as4P1 e commit/receipt. Contratos de núcleo não provam fiação da UI/worker, sender real, IndexedDB ou restart do navegador: T037/T038 são obrigatórios. Testes antigos proxy-content fazem slicing do runCrawlFetchNext e listing-fields preserva delimitadores; preservar intenção ao adaptar testes unitários, não manter código morto para satisfazer mocks.


## Estado Atual

| Área | Estado |
| --- | --- |
| Branch | feature/004-coleta-resiliente; alterações preservadas, sem commit |
| Fases | 1–10 concluídas;45tasks e13gates aprovados,58/58 |
| Automação | 117/117 testes e41cenários E2E em cada build; quatro travas íntegras |
| Persistência/browser | IndexedDB real, abort injetado, worker encerrado e browser reiniciado no mesmo perfil; zero recoleta1–3 |
| Preservação | Manifest/permissões, packages, writers/stores e legados intactos conforme preservation.json |
| Nativo | T039 PASS:picker/confirmações humanos, três arquivos com hashes conferidos,1Download e0pageerrors; native-result.json |
| Próximo | sdd-converge para reauditarC-001/C-002/C-003; sem commit/merge ou prova comercial |

## Riscos e Decisões

<!--
  IDs estáveis (R-001, R-002...), nunca deletados. Item resolvido ganha
  prefixo "Resolvido:" na célula de Mitigação em vez de sumir da tabela.
-->

| ID | Risco/Decisão | Impacto | Mitigação/Encaminhamento |
| --- | --- | --- | --- |
| R-001 | Worker encerrado ou dono antigo vivo | Duplicação/rede não contabilizada | Resolvido: Epoch+prova de vida, C3 e T016/T037/T038; não takeover por timer. |
| R-002 | Quota/abort IDB após resposta | Perda de progresso | Resolvido: Delta+manifest atômicos, C5 e T019/T023; sem próxima página. |
| R-003 | Crash entre filesystem close e receipt | Sobrescrita/recoleta repetida | Resolvido: Intent+digest/reconciliação manual T022; Downloads unknown não tem exactly-once. |
| R-004 | Observação HTTP indisponível/redirecionamento | Classificação/contagem enganosa | Resolvido: Correlacionar só aba própria, unknown e cadeia lógica; T012/T032. |
| R-005 | Mudança de catálogo/clock/proxy após checkpoint | Contexto misturado | Resolvido: Hash/revisão/origem/idade e highWaterClock T023/T025; não snapshot temporal. |
| R-006 | Alterações locais prévias e travas001/002/003 | Perda de trabalho/regressão | Resolvido: planning-baseline.json, não reset/commit, T040. |
| R-007 | IP/apply PAC confundido com eficácia real | Aceite inflado | Resolvido: Provas separadas; nenhum provedor pago nesta fase, quickstart e T042. |
| R-008 | Colisão HTTP/requestId e reentrância enquanto valida | Duplo fetch ou resposta não correlacionada | Resolvido: networkRequestId separado, busy síncrono e permit network one-shot; regressões e E2E. Mapeamento wire detalhado no contrato runtime, sem mudar testes travados. |
| R-009 | Receipt confirmado antes de projetar fila; pausa durante close | Regravação ou perda de fila após crash | Resolvido: pendingProjection+ACK persistentes, afterSave e autoridade owned nos handlers/callbacks do Lote. Testes save e runtime/readonly complementam contratos. |
| R-010 | loadUnpacked via CDP não persiste instalação ao fechar Chromium | Falso teste de restart ou extensão indisponível | Resolvido: harness abre ambos processos com --load-extension no mesmo caminho/perfil; dados e identidade preservados, sem reinstalar/limpar. URLs1–4 observadas uma vez. |
| R-011 | Revisão independente: domínio retido em pausa e painel readonly sem guard | Outra sessão bloqueada ou fila de outra tela alterada | Resolvido: RED→GREEN em rate/ownership/runtime, guards canMutate/owned e E2E de duas telas. Elegibilidade passou ao resumo/UI para FR-006. Duração de eventos está persistida; exibição detalhada permanece melhoria menor. |
| R-012 | Converge confirmou feedback de conflito e diagnóstico incompletos | Operador não identifica execução ativa ou causa anterior de gravação | Resolvido: Phase10/T043–T045 com activeSession mínimo, métricas allowlisted e SAVE_FAILURE com owner/epoch/intentId. Falha preserva awaiting-save/intent e sucesso limpa razão atual, mantendo histórico. Mensagem sanitizada e somente nomes DOM permitidos preservados para reautorização. Gates117/117 e41E2E/build; reauditar no converge. |


## Execution Notes

<!--
  Tabela append-only, mantida pelo sdd-execute. Quando passar de ~40 linhas,
  arquivar as mais antigas (exceto as ~10 mais recentes) em history.md,
  substituindo por uma linha de resumo consolidado aqui.
-->

| Data | Fase/Story | Resumo | Pendência Principal |
| --- | --- | --- | --- |

| 2026-11-14 | Phase 1 | Portas de persistência e transporte lazy/cancelável; sender validado. | Phase2/US1, T005. |

| 2026-11-14 | Phase 2 | Ritmo persistente e telas integradas; Itens em página durável. | Phase3 respostas; núcleoC2 já verde pela implementação compartilhada, ampliar integração. |

| 2026-11-14 | Phase 3 | Classificação e limites persistentes; coleta de uma página e HTTP observacional. | Phase4 exclusividade, fencing e aborto. |

| 2026-11-14 | Phase 4 | Propriedade e fences persistentes, prova de executor e cancelamento integrados. | Phase5 checkpoints e reconciliação de arquivo. |

| 2026-11-14 | Phase 5 | Checkpoint com hash/capacidade, mês e nomes preservados; intent/receipt e Downloads desconhecido recuperáveis. | Phase6 proxy estável; restart/browser e gesto nativo seguem emT037–T039. |

| 2026-11-14 | Phase 6 | Proxy estável com revisão efetiva opaca, onChange e guards de configuração/reserva/dispatch. | Phase7 sondagem IP opt-in limitada; nenhum proxy comercial consultado. |

| 2026-11-14 | Phase 7 | Sondagem IP fixa e opt-in, marker antes do fetch, prazo5s e cancelamento independente; teste manual preserva proxy. | Phase8 ciclos/diagnóstico; depois gates de navegador e exportações. |

| 2026-11-14 | Phase 8 | Ciclos de paginação/CTA/redirect e destinos inválidos pausam; diagnóstico sanitizado e retenção terminal preservam dados. | PolishT036–T042: E2E de três modos/restart real, compatibilidade de writers e validação nativa. |

| 2026-11-14 | Phase9/Polish | Gates dev/prod112/112 e40E2E por build; revisão independente, preservação e README/handoff. | T039 nativo; primeiro destino Temp recusado, roteiro realocado para .data/validacao-nativa-004. |

| 2026-11-14 | Phase9/T039 final | Roteiro nativoZV9730 aprovado; estado save-unknown antes da confirmação, apenas1Download,0pageerrors e três hashes conferidos. Tentativas incompletas preservadas em native-attempts.md. | Nenhuma do execute; sdd-converge sugerido. |

| 2026-11-14 | Phase10 parcial | T043/T044 RED→GREEN; conflito no Chromium aprovado; T045 erro/resultado do writer persistem categoria sanitizada e reconciliação passa sem regravar.116testes dev aprovados. | Gates E2E/dev/prod e revisão de T045. |

| 2026-11-14 | Phase10 concluída | T043–T045 completas;117/117 e41E2E por build, quatro travas e revisão aprovadas. Falhas do harness e regressão de name corrigidas com evidência, sem afrouxar timeouts/contratos. | Repetir sdd-converge; nenhum commit/merge. |

**PRÓXIMO**: sdd-converge para reauditar a entrega corrigida. Não criar commit/merge automaticamente.

## Arquivos Principais

- src/coleta-coordinator.js, src/coleta-background.js, src/coleta-runner.js e src/coleta-ui.js
- src/itens.js, src/lote.js, src/localidades.js e src/background.js
- tests/e2e/coleta{,-store}.smoke.cjs e coleta.native.cjs
- validation/execute-summary.md, tasks.md, handoff.md

## Cuidados para Retomada

<!-- Armadilhas operacionais específicas desta feature, anexadas conforme descobertas. -->

- loadUnpacked via CDP é efêmero; restart usa carregamento pelo mesmo path em ambos processos e mantém o perfil temporário.
- Não usar predicate async em waitForFunction para aguardar dados de runtime; o harness usa poll com await e deadline no Node. O DOM pode ser aguardado com predicate síncrono.
- Testes de rede transitória mantêm cooldown após descarte. Não encurtar o backoff por patch de timer para acelerar o gate.
- Falhas de integração encontradas emT036 foram corrigidas na própria fase: fila pós-receipt, pausa durante close, enumeração readonly e descarte de owner encerrado. Não são alterações dos writers002/003.

- Picker nativo Windows/Chrome recusou AppData/Temp como destino sensível. Perfil continua isolado em Temp; exports usam subpasta nova .data/validacao-nativa-004 e são preservados.
- No roteiro nativo, banner7 verifica save-unknown e banner8 pede confirmação de Download. Confirmar diretamente conclui a sessão, mas não cobre esse cenário; o harness rejeita a ordem antecipada.
- Smoke de restart retém a primeira resposta READ resumida do runner após terceiro commit real, antes da quarta reserva. A barreira sincroniza a interrupção; não altera policy/timers/IndexedDB. Worker/executor/restart continuam reais. Não voltar a depender de observar exatamente3enquanto o runner avança.


## Resultado Final

Convergida em2026-11-14.45tasks +13gates =58/58, sem lacunas acionáveis
após reauditoria deC-001/C-002/C-003. tasks.md foi mantido byte-idêntico.

### Entrega confirmada

Links, Itens e Lote compartilham coordenador transacional IndexedDB, política
finita, reserva antes da rede, exclusividade com epoch e recuperação manual.
Respostas429/403/desafios impõem pausa; erros transitórios têm retry limitado.
Checkpoints por página preservam dados, orçamento e mês inicial; resultados
completos usam intent/receipt e reconciliação sem recoleta. Proxy permanece
estável com revisão opaca; IP é diagnóstico limitado. UI apresenta conflito,
elegibilidade, métricas e falhas de gravação persistidas e sanitizadas.

### Decisões e desvios consolidados

- O stub citado no planejamento foi implementado e integrado; a referência
  inicial a stub descreve a etapa de plan, não o estado entregue.
- O envelope efetivo usa payload com identidade; VALIDATE/REGISTER/REQUEST/
  REPORT/SAVE_INTENT/ACK_PROJECTION e SAVE_FAILURE documentam a integração.
  Intent, receipt e ring de eventos ficam em session:<id>; deltas em page:.
- pendingProjection/ACK separa receipt durável da projeção da fila003; guard
  owned do Web Lock003 complementa a exclusividade global. Essas correções
  e os fences preservam as assinaturas dos writers existentes.
- Phase10 completou feedback e diagnóstico após a primeira convergência:
  execução ativa identificável, tentativa por URL/item, duração/novos anúncios
  e categorias de falha de writer. Nomes DOM permitidos foram preservados
  na exceção sanitizada para manter reautorização.
- Restart E2E usa mesmo path/perfil e barreira de leitura após terceiro commit
  real, antes da quarta reserva. Não fabrica storage/progresso nem altera
  policy/timers. Tentativas de harness incompletas e suas correções ficaram
  registradas, sem afrouxar contratos ou aceitar flake como baseline.
- Exports nativos usam pasta exclusiva do projeto porque o seletor recusou
  Temp; os arquivos anteriores e dados do usuário foram preservados.

### Evidências e limites

Nesta reauditoria:5contratos004 +5regressões da convergência aprovados10/10;
quatro travas íntegras,11artefatos protegidos e três hashes nativos conferidos.
Inspeção do código confirmou fechamento das três lacunas, sem atalhos por
ambiente/valores de teste. ConstitutionI–V e decisões invariantes preservadas.

Execução anterior desta mesma implementação:117/117 testes e41E2E em CADA
build,0pageerrors, último artefato production. Prova nativa humanaZV9730
permanece separada; writers/picker/gestos preservados. Erros de quota nos E2E
são injetados, não evidência de disco fisicamente cheio. Site atual e proxy
comercial não foram validados e não são gate nem promessa de eficácia.

README revisado: já documenta capacidades, limites, retomada e diagnóstico;
nenhuma alteração adicional necessária. Código, testes, bundles e contratos
não foram modificados pelo converge. Sem commit/merge/publicação.

Evidências:validation/convergence-final.md,
validation/convergence-execute-summary.md e validation/convergence-gates.json.

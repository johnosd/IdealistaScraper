# Feature Specification: Coleta resiliente com controle de ritmo e retomada persistente

**Slug**: `004-coleta-resiliente`
**Created**: 2026-11-14
**Status**: Convergida
**Input**: “Excelente vamos criar uma feature com todos os items. sdd-specify”, referente aos sete itens da análise do código atual: controle de ritmo compartilhado; tratamento de limites/bloqueios/falhas; detecção durante paginação; exclusividade entre modos; política de sessão do proxy; redução de verificações de IP; checkpoints e prevenção de repetição. Usuário confirmou retomada manual após fechar a tela/reiniciar o Chrome e perfil conservador padrão com limites ajustáveis, preservando pausas obrigatórias.

## Escopo

### Incluído

- Aplicar uma política de coleta compartilhada aos fluxos Links, Itens e Lote, com controle antes da navegação inicial, resolução de destino, paginação e passagem ao próximo item.
- Oferecer perfil conservador padrão e ajustes de intervalo, orçamento de páginas, tentativas e limites de execução, sem opção para ignorar espera imposta pelo servidor ou bloqueio de acesso.
- Classificar limites de acesso, bloqueios/desafios, falhas temporárias, problemas do proxy, mudanças de layout e conclusão válida, com feedback compreensível e diagnóstico.
- Impedir coletas próprias simultâneas para o mesmo domínio no mesmo perfil da extensão.
- Manter configuração de proxy estável durante a sessão, sem reaplicação arbitrária a cada dez páginas; verificar sua configuração quando necessário e interromper diante de divergência relevante.
- Reduzir consultas de IP a eventos justificados, com duração limitada e separação entre diagnóstico de IP e disponibilidade da coleta.
- Persistir progresso por página em Itens/Lote e por etapa válida em Links, oferecendo retomada manual após fechar a tela ou reiniciar o Chrome.
- Preservar fila, resultados ainda não gravados, contadores, esperas, tentativas e contexto de exportação, incluindo o mês original do Lote.
- Prevenir ciclos de paginação, limitar páginas e registrar por que uma execução parou.
- Registrar métricas locais suficientes para avaliar ritmo, erros e retomadas, sem exportar segredos ou criar telemetria externa.

### Fora de Escopo

- Garantir ausência de bloqueios ou definir qualquer intervalo como comprovadamente aceito pelo Idealista.
- Resolver automaticamente CAPTCHA, contornar desafios, simular identidade humana, alterar fingerprints ou trocar IP para insistir após bloqueio.
- Contratar/integrar novo provedor, implementar rotação de IP ou prometer que reaplicar a configuração troca o IP de saída.
- Executar coletas automaticamente com o Chrome fechado ou retomar automaticamente ao iniciar o navegador.
- Backend, sincronização entre dispositivos/perfis, controle da navegação manual do usuário ou de outros programas.
- Redesenhar a interface inteira, ampliar campos dos anúncios ou visitar suas páginas de detalhes.
- Alterar destinos, formatos de JSON, regras de substituição de arquivos e autorizações de pasta das features 002/003.
- Migrar ou apagar arquivos/dados legados, corrigir integralmente bugs de exportação parcial ou certificar um provedor comercial.

## User Scenarios & Testing

### User Story 1 - Controlar o ritmo de todas as coletas (Priority: P1)

Como operador, quero iniciar qualquer modo com um perfil conservador e conhecer seus limites, para evitar requisições desnecessariamente próximas e manter o consumo previsível.

**Why this priority**: Reduz pressão de acesso em todas as entradas, inclusive quando não há erro.
**Independent Test**: Com destinos controlados e limites conhecidos, medir os horários de início das solicitações em cada modo, entre municípios e ao alternar modos.

**Acceptance Scenarios**:

1. **Given** uma instalação sem política salva, **When** abre a coleta, **Then** apresenta perfil conservador com intervalo mínimo, orçamento por janela, orçamento por execução e teto de tentativas finitos.
2. **Given** intervalo ainda não cumprido, **When** inicia Itens, Links, outro município ou paginação, **Then** aguarda e mostra o motivo antes da solicitação correspondente.
3. **Given** orçamento esgotado, **When** há páginas pendentes, **Then** pausa sem emitir a próxima solicitação nem marcar o item como concluído.
4. **Given** limites ajustados, **When** fecha e reabre a tela, **Then** preserva configuração, consumo e espera ainda vigentes; reduzir o intervalo não elimina uma espera obrigatória do servidor.

### User Story 2 - Pausar corretamente diante de limites e bloqueios (Priority: P1)

Como operador, quero distinguir bloqueio, limite e erro temporário, para decidir quando continuar sem insistência indevida nem resultados incompletos tratados como sucesso.

**Why this priority**: Evita novas solicitações após uma recusa e torna o motivo observável.
**Independent Test**: Simular 429, 403, 503, falha de rede, erro de proxy e HTML de desafio nas páginas inicial/intermediária e nos modos de coleta.

**Acceptance Scenarios**:

1. **Given** resposta 429 com espera válida, **When** o coletor a recebe, **Then** pausa as coletas do domínio até pelo menos o prazo informado, inclusive em outra tela ou após reinício.
2. **Given** 403 ou desafio identificado, inclusive HTML inesperado com status 200, **When** classifica a resposta, **Then** pausa sem nova tentativa automática e informa a necessidade de conferir o acesso.
3. **Given** falha transitória elegível, **When** tenta novamente, **Then** aplica espera progressiva dentro do teto de tentativas e do orçamento total; esgotamento preserva o progresso e encerra tentativas automáticas.
4. **Given** desafio em página intermediária, **When** a coleta para, **Then** preserva o último checkpoint e informa a página afetada, sem exportar o item como completo.
5. **Given** período de espera vencido, **When** o usuário solicita continuar uma sessão pausada, **Then** confere elegibilidade e contexto antes de prosseguir; o vencimento sozinho não reinicia a coleta.

### User Story 3 - Evitar coletas concorrentes entre modos (Priority: P1)

Como operador, quero que Itens, Links e Lote compartilhem exclusividade de coleta, para não disparar trabalho duplicado nem disputar a configuração de proxy.

**Why this priority**: O limite por tela é insuficiente quando há modos e abas distintos.
**Independent Test**: Disparar duas entradas ao mesmo tempo e repetir START_CRAWL durante execução ativa.

**Acceptance Scenarios**:

1. **Given** uma coleta ativa, **When** inicia outro modo no mesmo domínio, **Then** a segunda ação não navega nem coleta e informa qual execução está ativa.
2. **Given** comando duplicado de início, **When** chega à coleta em andamento, **Then** não cria outro crawler nem reinicia seus resultados/contadores.
3. **Given** tela fechada ou worker reiniciado, **When** outra tela assume a sessão, **Then** reconhece a interrupção sem criar duas execuções e oferece retomada manual após verificar o estado.

### User Story 4 - Retomar do último checkpoint válido (Priority: P1)

Como operador, quero recuperar uma coleta interrompida após fechar sua tela ou reiniciar o Chrome, para aproveitar páginas já coletadas sem publicar arquivos incompletos.

**Why this priority**: Evita refazer grande parte do tráfego após falha tardia.
**Independent Test**: Coletar três páginas conhecidas, persistir a terceira, interromper a execução e reiniciar o navegador; retomar manualmente e conferir registros, próximas páginas, fila e exportação.

**Acceptance Scenarios**:

1. **Given** checkpoint válido com três páginas concluídas, **When** reabre o Chrome, **Then** apresenta sessão interrompida e resumo recuperado sem fazer nova coleta automaticamente.
2. **Given** opção de retomar, **When** o usuário a aciona e o contexto é compatível, **Then** continua após a última página confirmada, mantém deduplicação e não refaz as páginas já confirmadas apenas para reconstruir memória.
3. **Given** resultado completo aguardando gravação, **When** recupera permissão de pasta, **Then** salva os dados recuperados sem recoletar, preservando o mês inicial do Lote.
4. **Given** checkpoint incompatível/corrompido ou contexto divergente, **When** tenta retomar, **Then** explica a incompatibilidade e oferece reiniciar ou descartar explicitamente, sem misturar resultados.
5. **Given** falha de persistência de uma nova página, **When** a detecta, **Then** mantém o checkpoint anterior e pausa; essa página não é apresentada como progresso durável.
6. **Given** Links com resultado completo recuperado, **When** retoma, **Then** oferece a etapa de exportação existente, sem recolher os mesmos links por falta de estado em memória.

### User Story 5 - Manter o proxy coerente durante a sessão (Priority: P2)

Como operador, quero que a coleta use a configuração confirmada de proxy sem reconexões periódicas arbitrárias e interrompa quando houver divergência relevante.

**Why this priority**: Evita reaplicações sem benefício demonstrado e mudanças silenciosas de contexto.
**Independent Test**: Executar mais de dez páginas com configuração estável e simular alteração/desativação durante uma sessão.

**Acceptance Scenarios**:

1. **Given** proxy solicitado e confirmado, **When** ultrapassa dez páginas sem falha ou mudança, **Then** não reaplica o proxy só pela contagem de páginas.
2. **Given** alteração necessária de configuração, **When** há coleta ativa, **Then** a mudança não acontece silenciosamente durante a coleta; a sessão deve parar e ter o contexto conferido antes de continuar.
3. **Given** proxy solicitado indisponível ou divergente, **When** pretende iniciar nova página, **Then** interrompe antes da coleta seguinte, sem continuar deliberadamente por acesso direto.
4. **Given** suspensão do worker, **When** recupera a sessão, **Then** mantém as garantias do bug proxy-seguro-antes-navegacao-reinicio e não confunde configuração aplicada com conectividade/IP confirmado.

### User Story 6 - Consultar o IP com frequência e duração limitadas (Priority: P2)

Como operador, quero um diagnóstico de IP útil, sem consultas antes e depois de toda página nem esperas indefinidas que impeçam pausar a coleta.

**Why this priority**: Reduz tráfego auxiliar e dependência de serviço externo de diagnóstico.
**Independent Test**: Contar consultas numa coleta com cem páginas, numa mudança efetiva de configuração e numa falha do serviço de IP.

**Acceptance Scenarios**:

1. **Given** sessão iniciada com diagnóstico de IP habilitado, **When** coleta cem páginas sem mudança de configuração nem teste manual, **Then** consulta o IP no máximo uma vez no início.
2. **Given** mudança efetiva de configuração ou teste manual explícito, **When** consulta novamente, **Then** cada evento permite no máximo uma nova consulta, com duração máxima definida.
3. **Given** timeout ou indisponibilidade do diagnóstico, **When** encerra a consulta, **Then** apresenta “IP não verificado” e permite pausar/cancelar; não declara proxy inativo, bloqueio ou troca de IP apenas por essa falha.

### User Story 7 - Diagnosticar progresso e impedir paginação repetida (Priority: P2)

Como operador, quero conhecer consumo, erros, páginas e motivo da parada, para identificar repetições ou bloqueios sem expor credenciais.

**Why this priority**: Fornece evidência para ajustar limites e evita ciclos de tráfego.
**Independent Test**: Fornecer paginação cíclica, uma sequência sem novos anúncios, teto de páginas e respostas com classes distintas; conferir parada e diagnóstico.

**Acceptance Scenarios**:

1. **Given** próxima URL já confirmada como visitada na mesma cadeia, **When** pretende segui-la, **Then** interrompe por ciclo sem solicitar essa URL novamente.
2. **Given** teto de páginas ou de páginas consecutivas sem novos anúncios, **When** o atinge, **Then** pausa com motivo explícito, sem declarar conclusão natural.
3. **Given** uma sessão com sucesso, falha e retomada, **When** consulta o diagnóstico, **Then** mostra modo, horários, páginas solicitadas/concluídas, tentativas, duração, classe/status disponível e motivo da pausa, sem senhas ou cookies.

### Edge Cases

- Retry-After em segundos ou data, ausente, inválido, expirado, muito distante ou recebido novamente durante espera; nunca encurtar espera válida nem entrar em ciclo por valor inválido.
- HTTP 200 com desafio, HTTP 403 sem causa comprovada, sessão expirada/login, layout alterado e listagem legitimamente vazia: evitar classificar todos como bloqueio ou todos como sucesso.
- Limite de páginas, limite de tentativas e orçamento por janela atingidos juntos; apresentar a restrição efetiva mais duradoura e conservar os demais contadores.
- Itens/Lote/Links abertos simultaneamente, mensagens duplicadas, navegador fechado durante fetch, fechamento após coleta mas antes de checkpoint ou gravação.
- Solicitação interrompida após envio pode ter chegado ao servidor; consumo já reservado não pode ser devolvido apenas porque o navegador fechou ou não houve resposta.
- Alteração de relógio ou suspensão do computador não pode liberar espera antecipadamente por interpretação inconsistente; sinalizar contexto temporal inválido quando não for possível decidir com segurança.
- Permissão de pasta expirada, mês virado, resultado completo ainda não gravado, escrita concluída com confirmação local pendente e fila parcialmente consumida: não recoletar por padrão nem alterar o mês original.
- Checkpoint incompleto, corrupção, versão incompatível, configuração de proxy modificada ou origem de coleta diferente: não juntar dados silenciosamente.
- Conteúdo do site pode mudar entre coleta e retomada; indicar que retomada não garante uma fotografia temporal única do catálogo.
- Dados recuperados não devem depender da senha presente em checkpoint; credenciais continuam na configuração existente e não entram em diagnósticos.
- Links não tem paginação de anúncios: checkpoint é por etapa válida e resultado coletado, preservando seu fluxo de confirmação de substituição.
- Recursos auxiliares carregados pelo navegador não equivalem às páginas de coleta controladas pela feature; distinguir métricas para não apresentar um orçamento de páginas como limite de todo tráfego HTTP.

## Requirements

### Functional Requirements

- **FR-001**: Sistema DEVE aplicar política compartilhada por domínio às solicitações de coleta emitidas pela extensão em Links, Itens e Lote, incluindo navegação inicial, resolução de destino e paginação.
- **FR-002**: Sistema DEVE oferecer perfil conservador inicial e controles de limites finitos para intervalo mínimo, páginas por janela, páginas por execução, páginas por item, tentativas transitórias e duração de solicitações; configurações inválidas ou ilimitadas devem ser rejeitadas.
- **FR-003**: Sistema DEVE exibir os limites efetivos antes de iniciar, permitir restaurar padrões e conservar configurações entre aberturas. Ajustes não podem apagar consumo, pausas ou prazos em vigor.
- **FR-004**: Sistema DEVE contabilizar cada solicitação de página controlada antes do envio, incluindo tentativas, mesmo quando falhar ou for interrompida; recursos embutidos, consultas de IP e etapas sem rede devem ser apresentados separadamente.
- **FR-005**: Sistema DEVE preservar orçamento por domínio entre sessões e modos dentro da mesma janela; criar uma nova sessão ou alternar modo não pode reiniciar esse orçamento.
- **FR-006**: Sistema DEVE respeitar o intervalo efetivo também na passagem entre itens de lote e após recuperação, mostrando a próxima elegibilidade e pausando ao esgotar um teto sem consumir o item como concluído.
- **FR-007**: Sistema DEVE classificar separadamente limite de acesso, recusa/desafio, falha transitória, falha de proxy/autenticação, contexto inválido, conteúdo inesperado, listagem vazia válida e conclusão normal.
- **FR-008**: Sistema DEVE interpretar Retry-After válido em segundos ou data, persistir o prazo e respeitá-lo no domínio. Ausência/valor inválido não autoriza repetição imediata: deve aplicar espera conservadora finita e informada.
- **FR-009**: Sistema DEVE limitar tentativas automáticas a falhas explicitamente transitórias, com espera progressiva, duração máxima e consumo do orçamento. A lista de falhas elegíveis e os valores devem constar no plano antes da implementação.
- **FR-010**: Sistema DEVE pausar manualmente retomável diante de 403 ou desafio confirmado, sem tentativa automática, troca de IP ou continuação do lote; expirar um prazo não inicia coleta por si só.
- **FR-011**: Sistema DEVE reconhecer sinais de desafio nas respostas inicial e intermediárias, mesmo quando houver HTTP 200, usando somente sinais disponíveis; evidência inconclusiva deve aparecer como conteúdo inesperado, sem atribuir fornecedor ou causa não comprovados.
- **FR-012**: Sistema DEVE aplicar as mesmas regras de integridade de coleta em Itens e Lote: falha/interrupção não equivale a resultado completo. Dados parciais devem ser distinguíveis e não substituir a exportação final válida automaticamente.
- **FR-013**: Sistema DEVE impedir mais de uma execução própria ativa de coleta por domínio no mesmo perfil, incluindo modos distintos e comandos duplicados, informando a execução responsável.
- **FR-014**: Sistema DEVE recuperar exclusividade após interrupção de forma que não permita um segundo crawler enquanto ainda existe coleta própria ativa. Suspensão do worker não equivale, por si só, à conclusão da sessão.
- **FR-015**: Sistema DEVE manter estados visíveis de execução, espera, pausa por limite, bloqueio, falha, interrupção recuperável, resultado aguardando gravação e conclusão, com ações coerentes de pausar, cancelar, retomar e descartar.
- **FR-016**: Sistema DEVE manter estável a configuração de proxy confirmada por sessão e remover a reaplicação automática baseada somente em dez páginas; configuração aplicada, conectividade e IP observado devem ser estados distintos.
- **FR-017**: Sistema DEVE conferir a configuração solicitada antes de iniciar/retomar e antes da próxima solicitação controlada quando houver divergência relevante; se proxy exigido não puder ser confirmado, deve interromper sem fallback deliberado para acesso direto.
- **FR-018**: Sistema DEVE impedir alterações silenciosas de proxy por outra tela própria durante uma coleta; continuidade após mudança exige parada e nova conferência de contexto. Configuração aplicada externamente deve ser detectada quando disponível.
- **FR-019**: Sistema DEVE limitar diagnóstico automático de IP ao início da sessão e a mudanças efetivas de configuração, no máximo uma consulta por evento, além de teste manual explícito. Retomada sem mudança não deve repetir consulta apenas por reabrir tela.
- **FR-020**: Sistema DEVE impor timeout às consultas de IP e mostrar falha como diagnóstico inconclusivo; a falha isolada não comprova bloqueio do site, proxy desativado ou mudança de IP.
- **FR-021**: Sistema DEVE persistir checkpoint após cada página validada em Itens/Lote e cada etapa válida em Links, contendo origem, modo, item/fila, dados acumulados, identificadores de deduplicação, progresso, próximo destino, contadores e contexto de exportação necessário.
- **FR-022**: Sistema DEVE disponibilizar manualmente sessões interrompidas após fechar a tela ou reiniciar o Chrome, exibindo resumo e ações de retomar/descartar, sem emitir solicitações de coleta automaticamente.
- **FR-023**: Sistema DEVE preservar esperas, orçamento por janela, tentativas consumidas e mês original da execução em retomadas. Pausa, cancelamento ou descarte da sessão não apagam o histórico de limitação ainda vigente no domínio.
- **FR-024**: Sistema DEVE retomar do último checkpoint confirmado compatível, sem refazer páginas confirmadas somente para reconstrução de estado; página enviada e não confirmada pode exigir nova tentativa, contabilizada e informada.
- **FR-025**: Sistema DEVE validar integridade/compatibilidade e contexto do checkpoint antes de retomar; falha exige decisão explícita de reiniciar/descartar e não pode misturar dados de execuções incompatíveis.
- **FR-026**: Sistema DEVE preservar o checkpoint anterior se a nova persistência falhar e pausar antes de solicitar outra página. Falta de espaço não pode causar progresso durável fictício nem exclusão silenciosa de dados recuperáveis.
- **FR-027**: Sistema DEVE recuperar resultados completos aguardando gravação e permitir salvar após reautorização sem recoleta; fila só avança conforme a gravação confirmada, mantendo regras de destinos/substituição 002/003.
- **FR-028**: Sistema DEVE detectar URL de paginação já visitada, limite de páginas e sequência limitada de páginas sem novos anúncios, interrompendo com motivo específico e preservando os dados válidos.
- **FR-029**: Sistema DEVE validar que a próxima URL pertence ao escopo autorizado de coleta e conferir redirecionamento/conteúdo disponível antes de aceitar a página; não ampliar silenciosamente o domínio coletado.
- **FR-030**: Sistema DEVE registrar localmente sessão, modo, domínio/caminho sanitizado, horários, duração, tentativas, páginas solicitadas/confirmadas, contagem de novos anúncios, status disponível, classificação e motivo/horário de pausa/retomada.
- **FR-031**: Sistema DEVE excluir senhas, cookies, tokens, cabeçalhos de autenticação e HTML integral dos diagnósticos; manter retenção e volume finitos, sem eliminar checkpoints recuperáveis silenciosamente.
- **FR-032**: Sistema DEVE oferecer diagnóstico consultável na interface, inclusive depois de reabrir a sessão, distinguindo falha da coleta, falha de persistência e falha de gravação do arquivo.
- **FR-033**: Sistema DEVE preservar schemas de anúncios/localidades, regras de exportação e configurações já existentes; melhorias de coleta não autorizam apagar dados, credenciais locais ou arquivos legados.

### Key Entities

- **Política de coleta**: domínio/grupo de destinos atendidos, intervalo, janelas e orçamentos, tetos de páginas/tentativas/duração e perfil de padrões.
- **Estado de acesso do domínio**: consumo, próxima elegibilidade, espera do servidor, pausa por bloqueio e último motivo, compartilhados entre modos.
- **Sessão de coleta**: identificador, modo, data inicial, política efetiva, contexto do proxy sem segredo, fila/item atual, estado e responsabilidade pela execução.
- **Checkpoint**: versão/integridade, páginas confirmadas/visitadas, próximos destinos, dados deduplicados, contadores, resultado pendente e contexto de exportação.
- **Ocorrência de coleta**: solicitação/tentativa, duração, status/classificação, novos registros e desfecho, sem segredos.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Em cenários controlados de Links, Itens e Lote, 100% das solicitações controladas respeitam intervalo e orçamento efetivos, inclusive entre municípios e ao alternar modos.
- **SC-002**: Com 429 e espera válida, nenhuma nova solicitação controlada do domínio é iniciada antes do prazo, mesmo após fechar tela/reiniciar navegador ou iniciar outra sessão.
- **SC-003**: Nenhum cenário de 403/desafio gera tentativa automática, avanço do lote ou classificação de sucesso completo; retomada requer ação do operador e conferência do contexto.
- **SC-004**: Falhas transitórias nunca excedem o teto configurado de tentativas nem geram execução sem duração/orçamento máximos; todas as tentativas aparecem no consumo.
- **SC-005**: Ao disparar dois modos e comandos duplicados simultaneamente, somente uma coleta própria fica ativa; a outra informa conflito sem navegar/coletar.
- **SC-006**: Após três páginas confirmadas e reinício do navegador, retomada manual recupera registros e prossegue sem buscar novamente essas três páginas por necessidade de reconstrução de memória.
- **SC-007**: Falhas simuladas de persistência preservam o checkpoint anterior e não são seguidas de nova página; checkpoint incompatível nunca é mesclado silenciosamente.
- **SC-008**: Resultado completo recuperado após reinício é gravado após reautorização sem recoleta, preservando mês/destino/schema e sem consumir item antes da gravação confirmada.
- **SC-009**: Em cem páginas sem mudança de configuração, há zero reaplicações de proxy motivadas pela contagem de páginas e no máximo uma consulta automática de IP no início, quando habilitada.
- **SC-010**: Ciclo de URL e teto de páginas interrompem a coleta antes da próxima solicitação proibida; páginas sem novos anúncios param no teto configurado, com motivo distinto da conclusão natural.
- **SC-011**: Os cenários de limite, bloqueio, rede, proxy, persistência e gravação exibem diagnóstico distinto; registros gerados nos testes não contêm os segredos conhecidos das fixtures.
- **SC-012**: Fechar/reabrir ou reiniciar não dispara coleta automaticamente nem elimina esperas/consumo vigentes. Cancelar/pausar permanece utilizável quando o diagnóstico de IP não responde.
- **SC-013**: Evidências de simulação, navegador isolado, reinício real do navegador, coleta no site atual e proxy comercial são registradas separadamente; resultado local não é anunciado como redução comprovada de bloqueios reais.

## Assumptions

- Público-alvo é o operador da extensão existente; os pontos de entrada continuam Links, Itens e Lote, com feedback e controles de coleta nas superfícies apropriadas.
- A feature busca reduzir tráfego redundante e responder corretamente a recusas, sem prometer taxa de sucesso no site atual.
- A exclusividade aplica-se às operações próprias de coleta no mesmo perfil. Recursos embutidos e tráfego manual/externo não estão sob esse orçamento de páginas.
- As garantias do bug de proxy verificado são baseline e devem continuar válidas; sua evidência de Chromium isolado não comprova autenticação com provedor comercial.
- Os valores numéricos iniciais de perfil, faixas de ajuste, duração/retenção, limites de volume e elegibilidade de checkpoint serão explicitados no sdd-plan, com justificativa operacional e cenários nos extremos antes da implementação. Não representam limites autorizados/publicados pelo site.
- Ajustes são operações explícitas do usuário; aumentos não limpam consumo ou desbloqueiam uma sessão recusada. Prazos do servidor têm precedência sobre preferências locais.
- Retomar uma sessão nunca significa garantir que os anúncios mantiveram o mesmo conteúdo durante a interrupção; o histórico deve tornar os momentos da coleta identificáveis.
- Testes determinísticos e navegação em fixtures isoladas são o padrão. Qualquer etapa com provedor pago ou coleta real exige escopo/limites próprios e não está implicitamente autorizada por esta spec.
- Arquitetura, persistência, coordenação entre contextos e desenho detalhado da interface pertencem ao sdd-plan; não há migração de stack nesta especificação.

## Clarifications

### Sessão 2026-11-14

- Q: Quais melhorias da revisão entram na feature? → A: Todos os sete itens, conforme pedido explícito do usuário.
- Q: Até onde a retomada por checkpoints deve funcionar? → A: Após fechar a tela ou reiniciar o Chrome, oferecendo retomada manual do último checkpoint válido.
- Q: Como controlar intervalos, orçamento de páginas e tentativas? → A: Perfil conservador padrão, com limites ajustáveis e sem desativar pausas obrigatórias por bloqueio.

### Coverage Review

- Escopo funcional, interação e conclusão: sete itens mapeados às stories e aos critérios mensuráveis; decisões de retomada e configuração confirmadas pelo usuário.
- Domínio/dados e integração: preservação de resultados, fila, mês, permissões, schemas e garantias do proxy derivada dos contratos 002/003 e do código atual.
- Não funcional, edge cases e terminologia: orçamento finito, exclusividade por perfil, segurança de diagnósticos, falhas de checkpoint e contagem de solicitações explícitos nesta spec.
- Não houve pergunta sobre stack, mecanismos de persistência ou bibliotecas: são decisões do planejamento. Não restam marcadores NEEDS CLARIFICATION.

## Traceability

| Item da revisão | Stories | Requisitos principais |
| --- | --- | --- |
| 1. Ritmo compartilhado | US1 | FR-001 a FR-006 |
| 2. Tratamento de limites/bloqueios/falhas | US2 | FR-007 a FR-010, FR-012 |
| 3. Detecção na paginação | US2 | FR-011, FR-029 |
| 4. Exclusividade entre modos | US3 | FR-013 a FR-015 |
| 5. Política de sessão do proxy | US5 | FR-016 a FR-018 |
| 6. Diagnóstico de IP limitado | US6 | FR-019 a FR-020 |
| 7. Checkpoints e prevenção de repetição | US4, US7 | FR-021 a FR-028 |
| Diagnóstico transversal | US7 | FR-030 a FR-033 |

### Related Work

- `002-exportacao-localidades-pasta-autorizada`: autorização de pasta, confirmação de substituição e saída de Links preservadas.
- `003-exportacao-lote-municipios`: mês fixo, gravação confirmada e formato/exportação do Lote preservados; a nova retomada amplia explicitamente o escopo que a 003 deixava de fora.
- `.sdd/bugs/proxy-seguro-antes-navegacao-reinicio/`: ativação anterior à navegação e recuperação de estado do worker continuam como baseline.

### Backlog Entries Promoted

Textos históricos preservados como origem, sem tratá-los como fotografia atual do código:

- [Bug] **Execução e retomada do lote dependentes do popup:** a orquestração e os resultados agregados ficam no popup; fechar a interface interrompe o controle e perde resultados em memória. Persistir e restaurar o estado necessário para uma retomada consistente.
  - Estado atual: a 003 já moveu a orquestração para página durável; recuperação após fechar a tela/reiniciar passa a ser coberta pela US4.
- [Bug] **Repetição ilimitada de entradas com erro:** o lote move falhas ao fim da fila sem limite de tentativas ou encerramento por falha persistente.
  - Estado atual: o Lote já para após erro e aguarda ação manual. A 004 cobre limites persistentes, esperas e política de tentativas, sem assumir a existência do laço automático histórico.
- [Bug] **Coleta incompleta tratada como sucesso:** erros de rede/HTTP interrompem a paginação sem distinguir resultado parcial de completo; o lote podia remover a URL da fila como concluída. A feature003 impede gravação/consumo parcial no Lote com modo estrito; o fluxo Itens legado não foi redesenhado.
  - O comportamento restante de Itens e a classificação comum são cobertos por FR-012, sem expandir para redesign de exportação parcial.

# Feature Specification: Coleta em um clique com acompanhamento e recuperação por localidade

**Slug**: 005-experiencia-coleta-autonoma
**Created**: 2026-11-14
**Status**: Em Execução
**Last UI/UX Review**: 2026-11-14
**Input**: Como usuário do IdealistaScraper, quero iniciar a coleta de localidades com um clique, acompanhar de forma amigável as localidades e o estágio da captura enquanto navego no site, deixar a coleta avançar autonomamente, ter uma tela de configurações separada e retomar o scraping de qualquer município que falhou ou ficou incompleto.

## Scope

### Included

- Um comando primário que descobre as localidades diretamente listadas na navegação da página atual e inicia a coleta dos anúncios de todas elas, após a configuração inicial.
- Fila definida pela página de origem no momento do comando, sem importação manual de JSON e sem exportação intermediária obrigatória.
- Painel lateral recolhível ao lado do site, com resumo da execução, estágio atual, localidade em coleta, progresso e detalhes de cada localidade.
- Continuidade da execução com o Chrome aberto, mesmo ao recolher ou fechar o painel e ao navegar em outras páginas.
- Tela de Configurações que concentra destinos de gravação, proxy, preferências existentes e limites de coleta, separando esses ajustes do acompanhamento cotidiano.
- Continuação dos demais itens após falha específica de uma localidade, preservando seu progresso e a possibilidade de retomá-la.
- Ações para retomar uma localidade com problema ou todos os itens pendentes de uma execução, sem repetir os concluídos.
- Resumo final que diferencia captura integral, término com pendências, pausa e interrupção.
- Preservação das garantias de ritmo, bloqueios, exclusividade, checkpoints, proxy e exportação das features anteriores.

### Out of Scope

- Descobrir Portugal inteiro independentemente da página atual ou percorrer recursivamente outros níveis geográficos.
- Exportar automaticamente o catálogo de localidades como pré-requisito para coletar anúncios; essa exportação continua sendo uma ação separada.
- Rodar com o Chrome fechado ou reiniciar automaticamente a coleta ao abrir o navegador.
- Contornar bloqueios, resolver desafios automaticamente, ignorar esperas ou implementar rotação de IP.
- Alterar schemas dos arquivos, campos dos anúncios, destinos convencionados, regras de substituição ou exportação parcial.
- Coletar detalhes internos dos anúncios, adicionar backend, sincronizar dispositivos ou trocar de stack.
- Redesenhar todas as ferramentas legadas de importação e coleta individual; suas capacidades existentes devem continuar acessíveis.
- Corrigir os itens históricos de exportação parcial e do botão Parar e Exportar como parte desta feature.
- Reconstruir checkpoints de coletas históricas sem dados recuperáveis ou certificar o funcionamento do site/proxy real por meio de simulações.

## User Scenarios & Testing

### User Story 1 - Iniciar a sequência de coleta em um clique (Priority: P1)

Como usuário com as configurações prontas, quero acionar Iniciar coleta na página atual para descobrir as localidades listadas nela e coletar seus anúncios sem carregar lista, copiar links ou iniciar outro modo manualmente.

**Why this priority**: Entrega valor por si só ao encadear as operações hoje separadas, mesmo antes do novo painel ou da nova tela de configurações.

**Independent Test**: Partir de uma página controlada com três localidades e configurações válidas, acionar uma vez e observar a descoberta, a coleta e a gravação dos três resultados usando o acompanhamento já disponível.

**Acceptance Scenarios**:

1. **Given** uma página suportada com localidades diretamente listadas e configuração válida, **When** aciona Iniciar coleta uma vez, **Then** o app descobre a fila, coleta os anúncios de cada entrada e grava cada resultado completo sem outro comando de início.
2. **Given** a fila descoberta, **When** a coleta começa, **Then** não exige colar JSON, carregar lista, exportar localidades ou confirmar o início de cada item.
3. **Given** destino ausente ou permissão indisponível, **When** tenta iniciar, **Then** mostra o requisito e o acesso à configuração/reautorização, sem iniciar uma coleta de anúncios que dependa desse destino.
4. **Given** página sem localidades reconhecíveis, **When** tenta iniciar, **Then** explica que não encontrou localidades e não cria uma execução vazia apresentada como sucesso.
5. **Given** execução já ativa, **When** aciona novamente Iniciar coleta, **Then** oferece acompanhar a execução existente e não duplica a fila nem o coletor.
6. **Given** navegação manual depois da descoberta, **When** abre outra região ou outra página, **Then** a fila em andamento mantém a origem e o escopo inicialmente definidos.

### User Story 2 - Acompanhar sem interromper a navegação (Priority: P1)

Como usuário, quero acompanhar a coleta em um painel lateral recolhível para saber o que está acontecendo sem abandonar a página em que navego.

**Why this priority**: Torna a autonomia observável e pode ser entregue sobre os pontos de início de lote existentes, sem depender do início em um clique.

**Independent Test**: Iniciar um lote pelo fluxo existente, abrir o painel, navegar, recolhê-lo, fechá-lo e reabri-lo; conferir continuidade e correspondência entre painel, checkpoints e arquivos.

**Acceptance Scenarios**:

1. **Given** uma execução em descoberta, coleta, espera ou gravação, **When** acompanha o painel, **Then** vê o estágio, a localidade atual, os itens resolvidos/total, os pendentes e as páginas/anúncios confirmados do item atual.
2. **Given** uma espera obrigatória, **When** acompanha, **Then** vê o motivo e, se conhecido, o prazo para nova elegibilidade, distinguindo espera normal de ação necessária.
3. **Given** navegação no Idealista, **When** o coletor muda de localidade, **Then** não substitui a página de navegação do usuário nem toma seu foco automaticamente; o painel continua representando a mesma execução.
4. **Given** uma coleta ativa, **When** recolhe ou fecha o painel, **Then** a coleta continua com o Chrome aberto; reabrir recupera o progresso atual sem criar outra execução.
5. **Given** o Chrome foi fechado durante a coleta, **When** reabre o app, **Then** encontra o estado interrompido e a ação de retomada manual, sem coleta automática.
6. **Given** um término com dois itens concluídos e um pendente, **When** consulta o resumo, **Then** vê término com pendências e a ação de recuperar o item, sem mensagem de captura integral.

### User Story 3 - Recuperar qualquer localidade pendente (Priority: P1)

Como usuário, quero identificar e retomar um município que falhou ou ficou incompleto, ou retomar todos os pendentes, para terminar a captura aproveitando o trabalho já confirmado.

**Why this priority**: Evita refazer municípios completos e pode ser entregue na lista de execução existente antes da reorganização das telas.

**Independent Test**: Usar uma fila A/B/C em que B falha após páginas confirmadas; observar C avançar, selecionar somente B para retomada e conferir que A/C não são solicitados novamente.

**Acceptance Scenarios**:

1. **Given** falha comprovadamente específica de B e condições gerais válidas, **When** esgota as tentativas transitórias já permitidas, **Then** preserva B como pendente e passa a C respeitando ritmo e limites.
2. **Given** B incompleto com checkpoint compatível, **When** solicita Retomar nesta localidade, **Then** continua após a última página confirmada de B, sem recolher as páginas confirmadas nem iniciar os demais pendentes.
3. **Given** múltiplos itens pendentes, **When** solicita Retomar pendentes, **Then** inclui todos os recuperáveis dessa execução, explica eventuais impedimentos e não inclui os itens já concluídos.
4. **Given** bloqueio geral, espera imposta, proxy incompatível ou impossibilidade de preservar novos dados, **When** ocorre durante um item, **Then** pausa a execução inteira e explica a condição, sem seguir para outro município para evitá-la.
5. **Given** anúncios completamente coletados e gravação ainda pendente, **When** retoma o item, **Then** tenta resolver a gravação usando os dados preservados, sem recoletar anúncios.
6. **Given** checkpoint incompatível, **When** solicita retomada, **Then** explica a incompatibilidade e exige uma decisão explícita para reiniciar ou descartar, sem apagar dados ou misturar contextos silenciosamente.
7. **Given** execução antiga com checkpoints compatíveis, **When** a seleciona após reiniciar o Chrome, **Then** pode escolher a localidade pendente por seu nome e origem, conservando os arquivos e o mês da execução original.

### User Story 4 - Configurar o app em uma tela própria (Priority: P1)

Como usuário, quero ajustar pastas, proxy e limites em Configurações para manter a tela de coleta simples e reutilizar minhas preferências nas próximas execuções.

**Why this priority**: Separar configuração de operação é parte central da experiência solicitada. Pode ser entregue sobre os fluxos atuais, mas é necessária para o aceite da experiência completa desta feature.

**Independent Test**: Abrir Configurações a partir da interface atual, conferir valores salvos, ajustar uma preferência permitida, reabrir a tela e iniciar um lote existente com os valores efetivos.

**Acceptance Scenarios**:

1. **Given** o acompanhamento aberto, **When** acessa Configurações, **Then** encontra os destinos, o proxy, os limites e o diagnóstico de IP existentes em uma tela dedicada, sem precisar procurar esses controles no progresso.
2. **Given** preferências e autorizações já salvas, **When** atualiza o app ou abre a nova tela, **Then** as recupera sem exigir redigitação de credenciais ou nova escolha de pasta se o acesso continuar válido.
3. **Given** um ajuste inválido, **When** tenta salvar, **Then** recebe uma explicação junto ao ajuste e os valores válidos anteriores permanecem efetivos.
4. **Given** uma coleta ativa, **When** acessa ajustes incompatíveis com sua continuidade, **Then** a interface explica a restrição; não altera silenciosamente proxy, destino, contexto ou garantias da sessão.
5. **Given** dados recuperáveis e uma permissão vencida, **When** abre a ação de reautorizar o destino, **Then** recupera o acesso sem perder a execução nem exigir nova descoberta.

### Edge Cases

- Página não suportada, lista inexistente, lista vazia, navegação da origem durante a descoberta e falha de descoberta: não completar uma fila ambígua ou misturar duas páginas.
- URLs repetidas com rótulos diferentes e localidades homônimas com URLs distintas: não duplicar o mesmo destino nem fundir municípios apenas pelo nome.
- A página pode listar região, município ou freguesia. O rótulo Localidade deve representar o tipo disponível; não prometer que toda entrada é um município.
- Quantidade de anúncios ausente, estimativa do site divergente ou total de páginas desconhecido: mostrar progresso confirmado sem percentual ou previsão inventada.
- Localidade validamente sem anúncios: distingui-la de falha de leitura e de arquivo salvo; aplicar as regras vigentes de exportação sem anunciar gravação inexistente.
- Fechamento do painel e fechamento do navegador têm efeitos diferentes; uma navegação, troca de aba ou suspensão do contexto visual não deve ser confundida com cancelamento.
- Resposta perdida, interrupção entre coleta e checkpoint ou entre gravação e confirmação: recuperar somente o que pode ser comprovado, sem dupla execução nem falso sucesso.
- Falha localizada não demonstrada como local, bloqueio geral, autenticação, limite global, falta de espaço ou perda de persistência: pausar quando não for possível seguir com segurança e integridade.
- Falha isolada de gravação versus indisponibilidade do destino compartilhado: manter resultado aguardando gravação e pausar globalmente quando o destino comum impedir a continuidade.
- Retomada individual durante outra coleta, clique duplo ou duas interfaces abertas: respeitar exclusividade e apontar a execução ativa.
- Pendências de execuções diferentes ou de meses diferentes: selecionar explicitamente a execução e conservar seus contextos; não juntar filas silenciosamente.
- Alteração das páginas do site entre tentativa e retomada: não prometer fotografia temporal única; conservar a identificação da execução e das tentativas.
- Lista extensa: permitir localizar pendentes e consultar seu motivo sem depender de ler um log técnico completo.
- Abrir Configurações, cancelar um seletor de pasta ou recusar permissão não deve apagar preferências válidas nem checkpoints.

## UI & UX Behavior

### Information Architecture

Revisão solicitada pelo usuário em T051 (2026-11-14): recuperar navegação visível Links/Itens/Lote da interface anterior, mantendo Configurações dedicada no cabeçalho. Lote permanece a entrada padrão da coleta autônoma. O usuário confirmou que deseja ver municípios da fila, com atual destacado, progresso e resultado. Trocar abas é navegação visual, preserva execução/filtros e não dispara coleta. Links/Itens dão acesso explícito aos modos existentes; não viram passos obrigatórios. Resumo compacto deve deixar a fila visível durante processamento; posição atual, páginas/anúncios e resultado aparecem sem exigir abrir cada detalhe. Não introduzir listagem de anúncios individuais neste ajuste.

- **Coleta** é a superfície principal no painel lateral. Ao abri-la, mostrar a execução ativa; na ausência dela, a última execução consultada ou o estado pronto para iniciar. A execução exibida deve estar identificada por origem e data, sem trocar silenciosamente conforme a aba ativa muda.
- **Configurações** é uma tela dedicada, acessível pelo painel, com retorno explícito para Coleta. Abrir ou retornar dessa tela preserva a execução, o filtro e a localidade consultada.
- **Outras ferramentas** reúne os acessos existentes à exportação de localidades, importação de lista e coleta individual, em posição secundária. Esses modos não devem competir visualmente com Iniciar coleta nem parecer etapas obrigatórias do fluxo principal.
- Consultar outra execução é uma ação secundária. Se houver uma coleta ativa diferente da consultada, mostrar esse fato e a ação Voltar à coleta ativa.

### First Use and Ready State

1. Sem destino configurado, apresentar uma explicação curta do fluxo e a ação Configurar pasta de anúncios. Proxy e limites avançados não são passos obrigatórios quando seus valores atuais permitem coletar.
2. Depois da configuração, retornar ao contexto de coleta. Configurar uma pasta por si só não inicia solicitações; o usuário aciona Iniciar coleta quando estiver pronto.
3. Antes do início, mostrar a página de origem reconhecida, o destino efetivo e a regra de substituição existente. O total de localidades pode aparecer como A descobrir; não é necessário realizar coleta antecipada para preencher uma prévia.
4. Em página incompatível, informar como abrir uma página com localidades. Não deixar um botão desabilitado como única explicação.
5. Após o acionamento, reconhecer a ação com Descobrindo localidades… e impedir início duplicado. O alcance fica fixado nesse momento. Se a origem mudar antes de obter uma lista válida, explicar a interrupção e permitir tentar novamente a partir da nova página, sem mesclar origens.
6. A descoberta válida leva automaticamente à coleta. Não inserir uma etapa adicional de revisão ou confirmação da lista no caminho normal.

### Panel Hierarchy

O painel deve permitir responder, nesta ordem: o que está acontecendo, quanto falta resolver, qual localidade está ativa e o que o usuário pode fazer.

1. **Cabeçalho**: nome Coleta, identificação curta da origem e acesso a Configurações e ao recolhimento.
2. **Resumo**: estado geral e contagens por categoria, com aviso persistente quando houver intervenção necessária.
3. **Atividade atual**: nome da localidade, etapa e progresso confirmado. Durante espera, motivo e prazo conhecido substituem indicadores que sugiram atividade de rede contínua.
4. **Ação contextual**: um único destaque primário por estado. Pausar e ações secundárias continuam fáceis de localizar.
5. **Lista de localidades**: busca por nome e filtros Todas, Em andamento, A iniciar, Pendentes e Concluídas, com contagens. Concluídas inclui finalizadas sem anúncios, distinguindo-as por texto.
6. **Detalhe sob demanda**: motivo da falha, páginas confirmadas, próxima ação, resultado/destino quando disponível e diagnóstico técnico expansível. Logs, IDs e ajustes numéricos não ocupam o resumo cotidiano.

Atualizações não devem reordenar a linha consultada, deslocar a rolagem nem fechar seus detalhes. Nomes longos precisam continuar identificáveis; informações essenciais e ações não podem depender de passar o mouse.

### Status and Action Matrix

| Estado da execução | Mensagem principal | Ação em destaque | Comportamento esperado |
| --- | --- | --- | --- |
| Configuração necessária | Escolha a pasta para salvar os anúncios | Configurar pasta | Explicar o requisito ausente; preservar configurações válidas |
| Pronta | Coletar localidades desta página | Iniciar coleta | Informar origem e destino antes do acionamento |
| Descobrindo | Descobrindo localidades… | Pausar | Mostrar atividade sem percentual fictício; impedir novo início |
| Coletando / Salvando | Coletando em [localidade] / Salvando resultado… | Pausar | Preservar a distinção entre dados coletados e arquivo salvo |
| Espera automática | Próxima solicitação em [tempo], quando conhecido | Pausar | Informar que seguirá automaticamente; se não houver prazo conhecido, não inventar contagem regressiva |
| Pausa solicitada | Pausando com segurança… | Sem novo comando primário | Reconhecer o pedido e impedir repetição; só mostrar Pausada quando confirmado |
| Pausada pelo usuário | Coleta pausada; progresso preservado | Retomar coleta | Continuar a execução e sua fila restante após verificar elegibilidade |
| Intervenção necessária | Coleta pausada: [motivo] | Ação correspondente ao impedimento | Por exemplo Reautorizar pasta ou Conferir acesso; explicar quando ainda há espera obrigatória |
| Interrompida | Coleta interrompida; progresso recuperado | Retomar coleta | Exigir ação manual e informar o que será retomado |
| Finalizada com pendências | Coleta finalizada com [N] pendências | Retomar pendentes ([N recuperáveis]) | Excluir os concluídos; identificar impedimentos que permanecerão |
| Concluída | Captura concluída | Nova coleta | Exibir resumo e destino; Nova coleta retorna à preparação da página atual, sem iniciar rede automaticamente |

Durante uma execução ativa, a retomada de outra localidade não dispara coleta concorrente nem preempção silenciosa. A interface explica que é necessário pausar a coleta atual ou aguardar seu término. Corrigir um impedimento não retoma automaticamente uma sessão que exige ação manual.

### Progress Semantics

- **A iniciar** significa que a localidade ainda não foi tentada. **Pendente** significa falha, interrupção/incompletude ou resultado aguardando gravação. Esses grupos não compartilham o mesmo contador.
- O resumo contabiliza todos os itens em categorias mutuamente exclusivas: a iniciar, em andamento (incluindo espera/gravação em curso), concluídos com arquivo salvo, concluídos sem anúncios e pendentes. Um item com resultado preservado mas gravação parada é pendente, não está simultaneamente em andamento.
- Exemplo de resumo: 6 de 10 localidades concluídas · 1 em andamento · 2 a iniciar · 1 pendente. Os números devem somar o total e continuar visíveis mesmo quando a lista estiver filtrada.
- Uma barra, se usada, representa localidades concluídas sobre o total descoberto e tem esse rótulo. Uma rodada que tentou todas as localidades mas deixou falhas não mostra 100% de conclusão.
- Durante descoberta, o total é desconhecido. No item atual, mostrar páginas confirmadas e anúncios coletados, sem estimar tempo restante ou percentual a partir de totais incertos.
- Retomar coleta continua a execução pausada/interrompida e seus itens a iniciar. Retomar pendentes seleciona somente pendências recuperáveis. Cada ação informa seu alcance; itens a iniciar não são omitidos silenciosamente do resumo nem incluídos sob um nome incorreto.
- No detalhe do item, usar Retomar coleta, Tentar salvar novamente ou Resolver impedimento conforme a etapa necessária. A recuperação em grupo pode combinar essas etapas, informando as quantidades antes do acionamento, sem confirmação extra obrigatória.

### Settings and Recovery

- Organizar Configurações em Pastas, Conexão e Limites de coleta. Em Pastas, diferenciar destino de anúncios e destino da exportação separada de localidades; só o primeiro é pré-requisito do novo fluxo.
- Mostrar o perfil conservador e uma explicação curta em Limites de coleta; campos numéricos e diagnósticos ficam sob expansão explícita. A conexão direta válida não deve aparecer como configuração incompleta só porque não há proxy.
- Usar Salvar configurações e retorno explícito do resultado. Indicar alterações ainda não salvas; ao sair, oferecer permanecer ou descartar apenas essas edições. Autorizações nativas de pasta devem informar quando já tiveram efeito, separadamente das edições ainda não salvas.
- Cada ajuste deve explicar unidade, finalidade e restrição. Diante de erro, manter os valores digitados para correção e preservar os valores efetivos anteriores.
- Durante coleta, campos cuja alteração seja incompatível ficam indisponíveis com motivo visível e orientação para pausar; não criar aplicação futura silenciosa.
- Erros de execução devem responder: o que aconteceu, se os dados estão preservados e qual ação ajuda a continuar. Códigos e mensagens técnicas ficam nos detalhes.
- Reiniciar ou descartar dados recuperáveis é ação secundária, com confirmação que identifica localidade/execução e o que será perdido. Pausar, recolher o painel e navegar não pedem confirmação destrutiva.
- Com painel fechado, a entrada da extensão deve sinalizar de forma discreta execução ativa, intervenção necessária ou término, com significado textual acessível ao consultá-la. Não abrir painel, trocar foco, emitir som ou exigir notificações do sistema para comunicar progresso.
- O resumo final permanece consultável, com contagem de arquivos confirmados, localidades sem anúncios, pendências e destino. Não depender apenas de aviso temporário.

### Accessibility and Content

- Manter rótulos visíveis e nomes acessíveis para ações; ícones sozinhos exigem identificação acessível. Erros de campo devem ser associados ao campo e alcançáveis por teclado.
- Ao abrir detalhes ou confirmação, posicionar o foco de forma previsível e devolvê-lo à ação de origem ao fechar. Atualizações automáticas não movem o foco. Ações de interface não podem manter o teclado preso no painel.
- Anunciar mudanças significativas de estado para leitores de tela sem repetir cada contador ou segundo de espera. Respeitar preferência de movimento reduzido.
- Em painel estreito de 320 pixels CSS e com zoom de 200%, as ações e textos essenciais devem continuar utilizáveis sem sobreposição nem rolagem horizontal do conteúdo principal.
- Usar contraste legível, texto além da cor, linguagem consistente em português e datas/quantidades formatadas de modo compreensível. Não exibir ao usuário termos internos como ownership, checkpoint ou elegibilidade quando uma explicação como progresso salvo ou disponível após [horário] for suficiente.

## Requirements

### Functional Requirements

- **FR-001**: O sistema DEVE oferecer uma ação primária Iniciar coleta que encadeie descoberta, coleta de anúncios e gravação dos resultados completos em um único acionamento, quando os pré-requisitos estiverem válidos.
- **FR-002**: O sistema DEVE descobrir somente as localidades diretamente listadas na navegação da página atual, sem explorar outros níveis automaticamente e sem adicionar a própria página como outro item se ela não estiver nessa lista.
- **FR-003**: O sistema DEVE vincular a execução à origem usada na descoberta e manter sua fila estável após descobri-la, independentemente da navegação posterior do usuário.
- **FR-004**: O sistema DEVE validar os destinos descobertos e impedir duplicação do mesmo destino na fila; nomes iguais com destinos distintos não devem ser fundidos. Se não puder definir uma fila válida, deve informar a falha sem iniciar uma captura apresentada como completa.
- **FR-005**: O sistema DEVE verificar configuração, disponibilidade do destino de gravação e elegibilidade antes de iniciar os anúncios, apresentando ação específica para cada pré-requisito ausente.
- **FR-006**: O sistema DEVE iniciar os anúncios após descobrir a fila sem exigir importação manual, exportação da lista ou segundo comando de início.
- **FR-007**: O sistema DEVE manter a exportação de localidades acessível como ação separada, preservando suas autorizações e confirmação de substituição existentes.
- **FR-008**: O sistema DEVE apresentar um painel lateral recolhível ao lado do site, acessível novamente pela extensão e associado à execução escolhida.
- **FR-009**: O painel DEVE mostrar estágio atual, origem, nome da localidade ativa, total de itens, contagens por estado e páginas/anúncios confirmados, distinguindo descoberta, coleta, espera, gravação, pausa, interrupção e término.
- **FR-010**: O sistema DEVE diferenciar localidades na fila, em coleta, aguardando gravação, concluídas, sem anúncios confirmados e pendentes por falha/incompletude; cada pendência deve apresentar motivo compreensível e a ação aplicável.
- **FR-011**: O sistema DEVE informar esperas e condições que exigem intervenção, incluindo prazo conhecido de elegibilidade, sem apresentar espera normal como travamento ou promessa de reinício automático.
- **FR-012**: O sistema DEVE continuar a execução com o Chrome aberto ao recolher/fechar o painel ou navegar, sem depender de manter o popup ou outra tela de controle aberta. Fechamento, falha ou indisponibilidade da própria aba de coleta deve preservar o checkpoint e ser informado.
- **FR-013**: O sistema DEVE preservar a página em que o usuário navega e não tomar seu foco automaticamente durante a coleta; abrir a página de coleta para inspeção deve ser ação explícita.
- **FR-014**: O sistema DEVE recuperar o resumo e o controle da execução ao reabrir o painel, sem reiniciar a fila; após reiniciar o Chrome deve oferecer retomada manual sem coletar automaticamente.
- **FR-015**: O sistema DEVE oferecer Pausar e Retomar com estados coerentes e preservar o progresso confirmado. Pausa explícita do usuário não pode provocar avanço automático para outro item.
- **FR-016**: O sistema DEVE preservar uma localidade com falha específica como pendente e seguir as demais, após esgotar somente as tentativas transitórias permitidas e respeitando todos os limites vigentes.
- **FR-017**: O sistema DEVE pausar todo o lote diante de bloqueio/desafio, limite de acesso que exija retomada manual, divergência de proxy, restrição global ou falha que impeça preservar resultados. Não deve seguir outro item para contornar essa condição; esperas ordinárias de ritmo continuam sendo esperas.
- **FR-018**: O sistema DEVE distinguir falhas comprovadamente locais de condições compartilhadas. Quando não houver evidência suficiente para seguir, deve preservar o progresso e pausar com diagnóstico. O plano deve explicitar a classificação antes da implementação.
- **FR-019**: O sistema DEVE permitir selecionar uma execução e localizar suas pendências por nome/estado, exibindo origem suficiente para distinguir localidades homônimas.
- **FR-020**: O sistema DEVE oferecer Retomar em cada localidade pendente recuperável e Retomar pendentes para todos os itens pendentes recuperáveis da execução escolhida, informando impedimentos individuais.
- **FR-021**: A retomada DEVE aproveitar o último checkpoint compatível e os dados confirmados, sem recolher páginas confirmadas para reconstruir memória, sem incluir localidades concluídas e sem misturar execuções.
- **FR-022**: O sistema DEVE resolver resultados aguardando gravação com os dados preservados antes de considerar recoleta, e só apresentar arquivo salvo após confirmação efetiva da gravação.
- **FR-023**: O sistema DEVE explicar incompatibilidade ou ausência de dados recuperáveis; reiniciar ou descartar exige ação explícita. A retomada não pode apagar resultados silenciosamente.
- **FR-024**: O sistema DEVE manter exclusividade de coleta entre modos e interfaces, tornando comandos duplicados inofensivos e apontando a execução já ativa.
- **FR-025**: O sistema DEVE apresentar resumo final com itens concluídos, sem anúncios e pendentes. Término com pendências deve ser distinto de captura integral; esta só pode ser anunciada sem falhas, itens incompletos ou gravações pendentes.
- **FR-026**: O sistema DEVE concentrar destinos, proxy, preferências existentes, limites e ações de diagnóstico de IP em uma tela dedicada de Configurações. O acompanhamento deve priorizar início, progresso, pausa e recuperação, com acesso claro às configurações e aos detalhes de diagnóstico.
- **FR-027**: Configurações DEVE recuperar os valores existentes, validar alterações antes de aplicá-las, preservar os valores anteriores diante de erro/cancelamento e indicar se uma alteração requer pausar/reiniciar a sessão.
- **FR-028**: O sistema DEVE preservar autorizações ainda válidas e oferecer seleção/reautorização quando necessário, sem perder fila ou resultados; não deve solicitar novamente credenciais já disponíveis apenas pela reorganização da interface.
- **FR-029**: O sistema DEVE preservar esperas, tentativas, consumo, checkpoints, mês original da execução, regras de proxy e confirmação de gravação ao alternar telas ou retomar. Mudar preferências não pode zerar consumo nem eliminar restrições em vigor.
- **FR-030**: O sistema DEVE manter formatos, nomes, destinos e regras de substituição dos arquivos anteriores, sem gravar resultados parciais como finais nem criar download de reserva no Lote.
- **FR-031**: O sistema DEVE tornar as ações acessíveis por teclado, manter foco identificável e apresentar estados com texto além de cor; mudanças de progresso devem ser perceptíveis sem deslocar o foco do usuário.
- **FR-032**: O sistema DEVE preservar dados e alterações existentes, limitar diagnósticos aos dados necessários e impedir exposição de senhas, cookies ou credenciais no painel, histórico e arquivos exportados.
- **FR-033**: O sistema DEVE apresentar apenas progresso confirmado e totais conhecidos. Não deve derivar conclusão exclusivamente das estimativas de anúncios do site nem exibir percentual de páginas quando o total for desconhecido.

- **FR-034**: O sistema DEVE aplicar a hierarquia e a matriz de estados de UI & UX Behavior, com um destaque primário contextual, feedback imediato ao acionamento e motivo visível para ações indisponíveis.
- **FR-035**: O sistema DEVE orientar o primeiro uso, mostrar origem e destino antes do início e distinguir configuração inicial de iniciar coleta, sem exigir configurar proxy ou exportação de localidades quando não necessários.
- **FR-036**: O sistema DEVE separar itens a iniciar de pendências recuperáveis, manter contadores sem dupla contagem e explicitar a diferença entre Retomar coleta e Retomar pendentes.
- **FR-037**: O sistema DEVE oferecer busca e filtros por estado sem alterar a fila, preservar o contexto consultado durante atualizações e apresentar detalhes e diagnósticos sob demanda.
- **FR-038**: O sistema DEVE reconhecer pedidos de pausa antes de sua conclusão, exibir Pausando com segurança enquanto necessário e impedir comandos duplicados ou conflitantes.
- **FR-039**: Configurações DEVE organizar ajustes por finalidade, distinguir edições não salvas de valores efetivos, informar sucesso/erro e permitir sair sem perder edições silenciosamente, preservando o contexto de retorno à coleta.
- **FR-040**: O sistema DEVE manter sinalização discreta consultável com o painel fechado e um resumo final persistente, sem abrir interfaces nem tomar foco automaticamente.
- **FR-041**: O sistema DEVE cumprir os comportamentos de foco, leitura assistiva, movimento reduzido e adaptação a painel estreito/zoom definidos em Accessibility and Content.
- **FR-042**: O sistema DEVE manter reinício e descarte como ações secundárias, com confirmação contextual de perda de dados recuperáveis, e não usar essas ações como solução padrão para falha recuperável.

### Key Entities

- **Execução de coleta**: Identifica origem, momento inicial, fila definida, estágio, localidade ativa, totais por estado, contexto de exportação e condição geral de continuidade.
- **Localidade da execução**: Destino identificado por origem/URL, nome e tipo quando disponível, com estado, progresso confirmado, tentativas, motivo de pendência e possibilidade de retomada.
- **Checkpoint recuperável**: Progresso confirmado e contexto necessários para continuar a captura ou a gravação de uma localidade sem repetir trabalho confirmado.
- **Resultado e confirmação de gravação**: Dados coletados e evidência de que seu arquivo foi efetivamente salvo; distinguem captura completa de arquivo ainda pendente.
- **Configuração do app**: Destinos autorizados, preferências de proxy, limites e diagnóstico existentes, com indicação de validade e de aplicabilidade à execução.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Em cenário com configurações válidas e três localidades diretamente listadas, um acionamento inicia descoberta e coleta das três, sem copiar/importar lista, exportar localidades ou iniciar manualmente cada item.
- **SC-002**: Em cenário com links repetidos e níveis geográficos abaixo dos links listados, 100% dos destinos válidos diretamente listados entram uma única vez na fila e nenhum nível adicional é explorado.
- **SC-003**: Com o painel visível e o navegador responsivo, mudanças confirmadas de estágio e progresso aparecem em até 2 segundos; ao reabri-lo, o estado atual aparece em até 2 segundos após a interface ficar disponível.
- **SC-004**: Em uma coleta controlada, recolher o painel, fechá-lo e navegar em outra página não interrompem a captura, não alteram sua fila e não substituem a página do usuário.
- **SC-005**: Em fila A/B/C com falha específica de B, C é processado sem ação manual; B permanece identificável como pendente. Retomar B não repete A/C nem páginas já confirmadas de B.
- **SC-006**: Em execução com múltiplas pendências, Retomar pendentes seleciona 100% dos itens pendentes recuperáveis dessa execução e zero itens já concluídos, exibindo os impedimentos restantes.
- **SC-007**: Nos cenários de bloqueio geral, espera obrigatória, divergência de proxy e falha de preservação, nenhuma solicitação de outro item é iniciada para escapar da restrição; o painel apresenta motivo e ação coerentes.
- **SC-008**: Após reiniciar o Chrome, a execução controlada é recuperável por ação manual, com contagens, checkpoint e contexto de exportação preservados e zero solicitações automáticas antes dessa ação.
- **SC-009**: Na recuperação de resultado completo aguardando gravação, zero páginas de anúncios são recoletadas; a conclusão só é exibida após confirmar a gravação.
- **SC-010**: Em execuções de sucesso integral, com pendências e interrompida, 100% dos estados finais correspondem aos checkpoints e às gravações efetivas; nenhum item incompleto é apresentado como concluído.
- **SC-011**: Todos os ajustes existentes de pastas, proxy, limites e diagnóstico de IP ficam acessíveis em Configurações, preservam seus valores válidos ao reabrir e dispensam a exposição dos formulários de ajuste na tela de progresso.
- **SC-012**: Início, acompanhamento, pausa, acesso a Configurações e retomada individual/em grupo são operáveis somente com teclado; todo estado relevante pode ser identificado por texto.
- **SC-013**: As verificações de regressão confirmam preservação dos formatos de exportação, regras de substituição, mês original, exclusividade e esperas existentes; nenhum diagnóstico de aceitação contém credenciais.

- **SC-014**: Em primeiro uso e em permissão vencida, o usuário encontra a ação que resolve o requisito sem consultar logs; após corrigir, retorna ao contexto de coleta e nenhuma coleta começa apenas por salvar uma configuração.
- **SC-015**: No cenário com 6 localidades concluídas, 1 em andamento, 2 a iniciar e 1 pendente, o resumo totaliza 10, a conclusão corresponde a 6/10 e filtros não alteram esses totais. Retomar pendentes seleciona a pendência recuperável; Retomar coleta também continua itens a iniciar da execução interrompida.
- **SC-016**: Em uma lista controlada com 308 localidades, busca, filtros e detalhes permitem localizar uma pendência sem ler logs; atualizações de outro item não removem foco, filtro, expansão ou posição de leitura.
- **SC-017**: Pedidos de iniciar, pausar e salvar configurações exibem reconhecimento visual em até 1 segundo com a interface responsiva; Pausada e Configurações salvas só aparecem após confirmação real da operação.
- **SC-018**: Os cenários de navegação com edições não salvas, ajuste inválido e descarte de checkpoint exibem consequências claras e preservam dados quando o usuário cancela a ação.
- **SC-019**: Em painel de 320 pixels CSS e em zoom de 200%, testar início, pausa, filtros, detalhes, Configurações e recuperação sem sobreposição ou perda de ações; validar também teclado, retorno de foco e anúncio de mudança de estado com leitor de tela.
- **SC-020**: Com o painel fechado, consultar a entrada da extensão distingue coleta ativa, intervenção e término. Reabrir exibe o mesmo estado e o resultado permanece consultável após o aviso inicial.

## Assumptions

- O público é o operador da extensão no mesmo perfil do Chrome, usando páginas suportadas do Idealista.pt. Não há mudança para serviço remoto.
- Um clique significa um acionamento de Iniciar coleta na interface pronta, depois da configuração inicial. Autorizações exigidas pelo navegador e a correção de configurações inválidas continuam sendo ações explícitas.
- Localidade é a entrada geográfica diretamente listada pela página. Município é um caso desse conceito; freguesias e regiões não são renomeadas incorretamente.
- A descoberta usa a página atual no momento do comando; não amplia seu alcance conforme o usuário navega.
- A fila preserva a ordenação atual de descoberta, inclusive prioridade por quantidade disponível, sem introduzir uma nova política de ordenação nesta feature.
- A reorganização concentra configurações existentes. Novas preferências, templates de execução, agendamento e personalização visual não são necessários para este escopo.
- Coletas legadas com checkpoints compatíveis devem continuar recuperáveis; dados inexistentes não podem ser reconstruídos por promessa da interface.
- Esperas de ritmo e tentativas transitórias já permitidas continuam automáticas. Bloqueios, esgotamento de limites e demais estados que já exigem retomada manual preservam essa exigência.
- A continuidade com o painel fechado é uma ampliação explícita da experiência anterior. Fechar o Chrome continua interrompendo a execução, com retomada manual.
- O painel recolhível e a tela de Configurações são requisitos de experiência; APIs, componentes, persistência, coordenação e layout detalhado ficam para o sdd-plan.
- A especificação não autoriza chamadas pagas, ativação de provedor comercial ou coleta real em escala. Evidências simuladas, navegador isolado, escrita nativa e site/proxy real devem permanecer distintas.

## Clarifications

### Session 2026-11-14

- Q: O que deve acontecer ao clicar em Iniciar coleta depois da configuração inicial? → A: Descobrir as localidades da página atual e coletar automaticamente os anúncios de todas elas.
- Q: Onde acompanhar o progresso enquanto navega no Idealista? → A: Em um painel lateral recolhível, ao lado do site, com resumo e detalhes por município.
- Q: Como seguir após falha ou incompletude de um município? → A: Separar falhas específicas, seguir os demais e oferecer retomada individual ou de todos os pendentes; bloqueios gerais pausam o lote.
- Q: Quais localidades da página atual entram na coleta? → A: As localidades diretamente listadas na navegação da página, sem explorar outros níveis automaticamente.
- Q: O que acontece ao recolher ou fechar o painel? → A: Continuar a coleta com o Chrome aberto; ao reiniciar o Chrome, oferecer retomada manual.
- Q: A lista descoberta deve ser exportada antes dos anúncios? → A: Não. Usar a lista como fila e iniciar os anúncios; manter a exportação de localidades como ação separada.

### Coverage Review

- Escopo funcional: início encadeado, alcance da descoberta e exportação separada foram confirmados; exploração recursiva e execução com navegador fechado ficaram excluídas.
- Domínio/dados: identidade por destino, nomes homônimos, checkpoint, resultado pendente e contexto mensal derivados das garantias existentes; nenhuma decisão de schema foi solicitada.
- Interação/UX: painel lateral, fechamento sem parada e seleção individual/em grupo confirmados. Configurações concentra os controles encontrados no repositório.
- Não funcional: atualização observável, teclado, foco e proteção de credenciais definidos sem exigir escolha técnica do usuário.
- Integração: preservação dos fluxos anteriores e distinção entre descoberta interna e exportação do catálogo definidas a partir das features 002/003/004.
- Edge cases: falha específica versus global, esperas, duplicidade, vazio, recuperação de gravação e reinício do navegador cobertos.
- Constraints/terminologia: localidade definida pelo que a página lista; município não é assumido como o único nível geográfico. Um clique pressupõe configuração inicial válida.
- Sinais de conclusão: critérios distinguem captura integral, término com pendências e interrupção, usando dados confirmados.
- Perguntas adicionais não foram necessárias para dados, integração, acessibilidade e proteção de dados: essas condições foram derivadas do código, dos contratos existentes e da constitution. Não restam marcadores de clarificação.

### UI/UX Review 2026-11-14

Revisão solicitada pelo usuário antes do sdd-plan. As seis decisões da entrevista foram mantidas. Os detalhamentos abaixo são refinamentos desta revisão, não novas respostas atribuídas ao usuário.

| Achado | Impacto | Resolução na spec |
| --- | --- | --- |
| Controles descritos sem hierarquia ou entrada principal | Risco de reproduzir a tela sobrecarregada | Information Architecture, Panel Hierarchy, FR-034/037 |
| Configurações classificada como P2 apesar de ser parte central do pedido | Entrega poderia manter a complexidade atual | US4 promovida a P1; FR-039 |
| Primeiro uso e retorno após autorização indefinidos | Usuário sem próximo passo ou início involuntário | First Use and Ready State, FR-035, SC-014 |
| Pendentes confundidos com itens ainda não tentados | Retomada e progresso com alcance ambíguo | Progress Semantics, FR-036, SC-015 |
| Pausa sem estado transitório e erros sem hierarquia de ação | Falso feedback de parada e cliques repetidos | Status and Action Matrix, FR-038, SC-017 |
| Fechar painel sem sinalização definida | Autonomia deixa o usuário sem indicação de resultado | FR-040, SC-020 |
| Edições de configuração sem regra de saída | Perda acidental ou aplicação silenciosa | Settings and Recovery, FR-039, SC-018 |
| Acessibilidade apenas genérica | Critérios insuficientes para painel estreito e leitura assistiva | Accessibility and Content, FR-041, SC-019 |

Referência externa consultada: [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), para foco, formulários, estados, conteúdo longo e feedback acessível. As regras foram adaptadas à experiência da extensão; esta revisão documental não certifica uma interface implementada.

O sdd-plan deve materializar estes comportamentos em telas e cenários verificáveis. Composição visual detalhada, componentes e APIs continuam no planejamento; esta revisão não cria plan.md nem tasks.md.

## Related Work

- 002-exportacao-localidades-pasta-autorizada: fluxo separado de exportação de localidades, autorização e confirmação de substituição preservados.
- 003-exportacao-lote-municipios: fila e exportação de arquivos municipais são a base do novo encadeamento; formatos e regras de escrita permanecem.
- 004-coleta-resiliente: checkpoints, exclusividade, ritmo e bloqueios são reaproveitados. Esta feature amplia a continuidade sem tela de controle, a recuperação por localidade e a passagem por falhas específicas; não revoga pausas obrigatórias.
- Bugs históricos de exportação parcial e botão Parar e Exportar continuam no backlog, fora desta entrega.

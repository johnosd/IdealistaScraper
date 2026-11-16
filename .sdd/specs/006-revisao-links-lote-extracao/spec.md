# Feature Specification: Revisão ponta a ponta de Links, Lote e extração paginada validada no site real

**Slug**: `006-revisao-links-lote-extracao`

**Created**: 2026-11-16

**Status**: Em Execução

**Input**: Como usuário, quero que o app colete todos os links de localidades da página de arrendamento do Idealista, carregue cada localidade no Lote com a URL de listagem correta e extraia os anúncios página a página, uma localidade após a outra, sem telas de configuração durante a coleta. O fluxo deve ser revisado e corrigido com base em inspeção aprofundada das páginas reais (`/arrendar-casas/#municipality-search`, `/arrendar-casas/braga-distrito/concelhos-freguesias` e `/arrendar-casas/braga-distrito`), validando também o comportamento diante de bloqueios. Após as mudanças da 005 o fluxo voltou a apresentar problemas que não foram resolvidos.

## Escopo

### Incluído

- Inspeção aprofundada, no site real, das três páginas principais usadas pelo app, com relatório do que cada uma oferece (estrutura, quantidade de links, paginação, sinais de bloqueio) e comparação com o que o app extrai hoje.
- Correção dos erros encontrados nessa comparação em: coleta de links de localidades, carga das localidades no Lote, derivação da URL de listagem e extração paginada dos anúncios.
- Garantia de que o comando de coletar links captura todos os links de localidades exibidos na página, sem perdas e sem duplicatas.
- Cada link coletado vira uma entrada do Lote cuja listagem é a URL do link sem o sufixo `/concelhos-freguesias` (ex.: `braga-distrito/concelhos-freguesias` → `braga-distrito/`), que reúne todas as casas e apartamentos independentemente da freguesia.
- Extração, para cada entrada, de todas as páginas de resultados até a última, concluindo uma entrada antes de iniciar a seguinte.
- Navegação em uma aba visível do Idealista, dedicada à coleta, sem abrir telas da extensão (configurações, exportação, runner) durante o processamento.
- Direcionamento do usuário à aba Configurações apenas quando faltar a configuração inicial, antes do início da coleta.
- Tratamento de bloqueios temporários: detectar, pausar a fila, esperar e retomar automaticamente quando o site voltar ao normal.
- Deduplicação de anúncios por identificador entre entradas sobrepostas (região, sub-região, município) e relato do que foi repetido.
- Aviso explícito quando uma listagem for truncada por limite do site.
- Validação em site real com a extensão instalada, com evidência registrada separadamente de testes controlados.

### Fora de Escopo

- Contornar desafios/CAPTCHA, resolver verificações automaticamente, ignorar esperas ou rotacionar IP.
- Subdividir automaticamente uma listagem truncada em listagens menores; ela é apenas sinalizada.
- Coletar detalhes internos de cada anúncio, alterar ou remover campos existentes dos arquivos, destinos convencionados ou regras de substituição. A única mudança de schema permitida é o acréscimo dos campos opcionais de contexto da US7.
- Expandir automaticamente a fila para o nível de município a partir de distritos/sub-regiões.
- Rodar com o Chrome fechado ou reiniciar a coleta sozinho ao abrir o navegador.
- Redesenhar o painel, as abas ou a tela de Configurações da 005, além do necessário para cumprir os requisitos abaixo.
- Tornar o proxy obrigatório ou fazer a extensão ler o arquivo `.env`; o proxy continua opcional e configurado em Configurações.
- Coleta do site inteiro ou de outras páginas além das de arrendamento.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entender o que as páginas reais oferecem e corrigir divergências (Priority: P1)

Como usuário, quero que as três páginas principais sejam inspecionadas no site real e comparadas com o que o app extrai, para que os erros introduzidos nas últimas mudanças sejam identificados e corrigidos com base em fatos.

**Why this priority**: Sem saber o que o site realmente entrega, as correções seguintes seriam mais um palpite; esta story sozinha já entrega o diagnóstico e as correções de extração.

**Independent Test**: Abrir as três páginas no site real, contar os links e a estrutura de cada uma, executar o extrator do app sobre a mesma página e conferir que o resultado coincide com o observado, sem links a menos nem a mais.

**Acceptance Scenarios**:

1. **Given** a página nacional de arrendamento, **When** o app extrai os links de localidades, **Then** o total e a lista coincidem com os links de localidades visíveis na própria página.
2. **Given** a página `braga-distrito/concelhos-freguesias`, **When** o app extrai os links, **Then** obtém todos os municípios e freguesias listados nela, com URLs corretas e sem duplicatas.
3. **Given** a listagem `braga-distrito/`, **When** o app lê uma página de resultados, **Then** obtém todos os anúncios exibidos e identifica corretamente se existe próxima página.
4. **Given** qualquer divergência encontrada entre o site real e o app, **When** a revisão termina, **Then** a divergência está registrada no relatório com a evidência e a correção correspondente.
5. **Given** a estrutura do site mudou em relação ao que o app espera, **When** a inspeção detecta isso, **Then** o relatório informa o que mudou e o app é ajustado, em vez de assumir o formato antigo.

---

### User Story 2 - Coletar todos os links de localidades com um clique (Priority: P1)

Como usuário, quero clicar em coletar links de localidades e obter todos os links exibidos na página, sem que abram telas de configuração ou exportação enquanto o processamento acontece.

**Why this priority**: É a porta de entrada do fluxo; links perdidos ou telas inesperadas inviabilizam o restante.

**Independent Test**: Com a configuração inicial pronta, clicar uma vez na página nacional e conferir que a quantidade de links coletados é igual à da página e que nenhuma tela da extensão foi aberta.

**Acceptance Scenarios**:

1. **Given** a configuração inicial pronta e a página de localidades aberta, **When** o usuário clica em coletar links, **Then** todos os links de localidades da página são coletados, e a contagem coletada é igual à contagem visível.
2. **Given** a coleta em andamento, **When** acompanha o processamento, **Then** nenhuma tela de configuração, exportação ou técnica da extensão é aberta em primeiro plano; a navegação ocorre em uma aba do Idealista.
3. **Given** a configuração inicial ausente ou inválida, **When** o usuário tenta coletar, **Then** é orientado a abrir a aba Configurações, explicando o que falta, e nenhuma navegação do scraping é iniciada.
4. **Given** uma coleta de links ativa, **When** o usuário clica de novo, **Then** acompanha a coleta existente sem duplicá-la.
5. **Given** a página sem localidades reconhecíveis, **When** o usuário clica, **Then** é informado de que nada foi encontrado e nenhuma execução vazia é apresentada como sucesso.

---

### User Story 3 - Carregar cada localidade no Lote com a listagem correta (Priority: P1)

Como usuário, quero que, após coletar os links, cada localidade apareça como um item da lista do Lote apontando para a listagem completa daquela localidade, para extrair todas as casas e apartamentos sem depender de freguesia.

**Why this priority**: O Lote só é útil se cada item aponta para a listagem certa; é pré-requisito da extração.

**Independent Test**: Coletar os links, abrir a aba Lote e conferir que a lista tem uma entrada por link e que a URL de listagem de cada entrada é a do link sem o sufixo `/concelhos-freguesias`.

**Acceptance Scenarios**:

1. **Given** links coletados, **When** abre a aba Lote, **Then** vê uma entrada por localidade, com nome e URL de listagem, sem exigir importação manual de arquivo.
2. **Given** o link `…/braga-distrito/concelhos-freguesias`, **When** a entrada é criada, **Then** sua listagem é `…/braga-distrito/`.
3. **Given** um link que não termina em `/concelhos-freguesias`, **When** a entrada é criada, **Then** a URL é usada como listagem sem alteração indevida, e o relatório indica a regra aplicada.
4. **Given** dois links que resultam na mesma listagem, **When** a lista é formada, **Then** aparece uma única entrada.
5. **Given** uma localidade cuja URL de listagem não abre ou redireciona para outra região, **When** a validação detecta o problema, **Then** a entrada é marcada com o motivo, sem corromper as demais.

---

### User Story 4 - Extrair todas as páginas de cada item, um após o outro (Priority: P1)

Como usuário, quero que o Lote percorra cada item iterando as páginas de resultados até a última e só então inicie o item seguinte, para ter cada localidade completa antes de passar adiante.

**Why this priority**: É o resultado final do produto: anúncios completos por localidade.

**Independent Test**: Com um item de poucas páginas, iniciar o Lote e conferir que todas as páginas foram lidas até a última, que os anúncios foram gravados e que o próximo item só começou depois.

**Acceptance Scenarios**:

1. **Given** um item com várias páginas, **When** a extração roda, **Then** lê a primeira página, depois cada página seguinte, até que o site não ofereça mais próxima página.
2. **Given** uma última página identificada, **When** a leitura termina, **Then** o resultado completo do item é gravado e o item é marcado como concluído antes de qualquer pedido do item seguinte.
3. **Given** um item concluído, **When** há itens a iniciar, **Then** o próximo começa automaticamente, mantendo no máximo um item ativo.
4. **Given** um item sem anúncios, **When** lido, **Then** é concluído como vazio, distinguido de falha de leitura.
5. **Given** a listagem com número de resultados acima do que o site permite percorrer, **When** o item termina, **Then** é marcado como "limitado pelo site", com o total declarado e o total obtido, sem afirmar captura integral.
6. **Given** falha específica de um item, **When** esgota as tentativas permitidas, **Then** permanece como pendente com o progresso preservado e a fila segue para o próximo, conforme as regras da 005.
7. **Given** o mesmo anúncio aparecendo em duas entradas sobrepostas, **When** a execução termina, **Then** o resumo informa quantos anúncios únicos foram obtidos e quantos foram repetidos entre entradas.

---

### User Story 5 - Atravessar bloqueios temporários sem intervenção (Priority: P2)

Como usuário, quero que, ao encontrar uma tela bloqueada que depois deixa de existir, o app espere e retome sozinho, para não precisar acompanhar a coleta.

**Why this priority**: O bloqueio acontece no site real e interrompe a fila; sem retomada automática o fluxo não é autônomo, mas as stories anteriores têm valor sem ela.

**Independent Test**: Simular ou provocar um bloqueio temporário numa listagem, observar a pausa e, quando o site voltar a responder normalmente, observar a retomada sem clique do usuário.

**Acceptance Scenarios**:

1. **Given** uma resposta de bloqueio (acesso negado, limite de requisições ou desafio), **When** detectada, **Then** a fila inteira é pausada, o motivo e o prazo de nova verificação ficam visíveis e nenhuma listagem adicional é solicitada nesse intervalo.
2. **Given** o prazo vencido e o site voltando ao normal, **When** a verificação ocorre, **Then** a fila retoma do ponto confirmado, sem repetir páginas já coletadas e sem exigir confirmação manual.
3. **Given** o bloqueio persistente após as verificações permitidas, **When** o limite é atingido, **Then** a execução passa a "intervenção necessária", com o progresso preservado, e não tenta contornar o bloqueio.
4. **Given** um bloqueio durante a coleta de links, **When** ocorre, **Then** o mesmo tratamento é aplicado e os links já obtidos são preservados.
5. **Given** um proxy configurado e funcional, **When** o bloqueio ocorre, **Then** a verificação segue as mesmas regras; o proxy não é exigido para o fluxo.

---

### User Story 6 - Prova em site real com a extensão instalada (Priority: P2)

Como usuário, quero um relatório de validação real que mostre o fluxo completo funcionando, para saber se o problema foi resolvido de fato e não apenas em testes controlados.

**Why this priority**: As features anteriores ficaram sem aceite por falta de prova real; esta story fecha o ciclo, mas depende das anteriores.

**Independent Test**: Executar o roteiro de validação com a extensão instalada: coletar links, ver as entradas no Lote e concluir ao menos uma localidade até a última página; conferir o relatório.

**Acceptance Scenarios**:

1. **Given** a extensão instalada e a configuração pronta, **When** a validação real é executada, **Then** o relatório registra a contagem de links coletados versus a contagem da página, a lista de entradas do Lote e ao menos uma localidade concluída com todas as páginas.
2. **Given** a validação real não pôde ser executada (conexão, bloqueio, indisponibilidade), **When** o registro é feito, **Then** o motivo fica descrito e a feature não é declarada aceita.
3. **Given** a evidência registrada, **When** consultada, **Then** distingue de forma explícita teste unitário, ambiente controlado, site real sem a extensão e site real com a extensão instalada, sem credenciais nem tokens.

---

### User Story 7 - Anúncios com contexto geográfico (Priority: P3)

Como usuário, quero que cada anúncio gravado traga a região, sub-região, município e, quando possível, a freguesia, para analisar os dados sem cruzar manualmente com a lista de localidades.

**Why this priority**: Enriquece os dados, mas a coleta completa (P1) tem valor sem ela.

**Independent Test**: Coletar uma entrada de município e outra de sub-região e conferir que os anúncios gravados têm os campos de contexto corretos e que os campos antigos permanecem idênticos.

**Acceptance Scenarios**:

1. **Given** uma entrada originada de um link de município, **When** seus anúncios são gravados, **Then** cada anúncio traz `Região`, `Sub-região` e `Município` da entrada.
2. **Given** uma entrada de região ou sub-região, **When** gravada, **Then** os níveis inexistentes ficam `null`, sem inventar município.
3. **Given** a listagem real expõe a freguesia de forma confiável, **When** o anúncio é lido, **Then** `Freguesia` é preenchida; senão fica `null`.
4. **Given** um consumidor dos arquivos antigos, **When** lê o novo arquivo, **Then** todos os campos anteriores continuam com os mesmos nomes e valores.

---

### Edge Cases

- A URL informada pode divergir do caminho real (`concelhos-freguesia` vs. `concelhos-freguesias`); a inspeção deve confirmar o caminho real em vez de presumi-lo.
- Link de região ou sub-região sem o sufixo `/concelhos-freguesias`; link com barra final, parâmetros ou âncora (`#municipality-search`).
- Âncora na URL da página nacional: a coleta deve usar a página, não depender de a âncora estar presente.
- Listagem com uma única página, sem anúncios, ou com mais páginas do que o site permite percorrer.
- Número da página solicitada acima da última (site redireciona, repete a última ou exibe vazio): não contar como nova página nem gravar duplicatas.
- Mesma localidade aparecendo sob nomes ou regiões diferentes; homônimos com URLs distintas não devem ser fundidos pelo nome.
- Região, sub-região e município sobrepostos: anúncios repetidos entre entradas.
- Resposta HTTP 200 que contém desafio/página de verificação em vez de resultados; resposta de bloqueio que desaparece depois.
- Usuário fecha ou recolhe o painel, troca de aba ou navega em outra aba durante a coleta: a coleta continua e não é redirecionada.
- Usuário fecha a aba do Idealista dedicada durante a coleta: a execução é pausada com o progresso preservado, sem falso sucesso.
- Destino de gravação indisponível ou permissão vencida no meio da fila: pausar com motivo, sem perder o resultado coletado.
- Quantidade de resultados declarada pelo site diferente da obtida: relatar, sem inventar percentual.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE, antes de qualquer correção, produzir um relatório de inspeção das três páginas principais no site real, registrando estrutura, quantidade de links, paginação e sinais de bloqueio observados.
- **FR-002**: O sistema DEVE comparar o resultado da extração do app com o conteúdo real de cada página inspecionada e registrar toda divergência com a correção associada.
- **FR-003**: O comando de coletar links DEVE capturar todos os links de localidades exibidos na página de origem, sem omitir links visíveis e sem duplicatas.
- **FR-004**: A coleta de links DEVE validar a contagem coletada contra a quantidade de links de localidades presentes na página e sinalizar divergência.
- **FR-005**: Durante a coleta de links e a extração do Lote, o sistema NÃO DEVE abrir telas de configuração, exportação ou técnicas da extensão em primeiro plano.
- **FR-006**: O sistema DEVE realizar a navegação do scraping em uma aba visível do Idealista dedicada à coleta, separada da aba em que o usuário navega.
- **FR-007**: Quando faltar a configuração inicial, o sistema DEVE direcionar o usuário à aba Configurações, explicando o que falta, antes de qualquer navegação de scraping, e NÃO DEVE abrir essa tela por conta própria quando a configuração estiver completa.
- **FR-008**: Concluída a coleta de links, o sistema DEVE carregar automaticamente no Lote uma entrada por localidade, sem importação manual de arquivo.
- **FR-009**: Cada entrada do Lote DEVE ter como listagem a URL do link sem o sufixo `/concelhos-freguesias`; URLs sem esse sufixo DEVEM ser usadas sem alteração indevida.
- **FR-010**: O sistema DEVE evitar entradas duplicadas quando links distintos resultarem na mesma listagem, sem fundir localidades apenas pelo nome.
- **FR-011**: O sistema DEVE extrair, para cada entrada, todas as páginas de resultados em sequência até identificar que não existe próxima página.
- **FR-012**: O sistema DEVE concluir e gravar o resultado de uma entrada antes de iniciar a seguinte, mantendo no máximo uma entrada ativa.
- **FR-013**: O sistema DEVE identificar corretamente a última página, sem contar como nova uma página repetida, vazia ou redirecionada.
- **FR-014**: O sistema DEVE distinguir entrada concluída com anúncios, concluída sem anúncios, pendente e limitada pelo site, e NÃO DEVE afirmar captura integral nos dois últimos casos.
- **FR-015**: O sistema DEVE sinalizar quando a listagem for truncada por limite do site, informando o total declarado e o total obtido, sem subdividi-la automaticamente.
- **FR-016**: O sistema DEVE deduplicar anúncios por identificador entre entradas sobrepostas no resumo da execução, informando o total de anúncios únicos e os repetidos por entrada. O arquivo de cada entrada DEVE manter a listagem completa daquela entrada (sobreposição preservada nos arquivos).
- **FR-017**: Ao detectar bloqueio (acesso negado, limite de requisições ou desafio), o sistema DEVE pausar a fila inteira, exibir motivo e prazo de nova verificação e NÃO DEVE solicitar outras páginas nesse intervalo.
- **FR-018**: Após o prazo, o sistema DEVE reverificar o acesso automaticamente e, se o site estiver normal, retomar do último ponto confirmado sem confirmação manual e sem repetir páginas coletadas.
- **FR-019**: Se o bloqueio persistir após as verificações permitidas, o sistema DEVE passar a "intervenção necessária", preservando o progresso e sem tentar contornar o bloqueio.
- **FR-020**: O sistema NÃO DEVE resolver desafios automaticamente, ignorar esperas obrigatórias nem rotacionar IP.
- **FR-021**: O sistema DEVE manter o proxy opcional: o fluxo funciona em conexão direta e o proxy, quando configurado, segue as mesmas regras de bloqueio.
- **FR-022**: O sistema DEVE preservar as garantias da 004/005: ritmo, exclusividade, checkpoints, retomada por localidade, exportação e destinos convencionados. Exceção decidida pelo usuário: no Lote autônomo, ao atingir o orçamento de páginas por execução ou a duração máxima da execução, a fila DEVE abrir um novo ciclo automaticamente e continuar, mantendo intervalo mínimo e limite por janela.
- **FR-023**: O sistema DEVE manter credenciais, tokens e dados de proxy fora de artefatos versionáveis, relatórios, logs e testes.
- **FR-024**: O sistema DEVE produzir um relatório de validação real que distinga teste unitário, ambiente controlado, site real sem a extensão e site real com a extensão instalada.
- **FR-025**: Se a validação real com a extensão instalada não puder ser executada, o sistema DEVE registrar o motivo como pendência e a feature NÃO DEVE ser declarada aceita.
- **FR-026**: Cada anúncio gravado DEVE receber campos aditivos e opcionais de contexto da entrada (`Região`, `Sub-região`, `Município`), com `null` quando o nível não se aplica; os campos existentes NÃO DEVEM mudar de nome, tipo ou conteúdo.
- **FR-027**: O anúncio DEVE receber `Freguesia` somente quando a inspeção da listagem real demonstrar uma fonte confiável para ela; caso contrário o campo fica `null` e o relatório registra o motivo, sem inferência por texto livre não comprovada.
- **FR-028**: A coleta de links DEVE usar a página do Idealista em que o usuário está quando ela tiver lista de localidades reconhecível; nos demais casos DEVE usar a página nacional de arrendamento, informando a origem usada.

### Key Entities *(include if feature involves data)*

- **Localidade coletada**: nome, tipo observado (região, sub-região, município ou outro), URL do link e página de origem.
- **Entrada do Lote**: localidade, URL de listagem derivada, estado (a iniciar, em andamento, concluída, concluída sem anúncios, pendente, limitada pelo site), páginas confirmadas, anúncios coletados e total declarado pelo site quando conhecido.
- **Página de resultados**: posição, anúncios lidos, existência de próxima página e sinais de bloqueio.
- **Anúncio**: identificador, usado para deduplicação entre entradas; demais campos conforme o schema existente, sem alteração.
- **Evento de bloqueio**: tipo, momento, prazo de nova verificação, tentativas de reverificação e desfecho.
- **Relatório de inspeção/validação**: páginas inspecionadas, contagens observadas, divergências, correções e nível de evidência.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em 100% das páginas inspecionadas, a quantidade de links de localidades coletados é igual à quantidade visível na página.
- **SC-002**: Em 100% das execuções com configuração pronta, nenhuma tela de configuração, exportação ou técnica da extensão aparece durante a coleta de links ou do Lote.
- **SC-003**: Em 100% dos links coletados que terminam em `/concelhos-freguesias`, a listagem da entrada do Lote corresponde à URL sem esse sufixo.
- **SC-004**: Para cada entrada concluída, o número de páginas lidas é igual ao de páginas realmente existentes na listagem, sem página repetida ou omitida.
- **SC-005**: Em nenhum momento há mais de uma entrada do Lote em coleta ativa, e o início de uma entrada ocorre somente após a conclusão da anterior.
- **SC-006**: Diante de um bloqueio temporário que desaparece, a fila retoma sem ação do usuário em 100% dos casos testados, sem repetir páginas já coletadas.
- **SC-007**: Em 100% dos casos de bloqueio persistente, a execução termina em "intervenção necessária" com o progresso preservado e nenhuma tentativa de contornar a verificação.
- **SC-008**: Em 100% das entradas truncadas pelo limite do site, o resultado informa o total declarado e o obtido, e nenhuma é apresentada como captura integral.
- **SC-009**: O relatório de validação real registra, com evidência, ao menos uma localidade concluída de ponta a ponta com a extensão instalada, ou a pendência explícita que impede o aceite.
- **SC-010**: Em 100% dos anúncios gravados, os campos anteriores são idênticos aos produzidos sem o enriquecimento e os campos de contexto correspondem à entrada de origem.

## Assumptions

- A página nacional `…/arrendar-casas/` exibe a navegação de localidades; verificação de 2026-11-15 contou 84 links (7 regiões, 22 sub-regiões, 55 municípios). A contagem deve ser reconfirmada na inspeção desta feature, pois o site pode ter mudado.
- O caminho correto da página de localidades do distrito é `…/concelhos-freguesias` (forma usada no exemplo do pedido); a grafia `concelhos-freguesia` do pedido original é tratada como erro de digitação até a inspeção confirmar.
- O sufixo `/concelhos-freguesias` pode ser removido do link para obter a listagem completa da localidade; a inspeção deve confirmar isso para os níveis região, sub-região e município.
- O site pode limitar o número de resultados percorríveis por busca; essa limitação é detectada e relatada, não contornada.
- Bloqueios observados são temporários e deixam de existir sem ação do usuário (informação do histórico da 005); isso deve ser confirmado na validação real, sem presumir.
- O proxy é opcional. As credenciais ficam fora de artefatos; a extensão não lê `.env`, portanto os valores são informados em Configurações.
- A conexão do Playwright com o Chrome real pode recusar telas da extensão (limitação registrada na 005); nesse caso a validação com a extensão instalada depende de roteiro manual ou de outro meio, e a limitação é registrada.
- A 005 permanece como base; esta feature ajusta o comportamento descrito nela sem reabrir seu escopo, e conflitos serão explicitados no plano.
- Chrome aberto e conexão de internet disponíveis; sem backend, sem sincronização entre dispositivos e sem mudança de stack.

## Clarifications

### Sessão 2026-11-16

- Q: Este pedido corrige a spec 005 ou vira feature separada? → A: Nova spec 006, tendo a 005 como base.
- Q: O que entra na lista do Lote e como tratar listagens acima do limite do site? → A: Uma entrada por link; listagem truncada é sinalizada como "limitada pelo site", sem subdivisão automática.
- Q: Em qual aba o scraping navega? → A: Aba visível do Idealista dedicada à coleta, separada da aba do usuário, sem abrir telas da extensão.
- Q: O que significa "passar por bloqueios"? → A: Detectar, esperar e retomar sozinho quando o site voltar ao normal; sem contornar desafio nem rotacionar IP.
- Q: Como tratar regiões, sub-regiões e municípios sobrepostos? → A: Coletar todos os links e deduplicar anúncios por identificador, relatando repetidos por entrada.
- Q: Que nível de prova é exigido para aceitar? → A: Site real com a extensão instalada; se impossível, pendência registrada e sem aceite.
- Q: Como tratar o proxy? → A: Opcional, usado só quando o site bloquear a conexão direta; credenciais nunca em artefatos, logs ou testes.

### Sessão 2026-11-16 (sdd-plan)

- Q: O arquivo de cada entrada guarda a listagem completa ou só anúncios inéditos? → A: Listagem completa por entrada; a deduplicação aparece só no resumo.
- Q: O usuário sugeriu coletar no nível de município e trazer região/sub-região/município/freguesia nos anúncios. Como incluir? → A: Contexto aditivo com a fila igual (uma entrada por link); `Freguesia` só se a inspeção comprovar uma fonte confiável. Nova US7 (P3).
- Q: A aba de coleta ganha foco? → A: Abre em foco só no início; depois nunca rouba o foco, e cada página é carregada por navegação real nessa aba.
- Q (Analyze A-02): limites por execução (200 páginas, 6 h) param filas grandes. O que fazer? → A: Esperar e continuar sozinho: o fim do orçamento por execução ou da duração abre um novo ciclo automaticamente; ritmo (intervalo e janela) mantido.
- Q (Analyze A-03): a aba técnica `runner.html` em segundo plano incomoda? → A: Aceita em segundo plano, inativa, fechada ao terminar.
- Q (Analyze A-04): Freguesia (P3) antes da validação real (P2)? → A: Manter a ordem; uma validação real cobre tudo.
- Evidência (Analyze A-01, 2026-11-16): Chromium automatizado sem perfil recebeu HTTP 403 com título "Um momento…" nas páginas de Braga, Faro e Açores. A inspeção real exige o Chrome do usuário. A derivação sem `/concelhos-freguesias` só afeta sub-regiões (distritos/ilhas), o mesmo tipo do exemplo de Braga confirmado pelo usuário.
- Q (execução, após inspeção real): o que coletar na página de distrito (14 concelhos, 134 freguesias, 15 zonas, 3 vizinhos)? → A: Concelhos + freguesias. Zonas e vizinhos ficam fora, mas são contados.
- Q (execução, R4): como preencher Freguesia, se o anúncio só a traz no fim do título? → A: Nome da entrada quando ela é freguesia; senão, o sufixo do título apenas se coincidir exatamente com uma freguesia conhecida da fila coletada; caso contrário `null`.
- Decisão do plano (sem pergunta): o botão de links usa a página atual do usuário quando ela tiver lista de localidades; senão, a página nacional (FR-028). Antes ele usava sempre a página nacional fixa.

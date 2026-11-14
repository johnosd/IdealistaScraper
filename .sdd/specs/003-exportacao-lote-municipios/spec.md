# Feature Specification: Exportação mensal do lote em pasta de municípios

**Slug**: `003-exportacao-lote-municipios`
**Created**: 2026-11-13
**Status**: Convergida
**Input**: Salvar arquivos da extração em lote em `.data/municipios/{anomes}`,
substituindo arquivos existentes sem confirmação. Aproveitar a feature para
revisar os dados coletados, inspecionando uma localidade com Playwright.

## Escopo

### Incluído

- Alterar o destino dos JSONs individuais produzidos pelo lote para pasta
  autorizada `.data/municipios`, com subpasta mensal YYYYMM.
- Manter um arquivo por item e o padrão atual `<nome>-Paginas<N>.json`.
- Substituir automaticamente arquivo com o mesmo caminho, sem confirmação.
- Selecionar/reutilizar/trocar destino e recuperar permissão quando necessário.
- Distinguir coleta concluída de arquivo efetivamente gravado, preservando dados
  e item pendente se a gravação não puder ser concluída.
- Revisar os campos existentes, informações ainda não exportadas e a paginação
  em uma localidade real com playwright-site-debug. Correções comprovadas:
  contagem de fotos `imagens` e garagem no campo `estacionamento`.
- Preservar o conteúdo e os nomes dos campos existentes dos anúncios, incluindo
  null quando a fonte não oferece o dado. Testar o extrator compartilhado.

### Fora de Escopo

- Servidor Node auxiliar, Native Messaging, mudança global de Downloads ou
  escrita fora da pasta autorizada. Sem download automático de reserva.
- Migrar, apagar ou reorganizar arquivos já existentes, inclusive nomes antigos
  que diferem pela quantidade de páginas.
- Ampliar localidades, redefinir município/freguesia, filtrar regiões ou eliminar
  sobreposição entre itens diferentes do catálogo.
- Abrir cada anúncio para obter descrição integral, telefone, galeria completa
  ou campos disponíveis somente na página de detalhe.
- Redesenhar o crawler/proxy, corrigir todos os bugs anteriores do backlog ou
  prometer retomada de operações após fechar a página responsável pelo lote.
- Alterar o destino de Links/localidades ou de Itens individuais; as correções
  de `imagens` e `estacionamento` no extrator compartilhado têm regressão nos dois usos.

## User Scenarios & Testing

### User Story 1 - Salvar os arquivos do lote no mês autorizado (Priority: P1)

Como usuário, quero que cada item extraído seja salvo diretamente no diretório
mensal de municípios, sem mover arquivos de Downloads.

**Why this priority**: É o destino solicitado para os arquivos produzidos pelo lote.
**Independent Test**: Autorizar pasta temporária e processar dois itens com
anúncios conhecidos, verificando caminhos, conteúdo e ausência de Downloads.

**Acceptance Scenarios**:

1. **Given** nenhuma pasta autorizada, **When** o usuário escolhe a pasta base,
   **Then** a interface mostra o destino e permite iniciar o lote com acesso válido.
2. **Given** lote iniciado em novembro de 2026, **When** Ponta Delgada conclui duas
   páginas, **Then** grava `202611/Ponta Delgada-Paginas2.json` dentro da base.
3. **Given** arquivo no mesmo caminho, **When** chega nova extração válida,
   **Then** substitui integralmente sem perguntar, mesclar, acrescentar sufixo
   ou deixar conteúdo residual do arquivo maior anterior.
4. **Given** outro arquivo/mês na base, **When** ocorre a gravação,
   **Then** somente o destino calculado é alterado.

### User Story 2 - Recuperar acesso ou falha sem perder o resultado (Priority: P1)

Como usuário, quero conseguir concluir a gravação após recuperar o acesso,
sem perder o resultado coletado nem consumir um item que não foi salvo.

**Why this priority**: Evita sucesso falso e perda de dados ao substituir Downloads.
**Independent Test**: Simular revogação/falha após coletar e reautorizar; comparar
arquivo anterior, resultado pendente e estado da fila antes/depois.

**Acceptance Scenarios**:

1. **Given** pasta já configurada, **When** reabre a interface com acesso válido,
   **Then** pode reutilizar o destino; sem acesso, pode reautorizar ou trocar.
2. **Given** cancelamento da seleção, acesso negado ou erro de escrita,
   **When** a gravação não termina, **Then** não há sucesso de arquivo salvo,
   retirada definitiva do item da fila ou download alternativo.
3. **Given** resultado pendente em memória e permissão recuperada,
   **When** solicita salvar novamente, **Then** usa os mesmos dados/mês,
   sem exigir nova coleta. Os itens restantes aguardam essa resolução.
4. **Given** seletor/reautorização muda o foco,
   **When** o usuário retorna, **Then** a operação continua utilizável e os
   registros pendentes não dependem de manter um popup de ação aberto.

### User Story 3 - Conferir a qualidade dos dados da listagem (Priority: P2)

Como usuário, quero que os campos já exportados representem os dados presentes
nos cards e que ausências da fonte não sejam preenchidas com valores inventados.

**Why this priority**: A revisão real solicitada encontrou perda de contagem de fotos.
**Independent Test**: Comparar DOM e função existente em uma localidade; testar
cards sintéticos dos formatos atual/legado e ausência de contador.

**Acceptance Scenarios**:

1. **Given** listagem de uma localidade com duas páginas,
   **When** executa o extrator existente nas páginas e confere os IDs,
   **Then** registra contagens, próxima página, duplicados e campos divergentes.
2. **Given** card com contador de fotos no formato atual,
   **When** extrai o anúncio, **Then** `imagens` contém o total exibido.
3. **Given** card sem contador/dado opcional,
   **When** extrai o anúncio, **Then** mantém null ou representação existente
   apropriada, sem substituir desconhecido por zero.
4. **Given** descrição resumida/truncada pela listagem,
   **When** exporta, **Then** preserva o resumo disponível sem anunciá-lo como
   descrição integral da página de detalhe.

### Edge Cases

- Mês local capturado no início do lote e fixo até sua conclusão, inclusive em
  virada de mês ou nova autorização após a coleta.
- A pasta escolhida é a base municipios; não duplicar `.data/municipios` nela
  nem presumir caminho absoluto a partir de seu nome exibido.
- Cancelar troca preserva destino anterior; trocar não move/apaga arquivos.
- Nomes com acentos devem ser preservados. Caracteres incompatíveis com nome de
  arquivo recebem normalização determinística, sem permitir escrita fora da base.
- Colisão de nome/caminho é substituição automática: o último resultado válido
  cuja escrita concluiu ocupa o arquivo. Serializar gravações próprias concorrentes.
- Resultados vazios/inválidos e falhas de coleta não substituem arquivo anterior.
- Erro de escrita/fechamento não deve truncar antecipadamente o arquivo anterior.
- Arquivos com nomes diferentes por número de páginas não são apagados.
- A leitura real de duas páginas não equivale a teste do proxy ou de todas as localidades.

## Requirements

### Functional Requirements

- **FR-001**: JSONs individuais do lote DEVEM ser gravados na pasta base escolhida,
  no caminho `{YYYYMM}/<nome>-Paginas<N>.json`, sem download automático de reserva.
- **FR-002**: O mês DEVE vir da data local capturada ao iniciar o lote, permanecendo
  fixo durante coleta, retomada de escrita e conclusão desse lote.
- **FR-003**: O usuário DEVE poder selecionar, reutilizar, reautorizar e trocar a
  pasta base; a interface DEVE indicar o destino e seu estado de acesso.
- **FR-004**: A permissão de municipios DEVE ser tratada independentemente do
  destino de localidades; a mudança NÃO DEVE alterar aquela configuração.
- **FR-005**: Arquivo já existente DEVE ser substituído automaticamente, sem
  confirmação, fusão, sufixo ou resíduos; somente esse caminho pode ser alterado.
- **FR-006**: Os dados DEVEM manter o array e campos atuais dos anúncios em JSON
  UTF-8; nome legível e número de páginas continuam compondo o nome do arquivo.
- **FR-007**: A aplicação DEVE criar a subpasta mensal ausente e impedir nomes que
  escapem da base, preservando acentos nos nomes compatíveis.
- **FR-008**: Sucesso de gravação DEVE ser anunciado somente após conclusão da
  escrita, com arquivo, quantidade de anúncios e destino identificados.
- **FR-009**: O item NÃO DEVE ser consumido definitivamente da fila como salvo
  antes de terminar a gravação. Falha deve interromper avanço e manter recuperação.
- **FR-010**: Resultado coletado e data DEVEM permanecer disponíveis para tentar
  salvar novamente após erro/permissão, enquanto a superfície do lote permanecer aberta.
- **FR-011**: Cancelar/recusar autorização, trocar foco e reautorizar NÃO DEVEM
  destruir os registros pendentes nem causar sucesso falso.
- **FR-012**: Extração vazia, inválida ou com erro NÃO DEVE substituir arquivo
  anterior por resultado vazio/inválido; falha de escrita deve preservar o anterior.
- **FR-013**: Gravações concorrentes próprias DEVEM ser coordenadas, sem misturar
  conteúdo ou marcar como concluído um resultado que ainda não foi gravado.
- **FR-014**: A revisão de uma localidade DEVE comparar DOM e extrator real,
  documentando cobertura de páginas/IDs e divergências por campo, com limites da prova.
- **FR-015**: `imagens` DEVE representar a quantidade de fotos exibida pelo card,
  suportando formato atual e legado, sem confundir foto atual com total.
- **FR-016**: Campos ausentes na fonte DEVEM manter ausência explícita; NÃO DEVE
  haver preenchimento presumido de fotos, descrição, agência ou demais opcionais.
- **FR-017**: Correção compartilhada do extrator DEVE preservar os demais campos
  e comportamento de consumo de Itens/Lote, com testes de regressão pertinentes.
- **FR-018**: Mudanças NÃO DEVEM alterar catálogo/localidades, proxy, credenciais
  ou demais dados locais e bugs anteriores fora das necessidades desta feature.

### Key Entities

- **Destino de municipios**: pasta base autorizada e situação de acesso.
- **Execução de lote**: data/mês inicial, itens, resultados e estado de coleta/gravação.
- **Resultado pendente**: anúncios coletados e metadados necessários para salvar sem recoletar.
- **Arquivo de item**: JSON de anúncios no destino mensal, com substituição automática.
- **Revisão de qualidade**: observação real, cobertura e diferenças entre DOM/campos.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Dois itens conhecidos geram arquivos no mês/nome esperados, sem
  arquivo adicional em Downloads.
- **SC-002**: Substituir JSON maior por menor deixa somente o conteúdo novo,
  sem confirmação e sem alterar arquivos não destinados à escrita.
- **SC-003**: Todos os cenários de falha/cancelamento testados preservam o arquivo
  anterior e não consomem o item como salvo; acesso recuperado permite tentar novamente.
- **SC-004**: Mudança de foco no fluxo de autorização mantém a sessão utilizável;
  a configuração de municipios pode ser reutilizada sem alterar localidades.
- **SC-005**: A auditoria real de uma localidade registra cobertura de anúncios e
  paginação e permite relacionar as correções a evidências concretas.
- **SC-006**: Contadores atual e legado produzem o total correto em `imagens`;
  ausência continua ausente e os demais campos permanecem compatíveis.

## Assumptions

- `anomes` significa YYYYMM local; manter nomes atuais foi comunicado ao usuário.
- A pasta base recomendada é `.data/municipios`; não há garantia de caminho
  absoluto por nome de pasta. Autorização no Chrome continua necessária.
- A autorização para sobrescrever sem confirmação se aplica aos arquivos do
  lote com mesmo caminho; não altera a confirmação da exportação de localidades.
- A revisão inclui os 17 campos atuais e um inventário de informações presentes
  na listagem ainda sem campo próprio. O inventário não implica ampliar o schema;
  dados exclusivos do detalhe permanecem fora da coleta desta feature.
- O desenho da superfície que preserva o lote ao perder foco e o mecanismo de
  gravação/recuperação serão definidos em sdd-plan.

## Clarifications

### Sessão 2026-11-13

- Q: Como tratar arquivo existente? → A: “Substituir sem confirmar”.
- Q: Qual destino? → A: `.data/municipios/{anomes}` para os arquivos do lote.
- Q: Revisar dados também? → A: Usuário pediu inspeção com a skill do projeto
  playwright-site-debug para uma localidade. Alvor foi inspecionada em duas páginas;
  perda de contador de fotos comprovada e incluída como correção pontual.

### Complemento de escopo solicitado durante o planejamento

O usuário esclareceu que a revisão deve procurar também campos ainda não
coletados. A auditoria deve distinguir dado perdido, dado conservado em texto
composto, informação sem campo próprio e informação que exige outra página/ação.

- **FR-019**: A auditoria DEVE inventariar informações dos cards/atributos ainda
  não exportadas, indicando fonte, cobertura observada e recomendação; não deve
  declarar coleta completa apenas porque os 17 campos existentes foram revisados.
- **FR-020**: `estacionamento` DEVE reconhecer indicação explícita de garagem ou
  estacionamento em `.item-detail`, preservando suporte ao seletor anterior e
  null quando a fonte não informa; não inferir existência por ausência de texto.
- **SC-007**: Inventário distingue campos perdidos, dados em campos compostos,
  novos candidatos e dados dependentes de detalhe, com limites da amostra.
- **SC-008**: Cards com “Garagem incluída” retornam esse texto em
  `estacionamento`; formatos anterior/ausente continuam compatíveis.

US3 inclui esse inventário e a correção de estacionamento, sem adicionar chaves
ao JSON. Novos campos identificados são recomendações para decisão posterior.

## Evidence

Ver [listing-audit.md](listing-audit.md). Revisão executada no site real antes da
implementação; a feature ainda não alterou código de exportação/coleta.

## Decisão na execução — A001

Usuário escolheu propagar a falha e impedir gravação parcial na 003. FR-012 inclui
falhas de paginação HTTP/rede ou HTML inesperado; informar erro e preservar arquivo/fila.

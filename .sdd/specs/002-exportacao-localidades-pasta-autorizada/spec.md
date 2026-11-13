# Feature Specification: Exportação mensal de localidades em pasta autorizada

**Slug**: `002-exportacao-localidades-pasta-autorizada`
**Created**: 2026-11-13
**Status**: Convergida
**Input**: Salvar a extração de links JSON em
`.data/localidades/{anomes}/links_localidades_{anomes}.json`, com autorização da
pasta no Chrome e substituição do arquivo existente somente após confirmação.

## Escopo

### Incluído

- Alterar exclusivamente o destino da ação “Extrair Links (JSON)”.
- Permitir ao usuário selecionar e autorizar `.data/localidades` do projeto.
- Reutilizar a pasta selecionada quando a autorização ainda for válida; permitir
  alterá-la e solicitar novamente a autorização quando o navegador exigir.
- Criar a subpasta do mês e gravar o JSON no padrão solicitado.
- Confirmar explicitamente antes de substituir um arquivo já existente.
- Informar pasta selecionada, caminho relativo, quantidade e resultado da gravação.
- Tratar cancelamento, autorização negada/revogada, pasta indisponível e falha de escrita.

### Fora de Escopo

- Servidor ou auxiliar Node, Native Messaging ou configuração global de Downloads.
- Gravar em caminhos arbitrários sem seleção/autorização do usuário.
- Alterar destino e execução de Itens ou Lote, proxy ou bugs existentes dessas áreas.
- Modificar seletores de extração, formato dos registros ou o site consultado.
- Acrescentar downloads de reserva, agendamento, histórico de versões ou fusão de arquivos.
- Corrigir os demais itens do backlog ou alterar a feature de reorganização convergida.

## User Scenarios & Testing

### User Story 1 - Salvar links no diretório mensal escolhido (Priority: P1)

Como usuário da extensão, quero autorizar a pasta de localidades do projeto e
salvar a extração diretamente no mês correspondente, sem mover arquivos de Downloads.

**Why this priority**: Entrega o destino pedido pelo usuário.
**Independent Test**: Autorizar uma pasta de teste e exportar localidades conhecidas;
conferir o caminho e o JSON gravado, sem download adicional.

**Acceptance Scenarios**:

1. **Given** nenhuma pasta configurada, **When** o usuário seleciona e autoriza
   `.data/localidades` e conclui uma extração em novembro de 2026, **Then** a
   extensão cria `202611/links_localidades_202611.json` dentro da pasta autorizada.
2. **Given** o mês ainda não tem subpasta, **When** ocorre a primeira gravação,
   **Then** a subpasta é criada sem modificar arquivos dos outros meses.
3. **Given** extração com registros, **When** a escrita termina com sucesso,
   **Then** o usuário vê o destino relativo e a quantidade de registros gravados.
4. **Given** o usuário cancela ou nega acesso à pasta, **When** a autorização é
   necessária, **Then** a operação informa o cancelamento/negação e não grava
   arquivo nem baixa silenciosamente em Downloads.

### User Story 2 - Substituir o retrato mensal com confirmação (Priority: P1)

Como usuário que já tem um arquivo do mês, quero decidir se a nova extração
pode substituí-lo, preservando o conteúdo anterior quando eu recusar.

**Why this priority**: A proteção de sobrescrita foi escolhida explicitamente.
**Independent Test**: Usar uma pasta com arquivo mensal existente; recusar e
confirmar em execuções separadas, comparando os bytes antes/depois.

**Acceptance Scenarios**:

1. **Given** arquivo mensal existente, **When** uma nova extração está pronta,
   **Then** a extensão apresenta o destino e pede confirmação antes de alterá-lo.
2. **Given** confirmação recusada ou fechada, **When** a operação termina,
   **Then** o arquivo anterior permanece byte-idêntico e não há cópia alternativa.
3. **Given** substituição confirmada, **When** a escrita é concluída,
   **Then** o arquivo contém somente o novo conjunto de registros, sem fusão,
   conteúdo residual, alteração de nome ou sufixo automático.
4. **Given** extração sem resultados ou com falha, **When** há arquivo mensal
   existente, **Then** ele não é substituído por dados vazios ou inválidos.

### User Story 3 - Reutilizar ou recuperar acesso à pasta (Priority: P2)

Como usuário recorrente, quero reutilizar a pasta configurada quando permitido
pelo Chrome e conseguir recuperar o acesso quando necessário.

**Why this priority**: Evita repetir seleção desnecessária sem prometer permissões permanentes.
**Independent Test**: Reabrir a extensão com autorização válida e depois simular
revogação/indisponibilidade, verificando o fluxo de nova autorização.

**Acceptance Scenarios**:

1. **Given** pasta previamente selecionada com acesso válido, **When** a extensão
   é reaberta, **Then** o destino pode ser reutilizado sem nova seleção obrigatória.
2. **Given** acesso revogado ou não persistido pelo navegador, **When** o usuário
   tenta salvar, **Then** a extensão oferece reautorizar ou escolher outra pasta.
3. **Given** o usuário decide trocar de destino, **When** escolhe outra pasta,
   **Then** a extensão passa a usar o novo destino sem mover ou apagar arquivos antigos.

### Edge Cases

- Ano/mês derivado da data local capturada no início da extração, fixo durante a
  operação, mesmo se o relógio passar para outro mês antes de salvar.
- A pasta selecionada é a base: a extensão acrescenta `YYYYMM/` e o nome do arquivo,
  sem duplicar `.data/localidades` dentro dela.
- O navegador pode não expor o caminho absoluto. A UI identifica a pasta pelo
  nome disponível e pelo destino relativo; não afirma ter validado o repositório.
- Seleção errada pode ser corrigida pelo usuário; a extensão não procura o
  projeto no disco ou escreve fora da pasta concedida.
- Cancelar seleção, substituir pasta ou confirmar uma escrita exige interação
  explícita; perder o foco do popup não pode causar sucesso falso ou perda dos
  registros já obtidos enquanto o fluxo de exportação estiver em andamento.
- Pasta removida, arquivo bloqueado e falta de espaço devem produzir erro claro,
  sem mensagem de sucesso ou limpeza/truncamento antecipado do arquivo anterior.
- Acionamentos concorrentes na extensão não podem provocar duas substituições
  silenciosas do mesmo destino.

## Requirements

### Functional Requirements

- **FR-001**: A ação “Extrair Links (JSON)” DEVE gravar em pasta escolhida e
  autorizada no Chrome, em vez de iniciar o download atual.
- **FR-002**: A pasta base DEVE ser selecionável/trocável pelo usuário, com
  indicação visível do destino; a seleção recomendada é `.data/localidades`.
- **FR-003**: O caminho DEVE ser `{YYYYMM}/links_localidades_{YYYYMM}.json`, com
  ano de quatro dígitos e mês de dois dígitos da data local no início da extração.
- **FR-004**: A extensão DEVE criar a subpasta mensal quando ausente e manter
  intactos os arquivos que não são o destino confirmado.
- **FR-005**: A gravação DEVE preservar a lista, os campos, os valores e a
  codificação UTF-8 do JSON de localidades atualmente exportado.
- **FR-006**: Arquivo existente DEVE exigir confirmação de substituição com o
  destino identificado, antes de qualquer alteração em seu conteúdo.
- **FR-007**: Recusa, fechamento da confirmação ou cancelamento da autorização
  DEVEM preservar o arquivo anterior e não produzir download alternativo.
- **FR-008**: A extensão NÃO DEVE substituir o arquivo existente em caso de
  extração vazia/inválida ou falha anterior à gravação.
- **FR-009**: A extensão DEVE informar sucesso somente após concluir a escrita,
  mostrando o destino relativo e o total de registros gravados.
- **FR-010**: Erros de permissão/escrita DEVEM ser distinguíveis de sucesso ou
  cancelamento, permitindo recuperar acesso sem apagar dados existentes.
- **FR-011**: A pasta configurada DEVE poder ser recuperada entre aberturas;
  permissões DEVEM ser verificadas e renovadas com interação quando exigido.
- **FR-012**: O fluxo de exportação DEVE continuar utilizável ao selecionar a
  pasta/mudar foco; NÃO DEVE depender de manter o popup de ação aberto.
- **FR-013**: A extensão DEVE impedir operações concorrentes próprias de gravação
  no mesmo destino sem a confirmação devida.
- **FR-014**: A implementação NÃO DEVE alterar o comportamento de Itens, Lote,
  proxy, armazenamento existente ou as correções pendentes fora deste escopo.

### Key Entities

- **Destino autorizado**: pasta escolhida, identificação exibível e situação de acesso.
- **Execução de exportação**: data local inicial, mês de referência, registros,
  destino, confirmação e resultado da escrita.
- **Arquivo mensal**: retrato JSON de localidades de um mês, substituído somente
  com confirmação explícita quando já existir.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Com destino autorizado, uma extração não vazia gera um JSON legível
  exatamente na subpasta e no nome mensal esperados, sem arquivo em Downloads.
- **SC-002**: Em todos os casos de recusa/cancelamento testados, os bytes do arquivo
  anterior permanecem inalterados e nenhum arquivo alternativo é criado.
- **SC-003**: Após confirmação, o JSON corresponde integralmente aos registros
  extraídos, incluindo acentos, sem conteúdo residual do arquivo anterior.
- **SC-004**: Extração vazia, acesso negado/revogado e falha de escrita não geram
  sucesso falso ou substituição silenciosa nos cenários de aceite.
- **SC-005**: Uma reabertura com acesso válido permite reutilizar o destino;
  acesso inválido oferece recuperação e troca de pasta.
- **SC-006**: Os fluxos existentes de Itens, Lote e Proxy permanecem sem mudanças
  funcionais decorrentes desta feature.

## Assumptions

- `anomes` significa `YYYYMM` no calendário e fuso locais, como `202611`.
- A pessoa seleciona a pasta `.data/localidades`; a extensão não consegue
  garantir um caminho absoluto específico apenas pelo nome de pasta exibido.
- O arquivo representa a extração mais recente confirmada do mês; não há merge.
- Não haverá fallback automático para Downloads quando a escrita falhar.
- O mecanismo de autorização, persistência e a superfície durável do fluxo
  serão definidos no planejamento; não há servidor local requerido.

## Clarifications

### Sessão 2026-11-13

- Q: Como gravar fora de Downloads na pasta do projeto? → A: Autorizar a pasta
  pelo Chrome, em vez de usar auxiliar Node local.
- Q: O que fazer se o arquivo do mês já existir? → A: Substituir após confirmação;
  recusa deve preservar o arquivo anterior.
- Q: Qual ação e caminho desejados? → A: Apenas “Extrair Links (JSON)”, em
  `.data/localidades/{anomes}/links_localidades_{anomes}.json`.

## Source Backlog Item

Texto original preservado para rastreabilidade:

> - [Melhoria] extracao de links hoje salva na pasta download, o ideal seria salvar na pasta .data/localidades/{anomes}/links_localidades_{anomes}.json

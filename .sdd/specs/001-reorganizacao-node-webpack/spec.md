# Feature Specification: Reorganização com Node/npm e Webpack

**Slug**: `001-reorganizacao-node-webpack`
**Created**: 2026-11-13
**Status**: Convergida
**Input**: Reorganizar como screen recorder: Node/npm, Webpack, fontes em src/,
bundles em dist/, testes em tests/ e manifest/HTML na raiz.

## Escopo

### Incluído

- Adotar a estrutura e as ferramentas confirmadas pelo usuário.
- Padronizar instalação com lockfile, build de desenvolvimento/produção,
  observação das fontes e execução de testes.
- Ajustar referências de manifesto, HTML e injeções para os bundles.
- Documentar desenvolvimento, build e carregamento da extensão no Chrome.
- Preservar interface, comportamentos, Python, notebook, dados e alterações locais.

### Fora de Escopo

- Corrigir os bugs registrados no backlog ou redesenhar a interface.
- Alterar a arquitetura de execução do lote e persistência do proxy.
- Criar backend Node, adotar framework de UI ou migrar para TypeScript.
- Excluir/mover dados, Python, notebook, cookies ou o ZIP histórico.
- Publicar a extensão ou executar coleta/proxy real como parte do build.

## User Scenarios & Testing

### User Story 1 - Desenvolver e carregar a extensão reorganizada (Priority: P1)

Como mantenedor, quero fontes separados das saídas geradas e comandos
padronizados para produzir a extensão, mantendo seus comportamentos atuais.

**Why this priority**: É o resultado central pedido antes das correções futuras.
**Independent Test**: Instalar dependências, gerar os bundles e conferir que
manifesto, popup e injeções apontam para arquivos existentes.

**Acceptance Scenarios**:

1. **Given** checkout sem dependências nem bundles, **When** a instalação pelo
   lockfile e o build são executados, **Then** todas as entradas são geradas.
2. **Given** build gerado, **When** a raiz é carregada no Chrome, **Then** o popup
   mantém suas quatro abas e os scripts carregam sem erros de empacotamento.
3. **Given** saídas geradas removidas, **When** o build é refeito, **Then** a
   extensão é reconstruída a partir das fontes, sem edições manuais em bundles.

### User Story 2 - Verificar e manter o projeto (Priority: P2)

Como mantenedor, quero testes separados e instruções para verificar regressões
antes de trabalhar no backlog.

**Why this priority**: Mantém o projeto utilizável em futuras sessões.
**Independent Test**: Executar testes e seguir o procedimento de recompilação.

**Acceptance Scenarios**:

1. **Given** instalação concluída, **When** os testes rodam, **Then** verificações
   relevantes de carregamento ou extração passam sem chamadas externas.
2. **Given** documentação atualizada, **When** um mantenedor a consulta, **Then**
   identifica fontes, saídas, testes e pasta a carregar no Chrome.

### Edge Cases

- Bundles devem funcionar nos contextos isolados de background, popup e conteúdo.
- A reinjeção existente deve usar o novo caminho; sua política não é corrigida.
- O build deve respeitar a CSP de extensões e não depender de eval.
- Alterações locais nos dados não devem ser revertidas pela migração.
- O ZIP histórico não é a saída validada desta feature.

## Requirements

### Functional Requirements

- **FR-001**: O projeto DEVE usar Node/npm e Webpack, com lockfile versionável.
- **FR-002**: Fontes DEVEM ficar em `src/`, bundles em `dist/`, testes em `tests/`
  e manifesto/HTML na raiz.
- **FR-003**: DEVEM existir comandos documentados de build de desenvolvimento,
  produção, observação de fontes e testes.
- **FR-004**: Manifesto, HTML e injeções DEVEM referenciar saídas existentes e
  compatíveis com seus contextos de execução no Chrome MV3.
- **FR-005**: A migração DEVE manter interface e comportamento, sem incluir os
  ajustes funcionais registrados no backlog.
- **FR-006**: Fontes e arquivos gerados DEVEM ser separados no versionamento.
- **FR-007**: Python, notebook, dados e alterações locais DEVEM ser preservados.
- **FR-008**: Testes DEVEM verificar comportamentos relevantes de empacotamento
  ou extração, sem acesso a serviços externos ou ativação real de proxy.
- **FR-009**: A documentação DEVE explicar comandos, pasta carregada no Chrome
  e o procedimento de reconstrução e recarga após mudanças.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Uma instalação limpa permite reconstruir todas as entradas.
- **SC-002**: Todas as referências locais de entrada resolvem para arquivos existentes.
- **SC-003**: Verificações automatizadas passam sem rede após instalar dependências.
- **SC-004**: As quatro abas permanecem acessíveis no Chrome, sem erros de scripts
  introduzidos pela reorganização.
- **SC-005**: Nenhum arquivo Python, notebook ou dado pré-existente é modificado.

## Assumptions

- A pasta `Idealista_extensao_v1/` é a fonte de verdade, não o ZIP histórico.
- Ajustes de caminhos e integração entre bundles fazem parte da migração.
- Testes locais não comprovam coleta no site atual ou funcionamento de proxy real.

## Clarifications

### Sessão 2026-11-13

- Q: Organização técnica ou também redesign? → A: O usuário confirmou Node/npm,
  Webpack, src/, dist/, tests/ e manifest/HTML na raiz.
- Q: Ordem dos trabalhos? → A: Registrar os problemas no backlog e reorganizar
  antes de atuar nos ajustes.

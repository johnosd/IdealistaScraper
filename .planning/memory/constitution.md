# Constitution do Idealista Extrator

## Princípios Fundamentais

### I. Escopo explícito

Cada mudança DEVE seguir seu escopo aprovado. Correções do backlog e redesign
DEVEM ser tratados separadamente quando estiverem fora da feature atual.

### II. Fontes e saídas separadas

O código DEVE ficar em `src/`, testes em `tests/`, bundles em `dist/` e
manifest/HTML na raiz. Bundles NÃO DEVEM ser editados manualmente. A instalação
DEVE ser reproduzível por lockfile.

### III. Compatibilidade

A extensão DEVE manter compatibilidade com Chrome Manifest V3 e sua CSP.
Permissões NÃO DEVEM ser acrescentadas sem necessidade da feature.

### IV. Preservação

Mudanças DEVEM preservar dados, arquivos legados e alterações pré-existentes.
Credenciais NÃO DEVEM ser incluídas em código, testes, logs ou documentação
versionável. Uma reorganização NÃO DEVE apagar credenciais locais existentes.

### V. Qualidade com evidências

A entrega DEVE passar nos testes aplicáveis e nos builds de desenvolvimento e
produção. Teste local, carregamento no Chrome, coleta real e proxy real DEVEM
ser reportados como níveis distintos de evidência.

## Restrições do Projeto

- Extensão Chrome MV3, JavaScript, Node/npm e Webpack.
- Node é ferramenta de desenvolvimento; não há backend requerido.
- Testes em `tests/`, sem chamadas externas por padrão.
- `.planning/memory/` guarda contexto durável em Markdown; notas não substituem
  artefatos de feature e status em `.sdd/` e `.planning/backlog.md`.

## Fluxo de Desenvolvimento

- Definir escopo e critérios de aceite antes da implementação.
- Manter pendências e fases nos artefatos SDD e no backlog.
- Antes do aceite, executar testes aplicáveis, builds de desenvolvimento e
  produção, verificar referências de entrada e atualizar a documentação.
- Validar o carregamento no Chrome quando a estrutura da extensão mudar. Se
  pendente, registrar explicitamente e não declarar aceite completo.
- Preservar as alterações locais e arquivos legados durante a validação.

## Governança

Os cinco princípios foram adotados explicitamente pelo usuário em 2026-11-13,
a partir de `001-reorganizacao-node-webpack/constitution-proposal.md`.
Emendas devem registrar motivo, versão e data e ter validação do usuário.

A constitution usa versionamento semântico. Uma versão MAJOR denota remoção ou
redefinição incompatível de um princípio. Uma versão MINOR denota um novo
princípio ou expansão material da governança. Uma versão PATCH denota
esclarecimentos, correções ou mudanças de texto não semânticas.

**Versão**: 1.0.0 | **Ratificada**: 2026-11-13 | **Última Emenda**: 2026-11-13

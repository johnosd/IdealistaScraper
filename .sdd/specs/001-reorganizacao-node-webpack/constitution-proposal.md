# Proposta de princípios do projeto

**Status**: Aprovada pelo usuário em 2026-11-13; incorporada em
`.planning/memory/constitution.md`. Este arquivo preserva a proposta original.
**Data**: 2026-11-13

O projeto ainda não tem `.planning/memory/constitution.md`. A skill `sdd-plan`
exige definir os princípios antes de planejar a primeira feature.

## Princípios propostos

1. **Escopo explícito:** cada mudança DEVE seguir seu escopo aprovado; correções
   do backlog e redesign devem ser tratados separadamente quando fora da feature.
2. **Fontes e saídas separadas:** o código DEVE ficar em `src/`, os testes em
   `tests/`, bundles em `dist/` e manifest/HTML na raiz. Bundles NÃO DEVEM ser
   editados manualmente; a instalação DEVE ser reproduzível por lockfile.
3. **Compatibilidade:** a extensão DEVE manter compatibilidade com Chrome MV3 e
   sua CSP, sem acrescentar permissões sem necessidade da feature.
4. **Preservação:** mudanças DEVEM preservar dados, arquivos legados e alterações
   pré-existentes. Credenciais NÃO DEVEM ser incluídas em código, testes, logs ou
   documentação versionável.
5. **Qualidade com evidências:** a entrega DEVE passar nos testes aplicáveis e nos
   builds de desenvolvimento/produção. Teste local, carregamento no Chrome,
   coleta real e proxy real DEVEM ser reportados como evidências distintas.

## Restrições e conclusão propostas

- Extensão Chrome MV3, JavaScript, Node/npm e Webpack; Node é ferramenta de
  desenvolvimento, sem backend requerido.
- Testes em `tests/`, sem chamadas externas por padrão.
- A migração exige testes e builds verdes, referências de entrada verificadas,
  documentação atualizada e carregamento no Chrome validado ou explicitamente
  registrado como pendente, sem declarar aceite completo nesse último caso.
- A constitution final usará versionamento semântico, inicialmente 1.0.0,
  após validação dos princípios pelo usuário.

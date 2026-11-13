# Verificação da reorganização

## Pré-requisitos

- Node >=22.16.0 e npm, rede somente para instalar dependências.
- Terminal na raiz. Não usar o ZIP histórico para esta verificação.
- Preservar a instalação existente e seus dados; para o smoke usar perfil isolado.

## Gates automatizados após implementação

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build:prod
node --test tests/contracts/001-reorganizacao-node-webpack.test.cjs
./.planning/scripts/powershell/check-contract-tests.ps1 -Slug 001-reorganizacao-node-webpack
```

Esperado: builds sem erros e contratos 2/2 verdes em desenvolvimento e produção.
O teste executa os bundles com APIs simuladas; não prova o site ou proxy reais.
Conferir SHA256 dos quatro legados em `preservation-baseline.json`, quando presentes.
Conferir as duas injeções `files` em `src/popup.js`: ambas apontam para
`dist/content.bundle.js`, que deve existir após cada build.

## Modo de desenvolvimento

Executar `npm.cmd run dev`, aguardar compilação inicial, alterar temporariamente
um comentário em `src/popup-ui.js`, observar recompilação, restaurar o conteúdo,
aguardar nova compilação e encerrar o watch. Não editar `dist/` manualmente.

## Smoke no Chrome — gate de aceite completo

1. Abrir perfil isolado do Chrome com modo desenvolvedor de extensões.
2. Carregar sem compactação a raiz do projeto, onde ficam manifest.json e popup.html.
3. Conferir nome/versão/permissões e ausência de erros de carregamento.
4. Abrir o popup e alternar Links, Itens, Lote e Proxy sem acionar coleta ou proxy.
5. Conferir registro do service worker e ausência de erros de bundle/CSP.
6. Após novas compilações, recarregar a extensão e a página alvo usada em testes.

Não remover/reinstalar a extensão usada pelo usuário nem limpar seu storage.
Se indisponível, registrar exatamente esta etapa como pendente; não equiparar
contratos VM ou build verde a carregamento real no Chrome.

## Encerramento

Registrar comandos e resultados no plano/tasks, atualizar README e memória,
preservar o backlog de correções e não declarar coleta/proxy real validado.

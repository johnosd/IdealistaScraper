# Handoff — reorganização Node/Webpack

## Objetivo e escopo

Migrar os sete arquivos de `Idealista_extensao_v1/` para fontes em src/,
manifesto/HTML na raiz, bundles dist/ e testes tests/. Manter UI, lógica,
permissões, storage e os bugs registrados no backlog. Sem backend Node.

## Situação atual

Execução concluída em modo contínuo autorizado pelo usuário. T001–T008 e checklist
completos. Fontes em src/, manifest/HTML na raiz e bundles dist/. Builds dev/prod,
contratos 2/2 e trava íntegra; watch confirmado. Chrome instalado 157 e Chromium
156 carregaram a extensão e as quatro abas, service worker e content script em
fixture local. Revisão independente sem achados. README e memória atualizados.
Nenhuma coleta ou proxy real ativado. Evidências em validation/.

Quatro legados do baseline foram removidos externamente do checkout durante o
fechamento, após conferência íntegra na fase 1. Não restaurar automaticamente.
Estado detalhado em validation/preservation.json; Bases/.data com status preservado.

## Leitura e contratos

Ler spec.md, plan.md, tasks.md, quickstart.md e constitution.md.
Contrato: `tests/contracts/001-reorganizacao-node-webpack.test.cjs`, 2 casos.
Baseline confirmado: 0/2, ambos com `Entrada da extensao ausente: manifest.json`.
Executar com `node --test tests/contracts/001-reorganizacao-node-webpack.test.cjs`.
Trava em contract-tests.lock; executor não pode editar esses testes.
Sem stubs e sem contratos de outras features identificados nesta revisão.

## Armadilhas

- Webpack: cinco entradas independentes, sem runtime/chunks compartilhados,
  cheap-source-map em desenvolvimento e devtool false em produção; não usar eval.
- Ajustar as duas injeções files de popup.js para dist/content.bundle.js.
- Node >=22.16.0; webpack 5.112.2 e webpack-cli 7.3.1 exatos, lockfile na execução.
- Runner proposto: node:test nativo, sem Babel/Jest para esta migração.
- Scripts build, build:prod, dev e test definidos no plano; test reconstrói dev.
- Não apagar dados, legados, ZIP ou configurações locais não versionadas.
- Não remover a extensão existente: mudar a pasta carregada pode mudar sua
  identidade local. Smoke deve ocorrer em perfil isolado e ser reportado à parte.
- A lista de quatro hashes de legados está em preservation-baseline.json.

## Pendências do Analyze

Nenhum achado CRITICAL/HIGH não resolvido. Aceite estrutural concluído.
Os oito itens funcionais/empacotamento do backlog continuam fora desta entrega.

## Gate de pronto

Instalação npm ci, npm test, build:prod, contratos 2/2 após produção, trava íntegra,
watch observado, hashes preservados, README/memória/status atualizados e smoke
Chrome. Sem lint/typecheck configurados: não aplicáveis nesta migração JavaScript.
Coleta real e proxy real não fazem parte do aceite estrutural.

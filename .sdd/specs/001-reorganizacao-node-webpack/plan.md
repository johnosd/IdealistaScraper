# Implementation Plan: Reorganização com Node/npm e Webpack

**Slug**: `001-reorganizacao-node-webpack` | **Date**: 2026-11-13
**Spec**: `.sdd/specs/001-reorganizacao-node-webpack/spec.md`
**Goal**: Reorganizar a extensão no padrão confirmado, preservando comportamento e dados.
**Architecture**: Fontes movidas para src/, cinco entradas independentes Webpack,
manifesto/HTML na raiz e saídas reconstruíveis em dist/.
**Tech Stack**: JavaScript, Chrome MV3, Node/npm, Webpack 5 e testes nativos Node.

## Summary

Migração estrutural, sem correções funcionais. A pasta original contém sete
arquivos; os cinco JS irão a src/, e manifest.json e popup.html irão à raiz.
O ZIP e o material Python permanecem intocados. Não criar backend.

## Technical Context

- **Language/Version**: JavaScript; Node >=22.16.0 (ambiente: 22.16.0, npm 10.9.2).
- **Primary Dependencies**: webpack 5.112.2 e webpack-cli 7.3.1, versões exatas,
  consultadas no registry em 2026-11-13; lockfile gerado na implementação.
- **Storage**: chrome.storage.local existente, sem alteração de chaves ou conteúdo.
- **Testing**: node:test e assert nativos; VM para smoke offline dos bundles.
- **Target Platform**: Chrome MV3; Node somente para desenvolvimento.
- **Performance Goals**: nenhuma meta nova; evitar chunks/runtime compartilhados
  que criem dependência entre contextos isolados.
- **Constraints**: mesmas permissões, mesma UI e os bugs conhecidos preservados.
- **Scale/Scope**: cinco entradas JS, um HTML, um manifesto e infraestrutura local.

## Global Constraints

- src/ contém fontes; dist/ contém bundles; tests/ contém testes; manifest/HTML na raiz.
- Preservar dados e alterações existentes; não publicar ou ativar proxy/coleta real.
- Não corrigir os itens de backlog nesta migração e não editar dist/ manualmente.

## Decisões Invariantes

- Entradas: background, content, popup, popup-ui e linkExtractor, cada uma com
  src/<nome>.js e dist/<nome>.bundle.js. Não extrair módulos funcionais nesta fase.
- webpack.config.js em CommonJS, modo development por padrão, cheap-source-map;
  produção minificada com devtool false. Não usar configuração baseada em eval.
- Não habilitar splitChunks nem runtimeChunk; manter entradas autossuficientes.
- Manifesto: background.service_worker e content_scripts[].js apontam para dist/.
  Popup: três scripts na ordem popup-ui, linkExtractor, popup.
- As duas injeções por files em popup.js passam de content.js para
  dist/content.bundle.js; funções injetadas por func não mudam.
- Scripts package.json: build=webpack; build:prod=webpack --mode production;
  dev=webpack --watch; test=npm run build && node --test.
- Runner nativo Node proposto pelo implementador: basta para esta migração e
  evita adicionar Jest/Babel sem necessidade. O usuário confirmou tests/, não Jest.
- Sem copy plugin: manifesto/HTML permanecem na raiz como no screen recorder.
- .gitignore acrescenta /node_modules/ e /dist/ sem reescrever regras existentes.
- O pacote histórico ZIP não é atualizado; empacotamento fica no backlog.

## Constitution Check

| Princípio | Pré-Design | Pós-Design | Notas |
| --- | --- | --- | --- |
| I. Escopo explícito | PASS | PASS | Migração estrutural; bugs fora do escopo |
| II. Fontes e saídas separadas | PASS | PASS | Estrutura e lockfile definidos |
| III. Compatibilidade | PASS | PASS | MV3, CSP sem eval, mesmas permissões |
| IV. Preservação | PASS | PASS | Hashes de legados e dados intocados |
| V. Qualidade com evidências | PASS | PASS | Builds, contratos e Chrome separados |

## Project Structure

### Estado atual verificado

```text
Idealista_extensao_v1/
  background.js content.js popup.js popup-ui.js linkExtractor.js
  manifest.json popup.html
IdealistaScraper.py
TrataArquivos.ipynb
Idealista_extensao.zip
listaArrendar.json
Bases/ e .data/ (alterações locais pré-existentes)
.planning/ .sdd/ .agents/ .claude/ .codex/
```

### Estrutura resultante

```text
src/
  background.js content.js popup.js popup-ui.js linkExtractor.js
tests/contracts/001-reorganizacao-node-webpack.test.cjs
dist/ (gerado e ignorado)
manifest.json
popup.html
package.json
package-lock.json
webpack.config.js
README.md
```

**Structure Decision**: Mover as sete entradas da pasta real, mantendo nomes das
fontes e os arquivos legados na raiz. A pasta original ficará vazia após mover
as entradas conhecidas; não executar remoção recursiva nela.

## Complexity Tracking

Sem violações ou infraestrutura adicional justificada.

## Review Focus

- Injeções por files precisam acompanhar o caminho novo; conferir ambas.
- Bundles em produção não podem depender de runtime de outro contexto.
- Recursos remotos do HTML continuam como estão; não são scripts remotos novos.
- Recarregar a extensão e a página alvo após migração para evitar scripts antigos.
- Não confundir smoke VM offline com carregamento real no Chrome ou coleta real.

## Estratégia de Testes

Prioridade: contratos/integracão offline do artefato, builds e carregamento Chrome.
Não criar testes que simplesmente repitam o webpack.config.js.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build:prod
node --test tests/contracts/001-reorganizacao-node-webpack.test.cjs
./.planning/scripts/powershell/check-contract-tests.ps1 -Slug 001-reorganizacao-node-webpack
```

### Testes de Contrato

Arquivo: tests/contracts/001-reorganizacao-node-webpack.test.cjs, 2/5 casos,
travado em contract-tests.lock. Sem stubs de produto: são testes do artefato.
Comando: `node --test tests/contracts/001-reorganizacao-node-webpack.test.cjs`.

| Teste | Origem | Fase | Vermelho confirmado |
| --- | --- | --- | --- |
| manifesto e popup resolvem todas as entradas locais geradas | FR-002/004, US1-AC1/3, SC-001/002 | 1 | Entrada da extensao ausente: manifest.json |
| bundles de background conteudo e popup inicializam em contextos isolados | FR-004/005/008, Constitution III/V | 1 | Entrada da extensao ausente: manifest.json |

Execução basal: 0/2 verdes, falhas de asserção esperadas, sem erro de importação
ou sintaxe. Não havia suíte anterior no projeto. Fase 1 deve deixá-los verdes
em builds development e production; não editar os contratos na execução.

Validação adicional: conferir reinjeções, hashes em preservation-baseline.json,
modo watch por recompilação observada e ausência de eval no bundle. Carregamento
Chrome é gate de aceite completo; se indisponível, registrar pendência explícita.
Não é necessário coletar dados no site ou autenticar proxy para aceitar a estrutura.

## Estado Atual

| Área | Estado |
| --- | --- |
| Fases 1/2/3 | Concluídas: T001–T008 e checklist de release completos |
| Estrutura | src/ com cinco JS; manifest.json e popup.html na raiz |
| Dependências | Webpack/CLI instalados; npm ci validado; lockfile gerado |
| Contratos | 2/2 verdes em development e production; trava íntegra |
| Preservação | Sete entradas iguais exceto caminhos; dados com status inalterado; exclusões concorrentes dos legados preservadas e documentadas |
| Aceite | README, watch, Chrome 157 e Chromium 156 isolados validados; revisão independente sem achados |

## Riscos e Decisões

| ID | Risco/Decisão | Impacto | Mitigação/Encaminhamento |
| --- | --- | --- | --- |
| R-001 | Isolamento de contextos e bundles | Scripts podem não inicializar | Resolvido: entradas independentes e contrato VM 2/2 em ambos os builds; aceite Chrome registrado em validation/ e confirmado por relato manual do usuário |
| R-002 | Injeções mantêm nome antigo | Fallback deixa de funcionar | Resolvido: duas ocorrências ajustadas para dist/content.bundle.js e caminho validado |
| R-003 | Extensão instalada pode depender da pasta antiga | Migração muda a pasta carregada | Resolvido: raiz carregada em perfis temporários Chrome/Chromium; instalação do usuário intocada; instruções no README e primeiro teste manual bem-sucedido relatado |
| R-004 | Alterações locais em Bases/.data | Perda de trabalho | Resolvido: status pré/pós idêntico nas pastas de dados; hashes dos quatro legados intactos na fase 1; exclusões concorrentes posteriores documentadas em validation/preservation.json |
| R-005 | Bugs preexistentes | Confusão entre migração e correção | Resolvido: oito itens mantidos no backlog, sem mudança funcional nas sete fontes |
| R-006 | Exclusões concorrentes de arquivos legados após fase 1 | Baseline final difere por mudanças externas | Resolvido: nenhuma restauração ou exclusão adicional pelo agente; estado observado registrado em validation/preservation.json; fontes da migração comparadas integralmente |

## Execution Notes

| Data | Fase/Story | Resumo | Pendência Principal |
| --- | --- | --- | --- |
| 2026-11-13 | Fase 1 / US1 | Migração dos sete arquivos, cinco bundles, npm ci e builds dev/prod aprovados; contratos 0/2 → 2/2, trava íntegra; alterações limitadas aos caminhos previstos | Pausa padrão antes da fase 2: README e watch |
| 2026-11-13 | Fase 2 / US2 | README concluído; npm run dev e duas recompilações observadas (alteração/restauração); contratos 2/2, trava íntegra | Smoke Chromium MV3 e fechamento da fase 3 |
| 2026-11-13 | Fase 3 / aceite | Builds dev/prod, contratos 2/2, Chrome 157/Chromium 156 isolados, quatro abas e content script em fixture local verificados; revisão independente sem achados; docs atualizadas | Oito itens de backlog fora do escopo; exclusões concorrentes de legados registradas sem restauração |

**PRÓXIMO**: Reorganização implementada; aguardar decisão sobre as correções do backlog. sdd-converge pode auditar a entrega.

## Arquivos Principais

- `src/`: cinco fontes migradas, com apenas os caminhos de reinjeção alterados.
- `manifest.json`, `popup.html`: entradas na raiz apontando para dist/.
- `package.json`, `package-lock.json`, `webpack.config.js`, `.gitignore`.
- `tests/contracts/001-reorganizacao-node-webpack.test.cjs`: contrato original intacto.

## Cuidados para Retomada

- Modo contínuo autorizado; execução concluída. Não iniciar correções do backlog nesta feature.
- dist/ contém o último build de produção; npm test reconstrói development.
- linkExtractor.bundle.js fica vazio em produção porque não possui consumidor
  dentro de seu bundle; o fluxo atual de links usa a função duplicada em popup.js.
  Não refatorar essa duplicação nesta migração estrutural.
- Pasta original ficou vazia; não houve exclusão recursiva, commit ou publicação.
- As remoções locais dos legados não foram realizadas pelo agente e não devem ser restauradas automaticamente.
- Evidências Chrome/Chromium em validation/ usam recursos e fixture locais; não representam coleta ou proxy reais.

## Resultado Final

**Status**: Convergida em 2026-11-13, sem achados acionáveis e sem novas tasks.

Entregue a organização Node/npm e Webpack confirmada pelo usuário: cinco fontes
em `src/`, bundles reconstruíveis em `dist/`, testes em `tests/`, manifesto e
HTML na raiz, lockfile e README. As duas reinjeções de conteúdo usam o bundle.
Mantidos interface, permissões, chaves de storage e comportamento da aplicação.

### Verificação da convergência

- `npm.cmd test`: build development aprovado e contratos 2/2 verdes.
- `npm.cmd run build:prod`: build minificado aprovado; contratos executados
  diretamente após produção com 2/2 verdes.
- `check-contract-tests.ps1 -Slug 001-reorganizacao-node-webpack -Json`: PASS,
  trava íntegra; nenhum contrato ou fonte alterado nesta convergência.
- Sete entradas comparadas ao backup original, equivalentes exceto pelos caminhos
  de bundles; lockfile coerente, saídas ignoradas e produção sem eval/source maps.
- Evidência anterior de watch, Chrome instalado e Chromium em perfis isolados
  confirmada nos registros da execução; revisão independente sem achados.
- Em 2026-11-13 o usuário relatou um primeiro teste bem-sucedido no Chrome e
  solicitou convergir. Não detalhou fluxos, URLs ou uso de proxy; o relato é
  registrado como validação manual inicial, sem ampliar sua cobertura.

### Cobertura e desvios

FR-001–FR-009 e SC-001–SC-005 cobertos pelas tasks T001–T008, contratos, evidências
de build/watch/navegador e documentação. `tasks.md` permanece byte-idêntico.
Os legados foram conferidos intactos na fase 1 e removidos externamente durante
a execução; essas alterações concorrentes foram preservadas e não constituem
uma exclusão implementada pela feature. Não houve mudança técnica fora das
decisões registradas: runner nativo Node, cinco entradas e nenhuma dependência
de Jest/Babel ou backend. Não houve commit ou publicação.

README atualizado pontualmente com o relato manual e o encerramento estrutural.
Os sete bugs e a melhoria de empacotamento permanecem no backlog. Esta
convergência não declara proxy real validado nem corrige os fluxos pendentes.

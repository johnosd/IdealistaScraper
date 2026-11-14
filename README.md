# Idealista Extrator

Extensão Chrome Manifest V3 para extrair links de localidades e anúncios do
Idealista.pt, percorrer páginas e exportar JSON. A interface mantém as abas
Links, Itens, Lote e Proxy.

## Desenvolvimento

Requisitos: Node.js 22.16.0 ou superior, npm e Chrome para carregar a extensão.
Execute na raiz do repositório:

```powershell
npm.cmd ci
npm.cmd run test:e2e:install
npm.cmd test
npm.cmd run build:prod
```

Em shells fora do Windows, use `npm` no lugar de `npm.cmd`.

| Comando | Resultado |
| --- | --- |
| `npm run build` | Gera os bundles de desenvolvimento com source maps |
| `npm run build:prod` | Gera bundles minificados sem source maps |
| `npm run dev` | Observa as fontes e recompila automaticamente |
| `npm test` | Reconstrói desenvolvimento e executa testes nativos do Node |

O build recria o conteúdo de `dist/`. Edite as fontes em `src/`; nunca edite
bundles manualmente. O lockfile fixa as dependências de desenvolvimento.
Node/npm são ferramentas de desenvolvimento: a extensão executa no navegador,
sem servidor Node.

## Estrutura

```text
src/
  background.js       # PAC e autenticação do proxy
  content.js          # Extração, paginação e exportação dos anúncios
  linkExtractor.js    # Extração de links de localidades
  popup.js            # Ações do popup e abertura das páginas de extração
  popup-ui.js         # Alternância das abas
  localidades*.js     # Coleta e exportação de localidades
  lote*.js            # Página, coleta, sessão e gravação do lote
tests/contracts/      # Contratos de empacotamento e inicialização offline
dist/                 # Bundles gerados, ignorados pelo Git
manifest.json         # Manifesto e permissões da extensão
popup.html            # Interface e referências aos bundles
localidades.html      # Página de exportação dos links
lote.html             # Página durável de extração em lote
webpack.config.js
package.json
package-lock.json
```

## Carregar no Chrome

1. Execute `npm run build` ou `npm run build:prod`.
2. Abra `chrome://extensions/` e habilite o modo do desenvolvedor.
3. Use **Carregar sem compactação** e selecione a raiz deste repositório, onde
   está `manifest.json`. Não selecione `src/`, `dist/` ou a pasta antiga.
4. Abra o popup e confira as quatro abas e eventuais erros da extensão.

Depois de alterar arquivos, reconstrua os bundles (ou mantenha `npm run dev`
ativo), recarregue a extensão e atualize a página alvo para carregar os novos
scripts de conteúdo. Webpack não faz a recarga do Chrome automaticamente.

Para validar a migração, prefira um perfil separado. A pasta de carregamento
mudou; não remova a instalação existente nem limpe seu armazenamento para
testar, pois a nova instalação pode ter outra identidade local.

## Testes e limites

Os testes usam `node:test`, sem Jest/Babel. Os testes de DOM utilizam o Chromium
do Playwright; instale-o uma vez com `npm.cmd run test:e2e:install` após o npm ci.
Eles verificam referências locais,
permissões e inicialização dos bundles com APIs simuladas, sem acessar o site
ou ativar proxy. Para rodá-los sobre o último build, inclusive produção:

```powershell
node --test tests/contracts/001-reorganizacao-node-webpack.test.cjs
```

Build e testes offline não comprovam coleta no site atual ou autenticação de
proxy. O roteiro de aceite está em
[quickstart.md](.sdd/specs/001-reorganizacao-node-webpack/quickstart.md).

## Legados e pendências

O histórico do repositório inclui um coletor Python separado (`IdealistaScraper.py`)
e um notebook de tratamento com pandas (`TrataArquivos.ipynb`). Esses materiais não integram o
build da extensão e suas dependências não são instaladas pelo npm.

`Idealista_extensao.zip`, quando presente no checkout, é um pacote histórico
divergente das fontes atuais; não representa o build desta reorganização.
A geração de pacotes e os problemas
funcionais conhecidos estão registrados no [backlog](.planning/backlog.md).
Esta migração organiza o desenvolvimento e preserva o comportamento existente.

O aceite da reorganização incluiu carregamento do build de produção no Google
Chrome e no Chromium, em perfis temporários isolados, com as quatro abas e o
script de conteúdo verificados. As páginas e os recursos externos desses testes
foram fornecidos localmente; coleta no site e autenticação de proxy não foram
validadas. Evidências em
[validation/](.sdd/specs/001-reorganizacao-node-webpack/validation/).

A reorganização foi convergida em 2026-11-13. O usuário também relatou um
primeiro teste bem-sucedido no Chrome; os fluxos exercitados nesse teste não
foram detalhados. As correções funcionais continuam no backlog.

## Exportar links para a pasta do projeto

Após gerar o build, recarregue a extensão em `chrome://extensions`.
**Extrair Links (JSON)** abre uma página separada, que continua funcionando
quando o popup fecha. Mantenha essa página aberta durante a operação.

1. Clique em **Escolher / trocar pasta** e autorize `.data/localidades` do projeto.
2. Clique em **Extrair e salvar**. A extensão grava
   `YYYYMM/links_localidades_YYYYMM.json` dentro da pasta escolhida.
3. Se o arquivo existir, confirme a substituição. Recusar mantém o arquivo anterior.

O mês vem da data local no início da extração. A pasta escolhida é a base;
`.data/localidades` não será acrescentado novamente. O Chrome pode exibir apenas
o nome da pasta, sem validar o caminho absoluto do repositório.

A referência da pasta fica em IndexedDB próprio. Quando necessário, use
**Reautorizar pasta** e depois **Salvar JSON coletado**, sem repetir a coleta.
Trocar de pasta não move arquivos anteriores. Se a pasta não puder ser memorizada,
a página informa o erro e permite usá-la nesta sessão. Os registros coletados ficam
somente na memória dessa página; fechar a página encerra essa sessão.

Não há download de reserva. Extração vazia, recusa e falta de permissão não
substituem o retrato anterior. Outra página gravando recebe prioridade até concluir;
a segunda informa que está ocupada. Itens e Proxy mantêm seus destinos anteriores;
o destino do Lote é descrito abaixo.

Testes E2E usam perfil temporário, fixtures locais e seletor simulado com OPFS:

```powershell
npm.cmd run test:e2e:install
npm.cmd run test:e2e
npm.cmd run build:prod
node tests/e2e/localidades.smoke.cjs
```

Esses testes não autorizam uma pasta externa real. O usuário informou validação
manual no Chrome em 2026-11-13, após o roteiro de gravação, recusa, substituição
e reabertura. Evidência e limites em
[manual-chrome.md](.sdd/specs/002-exportacao-localidades-pasta-autorizada/validation/manual-chrome.md).

## Exportar lote para municípios

Na aba **Lote**, use **Abrir extração em lote**. Na página que abre, escolha a
pasta base `.data/municipios` no seletor do Chrome e cole o JSON de localidades
(`URL`/`Texto`, `link`/`nome` ou URLs por linha). Cada item gera
`{YYYYMM}/<nome>-Paginas<N>.json`. O mês local é fixado ao iniciar o lote,
inclusive durante pausa e recuperação de gravação. Caracteres incompatíveis
com nome de arquivo são normalizados, preservando acentos.

Ao abrir pelo popup numa página com localidades no breadcrumb, também pode usar
**Carregar lista da página de origem**. A lista é ordenada pela contagem exibida;
resultado vazio ou erro mantém a lista anterior.

Arquivos com o mesmo caminho são **substituídos sem confirmação**. Outros nomes,
meses e variantes por número de páginas são preservados. O lote não gera Downloads
de reserva. A autorização dessa pasta é independente da pasta de localidades,
cuja substituição continua exigindo confirmação.

A página pode perder foco e o popup pode ser fechado. Mantenha a página do lote
aberta: resultados pendentes ficam em sua memória. Falhas HTTP/rede ou HTML sem
listagem durante a paginação impedem a gravação parcial e mantêm o item na fila.
Falha de escrita/permissão conserva o resultado coletado: use **Autorizar novamente**
ou troque a pasta, depois **Tentar salvar novamente**, sem recoletar. Se somente a
persistência da fila falhar após o arquivo ser salvo, a tentativa repete essa etapa.

**Pausar após este item** aguarda o arquivo atual; **Continuar lote** mantém o mês.
Outra tela não pode modificar a fila controlada pela sessão aberta. Após concluir,
use **Ativar esta tela** para começar outro lote ou editar sua lista. Ao reabrir,
a fila restante é restaurada, mas resultados pendentes em memória não são recuperados.
O controle de exportação parcial permanece indisponível.

Se a página não mostrar uma listagem ou o link explícito de anúncios, o lote
aguarda o conteúdo por até dez segundos. Bloqueios/verificações são informados
com o título e a URL; a aba de coleta fica aberta para inspeção. Após conferir
o acesso no Chrome, use **Continuar lote**. A tentativa reutiliza a mesma aba
quando ela ainda corresponde ao item; não há resolução automática de CAPTCHA.

O extrator mantém 17 campos. A revisão corrigiu contagem de fotos e indicação
explícita de garagem/estacionamento nos cards. Fotos/legendas, vídeo, anunciante
e dados ainda sem campo próprio estão inventariados na
[auditoria de dados](.sdd/specs/003-exportacao-lote-municipios/listing-audit.md);
não representam coleta de todos os dados das páginas de detalhe.

```powershell
npm.cmd run test:e2e:lote
```

O E2E usa extensão/crawler reais, fixtures sem rede pública, pasta OPFS e
seletor/permissão simulados. O usuário confirmou gravação de um item em pasta externa real, reabertura/
reutilização do destino e reautorização no Chrome. Evidência e limites em
[validação manual](.sdd/specs/003-exportacao-lote-municipios/validation/manual-chrome.md);
o [roteiro](.sdd/specs/003-exportacao-lote-municipios/quickstart.md) permite repetir o aceite.

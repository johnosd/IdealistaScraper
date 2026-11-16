# Idealista Extrator

Extensão Chrome Manifest V3 para extrair links de localidades e anúncios do
Idealista.pt, percorrer páginas e exportar JSON. No Chrome desktop **141 ou
superior**, a action abre o painel lateral com as abas **Links**, **Itens** e
**Lote**, ao lado do site. **Configurações** fica sempre visível no cabeçalho.

Escolha a pasta de anúncios em **Configurações**. Na aba **Lote**, com uma página do Idealista que
lista localidades, clique em **Iniciar coleta**: o app descobre somente os
links geográficos diretamente listados nessa página e coleta os anúncios de
toda a fila. Exportar a lista de localidades continua sendo uma ação separada
em **Outras ferramentas**, junto da importação de lote e da coleta individual.

O painel mostra origem, estado, páginas confirmadas, anúncios coletados e
pendências por localidade, com busca e filtros. Fechar o painel mantém o
executor em uma aba técnica inativa enquanto o Chrome permanece aberto.
Depois de reiniciar o navegador, a retomada exige uma ação manual.

A fila fica visível durante o processamento, com o município atual destacado,
posição no lote, páginas/anúncios e resultado de cada município. **Ver na fila**
localiza o atual e limpa filtros que o escondam. Trocar de aba mantém a coleta
e o contexto. **Links → Coletar links de localidades** navega no índice principal
do Idealista em primeiro plano e mostra as localidades coletadas na própria aba,
sem exigir pasta. O início não abre a tela de exportação nem Configurações.
**Salvar resultado em JSON** é uma ação posterior e separada. **Itens** abre a coleta
individual de uma página; **Lote** acompanha a coleta automática de municípios.
Em caso de pausa, Links mostra o motivo, o status HTTP disponível e o prazo de
espera. **Ver detalhes e retomar** abre a sessão preservada para retomada manual;
clicar novamente em coletar não substitui essa sessão nem repete o acesso bloqueado.
Se o bloqueio veio de outra coleta e Links ainda não possui sessão, o botão
mostra a espera obrigatória e depois oferece **Conferir acesso e coletar links**,
com confirmação explícita de que o site está acessível.

O fluxo Links foi verificado com extensão/coletor reais e página controlada,
incluindo captura, reabertura e exportação sem nova consulta. No site real, o
MCP Playwright abriu a página com HTTP200 e o extrator do projeto capturou os
84 links da navegação. O MCP recusou acesso à interface interna da extensão;
o clique no painel instalado e o diagnóstico anterior do proxy (407/403)
continuam pendentes. Veja [evidências e limites do teste real](.sdd/specs/005-experiencia-coleta-autonoma/validation/links-mcp-live.md).

Se uma verificação inicial dá lugar à página normal durante o carregamento,
a coleta observa essa transição por até10segundos e usa o documento final.
Bloqueios persistentes e esperas do servidor continuam pausando a coleta;
o app não recarrega a página para insistir. [Correção e testes da transição](.sdd/specs/005-experiencia-coleta-autonoma/validation/links-transition-fix.md).

Falhas comprovadamente locais (404/410 sem sinal de bloqueio geral) permitem
seguir as outras localidades. Use **Retomar coleta** no item ou **Retomar
pendentes** no lote; arquivos concluídos e páginas confirmadas são preservados.
Um resultado completo que não foi gravado pode ser salvo sem buscar anúncios
novamente. Homônimos com mesmo nome de arquivo exigem pasta diferente para
evitar sobrescrita entre itens da mesma execução.

**Configurações** reúne pastas, conexão, limites e diagnóstico de IP. Salvar
não inicia coleta; senha vazia conserva a credencial existente. Alterações
incompatíveis são recusadas durante coleta ativa. A preparação explícita de
uma nova coleta preserva a execução anterior.

A senha do proxy fica salva neste navegador. O campo mostra uma máscara quando
já existe uma senha; clique no **olho** para mostrá-la ou ocultá-la. O mesmo
botão permite conferir uma senha que está sendo digitada. Apenas mostrar a
senha não altera os valores salvos.

Links, Itens e Lote compartilham limites e checkpoints persistentes. O perfil
conservador usa intervalo mínimo de 10 segundos, até 60 solicitações por hora,
200 por sessão e 100 páginas por item. Os limites podem ser ajustados no
**Configurações**. Ajustes e descarte preservam consumo e esperas vigentes.

Nos modos legados de Outras ferramentas, depois de fechar a tela ou reiniciar o Chrome, abra a página correspondente,
use **Atualizar sessões**, selecione a sessão e escolha **Retomar sessão**.
Reabrir não inicia coleta. Checkpoints confirmados não precisam ser recoletados;
uma página enviada sem confirmação pode exigir nova tentativa contabilizada.
Contextos incompatíveis ou com mais de sete dias precisam de conferência;
resultados completos preservados ainda podem ser salvos.

429 exige espera e retomada manual. 403 ou desafio exige pelo menos 30 minutos,
conferência do acesso e retomada manual. A extensão não resolve CAPTCHA nem
troca IP para insistir. Erros transitórios têm até três tentativas totais,
com espera inicial de 30 e 60 segundos. Só uma sessão coleta por domínio.

O proxy solicitado é confirmado antes da navegação e permanece estável durante
a sessão. Mudança de configuração interrompe a coleta. **Verificar IP ativo**
consulta a configuração atual sem ativar/desativar o proxy. A sondagem automática
é opt-in, desligada por padrão, com até uma tentativa por sessão/revisão e
timeout de cinco segundos. IP desconhecido não significa proxy desligado.

Para configurar o proxy, preencha os dados e clique em **Salvar e testar conexão**.
O botão salva, aplica e consulta o IP em uma única ação, sem iniciar coleta.
O resultado aparece junto ao botão: **Testando conexão…**, **Proxy conectado**
com IP de saída, ou falha com orientação. Para voltar à conexão do sistema,
selecione **Direta** e use o mesmo botão. Essas ações exigem coleta pausada.
**Salvar configurações** continua guardando valores sem aplicar/testar;
**Verificar IP ativo** apenas consulta a conexão atual. Aplicar sem testar e
desativar ficam em **Mais opções de conexão**. Uma edição nova remove a
confirmação anterior para não parecer que os novos dados já foram testados.
O início da coleta também aplica a conexão salva automaticamente. O `.env` é
usado apenas pelos diagnósticos locais; a extensão usa os valores de Configurações.
Em 2026-11-14, o proxy informado foi autenticado no Chrome157 e mudou o IP de saída;
a volta à conexão do sistema também foi confirmada. Evidências sanitizadas em
[diagnóstico do proxy](.sdd/specs/005-experiencia-coleta-autonoma/validation/proxy-fix-result.md)
e [validação do retorno na interface](.sdd/specs/005-experiencia-coleta-autonoma/validation/proxy-feedback.md).

**Extrair Itens** abre `itens.html`; o resultado usa Downloads. Depois de conferir
o arquivo, use **Já baixei este resultado**. Uma gravação anterior desconhecida
não dispara outro download automaticamente. Links e Lote preservam suas pastas,
nomes, esquema JSON e regras de substituição.

O controle identifica a coleta que já está ativa quando outro início é recusado.
O diagnóstico mostra tentativas por página, duração e novos anúncios. Falhas de
gravação ficam registradas após reabrir a sessão; os dados coletados permanecem
disponíveis para conferir o destino e tentar salvar novamente.

Há limites de 10 sessões, 50 MiB por sessão e 100 MiB agregados. Falta de espaço
preserva o último checkpoint válido e impede a próxima página. Dados recuperáveis
só são removidos por descarte explícito. Diagnósticos excluem query strings,
HTML e credenciais. A eficácia contra bloqueios do site/proxy comercial não foi
validada; os gates locais e a validação nativa aprovada estão no
[roteiro da feature004](.sdd/specs/004-coleta-resiliente/quickstart.md).
A experiência autônoma005 está **Em Execução**: provas de lógica, UI e painel
real são separadas dos gates ainda pendentes de pasta externa/reautorização e
leitor de tela. Consulte o [roteiro005](.sdd/specs/005-experiencia-coleta-autonoma/quickstart.md)
e suas [tarefas](.sdd/specs/005-experiencia-coleta-autonoma/tasks.md).

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
  content.js          # Extração de uma página; sem paginação autônoma
  coleta*.js          # Coordenação persistente, transporte, limites e UI
  itens.js            # Página durável e confirmação de Downloads
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
itens.html            # Página durável de extração de anúncios
webpack.config.js
package.json
package-lock.json
```

## Carregar no Chrome

1. Execute `npm run build` ou `npm run build:prod`.
2. Abra `chrome://extensions/` e habilite o modo do desenvolvedor.
3. Use **Carregar sem compactação** e selecione a raiz deste repositório, onde
   está `manifest.json`. Não selecione `src/`, `dist/` ou a pasta antiga.
4. Clique na action da extensão e confira o painel lateral Coleta, Configurações
   e Outras ferramentas; confira também eventuais erros da extensão.

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
**Exportar localidades em JSON**, na interface antiga, abre uma página separada, que continua funcionando
quando o popup fecha. Após fechar a página, a retomada do checkpoint é manual.

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
a página informa o erro e permite usá-la nesta sessão. Os registros confirmados
ficam no checkpoint, inclusive quando falta autorização para gravar.

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

Em **Outras ferramentas**, use **Importar lista para coleta em lote**. Na página que abre, escolha a
pasta base `.data/municipios` no seletor do Chrome e cole o JSON de localidades
(`URL`/`Texto`, `link`/`nome` ou URLs por linha). Cada item gera
`{YYYYMM}/<nome>-Paginas<N>.json`. O mês local é fixado ao iniciar o lote,
inclusive durante pausa e recuperação de gravação. Caracteres incompatíveis
com nome de arquivo são normalizados, preservando acentos.

Ao abrir o lote com uma aba de origem identificada (inclusive pelo launcher legado), também pode usar
**Carregar lista da página de origem**. A lista é ordenada pela contagem exibida;
resultado vazio ou erro mantém a lista anterior.

Arquivos com o mesmo caminho são **substituídos sem confirmação**. Outros nomes,
meses e variantes por número de páginas são preservados. O lote não gera Downloads
de reserva. A autorização dessa pasta é independente da pasta de localidades,
cuja substituição continua exigindo confirmação.

A página pode perder foco e o popup pode ser fechado. Resultados pendentes ficam
preservados no checkpoint. Falhas HTTP/rede ou HTML sem
listagem durante a paginação impedem a gravação parcial e mantêm o item na fila.
Falha de escrita/permissão conserva o resultado coletado: use **Autorizar novamente**
ou troque a pasta, depois **Tentar salvar novamente**, sem recoletar. Se somente a
persistência da fila falhar após o arquivo ser salvo, a tentativa repete essa etapa.

**Pausar após este item** aguarda o arquivo atual; **Continuar lote** mantém o mês.
Outra tela não pode modificar a fila controlada pela sessão aberta. Após concluir,
use **Ativar esta tela** para começar outro lote ou editar sua lista. Ao reabrir,
a fila restante é restaurada; selecione uma sessão para recuperar dados pendentes.
O controle de exportação parcial permanece indisponível.

Se a página não mostrar uma listagem ou o link explícito de anúncios, o lote
aguarda o conteúdo por até dez segundos. Bloqueios/verificações são informados
no painel; a aba de coleta fica aberta para inspeção. Após conferir o acesso no
Chrome e cumprir a espera, use **Retomar sessão**. A próxima página ainda não
confirmada pode ser aberta em nova aba própria; não há resolução de CAPTCHA.

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

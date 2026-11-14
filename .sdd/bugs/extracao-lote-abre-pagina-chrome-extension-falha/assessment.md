# Bug Assessment: Lote não reconhece URL do JSON de localidades

- **Slug**: extracao-lote-abre-pagina-chrome-extension-falha
- **Criado**: 2026-11-13
- **Origem**: texto colado pelo usuário; arquivo local indicado no report
- **Veredito**: valid
- **Severidade**: high

## Report

O usuário cola a lista de `.data/localidades/202611/links_localidades_202611.json`
e clica em Iniciar lote. Em vez de navegar às localidades e iniciar a coleta,
o Chrome abre uma página chrome-extension e todas as extrações falham.

## Symptom

O lote transforma objetos com campo `URL` em endereço vazio e tenta navegar a
esse endereço. O esperado é consumir o JSON de localidades já exportado,
mantendo compatibilidade com entradas antigas de lote.

## Reproduction

1. Ler, sem alterar, o JSON indicado: 84 registros, todos com `URL` absoluta HTTPS
   do Idealista. Exemplo: Município Ponta Delgada, URL de arrendar-casas.
2. Reexecutar em node:vm o trecho literal de `src/popup.js:462-469`, extraído do
   próprio arquivo, com cada registro como itemAtual. Resultado: 84/84 endereços
   vazios. Controle `{nome, link:'/arrendar-casas/ponta-delgada/'}` gera endereço correto.
3. Carregar extensão real em Chromium 158.0.8127.18, perfil temporário isolado,
   DNS externo bloqueado e HTTPS abortado. Em página da extensão, criar aba
   about:blank e chamar `chrome.tabs.update(tab.id, {url:''})`.
4. A API devolve destino `chrome-extension://<id>/`, igual a runtime.getURL('').
   Esse recurso raiz não é a página Idealista nem recebe o content script esperado.
5. Encerrar contexto/perfil de teste. Nenhuma coleta externa, proxy, dados de
   perfil real ou escrita no arquivo de localidades foi realizada.

Reprodução executada: transformação do input real e navegação vazia real no
Chromium. Não foi executado lote completo contra o site público.

## Suspected Code Paths

- `src/linkExtractor.js`: exporta objetos com `URL`, `Texto`, `Município`, `Região`;
  esse formato é anterior à mudança de destino da feature 002.
- `src/popup.js:427-440`: parsing da lista e status usam nomes/campos minúsculos;
  não validam o formato e não reconhecem `URL`/`Texto` exportados.
- `src/popup.js:462-469`: navegação de objeto aceita somente itemAtual.link;
  objeto exportado cai no else com url vazia.
- `src/popup.js:477`: tabs.update recebe essa URL vazia sem validar o destino.
- `src/popup.js:413-419`: limpar estado anterior ocorre antes de validar a nova
  lista; inserir validação deve preservar os dados anteriores em entrada inválida.
- `src/popup.js:550-556`: falha é movida para o fim da fila sem limite de tentativas,
  amplificando o sintoma; problema já registrado no backlog, separado deste fix.

## Root Cause Hypothesis

Confiança **high**, confirmada pelas duas reproduções: incompatibilidade de schema
entre exportador (`URL`) e consumidor de lote (`link`), somada à ausência de
validação antes da navegação. O lote usa endereço vazio, que o Chrome resolve
para a raiz da extensão. Não há evidência de que Webpack, o seletor de pasta ou
os bundles de conteúdo tenham causado esse erro; a feature 002 preservou o
trecho antigo de lote, incluindo essa incompatibilidade.

## Proposed Remediation

**Preferida**: centralizar parsing/normalização da entrada do lote em um módulo
pequeno, importado pelo popup. Reconhecer JSON exportado com `URL` e `Texto`,
os objetos legados `link`/`nome` e `url`, além de URLs por linha/arrays de strings.
Resolver caminhos relativos legados contra https://www.idealista.pt e validar
URL HTTPS do domínio Idealista antes de navegar. Exibir rótulo legível usando
campos exportados e legados. Validar a lista inteira antes de limpar estado,
persistir progresso ou alterar abas; erro deve identificar o item e manter a
lista para correção. Nunca navegar para vazio, chrome-extension ou outro domínio.

Preservar formato dos arquivos exportados e a lista bruta do usuário; a
normalização deve servir ao consumo, não apagar campos nem reescrever dados locais.
Não filtrar Tipo/Região/Município ou transformar URLs de localidades silenciosamente.

**Alternativa**: acrescentar apenas itemAtual.URL ao if existente. Evita o caso
principal, mas mantém URLs vazias/inválidas chegando à navegação e duplica regras
de nomes/endereços entre status e execução; por isso não é a preferida.

**Files likely to change**:
- `src/popup.js` — parsing, rótulos e resolução de entrada no handler do lote.
- `src/lote-input.js` — novo módulo de parsing/normalização/validação.
- `tests/unit/lote-input.test.cjs` — formatos aceitos e entradas inválidas.
- `tests/unit/lote-popup.test.cjs` — handler real do popup com colaboradores de
  DOM/Chrome, verificando destino e ausência de efeitos em input inválido.
- `tests/e2e/lote.smoke.cjs` — reprodução com extensão real, fixture local e
  perfil temporário; sem acessar site/proxy ou usar dados de perfil real.
- `package.json` — script opt-in para rodar o E2E de lote, se necessário;
  sem novas dependências ou alteração das entradas/permissões da extensão.

**Tests to add or update**:
- JSON com `URL`/`Texto` equivalente ao arquivo real; endereço enviado a tabs.update
  deve ser exatamente o HTTPS exportado e o status deve mostrar nome legível.
- Compatibilidade com `{nome,link}`, `{url}`, array de strings e URLs por linha;
  links relativos legados e acentos preservados.
- Campo ausente, vazio, tipo inválido, JSON sem array, esquemas perigosos e domínio
  externo rejeitados antes de limpar storage/status/fila ou navegar.
- E2E local do clique Iniciar lote com objeto exportado: página de destino correta,
  tentativa de START_CRAWL na aba correta e nenhuma navegação à raiz da extensão.
- npm test, builds development/production, contratos 001/002 e E2E de localidades
  existentes permanecem verdes. Não alterar contratos travados para fazer o fix passar.

## Risks & Considerations

- O arquivo real contém links de tipos diferentes (sub-região, município, região).
  Nem todo link é necessariamente uma listagem de anúncios; a correção de schema
  não comprova que todo destino contém anúncios ou funciona no site atual.
- Dependência do popup, retries ilimitados, proxy tardio e coleta parcial são bugs
  previamente rastreados. Não ampliar a correção para esses assuntos silenciosamente.
- Não limpar lote salvo, dados locais, credenciais ou histórico durante testes.
- O backlog atual não contém a linha 002 que existia na rodada anterior; preservar
  esse estado concorrente, sem restaurar linhas de features durante este bugfix.
- A reprodução no Chromium isola o erro de URL; validação do site/proxy real
  permanece distinta de prova com fixtures locais.

## Open Questions

Nenhuma necessária para a correção proposta. Stack trace da tela do usuário e
versão exata do Chrome não foram fornecidos; o sintoma foi fundamentado no input
real, no código e na navegação da API real em Chromium.

## Complemento solicitado antes do Fix

Ver [site-review.md](site-review.md), revisão Playwright do site real solicitada
pelo usuário. O extrator cobre os 84 links da seção e os nulls são estruturais;
há evidência adicional de índice concelhos-freguesias versus listagem e rótulo
Município excessivo em ao menos Alvor. Considerar esse complemento antes de
fechar o Fix; não ampliar silenciosamente o contrato de arquivos/remediação acima.

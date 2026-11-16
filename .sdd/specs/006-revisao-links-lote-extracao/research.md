# Research — 006

Incertezas que **só a inspeção real** (T001–T004) resolve. Cada item tem uma decisão provisória
usada pelo plano; o executor DEVE substituir "Provisório" por "Decidido (evidência: …)" antes de
implementar a parte dependente. Nenhuma credencial/token neste arquivo.

## R1 — Estrutura de `/arrendar-casas/<distrito>/concelhos-freguesias`

- **Pergunta**: a lista de concelhos/freguesias usa `nav.locations-list` (como a página nacional) ou outra
  estrutura (ex.: breadcrumb `.breadcrumb-dropdown-subitem-list`, lista de municípios com contagem)?
- **Provisório**: tratar como estrutura desconhecida. `extractLinks` só conhece `nav.locations-list`;
  `extractDirectLocalities` (005) lê o breadcrumb. A 006 unifica em um extrator de localidades com
  estratégias ordenadas (nav → lista da página de concelhos → breadcrumb), escolhida pela evidência.
- **Alternativas**: manter dois extratores separados (rejeitado: é a origem provável da divergência
  "Links coleta X, Lote descobre Y").
- **Decidido (evidência: `validation/site-inspection.md` §1–2, fixtures 2026-11)**: duas estratégias em
  `extractLocalities`: (1) **nacional**, com `nav.locations-list` (formato atual de `extractLinks`, 84 registros);
  (2) **distrito**, quando não há `nav`: concelhos do breadcrumb destacado (`Tipo: Município`, contagem do
  sidenote) + freguesias de `#location_list` (`Tipo: Freguesia`, contagem do `span`, Município pelo slug do
  concelho). Zonas de interesse e vizinhos ficam de fora, mas são contados. `Sub-região` = rótulo atual do
  breadcrumb sem o sufixo " distrito" (`Braga`). Breadcrumb isolado deixa de ser a fonte do Lote.

## R2 — Total declarado e limite de paginação da listagem

- **Pergunta**: onde a listagem mostra o total (título `h1`, `.listing-title`, `#h1-container`)? Qual o
  máximo de páginas percorríveis (Idealista costuma cortar a paginação)? O que acontece em `pagina-N`
  acima da última (redirect, repetição, vazio)?
- **Provisório**: `declaredTotal = null` até haver seletor comprovado; `assessListing` não marca
  `site_limit` sem ele. Página repetida já é tratada por `pagination_cycle`/`visited`.
- **Alternativas**: inferir limite por número fixo de páginas (rejeitado: sem evidência).
- **Decidido (evidência: site-inspection §3–4)**: `declaredTotal` = número inicial do `h1`
  (`/^\s*([\d.]+)\s+(casas|apartamentos|moradias|imóveis|quartos)/i`, `.` como milhar), senão `null`.
  O site limita a listagem a **60 páginas (1.800 anúncios)**: a página 60 não tem próxima; acima dela vem
  HTTP 404 com conteúdo. Além da última página natural, há redirect para a página 1 (tratado como
  `pagination_cycle`). Com o padrão `maxPagesPerItem` 100, o limite do site chega antes do orçamento.

## R3 — Sinais de bloqueio reais

- **Pergunta**: como aparece o bloqueio hoje (HTTP 403 + página de desafio, `cf-mitigated`, título,
  iframe captcha, 429)? Ele some sozinho? Em quanto tempo?
- **Evidência parcial (2026-11-16, Chromium headless do Playwright, sem perfil e sem proxy)**: HTTP 403,
  título `Um momento…`, `h1` = `www.idealista.pt`, sem listagem, em `braga-distrito/concelhos-freguesias`,
  `braga-distrito/`, `geo/arrendar-casas/acores/` e `faro-distrito/`. Os detectores atuais
  (`coleta-page.js` `inspectCollectionPage`, `lote-navigation.js` `inspectBatchDestination`) **não**
  reconhecem esse título: `challenge` saiu `false`. Só o status 403 garante a classificação hoje.
  Ver `validation/pre-plan-headless-probe.md`.
- **Decidido**: incluir `um momento` (sem depender de acento) nos padrões de título dos dois detectores
  (task T058). Outros sinais só com evidência. Prazo do coordenador (30 min) mantido.
- **Evidência no Chrome real (site-inspection §7)**: a 1ª navegação recebeu HTTP 403 "Just a moment..." e liberou
  sozinha em cerca de 5 s; as 9 seguintes, com intervalo de 10 s ou mais, não foram bloqueadas. Isso confirma o caso
  transitório já tratado pela 005 (observação passiva de até 10 s) e justifica a recuperação automática da US5.

## R4 — Freguesia no anúncio

- **Pergunta**: o card da listagem expõe a freguesia de forma estruturada (atributo, elemento próprio,
  breadcrumb) ou só no título livre ("…, Sé, Braga")?
- **Provisório**: `Freguesia = null` (FR-027). Só preencher com fonte estruturada demonstrada.
- **Evidência (site-inspection §6)**: o card **não tem** campo estruturado de freguesia. O título termina com o
  nome dela, e 10 de 10 sufixos amostrados coincidem com nomes de `#location_list` do distrito.
- **Decidido (confirmado pelo usuário em 2026-11-16)**: `Freguesia` só vem de fonte
  verificável: (1) a entrada é do tipo `Freguesia`, então usa o nome da entrada; (2) senão, o sufixo do título
  (após a última vírgula), **somente** se ele coincidir exatamente com uma freguesia conhecida da mesma fila
  coletada (mesma página de origem). Nos demais casos fica `null`. Sem inferência por texto livre não validado.

## R5 — `/geo/arrendar-casas/<região>/`

- **Pergunta**: é página de listagem ou hub com "Ver N casas"? O destino é a listagem completa da região?
- **Provisório**: hub; resolvido pelo fluxo `destinationUrl` existente.
- **Decidido (evidência: site-inspection §5)**: **listagem direta** (`/geo/arrendar-casas/norte/`, 6.027 anúncios,
  paginação `/geo/…/pagina-N`). `deriveListingURL` não altera `/geo/` (C1), e o coletor pagina normalmente.
  O fluxo de destino "Ver N casas" continua só como proteção.

## R6 — Ferramenta de inspeção

- **Decidido**: Playwright MCP (`mcp__playwright__*`) conectado ao Chrome do usuário, quando disponível
  na sessão do executor; senão Playwright local (`playwright` 1.65.0 já em devDependencies) com perfil
  temporário e a extensão carregada (`tests/fixtures/coleta-browser.cjs` mostra o padrão). Limitação
  conhecida (005): a conexão MCP recusou navegar para `chrome-extension://…` — validação da extensão
  instalada pode exigir roteiro manual (quickstart Q6). Proxy do `.env` só se a conexão direta for
  bloqueada; valores nunca copiados para arquivos versionáveis.
- **Atualização (2026-11-16)**: o Chromium automatizado e limpo é bloqueado (R3). A inspeção N3 DEVE usar
  o Chrome real do usuário (Playwright MCP em modo extensão) ou um roteiro manual com o usuário. Não usar
  técnicas de evasão (stealth, troca de user-agent, rotação) para passar pela verificação.

## R7 — Derivação para sub-regiões (Analyze A-01)

- **Decidido (evidência: fixture 2026-11-15 + afirmação do usuário no pedido)**: os 22 links com
  `/concelhos-freguesias` no fixture nacional são todos sub-regiões (distritos/ilhas); o usuário afirmou
  que `braga-distrito/` traz todas as casas do distrito. Municípios já vêm sem o sufixo e `/geo/` usa o
  fluxo de destino. D2 mantida; confirmar em T004/T006 no Chrome real. Se falhar em algum distrito/ilha,
  aplicar R-001 (consultar o usuário; não editar o C1).

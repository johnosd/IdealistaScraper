# Inspeção do site real — 2026-11-16 (N3)

Ferramenta: Playwright MCP em modo extensão, no Chrome real do usuário, sem proxy, sem a extensão do
projeto envolvida. Funções do projeto executadas no DOM real por cópia literal
(`extractLinks`, `extractDirectLocalities`, seletores de `extrairDaRaiz`/`inspectCollectionPage`).
Intervalo de 10 s ou mais entre navegações. Nenhum clique em desafio e nenhuma evasão.
Fixtures sanitizadas: `tests/fixtures/idealista-concelhos-braga-2026-11.html` e
`tests/fixtures/idealista-listing-braga-p1-2026-11.html`.

## 1. Página nacional `…/arrendar-casas/#municipality-search` (T003)

| Medida | Observado | `extractLinks` (Links) | `extractDirectLocalities` (Lote/005) |
| --- | --- | --- | --- |
| Links de localidade em `nav.locations-list` | 84 únicos | **84/84**, sem faltantes (7 Região, 22 Sub-região, 55 Município) | **0** |
| Links com `/concelhos-freguesias` | 22, todos Sub-região | — | — |
| Regiões `/geo/…` | 6 (Faro é `/arrendar-casas/faro-distrito/`) | — | — |

- Primeiro acesso: **HTTP 403, título "Just a moment..."**. A página liberou sozinha em cerca de 5 s
  (título normal), sem interação.
- Estrutura igual ao fixture de 2026-11-15, que continua válido; não criei um fixture novo.

**Divergência D-1 (central)**: o Lote autônomo descobre pelo breadcrumb e acha 0 localidades na página
nacional, enquanto o Links acha 84. Correção: extrator único `extractLocalities` (T011/T014).

## 2. Distrito `…/arrendar-casas/braga-distrito/concelhos-freguesias` (T004)

Caminho real confirmado: `concelhos-freguesias` (plural). HTTP 200.

| Bloco | Seletor | Itens | Exemplo |
| --- | --- | --- | --- |
| Concelhos (municípios) | `.breadcrumb-dropdown-element.highlighted ul.breadcrumb-dropdown-subitem-list > li > a` + `.breadcrumb-navigation-sidenote` | 14, com contagem | `Braga` → `/arrendar-casas/braga/concelhos-freguesias` (475) |
| Freguesias | `#locations > ul#location_list > li > ul > li > a` + `span` (contagem) | 134, com contagem, agrupadas por letra | `Adaúfe` → `/arrendar-casas/braga/adaufe/` (2) |
| Zonas de interesse | `#zonesOfInterest a` | 15 `/geo/…` | `Areal de Baixo` |
| Vizinhos | `#surroundings a` | 3 outros distritos | `Porto` |
| CTA da listagem | `#showAllLink` "Ver 868 casas e apartamentos em Braga" | 1 | `/arrendar-casas/braga-distrito/` |
| Outros distritos (breadcrumb não destacado) | `.breadcrumb-dropdown-element:not(.highlighted) > a` | 28 | Lisboa 9.655, Porto 4.548 |

- `nav.locations-list` **não existe**, então `extractLinks` retorna **0** (Links coleta nada nessa página: D-2).
- `extractDirectLocalities` retorna os 14 concelhos, mas ignora as 134 freguesias (D-3).
- O slug do concelho no caminho da freguesia (`/arrendar-casas/<concelho>/<freguesia>/`) permite atribuir o Município.

## 3. Listagem `…/arrendar-casas/braga-distrito/` (T005)

| Medida | Observado |
| --- | --- |
| Anúncios por página | 30 (`article.item` sem `.adv`; 2 `article.adv` ignorados) |
| Seletores de `extrairDaRaiz` | título/link 30/30, preço 30/30, detalhe 30/30, descrição 30/30, fotos 30/30, id (`data-element-id`) 30/30; agência 10, tags 1, preço original 2 (opcionais) |
| Total declarado | `h1` = "868 casas e apartamentos para arrendar em Braga distrito" (número no início, separador de milhar `.`) |
| Próxima página | `a.icon-arrow-right-after` = `.pagination li.next a` = `/arrendar-casas/braga-distrito/pagina-2` (**sem barra final**) |
| Última página | `pagina-29`: 28 anúncios (28 × 30 + 28 = 868 ✓), sem link de próxima |
| Além da última | `pagina-30` → **redirect para a página 1** (HTTP 200, `redirectCount` 1) |

## 4. Limite de paginação do site (R2)

- `lisboa-distrito` (9.655 declarados): `pagina-60` tem HTTP 200, 30 anúncios, **sem próxima página** e o aviso
  "Viste 1.800 casas e ainda não encontraste o que procuras?…".
- `pagina-100` responde **HTTP 404**, mas ainda mostra 30 anúncios e uma paginação de 55 a 60 com "Seguinte" → 101.
- Conclusão: o limite é **60 páginas, ou 1.800 anúncios, por listagem**. O coletor para em 60 porque não há
  próxima página; `declaredTotal` (9.655) > obtido (≤ 1.800) → `completeness: limited / site_limit`.

## 5. Níveis de listagem e derivação (T006, R5/R7)

| Link | Listagem | Resultado |
| --- | --- | --- |
| `braga-distrito/concelhos-freguesias` → `braga-distrito/` | listagem, 868 | D2 confirmada (sub-região) |
| `braga/concelhos-freguesias` → `braga/` | listagem, 475 (= contagem do breadcrumb) | D2 confirmada (concelho) |
| `/geo/arrendar-casas/norte/` | **listagem direta**, 6.027, paginada `/geo/…/pagina-2` | R5: não é hub; não precisa do fluxo "Ver N casas" |

## 6. Freguesia no anúncio (R4)

- O card não tem campo estruturado de localização (só botões de mapa).
- O título termina com a freguesia: "Andar de moradia na Rua da Restauração, 175, **São Victor**". Os 10 sufixos
  amostrados coincidem com nomes de `#location_list` do distrito ("Oliveira - São Paio - São Sebastião",
  "Gualtar", "Azurém"…).

**Decisão aplicada (usuário, 2026-11-16; T049):** `Freguesia` = nome da entrada quando ela é do tipo Freguesia;
senão, o sufixo do título só se coincidir exatamente com uma das 134 freguesias conhecidas da fila; senão `null`.
Implementada na gravação (`matchFreguesia` em `src/coleta-completeness.js`), sem alterar `extrairDaRaiz`.
Sobre a listagem real de Braga (p.1): **28/30 anúncios** recebem Freguesia validada e 2 ficam `null`. Os campos
antigos ficam idênticos (SC-010, `extractors-fixtures.smoke`).

## 7. Bloqueio (T007, R3)

- No Chrome real: a 1ª navegação recebeu **HTTP 403 "Just a moment..."** e liberou sozinha em cerca de 5 s.
  As 9 navegações seguintes (≥ 10 s de intervalo) não tiveram bloqueio.
- No Chromium headless (sondagem anterior): 403 "Um momento…" persistente.
- Os padrões atuais de título reconhecem "just a moment", mas não "Um momento" (R-010 → T058).

## Divergências e correções

| ID | Divergência | Correção | Task |
| --- | --- | --- | --- |
| D-1 | Lote descobre pelo breadcrumb: 0 na página nacional; Links: 84 | `extractLocalities` com estratégia `nav.locations-list` | T011, T014 |
| D-2 | `extractLinks` = 0 na página de distrito | Estratégia distrito: concelhos do breadcrumb + freguesias de `#location_list` | T011 |
| D-3 | `extractDirectLocalities` ignora as 134 freguesias | Idem | T011 |
| D-4 | Total declarado não é extraído | `declaredTotal` = número inicial do `h1` | T013 |
| D-5 | Desafio "Um momento…" não é detectado pelo título | Padrão incluído | T058 |
| D-6 | Limite de 60 páginas e 404 além do limite | Coletor para no fim natural (sem próxima); `site_limit` por `declaredTotal`. Nenhum pedido acima de 60 | T033 (já planejado) |
| D-7 | Próxima página sem barra final | Sem impacto: `normalizedURL` preserva; `visited` compara a URL normalizada | — |
| — | `extrairDaRaiz` (anúncios) | **Sem divergência**: todos os seletores obrigatórios cobrem 30/30 | — |

## Escopo do extrator na página de distrito (decisão de execução)

O FR-003/US1-AC2 fala em "municípios e freguesias listados" na página. A estratégia de distrito coleta
**concelhos (14) + freguesias (134) = 148**. Ficam de fora as zonas de interesse (`/geo/…`, 15), que são bairros e
lugares, e não divisões administrativas, e os vizinhos (outros distritos, 3). Ambos ficam registrados como não
coletados, com contagem, para o painel mostrar "N de M links de localidades" sem falso alerta.

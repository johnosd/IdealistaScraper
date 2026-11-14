# Revisão de dados de uma localidade — Alvor

Observação real com Playwright MCP em 2026-11-13, aproximadamente 22:52–22:54 UTC.
Skill solicitada: `.claude/skills/playwright-site-debug/SKILL.md`, lida e aplicada.

## Método

Navegação somente de leitura:
- https://www.idealista.pt/arrendar-casas/portimao/alvor/
- https://www.idealista.pt/arrendar-casas/portimao/alvor/pagina-2

Executadas no DOM as funções existentes `extrairDaRaiz`, `limparTexto`, `toAbs`
e `parseIntSafe`, lidas de src/content.js, sem alterar sua implementação. O script
de mensagens/crawler não foi iniciado; não houve ativação de proxy, download ou
gravação de dados do site em .data. Não foram abertas páginas individuais dos anúncios.

## Cobertura observada

| Página | Cards elegíveis | Registros retornados | Próximo destino |
| --- | --- | --- | --- |
| 1 | 30 | 30 | pagina-2 |
| 2 | 20 | 20 | null |

Cabeçalho informou 50 anúncios; união dos IDs retornados: 50 únicos, zero
duplicados entre páginas. Sem ID/Titulo/Link/Preco vazios nos registros retornados.
Isso valida a extração isolada e o encadeamento dos links nessa amostra; não
comprova a execução completa do lote/fetch/persistência contra o site público.

## Campos: resultado e achado

O extrator possui 17 campos. Titulo, Link, Preco, id, detalhe do item, tipologia
e areaBrutaM2 ficaram preenchidos nos 50 registros. Demais opcionais abaixo.

| Campo | Observação |
| --- | --- |
| imagens | 50/50 null apesar de contador visível em todos: falha comprovada |
| agenciaNome/agenciaLink | 34 null; nenhum card com branding deixou de retornar nome; ausência de branding não autoriza inventar agência |
| precoOriginal/descontoPercentual | 45 null; valores opcionais, cinco cards com redução retornaram valores; página 2 tinha um preço anterior e um extraído |
| estacionamento | 50 null; na página 2 não havia o elemento correspondente; null não é prova de ausência de estacionamento no imóvel |
| tempoDestaque | 50 null; na página 2 não havia destaque vermelho correspondente |
| pisoResumo | 15 null; não foi comprovada perda de informação de andar nesta revisão |
| Descricao do item | Cinco null na página 2; elemento existe, mas textContent vazio nos cinco casos |
| tags | Mantém lista de rótulos conforme o seletor existente; não foi definida ampliação para novos metadados |

As descrições não vazias conferidas correspondem ao resumo disponível no card.
A primeira tinha 317 caracteres na fonte e no JSON; é resumo da listagem e pode
estar truncado. Não representa descrição integral do anúncio.

## Falha comprovada no contador de fotos

src/content.js consulta `.item-multimedia-pictures--old`, que não apareceu em
nenhuma das duas páginas. O DOM atual usa `.item-multimedia-pictures__counter`
com spans separados para posição atual e total. Na primeira página foram
observados 30 contadores atuais; na segunda, 20.

Exemplo de estrutura mínima observada (texto sem dados pessoais):

```html
<div class="item-multimedia-pictures__counter"><span>1/</span><span>9</span></div>
```

O resultado esperado desse card em `imagens` é 9, não null, 1 ou 19. A correção
deve aceitar formato atual, manter fallback legado e conservar null se não houver
total informado. Regressão deve cobrir execução no DOM e HTML parseado pelo crawler.

## Limites e encaminhamento

- Não preencher com zero os nulls sem evidência na fonte.
- Não houve auditoria de todos os municípios, de dados em detalhe, contatos ou
  da totalidade dos possíveis formatos/valores do site.
- Contagens/números são o retrato da inspeção, não valores fixos para testes futuros.
- A alteração de seletor de `imagens` integra a feature 003 por solicitação de
  revisão. O complemento abaixo acrescenta estacionamento e inventário; novos
  campos permanecem recomendações, sem ampliação automática do schema.

## Complemento — informações ainda não coletadas

Em 2026-11-13 às 23:09 UTC, aplicada novamente a skill playwright-site-debug
na segunda página já aberta. Inspeção de classes, atributos, textos dos detalhes
e elementos de mídia dos 20 cards. Não foram acionados contatos, mapas ou vídeos.

| Informação | Fonte observada na página 2 | Cobertura atual | Encaminhamento |
| --- | --- | --- | --- |
| Garagem incluída | `.item-detail`, sete cards | Presente em `detalhe do item`, mas `estacionamento` null nos sete; seletor `.price-row .item-parking` ausente | Corrigir o campo existente, com fallback legado |
| Total de fotos | Contador atual, 20 cards | `imagens` null | Correção já especificada |
| URL/legenda de fotos | `.item-gallery img[src]`, 20 cards | Não exportadas | Novo candidato; galeria carregada é parcial, não prometer todas as fotos |
| Disponibilidade de vídeo | `.icon-video-outline`, um card (atalhos desktop/mobile duplicados) | Não exportada | Novo candidato booleano; não equivale à URL/conteúdo do vídeo |
| Área do lote/terreno | `.item-detail`, dois cards (450 e 480 m²) | Conservada no texto composto; sem campo numérico próprio | Novo candidato `areaTerrenoM2`, sem confundir com área bruta |
| Elevador | `.item-detail`, 15 cards | Texto em detalhe/pisoResumo; “sem elevador” isolado não entra em pisoResumo | Novo candidato com três estados: informado sim/não ou desconhecido |
| Rótulo de data | `.item-detail`, um card com “10 nov” | Conservado no texto composto | Novo candidato textual; não inferir ano nem significado publicação/atualização |
| Tipo de anunciante | `data-is-professional-ad`, valores true/false | Não exportado; agência só quando branding presente | Novo candidato; profissional não fornece nome de agência por si só |
| Reserva online/faturação/offmarket | `data-online-booking`, `data-is-invoice-ad`, `data-is-offmarket`, todos false nesta amostra | Não exportados | Candidatos técnicos; sem inferir semântica comercial não verificada |
| Telefone, descrição integral, galeria completa e localização exata | Exigem ação/detalhe; botão de telefone não contém número nesta inspeção | Não verificados/não coletados integralmente | Fora da coleta desta feature; não declarar ausência no imóvel |

Conclusão: os 17 campos não representam toda a informação disponível. Há duas
falhas comprovadas em campos existentes (`imagens`, `estacionamento`), dados já
conservados em campos compostos e candidatos novos ainda sem chaves dedicadas.
Não foi auditada a totalidade dos scripts/endpoints privados nem todos os formatos.

Às 23:10 UTC, tentativa de reabrir a primeira página retornou HTTP 403 e título
“Just a moment...”. A inspeção foi interrompida sem contornar a verificação.
Esse bloqueio não invalida a observação anterior das duas páginas, mas limita
o inventário complementar aos 20 cards da página 2. Contagens são instantâneas.

## Implementação e evidência offline

Correções aplicadas na 003 em src/content.js. Testes com a função real passaram
para fotos atual/legado/ausente/malformado e garagem atual/legada/ausente, mantendo
as 17 chaves e os demais campos. E2E com extensão real e fixtures verificou DOM
inicial/HTML da página seguinte e fluxo Itens. Não houve nova coleta real após o403.
A observação anterior de estacionamento referia-se apenas ao seletor antigo: o
complemento comprovou que a informação existia em .item-detail e corrigiu essa
interpretação de ausência. Candidatos novos continuam apenas documentados.

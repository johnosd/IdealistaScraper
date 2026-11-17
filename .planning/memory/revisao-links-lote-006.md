# 006 — revisão Links → Lote → extração (planejada 2026-11-16)

Feature `006-revisao-links-lote-extracao` especificada e planejada. Base: 005 (Em Execução 58/64).

Decisões do usuário: nova spec (não emenda da 005); uma entrada do Lote por link, listagem = link sem
`/concelhos-freguesias`; aba Idealista visível dedicada, em foco só ao abrir, navegação real por página;
bloqueio: esperar e retomar sozinho, sem contornar; coletar todos os links e deduplicar só no resumo
(arquivo mantém listagem completa); aceite exige site real + extensão instalada; proxy opcional;
campos aditivos Região/Sub-região/Município/Freguesia (Freguesia só com fonte estruturada).
O usuário mencionou que o ideal talvez fosse coletar por município — registrado como não incluído
(fila não expande automaticamente).

Achados de código (não confirmados no site real): Links usa `extractLinks` (nav.locations-list) e
o Lote autônomo descobre pelo breadcrumb (`extractDirectLocalities`); `links-runner` ignora a página
atual; paginação por fetch em aba inativa recriada por item; `maxPagesPerItem`/`window_budget`/bloqueio
pausam a fila inteira; contratos 004 C2 e 005 C5 exigem retomada manual após desafio, por isso a
recuperação automática fica em `runQueue` opt-in.

Inspeção real 2026-11-16 (Chrome do usuário via Playwright MCP modo extensão, configurado em
escopo local): página nacional = nav.locations-list (84); distrito `…/concelhos-freguesias` NÃO tem
nav — concelhos no breadcrumb destacado (14 em Braga) e freguesias em `ul#location_list` (134);
listagem 30/página, total no `h1`, próxima `/pagina-N` sem barra, site corta em 60 páginas (1.800),
>60 = 404, além da última natural = redirect p.1; `/geo/…` é listagem; desafio "Just a moment..."
some sozinho em ~5 s no Chrome real, headless fica 403 "Um momento…". Detalhes em
`.sdd/specs/006-…/validation/site-inspection.md`.

Credenciais de proxy e token MCP foram colados no chat pelo usuário; não foram gravados em nenhum
artefato. Playwright MCP não estava disponível na sessão de planejamento; nenhuma inspeção real feita.

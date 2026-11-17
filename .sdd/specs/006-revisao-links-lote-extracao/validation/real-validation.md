# Validação real (N4) — 2026-11-16

Níveis de evidência, separados (Constitution V):

| Nível | Evidência |
| --- | --- |
| N1 unitário/contrato | 262/262 (`node --test`), contratos 006 5/5, travas 001–006 íntegras |
| N2 controlado | 22 smokes (`tests/e2e/*.smoke.cjs`) em prod; dev 21/22 (`autonoma.smoke`, intermitência conhecida R-008/R-020) |
| N3 site real sem a extensão | `site-inspection.md` (Playwright MCP no Chrome do usuário) |
| **N4 site real com a extensão instalada** | **Este documento: aprovado pelo usuário ("está funcionando") + arquivos gravados conferidos** |

## Execução

- Quem executou: o usuário, no Chrome pessoal, com a extensão carregada da raiz do projeto (build **production** de `dist/`).
- Proxy: não usado (conexão direta).
- Fluxo: aba Links → "Coletar links de localidades" → página nacional `…/arrendar-casas/#municipality-search` + páginas de concelhos dos distritos acima de 1.800 anúncios (Faro, Lisboa, Porto) → fila de cobertura exibida em Links e Lote (69 localidades: 19 distritos/ilhas + 50 concelhos) → Lote "Iniciar coleta".
- Nenhuma tela de configuração/exportação abriu durante o processamento (relato do usuário).

## Iterações da validação (divergências corrigidas antes do aceite)

1. Links coletava a página atual (149 links do distrito); o usuário esperava sempre a página nacional → T063 (FR-028/D7, R-018).
2. Usuário pediu fila sem duplicar; o "último nível literal" perderia anúncios → fila de cobertura com distritos grandes expandidos por concelhos (FR-029/030, D16, T064–T066).
3. Desafio Cloudflare real na página nacional (`cf-mitigated: challenge`) terminou em `unexpected_content` → o leitor não se vincula ao documento do desafio, janela de 12 s (T067, R-019).
4. A aba Links mostrava 134 registros brutos; o usuário pediu a mesma lista final do Lote → T068.

## Arquivos gravados (`.data/municipios/202611/`, conferidos em leitura)

| Hora | Arquivo | Anúncios (ids únicos) | Região / Sub-região / Município |
| --- | --- | --- | --- |
| 15:30:58 | São Miguel (Ilha dos Açores)-Paginas3.json | 75 (75) | Açores / São Miguel (Ilha dos Açores) / — |
| 15:31:10 | Terceira (Ilha dos Açores)-Paginas1.json | 15 (15) | Açores / Terceira (Ilha dos Açores) / — |
| 15:32:02 | Beja-Paginas4.json | 105 (105) | Alentejo / Beja / — |
| 15:32:54 | Évora-Paginas4.json | 118 (118) | Alentejo / Évora / — |
| 15:33:30 | Portalegre-Paginas3.json | 77 (77) | Alentejo / Portalegre / — |
| 15:35:52 | Santarém-Paginas11.json | 311 (311) | Alentejo / Santarém / — |
| 15:37:33 | Albufeira-Paginas8.json | 222 (222) | Algarve / Faro / Albufeira |
| 15:37:45 | Alcoutim-Paginas1.json | 4 (4) | Algarve / Faro / Alcoutim |
| 15:41:10 | Aljezur-Paginas2.json | 51 (51) | Algarve / Faro / Aljezur |
| 15:43:08 | Castro Marim-Paginas2.json | 34 (34) | Algarve / Faro / Castro Marim |
| 15:44:22 | Faro-Paginas6.json | 151 (151) | Algarve / Faro / Faro |
| 15:44:59 | Lagoa (Algarve)-Paginas3.json | 83 (83) | Algarve / Faro / Lagoa (Algarve) |

- Ordem e encadeamento: uma localidade concluída e gravada antes da seguinte (horários crescentes), na ordem da fila (SC-005).
- Totais compatíveis com as contagens do site (ex.: Beja 105 × 106 e Santarém 311 × 304 declarados na página nacional; variação normal durante a paginação). Nenhum id repetido dentro de um arquivo.
- Campos antigos primeiro; os 4 de contexto ao final (SC-010).
- Faro (2.394 > 1.800) coletado pelos concelhos, não como distrito único (FR-029).
- Os 13 arquivos `-Paginas1.json` de 2026-11-13 em `.data/municipios/202611/` (baseline) não foram sobrescritos: nomes distintos.

## Limites e pendências

- **Freguesia vazia em 1.246/1.246 anúncios.** A regra R4 (entrada do tipo Freguesia ou sufixo do título validado contra freguesias **da fila**) não dispara com a fila de cobertura, que não contém freguesias. Pendente de decisão do usuário (ex.: usar como lista de validação as freguesias lidas nas páginas de distrito, sem virar entradas).
- A coleta completa das 69 entradas não foi acompanhada até o fim nesta validação (12 entradas observadas).
- Bloqueio real durante o Lote não ocorreu nesta sessão; a espera real de 30 min da US5 segue provada só em ambiente controlado. O desafio transitório na página nacional ocorreu e motivou a T067.
- Ilhas dos Açores ausentes da página nacional (Corvo, Horta, Flores, Graciosa, Pico, São Jorge, Vila do Porto, cerca de 15 anúncios) não entram na base; registrado para decisão.

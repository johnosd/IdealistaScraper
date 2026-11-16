# Quickstart — validação da 006

Níveis de evidência (Constitution V), sempre reportados separadamente:
**N1** unitário/contrato · **N2** ambiente controlado (Playwright + fixtures, extensão carregada em perfil
temporário) · **N3** site real sem a extensão (inspeção) · **N4** site real com a extensão instalada.
Aceite da feature exige N4 (FR-025); sem N4 a feature fica Em Execução.

## Pré-requisitos

- Node ≥ 22.16, `npm ci`; Chromium do Playwright (`npm run test:e2e:install`) para N2.
- Para N3/N4: Chrome ≥ 141 com a extensão carregada a partir da raiz do repositório (`dist/` do build atual).
- Pasta de anúncios autorizada em Configurações (pré-requisito do Lote, 005).
- Proxy: opcional. Só configurar em Configurações se a conexão direta for bloqueada (valores do `.env`
  local, digitados na tela; **nunca** copiados para arquivos versionáveis, logs ou evidências).

## Q1 — Checagens automáticas (N1)

```powershell
npm.cmd run build
node --test                                   # suíte inteira, 0 fail, 0 skip
node --test tests/contracts/006-revisao-links-lote-extracao.test.cjs   # 5/5
foreach($s in '001-reorganizacao-node-webpack','002-exportacao-localidades-pasta-autorizada','003-exportacao-lote-municipios','004-coleta-resiliente','005-experiencia-coleta-autonoma','006-revisao-links-lote-extracao'){ .\.planning\scripts\powershell\check-contract-tests.ps1 -Slug $s }
npm.cmd run build:prod
node --test
```

## Q2 — Fixtures e jornadas controladas (N2), nos builds dev e prod

```powershell
node tests/e2e/extractors-fixtures.smoke.cjs   # novo: extratores sobre HTML capturado na inspeção
node tests/e2e/links-one-click.smoke.cjs
node tests/e2e/links-district.smoke.cjs        # novo: página concelhos-freguesias como origem
node tests/e2e/lote-from-links.smoke.cjs       # novo: links → Lote preparado → coleta sequencial com navegação
node tests/e2e/autonoma.smoke.cjs
node tests/e2e/autonoma-tabs.smoke.cjs
node tests/e2e/links-inherited-block.smoke.cjs
node tests/e2e/lote.smoke.cjs
```

Conferir em cada jornada: nenhuma aba `chrome-extension://…/configuracoes.html|localidades.html` criada
sem clique; aba Idealista de coleta única por execução; `pageerror` = 0.

## Q3 — Inspeção do site real (N3)

Para cada URL: `https://www.idealista.pt/arrendar-casas/#municipality-search`,
`https://www.idealista.pt/arrendar-casas/braga-distrito/concelhos-freguesias`,
`https://www.idealista.pt/arrendar-casas/braga-distrito/` (+ `pagina-2/`, a última página e última+1):

1. HTTP observado, título, presença de desafio.
2. Contagem de links de localidades visíveis vs. saída do extrator do projeto executado no DOM.
3. Na listagem: anúncios por página, total declarado, link de próxima página, comportamento além da última.
4. Freguesia: existe fonte estruturada no card?
5. Registrar em `validation/site-inspection.md` e decidir os itens de `research.md`.

Respeitar intervalo ≥ 10 s entre páginas; não forçar bloqueio; parar se aparecer desafio.

## Q4 — Bloqueio (N2 obrigatório; N3/N4 só se ocorrer naturalmente)

- N2: `lote-from-links.smoke.cjs` variante 403→200 e 403 persistente com relógio/prazo controlado
  (`blockedUntil` preparado no perfil temporário, como em `links-inherited-block.smoke.cjs`).
- Esperado: pausa com motivo e horário; retomada sem clique; após `maxRechecks` → intervenção.

## Q5 — Ponta a ponta real com a extensão instalada (N4) — gate de aceite

1. Abrir `…/arrendar-casas/braga-distrito/concelhos-freguesias` no Chrome com a extensão.
2. Painel → Links → Coletar links. Conferir: nenhuma tela de configuração/exportação abre; contagem
   coletada = contagem visível (o painel mostra ambas).
3. Aba Lote: lista com uma entrada por link, URL de listagem sem `/concelhos-freguesias`.
4. Para não percorrer o país inteiro: usar uma entrada pequena (município com ≤ 3 páginas) — ver
   "Coletar somente esta" / seleção — e iniciar. Conferir: aba Idealista abre em foco uma vez e navega
   página a página; o item termina quando não há próxima página; arquivo gravado com campos de contexto.
5. Se possível, uma segunda entrada para observar o início automático da próxima.
6. Registrar em `validation/real-validation.md`: data/hora, URLs, contagens, páginas, arquivo gerado
   (caminho relativo), nível de evidência, uso ou não de proxy (sim/não, sem valores).

## Q6 — Se o MCP/Playwright não puder dirigir a extensão instalada

Roteiro manual Q5 executado pelo usuário, com screenshots; registrar como N4 manual, citando quem executou.
Se nem isso for possível: pendência explícita em `real-validation.md`, sem aceite (FR-025).

## Checklist cross-cutting (constitution)

- Permissões do `manifest.json` inalteradas (nenhuma nova).
- `dist/` só via build; bundles não editados.
- `git status` de `.data/` igual ao baseline (nenhum dado real apagado/sobrescrito por testes).
- Busca por segredos nos artefatos novos: `Select-String -Path .sdd/specs/006-*/**/*,tests/**/* -Pattern 'PROXY_CHEAP|PLAYWRIGHT_MCP_EXTENSION_TOKEN'` → só nomes de variáveis, nunca valores.

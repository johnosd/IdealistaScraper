# Bug Verification: Lote não reconhece URL do JSON de localidades

- **Slug**: extracao-lote-abre-pagina-chrome-extension-falha
- **Testado**: 2026-11-13
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: verified

## Summary

A reprodução equivalente foi executada no Playwright com extensão e crawler
reais em Chromium 158.0.8127.18 e páginas locais. Objetos URL/Texto agora chegam
à listagem correta, inclusive passando pelo CTA de um índice, retornam anúncios
e produzem os arquivos esperados. O sintoma de navegação à raiz chrome-extension
não reproduziu. Testes críticos e regressões passaram.

## Checks Performed

| Checagem | Comando / Ação | Resultado | Notas |
| --- | --- | --- | --- |
| Reprodução pós-fix | node tests/e2e/lote.smoke.cjs | pass | Extensão e crawler reais; quatro jornadas, três downloads, zero pageerrors; dev/prod e nova passada em Test |
| Testes do fix | node --test tests/unit/lote-input.test.cjs tests/unit/lote-navigation.test.cjs tests/unit/lote-popup.test.cjs | pass | 11/11, rerrodados após fix.md na fase Test |
| Regressão development | npm.cmd test | pass | Build e 31/31 |
| Build production | npm.cmd run build:prod | pass | Últimos bundles gerados são production |
| Regressão production | node --test | pass | 31/31 |
| Exportação localidades | node tests/e2e/localidades.smoke.cjs | pass | Oito cenários em development e production; zero downloads/pageerrors |
| Contratos 001/002 | check-contract-tests.ps1 -Slug para cada feature | pass | Travas íntegras, 2+5 testes; fixture travada preservada |
| Arquivo indicado | parseBatchInput com leitura do JSON local | pass | 84 registros válidos, zero URL/nome vazios |
| Preservação do catálogo | Get-FileHash | pass | SHA256 idêntico ao Assess: 7627725C8E703B2F595EC63ED78608B76D3B3CC09FEF873C5703EF519143C708 |
| Lint/type-check | Não configurados | not-run | Projeto JavaScript sem esses scripts |
| Lote no site público/proxy | Não executado | skipped | Coleta externa completa não necessária para reproduzir erro de schema; não confundir com fixtures |

## Output Excerpts

E2E lote: `result: PASS`, `proof: extension/real-crawler/local-fixtures`,
`downloads: 3`, `errors: []`.

Cenários: dois itens URL/Texto (índice → CTA → listagem e destino direto),
objeto legado link/nome, input inválido preservando estado/abas, índice sem CTA
interrompendo com fila intacta. Antes do fix, os objetos exportados resolviam
para string vazia; o novo resultado contém URLs HTTPS de listagens e nomes legíveis.

## Residual Risks

- Não foi executado lote de 84 destinos contra o site real. O diagnóstico real
  anterior confirmou a estrutura de um índice e uma listagem; a regressão do fix
  foi executada sem rede externa e não valida proxy/autenticação/paginação reais.
- Se o site mudar o texto do CTA ou o contêiner, a resolução falha explicitamente
  e mantém o item para correção, sem inventar destino ou iniciar crawler no índice.
- Dependência do popup, retries de outros erros, contagens parciais e proxy tardio
  continuam como bugs previamente registrados. Catálogo pode conter destinos
  sobrepostos; este fix não redefine cobertura territorial nem classificação.

## Recommendation

Fechar este bug — erro de compatibilidade/navegação verificado pela reprodução
equivalente automatizada, com regressões verdes. Recarregar a extensão no Chrome
para usar o build corrigido. Problemas de site/proxy ou outros bugs de lote devem
ser tratados separadamente com suas próprias evidências. Nenhum código-fonte foi
editado nesta fase Test e nenhum commit foi realizado.

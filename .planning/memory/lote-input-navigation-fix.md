# Lote: schema de localidades e índices

2026-11-13: bug extracao-lote-abre-pagina-chrome-extension-falha corrigido e
verificado; relatórios em .sdd/bugs/ com assessment, site-review, emenda, fix e test.

Causa: catálogo exportava URL/Texto, lote lia somente link; endereço vazio era
resolvido por Chrome para chrome-extension://<id>/. Arquivo real tinha 84 entradas,
todas válidas após normalização. Nulls do catálogo não causavam o problema.

src/lote-input.js normaliza exportado e legados, valida HTTPS Idealista e informa
item inválido. Popup valida antes de limpar estado/navegar. src/lote-navigation.js
injeta função autônoma para identificar listagem ou CTA explícito; navega no máximo
um salto e confirma contêiner antes de START_CRAWL. Erro de resolução interrompe
e preserva fila. Não altera catálogo, nulls, classificação ou regras de proxy.

11 unitários novos, 31/31 no conjunto; builds development/production e ambos E2Es
aprovados. E2E lote usa extensão e crawler reais com fixtures locais, quatro jornadas
e três downloads em perfil temporário, zero pageerrors. E2E localidades oito cenários
nos dois builds. Ambas travas íntegras. Catálogo real byte-idêntico, SHA256
7627725C8E703B2F595EC63ED78608B76D3B3CC09FEF873C5703EF519143C708.

Comando novo: npm.cmd run test:e2e:lote. Último build é production; usuário deve
recarregar extensão para usar. Lote completo no site/proxy real não foi executado.
Bugs antigos do popup, retries, parcial e proxy seguem no backlog. Sem commit.

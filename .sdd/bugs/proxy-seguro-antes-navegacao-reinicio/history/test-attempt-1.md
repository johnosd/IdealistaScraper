# Bug Verification: Proxy antes da navegação e recuperação do service worker

- **Slug**: proxy-seguro-antes-navegacao-reinicio
- **Testado**: 2026-11-14
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: failed

## Summary

As reproduções dos bugs de proxy passam em APIs Chrome mockadas. A suíte completa falha no contrato antigo de inicialização tanto em development quanto em production; a entrega não está aprovada.

## Checks Performed

| Checagem | Comando / Ação | Resultado | Notas |
| --- | --- | --- | --- |
| Reprodução pós-fix + regressões de proxy/lote | node --test tests/unit/proxy-background.test.cjs tests/unit/proxy-popup.test.cjs tests/unit/proxy-content.test.cjs tests/unit/lote-collector.test.cjs | pass | 16/16; VM/mocks, sem rede. |
| Suite development e referências de entradas | npm test | fail | Build aprovado; 62/63. Contrato de referências do manifesto/popup aprovado. |
| Build production | npm run build:prod | pass | Webpack compilado com sucesso; último bundle production. |
| Suite production | node --test | fail | 62/63; mesmo contrato de inicialização. Log em test-production.log. |
| Whitespace | git diff --check | pass | Avisos de conversão LF/CRLF do Git, sem erro de whitespace. |
| Lint / type-check | Não há scripts configurados | skipped | Build analisa sintaxe dos módulos. |
| Chrome isolado / autenticação real | Não executado | not-run | Não ampliar prova de VM para navegador/proxy real. |

## Output Excerpts

`bundles de background conteudo e popup inicializam em contextos isolados`: `Cannot read properties of undefined (reading 'onAuthRequired')`.

O contrato fornece apenas chrome.runtime; não fornece chrome.webRequest, chrome.proxy, chrome.storage nem chrome.action e espera PROXY_STATUS síncrono. A recuperação agora é assíncrona e o listener de autenticação precisa ser registrado no boot. Novo Assess deve incluir atualização do harness, verificação de suas travas e espera assíncrona do status.

## Residual Risks

- Falha de regressão impede fechar o bug, mesmo com reproduções novas passando.
- Snapshot ativo e reconciliação foram validados em VM, não em reinício real do Chrome/service worker.
- Não houve coleta no site atual, proxy comercial ou uso de credenciais reais.
- O fallback legado de Itens reinjeta após qualquer erro de START_CRAWL; revisar no novo Assess a propagação de falhas funcionais de reconexão para evitar nova tentativa implícita.

## Recommendation

Reabrir Assess com a evidência do contrato e do fallback; incluir os arquivos necessários e suas travas. Não sobrescrever relatórios existentes sem confirmação. Ajustar na fase Fix e repetir a suíte completa/builds antes de fechar. Nenhum commit realizado.

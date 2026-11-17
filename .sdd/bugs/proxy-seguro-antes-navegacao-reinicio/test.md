# Bug Verification: Proxy antes da navegação e recuperação do service worker

- **Slug**: proxy-seguro-antes-navegacao-reinicio
- **Testado**: 2026-11-14
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: verified

## Summary

Reproduções automatizadas dos defeitos aprovadas; Itens/Lote bloqueiam navegação quando a ativação falha. Reinício em VM recupera estado/autenticação, e a suspensão real do service worker em Chromium isolado preserva o status aplicado. A regressão do contrato da tentativa 1 foi resolvida; suítes dev/prod passam integralmente.

## Checks Performed

| Checagem | Comando / Ação | Resultado | Notas |
| --- | --- | --- | --- |
| Reprodução e regressão development | npm test | pass | 65/65 e build development; log test-development.log. |
| Build production | npm run build:prod | pass | Artefato final production; log build-production.log. |
| Reprodução e regressão production | node --test | pass | 65/65; log test-production.log. |
| Chrome APIs reais / suspensão MV3 | node tests/e2e/proxy.smoke.cjs | pass | Executado nos dois builds, perfil temporário, seis verificações, zero pageerrors. |
| Contratos 001/002/003 | check-contract-tests.ps1 -Slug [slug] | pass | 2/5/5 casos, três travas íntegras. |
| Whitespace | git diff --check | pass | Sem erro; avisos LF/CRLF do Git. |
| Lint/type-check | Sem scripts configurados | skipped | Webpack aprovou análise dos módulos. |
| Proxy comercial / coleta no site atual | Não executado | not-run | Fora da prova local; nenhum provedor externo acionado. |

## Output Excerpts

Suíte: `tests 65`, `pass 65`, `fail 0`, `cancelled 0`.

Smoke: `pass:true`, casos `load`, `enable`, `stop-worker`, `recover-on-message`, `status-without-credentials`, `disable`; `pageErrors:0`.

O smoke usa APIs reais de settings/storage/mensageria, configura proxy fictício sem efetuar tráfego e interrompe o worker com CDP ServiceWorker.stopWorker. Uma mensagem PROXY_STATUS acorda nova execução e confirma enabled:true com o host/porta esperados, sem reenviar ENABLE_PROXY. DISABLE_PROXY confirma desativação. Perfil temporário removido após fechar o contexto; perfil e dados do usuário preservados.

## Residual Risks

- Autenticação foi exercitada com eventos Chrome mockados em VM, incluindo restrição do challenger. O smoke Chromium valida listener/carregamento e recuperação real de estado, não um desafio 407 de provedor.
- Sem prova de disponibilidade, IP de saída, credenciais comerciais, coleta no site atual ou autenticação ponta a ponta com proxy real.
- Nenhuma nova permissão ou dependência; arquivos legados/dados preservados.

## Recommendation

Fechar os dois defeitos no escopo local verificado. Validação com proxy comercial continua distinta e não foi reivindicada. Relatórios da tentativa anterior permanecem em history/. Nenhum commit criado; ponto sugerido: `fix: activate proxy before navigation and recover worker state`.

# Correção do fluxo de proxy — T048 — 2026-11-14

Resultado: corrigido e verificado. O proxy fornecido no .env funciona, inclusive autenticação no Chrome157. O problema reproduzido era salvar uma configuração e testar o IP enquanto a conexão anterior continuava ativa, sem uma ação clara de aplicação na tela. Salvar sem aplicar é decisão preservada.

Configurações agora oferece Aplicar conexão salva, diferencia salvo/ativo e exige salvar rascunhos antes de aplicar. Revisão divergente ou coleta ativa impedem alteração. TEST_IP apenas observa. Escolher Direta, salvar e aplicar remove o PAC próprio; nova coleta direta também remove o proxy anterior. Controle externo permanece preservado e exige intervenção. Um início recusado por outra sessão não altera PAC.

| Prova | Resultado/evidência |
| --- | --- |
| Provedor real | HTTP200 direto e via proxy; IP diferente. proxy-provider-result.json, diagnóstico curl com credenciais somente em stdin. |
| Reprodução Chrome157 | Salvar confirmou saved, mas proxy não aplicado e IP direto; ENABLE_PROXY explícito autenticou e alterou IP. proxy-chrome-before-fix.json. |
| Correção Chrome157 real | Novo botão real aplicou salvo e alterou IP; Direta → salvar → aplicar restaurou IP direto. proxy-chrome-after-fix.json. |
| Unitário RED/GREEN | Regressões de direto removendo PAC próprio e início busy sem mutação falharam antes e passaram depois. Outros casos protegem controle externo e aplicação durante coleta ativa. |
| Node dev/prod |185/185, zero falhas/skip. proxy-suite-dev.log e proxy-suite-prod.log; produção em proxy-build-production.log. |
| E2E dev/prod | proxy-settings.smoke.cjs (8 cenários), proxy.smoke.cjs (6 cenários), autonoma-ui.smoke.cjs e autonoma.smoke.cjs:PASS em ambos builds. UI/core:proxy-ui-dev/prod.log e proxy-core-dev/prod.log. |
| Travas001–005 | check-contract-tests.ps1:5 travas íntegras; contratos/fixtures/locks preservados nesta correção. |
| Segredos | Varredura de112 arquivos textuais src/dist/validation/teste/HTML:nenhuma ocorrência da senha ou IP do provedor. .env ignorado e não alterado. |

Os testes reais foram explicitamente autorizados pelo usuário e restritos a api.ipify.org, em perfil Chrome temporário removido após o uso. Artefatos registram somente resultados/booleanos, sem IPs ou credenciais. Não houve coleta no Idealista nem alteração do perfil Chrome pessoal. Diagnósticos opt-in: node .sdd/specs/005-experiencia-coleta-autonoma/validation/proxy-diagnose.cjs --real e proxy-chrome-diagnose.cjs --real --after-fix (mesma pasta, executar na raiz).

Uso após recarregar a extensão: Configurações → preencher conexão/proxy → Salvar configurações → Aplicar conexão salva → Verificar IP agora. .env é usado pelos diagnósticos locais, não importado pela extensão. O início da coleta também aplica a configuração salva automaticamente.

Último build:production. Feature005 permanece Em Execução:55/60, mantendo T044/T045 e a intermitência anterior R-013 pendentes. Este teste real de proxy não comprova eficácia contra bloqueios do Idealista, pasta externa ou leitor de tela.

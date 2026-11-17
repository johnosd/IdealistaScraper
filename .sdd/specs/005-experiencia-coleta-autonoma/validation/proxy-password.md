# Senha salva e olho — T050 — 2026-11-14

Pedido explícito do usuário: salvar senha e colocar olho para mostrar. Persistência já existia em config:005; campo vazio conservava segredo, mas parecia perdido. Adicionados máscara fixa/aviso de senha salva e botão Mostrar senha/Ocultar senha, com ícone SVG local e suporte a teclado/aria. Funciona na digitação e na senha persistida após reabrir.

Revelação privada por AUTONOMA_REVEAL_PROXY_PASSWORD é restrita ao documento principal configuracoes.html, runtime/origem/caminho válidos e revisão corrente. Somente o clique no olho faz essa leitura. GET_SETTINGS/save/status continuam sanitizados. Mostrar não altera draft/registro; ocultar remove o valor salvo revelado do campo, preservando digitação manual. Salvar limpa campo/oculta e conserva senha se omitida/vazia. Conflito não retorna credencial nova.

| Prova | Resultado |
| --- | --- |
| RED |2 novas regressões unitárias falharam antes da implementação; proxy-password-red.log. |
| Node dev | npm.cmd test:187/187,0falhas/skip; proxy-password-suite-dev.log. |
| Node prod | npm.cmd run build:prod e node --test:187/187; proxy-password-build-prod.log/proxy-password-suite-prod.log. |
| E2E senha | node tests/e2e/proxy-password.smoke.cjs:11 cenários dev/prod; teclado, persistência ao fechar/reabrir, revelar sem edição, ocultar, preservar ao salvar outro campo, substituir, conflito,320px, zero START/pageerrors. |
| Regressão UI | proxy-feedback.smoke.cjs e autonoma-ui.smoke.cjs:PASS dev/prod; proxy-password-ui-dev/prod.log. |
| Inspeção visual | proxy-password-masked-320.png:olho ao lado do campo, sem overflow, somente dados fictícios. |
| Travas |001–005 íntegras; contratos/fixtures/travas preservados. |

Sem nova chamada ao provedor, alteração no .env ou perfil pessoal. Testes usaram somente credenciais fictícias/perfil temporário removido. Build finalproduction; feature permanece Em Execução57/62 com gates T044/T045/R-013 anteriores.

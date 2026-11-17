# Links: clique → Idealista → localidades — T052 parcial — 2026-11-14

Relato válido: aba Links abria localidades.html (tela de configuração/exportação), sem iniciar captura. O teste T051 aceitava somente abrir essa tela, portanto não provava o comportamento esperado pelo usuário. Corrigido botão e teste de jornada; preservar registro anterior como evidência limitada.

Agora: Coletar links de localidades inicia controlador durável em segundo plano, aplica conexão salva e usa motor/coordenador004 para navegar no índice principal do Idealista. Progresso e links extraídos aparecem no painel. Nenhuma pasta é exigida para capturar. Exportação é ação separada, adota checkpoint e usa writer002 existente, sem nova consulta. Token consumível em storage.session impede clique duplicado e replay após reload/restart; nenhuma retomada automática. Defaults de Itens/Lote/exportação manual preservados.

| Prova | Resultado |
| --- | --- |
| RED inicial | Novo E2E falhou porque Links não tinha ação de coleta. |
| Node dev/prod | npm.cmd test e buildprod + node --test:194/194,0falhas/skip. links-suite-dev/prod.log e links-build-prod.log. |
| Jornada completa local | links-one-click.smoke.cjs:um clique navegou no site interceptado, extraiu4 registros reais dafixture, mostrou resultado, não exigiu pasta/configuração, não coletou anúncios/baixou arquivos; reabertura não consultou; exportação posterior gravou4 registros em OPFS sem HTTP adicional. PASS dev/prod. |
| Defaults legados | localidades.smoke/coleta.smoke/autonoma.smoke:PASS dev/prod, logs links-legacy/coleta/core-dev/prod.log. Tabs/UI também passaram após alteração do launcher. |
| Navegação |2 regressões RED/GREEN:complete antigo de about:blank e pendingUrl não liberam leitura prematura. Esse ajuste não eliminou407 real; não atribuir causalidade sem prova. |
| UI | links-one-click-360.png inspecionada com4 localidades; dados fictícios, sem overflow. |

## Teste real — não aprovado

Chrome157 temporário, .env privado, alvo único de localidades, no máximo1 página/1 tentativa por invocação, sem recursão/anúncios. Coleta terminou paused/proxy_error HTTP407, proxy efetivamente aplicado e igual ao salvo. Comparações:diagnóstico ipify retornou200 direto/via proxy, IP diferente; Chrome simples com proxy aplicado e curl retornaram403 no Idealista, curl CONNECT200. Assim, funcionamento no endpoint de IP não comprova coleta no Idealista.

Evidências sanitizadas:links-real-result.json, links-real-no-routing-result.json, links-provider-result.json, links-plain-chrome-result.json, proxy-provider-result.json e proxy-feedback-real-result.json. Não incluem credenciais/IPs/HTML. Testes com/sem interceptação de rede, instrumentação de autenticação removida e anexação prévia do target não demonstraram causa da divergência407/403. Não afirmar que senha/provedor/site são a causa única; captura real continua não confirmada. Não insistir/burlar403/CAPTCHA nem tratar esses testes como sucesso.

T052 permanece aberta/parcial; R-018 registra pendência. Gates T044/T045/R-013 anteriores mantidos. Último buildproduction, feature Em Execução58/64. Perfis temporários removidos, .env/perfil pessoal/dados reais preservados, nenhum commit. Travas001–005 devem permanecer íntegras.

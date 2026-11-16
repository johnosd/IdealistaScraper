# Links abre o Idealista, sem tela de exportação — 2026-11-15

O screenshot do usuário é localidades.html, usado indevidamente como controlador do início da coleta. O teste anterior só proibia configuracoes.html e aceitava a tela de exportação em segundo plano. Além disso, o botão antigo #extract ainda abria localidades.html diretamente em primeiro plano. As duas entradas estavam inconsistentes com o comportamento solicitado.

## Correção

- Painel e interface antiga enviam LINKS_START. Executor dedicado em runner.html?links=token, inativo, usa o mesmo motor/coordenador e a conexão canônica. O site é a aba ativa; nenhuma tela de pasta/exportação/configuração é carregada para iniciar ou reportar falha. Não há dependência de picker, pasta ou formulário.
- CLAIM é exclusivo do runner dono e devolve somente useProxy. Token consumível/expiração e limites preservados; recarga/restauração não autorizam rede. Ao terminar ou pausar sem operação em voo, FINISHED fecha somente a aba técnica autenticada; mantém site e checkpoint.
- localidades.html deixou de ter inicialização automática por ?collect. Salvar resultado em JSON abre ?session=id só por gesto explícito e exporta o checkpoint sem HTTP. Na interface antiga, Exportar localidades em JSON é botão separado; o teste legado agora usa esse botão explícito.
- Sessão pendente permanece preservada. Outro clique destaca seu executor Idealista já existente apenas com browserRunId compatível e URL HTTPS Idealista, sem alterar URL/fazer nova requisição. Bloqueio/espera continuam visíveis e não são contornados.
- Corridas do painel reproduzidas em unidades: resposta READ antiga podia reativar botão e apagar estado; debounce de150ms podia perder a aba em recarga imediata. Agora leituras antigas são ignoradas e troca de aba é persistida imediatamente.
- Encontrado separadamente caso de runner pendente: sobre about:blank com pendingUrl próprio, reconstrução do worker podia marcar sessão interrompida. Liveness agora considera pendingUrl no mesmo browserRunId; identidade/ATTACH continuam exigidos para dirigir coleta. Isso foi provado em unidade; não é atribuição exclusiva das intermitências E2E abaixo.

## Verificação

RED de jornada: novo assert proibindo localidades.html durante captura falhou porque essa tela era carregada. RED da interface antiga confirmou que #extract abria /localidades.html. REDs adicionais demonstraram as duas corridas da UI, runner pendente incorretamente interrompido e falta de destaque da página preservada.

Builddev e buildprod aprovados; `node --test`:208/208 em ambos,0skip. Logs links-direct-build-dev/prod.log e links-direct-suite-dev/prod.log. Último build production.

| Jornada | Resultado |
| --- | --- |
| links-one-click.smoke.cjs | PASS dev/prod:Idealista ativo, nenhuma localidades.html/configuracoes.html no início,4registros, progresso, reabertura, token sem replay, exportação posterior sem recoleta. Uma requisição controlada. |
| links-popup-navigation.smoke.cjs | PASS dev/prod:entrada antiga também abre Idealista ativo, sem tela de exportação/configuração,4registros, sem download automático. |
| links-start-errors.smoke.cjs | PASS dev/prod:403 controlado permanece no painel; sessão/prazo preservados, sem nova requisição. Detalhes e confirmação são ações explícitas. |
| links-connection-error.smoke.cjs | PASS dev/prod:falha simulada na API do Chrome fica no painel sem abrir exportação; tentativa explícita após restaurar API captura4 registros. |
| localidades.smoke.cjs | PASS dev/prod:botão explícito de exportação, arquivo mensal, reautorização, erro sem sobrescrita e conflito de gravação preservados; OPFS simulado. |
| autonoma-tabs.smoke.cjs | PASS dev/prod:abas, teclado, fila, configurações/contexto e resultados3 municípios preservados. |
| autonoma.smoke.cjs | Passou com diagnóstico adicional e passou na rodada final production; intermitência descrita abaixo permanece aberta. |

Logs por jornada em links-direct-happy/popup/blocked/connection/export/tabs-dev/prod.log e links-direct-autonoma-prod.log. Uma invocação instrumentada de autonoma em dev passou com13 chamadas/0pageerrors, registrada no retorno da ferramenta; a primeira invocação dev em arquivo falhou e não deve ser apresentada como verde.

## Pendências e limites

R-020: autonoma.smoke apresentou0salvos em vez de2 logo após stopWorker na variante local, antes da coleta esperada, em dev e numa rodada prod. Mesmo após a regressão de pendingUrl corrigida houve falha, portanto não atribuir causa exclusiva a ela. Diagnóstico sanitizado de estado/resumo/abas agora é emitido em falha; invocação instrumentada e rodada finalprod passaram. Não fechar essa intermitência por retry. As primeiras falhas de botão/reabertura em Links levaram às duas regressões determinísticas e correções de UI, sem afrouxar expectativas de jornada.

Sem rede pública, proxy comercial ou escrita em pasta pessoal nesta correção. Não houve nova captura no Idealista real;407/403 anteriores seguem sem resolução demonstrada. Perfil pessoal, .env, dados e senhas preservados. T052 permanece parcial/aberta e feature58/64, com T044/T045/R-013/R-018/R-019/R-020 abertos. Prova local de navegação/captura não equivale à captura real aceita.

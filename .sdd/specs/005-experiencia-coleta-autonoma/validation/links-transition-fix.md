# T052 — 403 inicial seguido de página normal

## Relato e reprodução

O usuário confirmou que a tela de bloqueio aparece brevemente e o próprio site depois abre normalmente, enquanto a extensão permanece com HTTP403 e espera de30min. O MCP Playwright observou novamente a página pública em2026-11-15T04:27:05Z: HTTP200 na Navigation Timing API,84 links na navegação e nenhum desafio detectado. O MCP não acessa o painel interno da extensão; essa observação é do site carregado, não uma reprodução do clique instalado.

Criado `tests/e2e/links-navigation-transition.smoke.cjs`: primeiro documento HTTP403 com uma transição feita pelo próprio site de teste, depois HTTP200 com a navegação pública capturada. Antes da correção, o teste ficou esperando collected enquanto a sessão já estava bloqueada (log links-transition-red.log). O site de teste usa meta-refresh para simular a transição relatada; não interage com desafio de provedor real. Testes unitários adicionais falharam com403 em vez de200 e prova do documento final recusada.

## Causas

1. O runner reportava o primeiro documento de desafio imediatamente e encerrava o executor técnico antes do documento normal.
2. O observador em coleta-background fixava o primeiro networkRequestId e ignorava o requestId novo da navegação feita pelo site.
3. A validação DOM fixava o primeiro documentId e recusava o documento novo mesmo com a operação inicial ainda em voo.

A documentação Chrome consultada via Context7 confirma que requestId identifica uma requisição e documentId identifica um documento; o frame0 permanece durante novas navegações. Referências oficiais: https://developer.chrome.com/docs/extensions/reference/api/webRequest e https://developer.chrome.com/docs/extensions/reference/api/webNavigation.

## Correção

Durante a navegação inicial ainda autorizada, o runner observa passivamente a aba própria por até10s, limitado também pelo timeout configurado. Pode reler o DOM após a transição do site; não inicia outra navegação, fetch, reload, clique em desafio ou troca de conexão. O domínio continua ocupado durante essa observação. Cancelamento continua abortável.

O observador aceita o novo requestId somente no tipo navigation, na mesma URL autorizada ou no destino já observado, com status HTTP e limite de8 substituições. IDs substituídos não podem sobrescrever a resposta final por eventos tardios. Registra o documentId novo; a validação permite a nova prova DOM somente quando esse documento foi observado para a mesma operação. Documento anterior, documento ausente em transferência, outro destino, fetch/paginação e proprietário antigo continuam recusados. Não há mudança de permissões ou do schema de registros exportados.

A classificação usa o documento final durante a operação pendente: HTTP200 com dados válidos pode concluir; um403/desafio persistente continua bloqueando após a observação. Um429 observado permanece obrigatório, mesmo se o navegador depois carregar200; Retry-After e a pausa persistente continuam no coordenador. As pausas já gravadas por execuções anteriores não são apagadas nem retomadas automaticamente por essa correção.

Durante as regressões, Links one-click também expôs uma corrida de inicialização: o runner ainda estava about:blank com pendingUrl válido e era mostrado como controlador fechado. Caso reproduzido em teste unitário RED/GREEN; controller agora considera pendingUrl, sem aceitar exportador como executor nem criar outro lançamento.

## Validação

- `npm.cmd run build`, `node --test`, `npm.cmd run build:prod`, `node --test`:218/218 em cada build, sem skip.
- Novo smoke:403→200 retorna84 registros, duas navegações HTTP (inicial e transição do site), uma única tentativa controlada e razão final nula. Variantes persistent e rate-limit mantêm bloqueio/espera, sem repetir coleta.
- Quatro jornadas Links (one-click, start-errors, inherited-block, connection-error), coleta.smoke e autonoma.smoke passaram em desenvolvimento e produção. Cobrem retomada/restart, desafio persistente,429 inicial/intermediário, proxy estável, checkpoints, falha de gravação e exportação separada.
- Logs links-transition-*.log; travas001–005 conferidas sem regravação. Último bundleproduction.

Limites: reprodução da transição é controlada, não prova o fluxo da extensão instalada no perfil pessoal nem a eficácia do proxy real. O MCP confirmou a página real já normal, sem recarregá-la. Não foram alterados dados, credenciais ou bloqueios do perfil pessoal. T052 permanece parcial e os gates anteriores T044/T045/R-013/R-019/R-020 continuam abertos; a divergência407/403 anterior não é fechada como problema do proxy sem nova evidência real.

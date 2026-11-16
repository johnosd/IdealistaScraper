# Runtime e interface pública — 004

## Núcleo

`src/coleta-coordinator.js`: `createCollectionCoordinator({store,now})`, CommonJS; now retorna epoch ms. Factory síncrona; métodos async; zero Chrome/fetch/timer no núcleo. Store em data-model; fake travado é colaborador de persistência, não substitui o núcleo. Único stub criado pelo plan, sem import produtivo.

| Método | Entrada / resultado |
| --- | --- |
| updatePolicy | política completa validada → efetiva; modifica próximas reservas inclusive maxSessionMs, sem reset de consumo/blockers |
| start | id,mode,owner,domain,startedAt,items,proxyRevision,exportContext → started+epoch ou busy/paused; não navega |
| requestPage | id,owner,epoch,requestId,url,kind → ready+token,wait+until/reason,paused,busy,duplicate,rejected |
| reportPage | identidade anterior + status,finalUrl,listing,challenge,retryAfter,records,nextUrl,transportError → checkpoint/pausa; idempotente |
| control | id,owner,epoch,action(pause/cancel/resume/discard),proxyRevision,accessConfirmed → estado/epoch novo no resume; não concede rede |
| recover | id,ownerAlive,executorAlive → busy/interrupted; fatos fornecidos pelo adapter Chrome, nunca confiados ao site |
| read | id → visão pública do data-model; sem adquirir ownership/navegar |
| markSaved | id,owner,epoch,receipt:{id,relativePath} → confirmação idempotente após writer autorizado |

Transporte gera IDs/datas reais; testes injetam valores. Entradas validadas em runtime; conteúdo não pode escolher categoria de desbloqueio. Read público pode agregar dados por necessidade de exportação; mensagens de estado da UI usam resumo sem transportar dataset inteiro por heartbeat.

## Mensageria

Envelope `{cmd:'COLETA_<ACTION>',requestId,sessionId,epoch,payload}`; resposta `{ok:true,result}` ou `{ok:false,code,message}` sanitizada. Listener síncrono retorna true para sendResponse async. Prefixos legados de proxy e resposta STOP_AND_DOWNLOAD preservados.

UI de extensão: GET_POLICY,SET_POLICY,START,READ,LIST,PAUSE,CANCEL,RESUME,DISCARD,SAVE_RESULT,CONFIRM_SAVE_UNKNOWN,TEST_IP. Content associado: handshake, REQUEST_PAGE/PAGE_RESULT e ACK de aborto. Sender real determina tab/document; site não escolhe ownerTabId nem altera política/accessConfirmed/proxy. Validar origem exata, URLs autorizadas e epoch. Nenhum fetch privilegiado de URL arbitrária.

### Mapeamento implementado no adapter (R-008/R-009)

O envelope efetivo coloca identidade e argumentos em `payload:{id,epoch,...}`.
O adapter da UI usa REGISTER, REQUEST, REPORT, READ_HTTP, SAVE_INTENT, GET_INTENT,
ACK_PROJECTION e PROBE_IP além das ações acima. O content só envia VALIDATE;
recebe COLLECT_PAGE, COLETA_EXECUTOR_PROOF e COLETA_ABORT. PAGE_RESULT retorna
na resposta de COLLECT_PAGE. O site não recebe permissão de reservar/reportar
diretamente. `networkRequestId` observacional é distinto do requestId lógico.

ACK_PROJECTION confirma somente a projeção legada da fila após receipt durável;
falha nessa etapa não autoriza novo arquivo nem recoleta. O Lote exige também
autoridade do Web Lock003 na UI e nos callbacks. O resumo READ inclui elegibilidade
persistente, sem transportar dados de todas as páginas.

Phase10/T045 acrescenta SAVE_FAILURE, exclusivo da UI: payload id/epoch/intentId
e reason de allowlist. Owner real e intent vigente são obrigatórios. O evento
save_failed guarda só categoria/horário; não aceita Error, stack ou mensagem
arbitrária. Não confirma arquivo nem avança fila. Receipt confirmado limpa a
razão atual, preservando o evento histórico no ring.

`src/coleta-background.js` registra handlers/eventos no topo e instancia store lazy; `src/coleta-protocol.js` adapta clientes. Integrar no background existente sem invalidar testes de boot/proxy nem expandir permissões.

## Uma página por operação

Criar aba própria about:blank, associar sessão; conferir proxy, reservar, então tabs.update. webRequest observacional captura main_frame/status/headers allowlisted/redirect/error correlacionados à reserva. A página inicial ou de retomada é navegada UMA vez e extraída do DOM, sem fetch adicional da mesma página.

Próximas páginas: `COLLECT_PAGE` no content de aba própria, fetch same-origin com AbortController/deadline, uma página por comando. Runner coordena reserva → transporte → classificação → commit → próxima decisão. Não manter paginação/reconexão/IP autônomos no content. Ao retomar sem aba, navegar a nextUrl ainda não confirmada, não às páginas confirmadas. CTA escolhido pela extensão também pede reserva.

Correlacionar receipt HTTP+DOM por requestId/tab/document/URL; sem contagem duplicada. status/headers indisponíveis são unknown; não inventar200. Redirects automáticos/sub-recursos não são novas reservas, e não há promessa de bloqueá-los; validar destino final antes de aceitar dados. Duplicatas do permit não fornecem novo direito de enviar request.

Preservar wrappers/exportações existentes quando necessário aos testes travados. Consumers produtivos migram para coleta por página; erro funcional não reinjeta/recoleta. Receptor ausente admite uma instalação idempotente, sem novo crawler invisível. STOP_AND_DOWNLOAD vazio continua ok/dados[] sem rede (contrato001).

## UI e exportação

Nova página `itens.html` e entry `src/itens.js`; popup abre/foca a página preservando URL/proxy. Links/Lote continuam nas páginas existentes. `src/coleta-ui.js` compartilha perfil, consumo, próxima elegibilidade, execução responsável, sessões recuperáveis, diagnóstico e ações. Inputs rotulados, status aria-live; nenhuma biblioteca/UI externa nova.

Reusar writers/stores002/003 sem mudar suas assinaturas/schema/confirmations. Novo runner envolve writes com intent/receipt duráveis. Seleção e reautorização de pasta permanecem em gesto da UI. Web Locks dos writers permanecem; lock antigo do lote não substitui exclusividade global nem pode ficar em ordem invertida com transações.

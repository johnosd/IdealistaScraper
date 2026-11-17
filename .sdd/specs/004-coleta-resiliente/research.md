# Research — 004-coleta-resiliente

Data: 2026-11-14. Pesquisa de documentação, sem coleta do site ou provedor pago.

## Estado durável e worker efêmero

**Decisão**: IndexedDB próprio e transacional; worker recebe comandos curtos, páginas duráveis conduzem coleta. Nenhum timer/Promise/global representa progresso. storage.session só identifica a execução atual do navegador.
**Justificativa**: globais se perdem na suspensão; storage.session não sobrevive ao navegador. Fontes consultadas por Context7: [lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle), [storage](https://developer.chrome.com/docs/extensions/reference/api/storage).
**Alternativas**: read-modify-write de chrome.storage.local não fornece atomicidade conjunta; offscreen/alarms/keepalive são desnecessários para retomada manual; nenhum backend.

## HTTP da navegação inicial

**Decisão**: webRequest observacional já permitido; listeners no topo do worker, correlacionados a abas próprias e reservas. main_frame, status, Retry-After, Content-Type e cf-mitigated; observar headers, redirects, conclusão e erro. Paginação usa também os fatos de fetch; não contar duas vezes.
**Justificativa**: tabs.onUpdated complete não informa HTTP. Não adicionar webRequestBlocking, extraHeaders ou DNR. [Referência Chrome](https://developer.chrome.com/docs/extensions/reference/api/webRequest).
**Alternativas**: DOM sozinho perde 429; HEAD extra aumenta tráfego e pode divergir.
**Limite**: redirects automáticos pertencem à mesma solicitação lógica; API observacional não impede cada salto. Destino fora do domínio autorizado causa rejeição do conteúdo/parada, sem prometer prevenção de todo tráfego do navegador.

## Transações e escrita externa

**Decisão**: mutator síncrono com chaves declaradas; responder somente no oncomplete. Rede, espera, hashing e filesystem fora da transação. [IDBTransaction](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction) documenta inatividade/autocommit entre tarefas.
**Alternativas**: transação aberta durante coleta ou escrita externa não oferece atomicidade entre APIs; reescrever todos os anúncios a cada reserva é desnecessário.
**Crash após close**: intent durável antes da escrita, receipt após close; intervalo ambíguo exige comparação de digest do destino autorizado em ação manual, nunca recoletar ou reescrever automaticamente. Downloads Itens sem nova permissão: confirmação humana de resultado desconhecido.

## Limites operacionais

Defaults são escolhas de engenharia ajustáveis, não limites aceitos pelo site. Núcleo/fakes, Chrome isolado, restart real, escrita nativa e provedor real serão evidências distintas. Pesquisa resolvida neste design; nenhuma incerteza de biblioteca requer nova dependência.

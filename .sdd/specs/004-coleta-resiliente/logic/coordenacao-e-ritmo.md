# Coordenação, ritmo e checkpoint

## Política operacional (não é limite aceito pelo site)

| Campo público | Padrão | Faixa |
| --- | --- | --- |
| minIntervalMs | 10000 | 1000–300000 |
| windowMs | 3600000 móvel | 60000–86400000 |
| maxPagesPerWindow | 60 | 1–1000 |
| maxPagesPerRun | 200 solicitações incluindo retries/CTA | 1–2000 |
| maxPagesPerItem | 100 páginas confirmadas | 1–1000 |
| maxAttempts | 3 totais por página (original+2) | 1–5 |
| requestTimeoutMs | 30000 | 5000–120000 |
| maxSessionMs | 21600000 (6h desde início incluindo pausas) | 60000–604800000 |
| backoffBaseMs | 30000 | 10000–300000 |
| maxNoNewPages | 3 consecutivas | 1–10 |

Inteiros finitos; rejeitar strings,0,NaN/Infinity/negativos. Defaults conservadores não são recomendação para operar na maior taxa da faixa. Ajustar/restaurar não remove consumo/blockers; política atual vale para próximas reservas sem alterar mês/origem. Eventos das últimas24h conservados para mudança de windowMs não zerar histórico. Estado do domínio prevalece sobre configurações da sessão.

## Reserva atômica (C1/C2/C3)

```
validar sender/origem/owner/epoch e identidade idempotente
transact(policy,domain,session,attemptMarker):
  paused/blocked/interrupted/awaiting-save => paused, não rede
  requestId repetido => duplicate; payload diferente => rejected
  inFlight => busy
  now < highWaterClock => clock-inconsistent, pausa
  until=max(lastStarted+interval, serverUntil, blockedUntil,
            expiração dos eventos necessária para orçamento de janela)
  accessBlocked => paused até ação manual elegível
  until>now => wait, razão mais restritiva; nenhum consumo
  teto run/item/duração ou ciclo => paused; nenhum consumo
  persistir inFlight + evento + counter solicitado atomicamente
  return ready com token one-shot válido por2s
```

Adapter envia uma vez e imediatamente. Token expirado/response perdida não devolve orçamento; consultar estado antes de decidir sobre retry. `duplicate` NÃO autoriza dispatch. Novo retry tem novo requestId. InFlight só termina após report/aborto provado. Horário de início observado atualiza lastStarted; sem início confiável usar fim conservador. Assim dispatch atrasado não libera próximo início cedo demais.

Rede/timer fora de transação. Runner da tela acorda para nova decisão. `waiting` por intervalo numa execução consentida pode avançar quando elegível; `paused` (429,budget,bloqueio,erro final) exige clique. Read/recover/list/startup não coletam.

## Exclusividade e recuperação

Start/acquire do grupo idealista.pt é atômico. Owner/epoch persistem. Não roubar por lease/heartbeat expirado: consultar tabs/handshake/run/document. Se executor pode estar vivo, pedir aborto e aguardar ACK ou encerrar SOMENTE aba própria comprovada; dúvida => busy. Pausa cancela esperas/fetch. Não confundir suspensão do worker com executor morto. Eventos atrasados não podem mutar epoch novo.

BrowserRunId em storage.session muda em restart. Content não inicia sozinho; aba restaurada não é comando. Validar identidade antes de fechar tabId reaproveitado. Uma sessão paused/cancelled libera execução ativa depois de aborto, mas conserva histórico do domínio. Resume acquire novo epoch e confere proxy/checkpoint antes de nova reserva (C3/C4).

## Checkpoint e ciclos (C4/C5)

Validar/deduplicar dados e pré-calcular digest; commit delta+manifest+counters+nextUrl confere revisão/inFlight. Falha conserva checkpoint/inFlight anterior, sem nova página. Mesmo report pode ser reentregue idempotentemente depois de recuperar espaço; após perder resultado não confirmado, recover+resume permite tentar essa página com novo consumo. Não simular exactly-once de rede.

Sem nextUrl e listagem válida => awaiting-save. URL já visitada => cycle, não complete. maxNoNewPages alcançado => no-new-records, não complete. Zero resultados só é válido com marcador inequívoco e sem login/desafio/nextUrl; restante unexpected-content. IDs de dedupe: id, depois URL normalizada. Não eliminar itens diferentes do catálogo por sobreposição.

Persistir completed item/receipt e próximo índice só após gravação confirmada. Nunca recalcular mês nem reconstruir memória refazendo páginas confirmadas. Retomada pode encontrar catálogo alterado; indicar intervalos de coleta, sem prometer snapshot temporal único.

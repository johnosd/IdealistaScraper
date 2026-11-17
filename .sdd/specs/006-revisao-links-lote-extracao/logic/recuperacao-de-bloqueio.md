# Lógica — `runQueue` e recuperação automática de bloqueio/espera

Cobre FR-012, FR-017–021, US5. Contratos C2, C3, C4 (todos chamam `runQueue`).

## Por que uma camada nova (não mexer no coordenador)

Os contratos travados **004 C2** e **005 C5** exigem que, após desafio/403, `resume` sem
`accessConfirmed:true` **não** seja aceito. Isso continua verdadeiro. A 006 só adiciona um agente
automático que, depois do prazo, envia `accessConfirmed:true` **por conta própria**, um número limitado
de vezes. O coordenador (`coleta-coordinator.js`) não perde nenhuma regra: intervalo, janela, prazo de
bloqueio (30 min), exclusividade e checkpoints permanecem.

`runQueue` é opt-in: sem `options.autoRecovery` ele deve se comportar como uma chamada a `drive()`
(retorna quando `drive` termina). O fixture 005 não passa `autoRecovery`, então C1–C5 da 005 seguem iguais.

## `planBlockRecovery({state, reason, until, now, rechecks, maxRechecks})` (`src/coleta-block-recovery.js`)

| reason (após drive terminar)                     | ação                                             | conta recheck |
| --- | --- | --- |
| `access_blocked`                                  | `rechecks < maxRechecks` → `recheck` até `until`; senão `stop` com `access_blocked_persistent` | sim |
| `rate_limit`                                      | `rechecks < maxRechecks` → `resume` até `until`; senão `stop` `rate_limit_persistent` | sim |
| `window_budget`, `server_wait`, `transient`, `interval` | `resume` até `until` (sem limite de vezes)       | não |
| `run_budget`, `session_duration` (A-02, decisão do usuário) | `renew` até `until` (sem limite de vezes): `coordinator.renewCycle` e depois `resume` | não |
| qualquer outro (`checkpoint_failed`, `write_error`, `proxy_changed`, `pagination_cycle`, `paused` pelo usuário, …) | `stop` com o próprio reason | — |
| estado `completed` / `finished-with-pending`       | `stop`                                           | — |

- `until` vem de `coordinator.eligibility()` (já considera `blockedUntil`, `serverUntil`, janela, intervalo).
  Se `until` for nulo/no passado, usar `now`.
- Pausa pedida pelo usuário (`reason === 'paused'`, ou `runState === 'pausing'`) é **sempre** `stop`.

## `runQueue({id, owner})` (`src/coleta-autonoma.js`)

```text
rechecks = valor persistido em session.autoRecovery.rechecks (0 se ausente)
loop:
  await drive({id, owner})
  s = metadata(id); se sem autoRecovery: retorna read(id)
  plano = planBlockRecovery({state: s.runState||s.state, reason: s.reason,
                             until: (await eligibility())?.until, now: now(), rechecks, maxRechecks})
  se plano.action == 'stop':
     se plano.reason != s.reason: control(pause, reason = plano.reason)   # ex.: access_blocked_persistent
     retorna read(id)
  persistir session.autoRecovery = {rechecks: rechecks + (conta ? 1 : 0), until: plano.until}
  await options.waitUntil(plano.until, signal)   # nenhuma requisição durante a espera
  se usuário pausou durante a espera: retorna read(id)
  r = resume({id, owner, selection: 'remaining', accessConfirmed: plano.action == 'recheck'})
  se r.status == 'wait': volta ao topo sem chamar drive (aguarda de novo)
  se r.status != 'accepted': retorna read(id)
  # sucesso de uma página após recheck zera o contador (persistir rechecks=0 no próximo reportPage success)
```

- Zerar `rechecks` quando uma página for confirmada depois da retomada (o bloqueio passou). Assim
  bloqueios espaçados ao longo de horas não se acumulam até `stop`.
- `waitUntil` no runner real = `abortableDelay` até `until` com o `AbortController` da pausa; no fixture,
  avança o relógio. Durante a espera o painel mostra motivo + horário (já existe `wait-time`).
- `access_blocked_persistent` e `rate_limit_persistent` precisam de rótulos em `coleta-labels.js` (REASONS)
  explicando que a coleta parou após N verificações e que a retomada manual continua disponível.
- Executar no `runner.html` (dono da execução). O runner **não** chama `FINISHED` enquanto `runQueue`
  estiver esperando; só ao retornar.
- Nunca: recarregar a página bloqueada fora de `requestPage`, trocar proxy, limpar `blockedUntil`,
  ou resolver desafio. A "verificação" é exatamente a próxima requisição normal da fila, autorizada pelo
  coordenador após o prazo.

## Novo ciclo — `coordinator.renewCycle({id, owner, epoch})` (A-02)

- Só para `schemaVersion 2` e estado pausado com `reason ∈ {run_budget, session_duration}`; senão `rejected`.
- Grava `s.cycle = {startedMs: now, requestedBase: s.counters.requested, n: (s.cycle?.n||0)+1}` e loga `cycle_renewed`.
- `requestPage` passa a comparar `counters.requested - (cycle?.requestedBase||0) >= maxPagesPerRun` e
  `time - (cycle?.startedMs ?? createdMs) >= maxSessionMs`. Sem `cycle`, a regra é idêntica à atual
  (contratos 004/005 inalterados).
- **Não** mexe em `d.events`, `d.lastStarted`, `blockedUntil`, `serverUntil`: intervalo mínimo e limite por
  janela continuam valendo entre ciclos (o ritmo é a garantia de segurança; o orçamento por execução vira ciclo).
- `runQueue`: `renew` → `waitUntil(until da elegibilidade)` → `renewCycle` → `resume(selection:'remaining')`.

## Interação com `maxAttempts` (descoberta na execução)

O limite de tentativas por página da 004 (`maxAttempts`, padrão 3) conta cada reverificação da mesma URL. O
limite efetivo de verificações é `min(maxRechecks, maxAttempts − 1)`. Se a parada vier como
`attempts_exhausted` logo após uma reverificação/espera contada sem página confirmada, o `runQueue` a apresenta
como `access_blocked_persistent` (ou `rate_limit_persistent`). Com os padrões, isso dá 1 tentativa e 2 verificações.

## Interação com `window_budget`

`drive` hoje chama `finishPause(s,'window_budget')` e sai. Com `runQueue`, isso vira espera automática
(`resume` após `until`). Sem `runQueue`, nada muda.

## Interação com Links

A coleta de links (modo `links`, `createCollectionWorkflow`) não usa o serviço autônomo. A US5/AC4
exige o mesmo tratamento: reaproveitar `planBlockRecovery` no `links-runner.js` (espera + recheck
limitado com `accessConfirmed`), preservando os registros já coletados no checkpoint. Teste unitário
dedicado (não contrato).

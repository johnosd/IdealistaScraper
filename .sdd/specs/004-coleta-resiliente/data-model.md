# Data Model — 004-coleta-resiliente

## Persistência

Novo banco `idealista-coleta-v1`, versão1, store `records` com chave string. Não alterar bancos/handles `idealista-localidades` e `idealista-municipios`.
Adapter `read(keys)` retorna mapa key→clone|null; `transact(keys, mutate)` lê as chaves na mesma transação e invoca mutator síncrono que retorna `{writes,result}`. Null deleta chave; só chaves declaradas. Resolver após oncomplete, abortar integralmente em falha. Nenhum await de rede/hash/timer/diálogo dentro da transação. DB lazy, sem I/O ao importar módulos.

| Chave | Conteúdo |
| --- | --- |
| policy | versão, limites e revisão; mudanças não apagam histórico |
| domain:idealista.pt | ownership, lastStarted, eventos de consumo, serverUntil, blockedUntil, accessBlocked, highWaterClock, revisão |
| session:<id> | schemaVersion1, mode/domain, owner/run/document, epoch, state/reason, data inicial, itens/índice, exportContext, proxyRevision opaca, counters, inFlight e manifest do checkpoint |
| page:<session>:<item>:<seq> | delta deduplicado imutável, URL, nextUrl, digest SHA256 canônico e horário |
| save:<session>:<item> | intentId, destino relativo, digest/bytes e estágio intent/closed/confirmed/unknown |
| log:<session> | ring de eventos sanitizados |

Página/delta + counters/manifest/nextUrl entram na MESMA transação. Hash preparado antes, revisão/epoch conferidos no commit. Não regravar todos os registros ao reservar página. Read público agrega blocos e revalida revisão: `{id,state,reason,epoch,counters,checkpoint:{confirmedPages,records,nextUrl,visited,complete},exportContext,diagnostics}`.

## Estados, ownership e compatibilidade

Estados: running/waiting/paused/blocked/interrupted/awaiting-save/saved/cancelled/discarded/incompatible/persistence-error. Uma coleta ativa por grupo idealista.pt (todos subdomínios autorizados). Sessões pausadas retêm dados sem ocupar rede; blockers/consumo permanecem no domínio. Resume adquire novo epoch; comandos velhos são rejected. InFlight único. RequestId repetido com mesmo payload retorna duplicate sem reautorizar dispatch; payload divergente é rejected.

Recover consulta prova de vida do owner E executor; lease expirada não basta para takeover. Se executor pode estar vivo: busy até aborto confirmado ou encerramento de aba própria comprovada. Se ambos ausentes/encerrados: interrupted, sem rede automática. storage.session guarda browserRunId; restart cerca tokens antigos. Tabs IDs reciclados não provam identidade: handshake/run/document. Content script não inicia no boot. Nunca encerrar aba do usuário.

Verificar schema, hashes, blocos, origem/modo, fila, esquema de dados, proxyRevision e mês. Revisão opaca incrementa ao mudar credenciais; não guardar senha/hash de senha em checkpoint. Checkpoint acima de7 dias é incompatível para retomada automática de contexto, sem apagar dados; oferecer restart/descarte explícito. Resultado completo ainda pode ser salvo após conferência. Sessão acima de maxSessionMs só volta mediante ampliação explícita dentro da faixa, preservando contadores (C4).

Links confirma etapa/resultados; Itens/Lote confirmam páginas. Mês YYYYMM local capturado uma vez, não recalcular em outro mês/timezone. Lote avança só após receipt; receipt repetido é idempotente. Resultado awaiting-save é durável e pode ser salvo sem rede.

## Capacidade e retenção

Teto inicial:50MiB JSON UTF8 por sessão,100MiB agregados,10 sessões recuperáveis,100mil registros e1MiB de metadados/sessão. Estimate de quota é informativo; erro real pode ocorrer antes. Sem unlimitedStorage. Atingir teto pausa sem truncar e pede salvar/descartar; checkpoint anterior preservado.

Logs:1000 eventos ou1MiB/sessão e10mil eventos ou10MiB agregados, ring remove mais antigos. Logs terminais expiram após7dias. Nunca expirar/apagar checkpoint recuperável silenciosamente. Eventos de consumo retidos por24h para mudanças de janela; só remover depois de expirar. Cancel/discard não apagam policy/domain/blockers nem arquivos externos. Limites operacionais ficam constantes documentadas, sem permissão extra.

## Complemento implementado na Phase10

Eventos de resposta incluem attempt por URL/item, durationMs e newRecords
deduplicados quando disponíveis. A UI não inventa os campos ausentes em eventos
antigos. save_failed grava somente time/code/reason allowlisted no ring da
sessão; state continua awaiting-save e a razão corrente indica save_failed.
Intent, receipt e eventos ficam no registro session:<id>, junto ao manifesto;
os deltas permanecem em page:<session>:<item>:<seq>. Receipt confirmado limpa
a razão corrente; o histórico segue a retenção existente. Não há nova versão
do banco, remoção de checkpoint ou cópia de Error/mensagem bruta.

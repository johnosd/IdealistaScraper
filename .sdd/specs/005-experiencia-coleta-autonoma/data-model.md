# Data Model — 005-experiencia-coleta-autonoma

## Autoridade e compatibilidade

Manter banco idealista-coleta-v1, versão1, store records. schemaVersion do registro não é versão do banco. Nenhuma recriação, migração destrutiva ou alteração dos bancos idealista-municipios/idealista-localidades. O adapter read/transact atual continua; nenhum await dentro de mutate.

Sessão autônoma usa schemaVersion2, mode:lote, autonomous:true. Campos comuns mantêm significado: id/domain/owner/runId/epoch/revision/createdAt/createdMs/exportContext/proxyRevision/counters/attempts/inFlight/events/ipMarkers/totalBytes/totalRecords. Domínio e quotas são os mesmos de v1; 308 itens são uma sessão, não308 sessões.

## Novos registros e campos

| Registro/campo | Conteúdo e regra |
| --- | --- |
| launch:<commandId> | idempotência do gesto, source congelada, runId/runner token, sessão associada e estágio accepted/discovering/committed/interrupted. Sem anúncios/credenciais. Reserva domain.active antes de criar aba/descobrir; duplicata retorna a associação existente |
| session:<id>.source | tabId, documentId quando disponível, URL validada e instante aceito. Identidade geográfica não é nome |
| session:<id>.itemStates | mapa itemId estável → nome, URL normalizada, índice original, estado, motivo, recuperabilidade, checkpoint manifest, saveIntent/receipts e data de confirmação |
| session:<id>.selection | remaining/pending ou itemId específico, itemIds elegíveis em ordem original e cursor. Seleção não reordena items nem reinicia contadores |
| session:<id>.runState | discovering/running/waiting/pausing/paused/interrupted/finished-with-pending/completed; projeção pública, coerente com a state do coordenador |
| page:<session>:<originalIndex>:<seq> | deltas/hash/seq existentes, chave não depende da posição numa seleção de retomada |
| config:005 | revisão, limits, ipEnabled, useProxy e proxy privado {host,port,user,password}; sem cópia em sessão/log/diagnóstico |
| storage.session autonomousRun | identificação do navegador atual e binding da aba técnica; nunca progresso durável |
| storage.local autonomousUI | último runId consultado e contexto de filtros/detalhes por execução, sem autoridade de coleta |

itemId é gerado uma vez na descoberta e persistido; URL sem fragmento e nome não servem como chave mutável. Deduplicar por URL normalizada HTTPS Idealista; não eliminar query com significado, nem fundir homônimos. Dados inválidos impedem fila ambígua; informar entrada problemática. Ordenação por quantidade conhecida desc, desconhecidas ao final, empate mantém ordem da página.

## Estados por item e resumo

queued → running → saved ou empty. Falha local confirmada: running → pending. Gravação parada: pending com stage=save e checkpoint completo. Pausa/interrupção no item corrente: pending com motivo; queued nunca tentado permanece queued. Incompatibilidade: pending/recoverable:false com ação explícita.

Categorias públicas exclusivas: queued, inProgress, saved, empty, pending; soma=total. Waiting e save ativo contam inProgress. Resultado preservado sem writer ativo conta pending. Sem anúncios só após resposta legitimamente vazia e checkpoint completo; resultado empty não produz receipt nem arquivo. Salvo exige writer.close + receipt confirmado.

Conclusão: completed somente todos saved/empty. Se seleção terminou e há pending: finished-with-pending, mantendo queued visíveis se seleção era individual. Se ainda existem queued não selecionados, retorno paused e ação Retomar coleta; não anunciar rodada integral finalizada enquanto a fila original não foi percorrida. remaining seleciona queued e item corrente interrompido, exclui pendências locais já puladas; pending seleciona só pending recuperáveis; itemId seleciona só aquele item. As ações apresentam quantidades e impedimentos.

## Commits e ownership

Uma transação confere owner/epoch/revision/inFlight e grava manifest do item, deltas, counters e domínio. Novo item só é selecionado após confirmar fim da operação anterior; troca não pode apagar tentativas por URL/item nem liberar bloqueio. Durante gravação ativa no005, manter domain.active reservado; liberação somente em pausa/término/interrupção comprovada.

Intent e receipt vinculados a sessionId/itemId e destino autorizado. Confirmação repetida não avança cursor duas vezes. Mês original em exportContext sempre prevalece. Save desconhecido exige reconciliação bytes/digest pelo writer existente; sem correspondência não sobrescrever automaticamente um arquivo anterior. Tentar salvar novamente é ação explícita.

## Leitura e adaptação v1

READ_SUMMARY não agrega blocos de anúncios; detalhe de item agrega só quando solicitado. Revalidar revisão/hash como no read atual. v1 não muda automaticamente de schema; adapter deriva saved das receipts e índices arquivados, current do checkpoint atual, queued dos demais. Nunca inferir sucesso só por índice. Se manifests necessários não forem válidos, mostrar incompatibilidade. Ativação manual para recuperação por item promove cópia de metadados para v2 em transação após verificar owner/executor mortos, reusando blocos e preservando ID/counters/data/mês; original não é apagado antes do commit.

Cancel/discard legado e descarte005 devem enumerar todos os manifests e páginas novos para manter storage-usage correto; não zerar domain/events/esperas. Manter tetos004:50MiB/sessão,100MiB agregado,100mil registros,1MiB metadados,10 sessões recuperáveis, validade7dias. Chegar ao teto pausa, sem truncar fila ou apagar resultado. Configuração privada nunca é contada como diagnóstico.

## Configuração e handles

Primeiro load importa policy + chaves legadas em config:005 somente se inexistente; usar transação CAS. Antes de confirmar importação, comparar revisão das chaves lidas e repetir se mudaram. Ao salvar: validar tudo, revalidar atividade/revisão no commit, escrever config e policy juntos. Senha omitida conserva a existente; não usar string vazia para apagar sem ação explícita.

Adaptar GET/SET_POLICY, SAVE_PROXY_CONFIG, prepare/snapshot e leitores legados para usar configuração efetiva quando config:005 existir. Projeções storage.local não disparam reaplicação de proxy durante coleta e não voltam a ser autoridade. Alteração externa relevante produz divergência e pausa, conforme004. Campos privados só são lidos pelo adaptador de proxy autorizado; load público nunca devolve password.

Handles permanecem em IDB próprios. Escolher/reautorizar em gesto direto na UI e chamar API nativa antes de awaits que percam ativação. Cancelar mantém handle anterior; gravação do novo handle deve informar falha. Runner carrega o handle localmente e usa queryPermission; nunca abre prompt nem picker em segundo plano. Reautorização não retoma automaticamente.

## Retenção

Herdar retenção004, sem apagar checkpoints silenciosamente. Remover launch sem sessão apenas quando comprovadamente não há runner/executor vivo; manter associação de commandId para não repetir um gesto ainda recuperável. UI preferences não impedem coleta ao falhar sua persistência; informar que o contexto visual não foi memorizado.

# Superfície pública interna — 003

CommonJS, sem dependências de DOM no writer/session. APIs injetadas em testes.

## src/lote-export.js

`getMunicipalityDestination({startedAt: Date,nome: string,totalPages: integer})`
retorna `{yearMonth,fileName,relativePath}`. Date válida, ano 0–9999 e totalPages
inteiro positivo obrigatórios. Nome NFC, substituir controles e `<>:"/\\|?*` por
`_`, retirar espaços/pontos finais, limitar base a 100 pontos de código, fallback
`municipio` se vazio. Preservar acentos. Somente um segmento de nome; nenhuma
interpretação de caminho. Sufixo `-Paginas<N>.json`. Colisões são last write wins.

`writeMunicipality({directory,records,startedAt,nome,totalPages,locks})` é async.
Capturar destino e JSON.stringify(records,null,2) antes do primeiro await. Array
não vazio de objetos não null/não arrays; rejeitar inválidos/não serializáveis
antes de IO. Vazio retorna `{status:'empty'}`. Permissão consultada readwrite;
nunca pedir autorização implicitamente. Sem acesso: `permission-required`.
Web Lock exclusivo `idealista-municipios:write`, ifAvailable; ocupado: `busy`
sem IO. API ausente: rejeitar. Saved inclui relativePath/total; demais status
não consomem fila. Erros reais rejeitam; não confundir erro com NotFoundError.
Sem confirmação e sem Downloads. createWritable({keepExistingData:false}),
write, close; abort best effort em falha preservando erro original.

## src/lote-session.js

`createBatchSession({items,startedAt,collect,save,commit})` síncrona, retorna
`{advance,getState}`. items já normalizados pelo parseBatchInput existente.
Snapshots na criação; callbacks públicos:
- `collect(item)` → Promise `{records,totalPages}`.
- `save(pending)` → Promise status do writer; UI injeta o handle atual aqui.
- `commit({completed,remaining})` → Promise; persiste o consumo do primeiro item.

`advance()` processa somente a cabeça ou tenta salvar pendente. Reentrada retorna
busy sem callbacks. Retorna saved após save+commit, done com fila vazia, ou status
recuperável retornado pelo writer. Exceções propagam conservando fila/pendente.
Se commit falhar após save, repetição faz somente commit. Não fazer retry automático
infinito. `getState()` retorna cópia defensiva `{remaining,pending,startedAt}`;
pending é null após consumo. Detalhes privados/recibos não fazem parte da API.

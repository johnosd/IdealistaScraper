# Lógica — fila do Lote, listagem, completude e deduplicação

Cobre FR-003/004/008–016, FR-026–028. Contratos C1, C2, C4.

## 1. Derivação da listagem — `deriveListingURL(linkUrl)` (`src/lote-queue.js`)

```text
u = new URL(validateBatchURL(linkUrl)); u.hash = ''; u.search = ''
path = u.pathname.replace(/\/concelhos-freguesias\/?$/, '/')
se path não termina em '/', acrescenta '/'
retorna u.origin + path
```

- Só remove o sufixo **final** `concelhos-freguesias`. Não reescreve `/geo/...` nem outros caminhos: páginas
  que não são listagem continuam sendo resolvidas pelo fluxo existente de destino "Ver N casas"
  (`destinationUrl` em `coleta-page.js` + `reportPage` categoria `destination`).
- URL fora de `https://*.idealista.pt` lança (via `validateBatchURL`); `buildBatchQueue` captura e põe em `rejected`.
- Se a inspeção real (T003) mostrar que a página sem sufixo **não** é a listagem completa para algum nível,
  registrar em `research.md` e ajustar esta regra **antes** de seguir; o contrato C1 fixa o caso Braga.

## 2. Fila — `buildBatchQueue(records)`

Entrada: registros de `extractLinks` (ordem do DOM). Saída `{entries, rejected}`.

```text
porListagem = Map ordenado
para cada r em records:
  tente listing = deriveListingURL(r.URL) senão rejected.push({record:r, reason}) e continue
  link = URL normalizada de r.URL (sem hash)
  nome = r.Texto || r['Município'] || r['Sub-região'] || r['Região'] || listing
  se porListagem tem listing:
     e = porListagem[listing]
     se link não está em e.linkUrls: e.linkUrls.push(link)
     se nome != e.nome e nome não está em e.aliases: e.aliases.push(nome)
     continue                      # primeira ocorrência vence (nome, tipo, contexto)
  porListagem[listing] = {nome, url: listing, linkUrls:[link], aliases:[], tipo: r.Tipo || 'Localidade',
     context: contexto(r)}
contexto(r) = {Região: r['Região'] ?? null,
               Sub-região: Tipo == 'Região' ? null : (r['Sub-região'] ?? null),
               Município: Tipo ∈ {'Município','Freguesia'} ? (r['Município'] ?? null) : null}
# Tipo 'Freguesia' (estratégia distrito, research R1): a entrada guarda também `freguesia: r.Texto`
# FORA de `context` (C1 compara `context` com 3 chaves exatas); usado pela Fase 8 (R4).
```

- Homônimos com URLs diferentes **não** são fundidos (chave = listagem, nunca nome).
- `Contagem` do link (ex.: `2.389`) pode virar `quantidade` informativa; não altera a ordem da fila.
- A fila preserva a ordem do DOM. `normalizeItems` em `coleta-autonoma.js` ordena por `quantidade` desc;
  as entradas vindas de `buildBatchQueue` passam `quantidade: null` para manter a ordem do DOM
  (empate → índice), salvo decisão posterior registrada em Riscos.

## 3. Itens com contexto no serviço autônomo

- `normalizeItems` DEVE preservar `context` (objeto com as três chaves, valores string|null) e `aliases`.
- `coordinator.start` hoje reduz itens a `{nome,url}`; estender para manter `context` validado
  (somente as três chaves; strings ≤ 200 chars ou null). Nenhuma outra chave nova no item.
- `publicRun` expõe `context` por item.

## 4. Completude — `assessListing({declaredTotal, obtained, budgetReached})` (`src/coleta-completeness.js`)

```text
se budgetReached: {status:'limited', reason:'item_budget'}
se declaredTotal é inteiro ≥ 0 e obtained < declaredTotal - tolerancia(declaredTotal):
    {status:'limited', reason:'site_limit'}
senão {status:'complete', reason:null}
tolerancia(n) = max(2, ceil(n * 0.02))      # anúncios entram/saem durante a paginação
retorno sempre inclui declaredTotal (ou null) e obtained
```

- `declaredTotal` vem do **primeiro** fato de página com inteiro válido (`facts.declaredTotal`), guardado no
  checkpoint do item (`checkpoint.declaredTotal`). O seletor que o produz em `coleta-page.js` é definido pela
  inspeção (research R2). Sem seletor confiável → `null` → nunca `limited` por site.
- `obtained` = `checkpoint.recordCount` (já deduplicado por id dentro do item).
- **item_budget**: hoje `requestPage` pausa a execução inteira com `item_budget` quando
  `confirmedPages >= maxPagesPerItem`. No modo autônomo (schemaVersion 2) isso passa a **concluir o item**:
  `checkpoint.complete = true`, `budgetReached = true`, estado `awaiting-save`, e a fila segue. Execuções v1
  (Itens/Lote legado, contrato 004) mantêm a pausa.
- `item.completeness` é gravado quando o item é salvo (ou fica vazio) e exposto em `publicRun`.
  O estado do item continua `saved`/`empty`: **não** criar novo estado (quebraria `counts()` e a view-model 005).
- A execução expõe `limitedCount` (fora de `summary`) = itens com `completeness.status==='limited'`; a UI mostra
  "Captura concluída · N listagens limitadas" e nunca "captura integral" para esses itens.

## 5. Contexto aditivo — `withContext(record, context)`

```text
retorna {...record,
  Região: context?.Região ?? null, Sub-região: context?.['Sub-região'] ?? null,
  Município: context?.Município ?? null,
  Freguesia: record.Freguesia ?? null}
```

- Aplicado **somente na gravação** (`options.write` recebe registros já enriquecidos); páginas no store
  continuam como extraídas. Assim a deduplicação e o digest de páginas não mudam.
- Ordem das chaves: campos originais primeiro, depois as quatro de contexto (C2 compara objeto inteiro).
- `Freguesia`: só preenchida se o extrator de anúncios (`extrairDaRaiz` em `content.js`) passar a produzi-la
  a partir de fonte comprovada pela inspeção (research R4). Caso contrário `null`.

## 6. Deduplicação entre entradas (FR-016)

- Store key nova `seen:<runId>`: `{ids: string[]}` (lista ordenada; chave = `String(r.id || r.Link)`).
- No momento em que o item é salvo/vazio (antes de `markSaved`/`advanceItem empty`), numa transação:
  `new = ids do item ∉ seen`, `repeated = ids do item ∈ seen`; `seen ∪= ids do item`;
  grava `itemStates[id].dedup = {new, repeated}` (contagens).
- `publicRun.dedup = {unique: seen.length, items: {[itemId]: {new, repeated}}}` apenas para itens já
  resolvidos. Antes de qualquer item resolvido: `{unique:0, items:{}}`.
- Arquivos não mudam: cada item grava sua listagem completa (decisão do usuário, spec FR-016).
- Retomada: transação idempotente — se `itemStates[id].dedup` já existe, não reconta.
- `discard` da execução remove `seen:<runId>`.

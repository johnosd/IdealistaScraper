# Data Model — 006

Somente acréscimos compatíveis sobre o modelo v2 da 005 (`.sdd/specs/005-.../data-model.md`).
Nenhum campo existente muda de nome, tipo ou significado.

## Entrada da fila (`buildBatchQueue`)

| Campo | Tipo | Regra |
| --- | --- | --- |
| `nome` | string | Texto do primeiro link que gerou a listagem |
| `url` | string | Listagem derivada (`deriveListingURL`), chave de deduplicação |
| `linkUrls` | string[] | Links originais (sem hash), ordem de aparição |
| `aliases` | string[] | Outros nomes que caíram na mesma listagem |
| `tipo` | string | `Região` / `Sub-região` / `Município` / `Localidade` |
| `context` | `{Região, Sub-região, Município}` | string ou `null` por nível |

## Sessão v2 (`session:<id>`) — acréscimos

| Caminho | Tipo | Regra |
| --- | --- | --- |
| `items[i].context` | objeto | Validado em `coordinator.start`; 3 chaves fixas |
| `itemStates[id].checkpoint.declaredTotal` | int \| null | Primeiro valor válido observado |
| `itemStates[id].checkpoint.budgetReached` | bool | `maxPagesPerItem` atingido no modo autônomo |
| `itemStates[id].completeness` | `{status, declaredTotal, obtained, reason}` | Gravado ao resolver o item |
| `itemStates[id].dedup` | `{new, repeated}` | Gravado uma vez ao resolver o item |
| `autoRecovery` | `{rechecks, until}` | Mantido por `runQueue` |
| `cycle` | `{startedMs, requestedBase, n}` \| ausente | Criado por `renewCycle` (D13); ausente = regra antiga |
| `source.linksSessionId` | string \| ausente | Execução criada a partir de uma coleta de links |

## Novas chaves de store

| Chave | Conteúdo | Ciclo de vida |
| --- | --- | --- |
| `seen:<runId>` | `{ids: string[]}` | Criada no primeiro item resolvido; removida no `discard` da execução |
| `lote:prepared` (chrome.storage.local) | `{linksSessionId, createdAt, entries, rejected}` | Escrita ao concluir Links; substituída pela próxima coleta de links; lida pela aba Lote |

## Anúncio gravado (arquivo `.data/municipios/AAAAMM/<nome>-PaginasN.json`)

Campos existentes de `extrairDaRaiz` intactos + ao final: `Região`, `Sub-região`, `Município`,
`Freguesia` (string ou `null`). Arquivo da entrada contém a listagem completa (sem remover repetidos).

## `publicRun` — acréscimos

`items[].context`, `items[].completeness`, `dedup: {unique, items}`, `limitedCount` (no nível da
execução, **fora** de `summary`, para não alterar `counts()` nem asserções existentes sobre `summary`).

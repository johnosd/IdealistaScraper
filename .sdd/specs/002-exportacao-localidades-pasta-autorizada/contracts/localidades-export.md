# Contrato interno de exportação

Módulos CommonJS, importáveis pelos testes Node e empacotados pelo Webpack.
Não é uma API de rede. Não cria servidor local nem permissão de Downloads.

## src/localidades-export.js

```js
getMonthlyDestination(startedAt: Date): {
  yearMonth: string, fileName: string, relativePath: string
}

exportLocalities({
  directory: FileSystemDirectoryHandle,
  records: Array<object>,
  startedAt: Date,
  confirmOverwrite: ({directoryName, relativePath, total}) => boolean | Promise<boolean>,
  locks: LockManager
}): Promise<{status, relativePath, total}>
```

Statuses: `saved`, `cancelled`, `permission-required`, `empty`, `busy`.
`relativePath` usa a data local recebida; `total` é o tamanho do snapshot de dados,
não uma afirmação de que houve escrita. UI usa status para anunciar sucesso.
Data inválida e registros não representáveis em JSON rejeitam antes de IO.
Array vazio retorna empty sem criar diretórios ou abrir writable.

Erros de filesystem são propagados como erro original; writer não solicita
permissão nem chama picker, fetch, downloads ou outros fluxos da extensão.
Sem LockManager suportado, informar erro de capacidade; não degradar para trava
somente em memória. `navigator.locks` é fornecido pelo controlador.

## src/localidades-directory-store.js

```js
loadDirectory(): Promise<FileSystemDirectoryHandle | null>
saveDirectory(handle: FileSystemDirectoryHandle): Promise<void>
```

Usar IndexedDB conforme data-model.md. Resolver save somente em transaction.complete,
rejeitando abort/error. Abrir/carregar na inicialização, antes do clique de reautorizar.

## src/localidades-collector.js

```js
collectLocalities(): Promise<Array<object>>
```

Cria uma aba própria inativa no endereço já usado atualmente:
`https://www.idealista.pt/arrendar-casas/#municipality-search`.
Aguarda carregamento e `nav.locations-list`, executa extractLinks como função
autônoma serializável e retorna a lista. Fecha em finally somente a aba criada
por esta chamada; não navega/fecha abas preexistentes do usuário.
Timeout de carregamento e de DOM: 30 segundos cada, com cleanup de listeners/timers.
Função injetada não pode depender de imports/capturas do bundle.

## Entradas e interface

- `src/localidades.js` controla `localidades.html`; Webpack entry `localidades`.
- Popup Extrair Links abre/reutiliza essa página via tabs/query/update/create;
  não coleta, cria blob nem baixa arquivos no popup ou na página do site.
- `localidades.html` carrega `dist/localidades.bundle.js` sem script inline.
- Controles: Escolher/Trocar pasta, Reautorizar, Extrair e salvar, Salvar JSON
  (para retomar dados já coletados), destino exibido e status acessível.
- Escolher/Trocar chama showDirectoryPicker no clique, antes de await de IO;
  Reautorizar chama handle.requestPermission no clique, com handle já carregado.
- Confirmação usa window.confirm na página durável com nome da pasta e caminho
  relativo. Não prometer acesso ao caminho absoluto.
- Se usuário fechar a confirmação, resultado false equivale à recusa.
- Não adicionar comandos ao service worker nem alterar storage/proxy/Itens/Lote.

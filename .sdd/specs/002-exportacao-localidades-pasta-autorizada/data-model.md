# Entidades e persistência

## Destino autorizado

- Persistência: IndexedDB `idealista-localidades`, versão 1, object store `settings`.
- Chave: `directory`; valor: FileSystemDirectoryHandle obtido por seletor do usuário.
- Projeção exibível: `handle.name` e permissão consultada para `{mode:'readwrite'}`.
- Não gravar caminho absoluto presumido nem copiar handles para chrome.storage.
- Cancelar um novo seletor mantém o handle anterior; substituir somente após
  seleção e autorização válidas, com transação IndexedDB concluída.
- Falha ao persistir é informada; a referência em memória pode ser usada na sessão
  se o usuário mantiver o destino autorizado, sem anunciar que foi memorizada.

## Execução de exportação

Estado em memória da página `localidades.html`: data inicial imutável, destino
capturado, registros, estado e último erro. Não persistir registros automaticamente.
Fechar o popup não afeta esta página. Fechar a página de exportação encerra a
sessão; recuperação após fechar essa página não faz parte da spec.

Estados: `loading`, `needs-directory`, `needs-permission`, `ready`, `collecting`,
`ready-to-save`, `confirming`, `saving`, `saved`, `cancelled`, `error`, `busy`.

- O mês é calculado com getFullYear/getMonth da data local capturada ao iniciar
  a extração; não usar toISOString para definir o mês.
- Não trocar destino/data no meio de uma gravação. UI bloqueia ação duplicada
  na mesma página; writer usa Web Locks para concorrência entre páginas.
- Se permissão expirar após coletar, manter registros e data na memória e mostrar
  Reautorizar/Salvar JSON. Retomar a escrita sem uma coleta duplicada obrigatória.
- Sucesso somente após close resolvido; recusa/cancelamento não representa erro.

## Arquivo mensal

Destino: `<pasta-autorizada>/<YYYYMM>/links_localidades_<YYYYMM>.json`.
Conteúdo: array JSON UTF-8, JSON.stringify(records, null, 2), sem envelope novo.
Campos e seletores iguais à função extractLinks existente.
Não mesclar, renomear com sufixo, apagar outros arquivos ou gerar download alternativo.

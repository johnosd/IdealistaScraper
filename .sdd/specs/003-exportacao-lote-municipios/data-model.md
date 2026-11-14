# Modelo de dados — 003

- Destino: FileSystemDirectoryHandle no IndexedDB `idealista-municipios`, versão 1,
  store `settings`, chave `directory`. Banco independente de `idealista-localidades`.
  Handle em memória continua utilizável se sua persistência falhar; avisar usuário.
- Sessão: snapshot de Date local inicial + fila normalizada `{nome,url}[]`, ordem
  e duplicatas preservadas. Guardar representação original para não perder campos
  do JSON colado ao persistir a fila restante. Não deduplicar por URL/nome.
- Pendente: `{item, records, totalPages, startedAt}` e recibo interno opcional de
  escrita concluída. Snapshot profundo dos dados; nenhuma mudança de mês/destino
  modifica sua data. Destino pode mudar explicitamente antes de nova escrita.
- Fila persistida/status: manter compatibilidade com `loteLista`, `loteStatusArr`,
  `loteProcessamento` em chrome.storage.local. Novo carregamento não assume execução
  ativa a partir de flag antiga; apenas restaura a fila. Sem retomada de memória
  após fechamento. Atualizar fila/status juntos no mesmo set e aguardar conclusão.
- Resultado salvo: `{status:'saved',relativePath,total}` emitido pelo writer após
  close; sessão só o anuncia após persistir consumo. Falha desse commit conserva
  pendente com recibo, sem escrever/coletar novamente na repetição.
- Schema de anúncio: manter exatamente as 17 chaves de src/content.js. Mudam
  apenas valores comprovados de `imagens` e `estacionamento`. Inventário não
  adiciona URLs de fotos, vídeo, terreno, elevador ou anunciante nesta entrega.

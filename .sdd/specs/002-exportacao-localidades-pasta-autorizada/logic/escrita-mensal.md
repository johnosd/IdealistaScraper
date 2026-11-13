# Escrita mensal e autorização

## Algoritmo do writer

1. Validar Date e array de objetos; capturar mês/total e serializar JSON antes de IO.
   Array vazio retorna empty; JSON inválido rejeita sem abrir arquivo.
2. Solicitar Web Lock `idealista-localidades:write`, exclusiva, ifAvailable=true.
   Se indisponível, retornar busy. Não enfileirar uma substituição para mais tarde.
3. Dentro da trava, consultar directory.queryPermission({mode:'readwrite'}).
   Se diferente de granted, retornar permission-required sem criar diretórios.
4. Buscar mês e arquivo com create=false. Somente NotFoundError significa
   ausência; outros erros não podem ser transformados em primeira gravação.
5. Se arquivo existe, chamar confirmOverwrite com nome da pasta, caminho mensal
   e total. False retorna cancelled, sem mutações. Manter lock durante confirmação.
6. Se ainda não existem, criar subpasta/arquivo. Abrir writable com keepExistingData=false.
7. Aguardar write(serialized) e close(). Retornar saved somente após close.
8. Em qualquer erro após abrir stream, tentar abort() sem esconder o erro original.
   Não apagar o arquivo antigo e não emitir sucesso. A Web Lock é liberada pelo
   encerramento do callback tanto em sucesso quanto em cancelamento/falha.

Escopo da trava: coordenação das páginas desta origem de extensão. Não promete
coordenar programas externos, outro ID da extensão ou escrita por outra aplicação.

## Controlador da página durável

Na carga: verificar APIs, carregar handle, consultar permissão sem prompt e
renderizar destino/estado. Não solicitar autorização automaticamente.

No clique Escolher pasta: chamar seletor imediatamente, aguardar escolha válida,
persistir handle e renderizar. AbortError mantém seleção anterior e informa
cancelamento. Não confundir cancelamento do seletor com erro de disco ao salvar.

No clique Reautorizar: chamar requestPermission diretamente com handle carregado;
se granted e existem registros pendentes, oferecer Salvar JSON. Sem nova coleta
obrigatória. Se denied, manter dados e oferecer outra escolha de pasta.

No clique Extrair e salvar: verificar destino/acesso; capturar Date uma vez;
desabilitar ações duplicadas/troca de destino; collectLocalities(); se não vazio,
exportLocalities com cópia do destino e navigator.locks. Manter dados até saved
ou cancelamento explícito. Se acesso expirou, voltar para needs-permission.

No clique Salvar JSON: reutilizar snapshot e data existentes; verificar destino
autorizado atual e chamar writer, que verifica existência e confirmação novamente.

Erros são exibidos em status role=status/aria-live, sem credenciais ou stack interna.
Antes de fechar a página com coleta/escrita em curso ou dados não salvos, usar
aviso de saída apropriado; mudar foco não dispara cancelamento.

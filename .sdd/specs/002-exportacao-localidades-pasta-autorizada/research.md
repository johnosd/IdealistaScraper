# Pesquisa técnica — exportação de localidades

## Pasta local e autorização

**Decisão**: File System Access API em página normal da extensão, iniciada por
interação do usuário. Selecionar `.data/localidades` como base; acrescentar somente
o mês e nome do arquivo. Não tentar descobrir ou validar caminho absoluto.

**Justificativa**: a API de Downloads restringe filename ao diretório de downloads.
O usuário escolheu autorização de pasta e rejeitou o auxiliar Node. `showDirectoryPicker`
e `requestPermission` exigem ativação transitória, portanto não podem ficar depois
de navegação, extração demorada, IndexedDB ou aquisição assíncrona de uma trava.

**Alternativas consideradas**: downloads relativos (não atendem à pasta do projeto);
auxiliar Node (não escolhido); seletor no popup (perda de foco destrói o controlador).

**Fontes**:
- https://developer.chrome.com/docs/extensions/reference/api/downloads
- https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
- https://github.com/WICG/file-system-access/blob/main/index.bs

## Persistência da pasta

**Decisão**: IndexedDB próprio da origem da extensão, banco `idealista-localidades`,
versão 1, store `settings`, chave `directory`. Guardar o DirectoryHandle por
structured clone; não usar JSON/chrome.storage para serializar o handle.

**Justificativa**: handles podem ser persistidos, mas a permissão pode expirar.
Carregar a referência no início da página, consultar permissão e oferecer botão
de reautorização que chama requestPermission diretamente dentro do clique.

**Alternativas consideradas**: nova seleção obrigatória toda vez (desnecessária);
prometer acesso permanente (não garantido pelo navegador).

**Fonte**: https://developer.chrome.com/docs/capabilities/web-apis/file-system-access#storing_file_handles_or_directory_handles_in_indexeddb

## Escrita e concorrência

**Decisão**: writer recebe registros e data de início; valida/serializa antes de IO,
consulta permissão sem pedir prompt, verifica existência sem create e confirma
substituição antes de abrir writable. Usar `createWritable({keepExistingData:false})`,
uma escrita JSON e close aguardado. Em falha, abort best-effort e propagar erro.
Uma Web Lock exclusiva por origem, `idealista-localidades:write`, com ifAvailable,
impede gravações próprias concorrentes e evita fila de escritas inesperadas.

**Justificativa**: a confirmação deve proteger o arquivo antigo; alterações de um
writable só são aplicadas no fechamento. A trava é compartilhada entre páginas
da extensão, diferente de um booleano em cada instância.

**Alternativas consideradas**: truncate/delete antes de confirmar (destrutivo);
booleano por página (não protege outra aba); serviço de escrita no background
(não pode pedir autorização por gesto e não é necessário).

**Fontes**:
- https://developer.chrome.com/docs/capabilities/web-apis/file-system-access#save_changes_to_disk
- https://developer.mozilla.org/en-US/docs/Web/API/FileSystemFileHandle/createWritable
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API

## Verificação local e limites

Em 2026-11-13, Chrome instalado 157, perfil temporário e extensão atual carregada:
`isSecureContext=true`; `showDirectoryPicker`, `indexedDB.open` e
`navigator.locks.request` disponíveis como funções em origem `chrome-extension:`.
Foi uma inspeção de capacidades, sem abrir seletor, autorizar pasta ou escrever
arquivos reais. A presença das APIs não equivale a validar a autorização nativa.

O gate final inclui seleção real de uma pasta temporária e conferência dos bytes
no disco, separado dos contratos com colaboradores em memória e do E2E simulado.

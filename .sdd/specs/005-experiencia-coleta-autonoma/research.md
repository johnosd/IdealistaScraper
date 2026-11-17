# Research — 005-experiencia-coleta-autonoma

Data: 2026-11-14. Exploração do checkout feature/004-coleta-resiliente; nenhuma ADR existente em .sdd/adr/.

## R1 — Superfície e versão de Chrome

**Decisão**: painel global sidepanel.html, permissão adicional somente sidePanel, minimum_chrome_version 141. Remover action.default_popup da entrada principal e usar sidePanel.setPanelBehavior({openPanelOnActionClick:true}); fechar/recolher via gesto no painel com sidePanel.close({windowId}). A posição direita/esquerda respeita a preferência do navegador. O painel pode permanecer observável fora do Idealista; iniciar só em origem suportada.

**Justificativa**: sidePanel existe desde Chrome114; open desde116 e close desde141. O fechamento programático explícito e os testes de compatibilidade justificam141. Usar chrome.*, sem migrar para browser.*. Um clique de Iniciar coleta é distinto do gesto para abrir o painel, conforme definição da spec.

**Alternativas consideradas**: overlay altera o site e não foi escolhido; aba de gerenciamento não atende ao painel lateral; manter o popup como entrada obrigatória acrescenta navegação. popup.html poderá continuar como página legada acessível em Outras ferramentas.

Fonte consultada via Context7: /websites/developer_chrome_extensions, conceitos separados de sidePanel e lifetime; [referência Side Panel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel). Não abrir painel a partir de progresso/restart.

## R2 — Execução independente da UI

**Decisão**: runner.html é uma aba técnica própria da extensão, criada active:false, sem UI de controle; runner.js mantém o laço e executa páginas usando coleta-runner.js refatorado. A aba do site usada pelo executor continua própria e inativa. tabs.update(autoDiscardable:false) reduz descarte voluntário; não constitui garantia contra falha/fechamento. Handshake identifica a aba técnica, runId, documento, token e epoch; não confiar só no ID/URL. UI apenas envia comandos e lê resumos.

**Justificativa**: preservar as APIs tabs/scripting, File System Access e Web Locks já usadas, sem offscreen/alarms/permissão extra. service worker é efêmero; timers nele não sustentam coleta. Offscreen oferece só runtime entre APIs de extensão, e usar motivo DOM_SCRAPING para um simples controlador seria inadequado. A aba técnica tem título discreto e texto explicando que fechá-la interrompe; não é necessário manter qualquer tela de gerenciamento aberta.

**Alternativas consideradas**: laço no painel falha ao fechá-lo; keepalive artificial do worker rejeitado; offscreen amplia permissões, pontes e lifetime sem necessidade; controlador por alarms exigiria reescrever runner, transporte e escrita.

Limite explícito: fechar a aba técnica ou a aba própria de coleta gera interrupção recuperável. Fechar/restaurar o Chrome nunca reinicia rede por si só. runner restaurado sem autorização do browserRunId atual fica inerte.

Fontes: [lifecycle do worker](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle), [tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs), [offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen). API é evidência documental, não prova de funcionamento no Chrome instalado.

## R3 — Qualquer item sem criar uma sessão por município

**Decisão**: extensão opt-in schemaVersion2 das sessões autônomas no mesmo IndexedDB idealista-coleta-v1/records, mantendo schemaVersion1 e contratos004 intactos. Um único domain.active, sessionId e consumo da sessão para toda a fila; itemId estável e manifests por item. Seleção/avanço/recovery/receipt são transacionais no coordenador existente.

**Justificativa**: criar308 sessões esgotaria o teto10 e reiniciaria orçamentos por execução. O coordenador atual guarda checkpoint ativo e archivedCheckpoints, não um estado independente recuperável para cada item. Projeções loteStatusArr atuais também inferem sucesso por índice; precisam ser substituídas pela leitura de estados reais no caminho005.

**Alternativas consideradas**: reconstruir tudo por arquivos perde contexto e dados parciais; sidecar com cópia de domínio/counters cria duas autoridades. Não migrar em massa v1; leitura derivada sob demanda permite recuperação dos checkpoints antigos compatíveis.

## R4 — Configurações consistentes

**Decisão**: registro config:005 autoritativo para novas configurações, no mesmo store transacional da política. Importação inicial preserva chaves legadas e handles. Configuração privada contém credenciais locais; leitura pública devolve apenas passwordConfigured. A atualização válida faz compare-and-swap da revisão e rechecagem de domain.active na mesma transação que altera policy. Adaptadores antigos passam a ler a configuração efetiva; projeções de compatibilidade em storage.local são reparáveis, nunca autoridade do consumo.

**Justificativa**: um único Salvar não pode informar sucesso após atualizar só alguns campos; storage.local e IndexedDB não compartilham transação. Policy e configuração efetiva precisam de commit único. Destinos continuam nos bancos originais e são operações de autorização separadas, visivelmente já efetivas; não transportar handles em mensagens JSON.

**Alternativas consideradas**: múltiplas gravações não atômicas, sem revisão; apagar/regravar todos os bancos; autosave silencioso. A configuração privada não pode entrar em READ/LIST de sessões, diagnósticos, baseline ou exportação.

## R5 — UX em listas grandes

**Decisão**: DOM nativo sem framework. Projeção pura buildCollectionView; lista por itemId com atualização incremental, busca/filtros sem mudar a fila; renderização por lotes e detalhes sob demanda, mantendo elementos focados. CSS local em src/coleta.css copiado/importado de forma CSP compatível na execução. Sem CDN/fontes remotas novas.

**Justificativa**: 308 localidades cabem nos limites existentes; o custo está em rerenderizar e reconstruir datasets a cada pulso. Resumos não incluem registros de anúncios. Testar320px e zoom200%, teclado e leitor de tela; testes DOM simulados não certificam leitura assistiva.

# Execution and Recovery — 005

## Responsabilidades

Background recebe intenções, valida sender e cria uma única aba runner.html ativa:false por execução (autoDiscardable:false). Runner invoca o núcleo autônomo com ports reais, que usa o MESMO coordenador/IDB/domínio004. Painel nunca importa drive, nunca envia records de checkpoint, nunca possui autoridade de rede. Registrar o owner técnico antes de iniciar. A aba própria de conteúdo é distinta da origem do usuário e nunca recebe active:true por progresso.

Refatorar a lógica de transporte de coleta-runner.js em createPageTransport(api) compartilhada pelo fluxo antigo e novo; não duplicar regras de timeout, proof, navegação, COLLECT_PAGE, reserve/validate/report. createCollectionWorkflow continua disponível para v1 sem mudanças de semântica.

## Lançamento e descoberta

start:
  validar source HTTPS Idealista, preflight e revisão de configuração
  transação reserva domain.active + launch:commandId + id/owner/run/browser token
  se mesmo commandId/payload: retornar associação; se outro active: busy
  ler DOM no frame0/documento aceito, sem navegar origem ou fazer fetch
  comparar URL/documentId antes/depois da extração; mudança => interrupted
  extrair links diretos do breadcrumb highlighted, fallback só para DOM legado já suportado
  validar, normalizar, deduplicar por URL sem fragmento, ordenar quantidade desc estável
  ausência de quantidade NÃO elimina link válido; número desconhecido vai ao final
  lista vazia/inválida => liberar reserva após encerrar executor, explicar motivo
  commit da sessão v2 + associação launch na mesma transação
  retornar started; drive autorizado segue no runner

Discovery usa tabs/scripting existentes e DOM da página já carregada, sem requestPage por leitura local. Não reutilizar collectLocalities que abre o catálogo nacional. Atualizar loteAutoLoad para compartilhar extrator sem introduzir recursão; testes antigos mantêm breadcrumb antigo e novo.

Se pausa/fechamento ocorrer na descoberta: cercar callback antigo pelo token/revisão. Não publicar fila depois da confirmação de pausa, não deixar domain.active órfão. Persistir estado discovering para acompanhar mesmo sem painel.

## Extensões do coordenador

Adicionar caminho opt-in v2 sem alterar as assinaturas existentes usadas por004:
- start(o.autonomous/source/commandId): inicia sessão v2 somente após launch válido.
- selectItems({id,owner,epoch,selection}): verifica estado, vida dos executores e contexto; incrementa epoch na retomada e seleciona IDs; não limpa budgets.
- advanceItem({id,owner,epoch,itemId,outcome,reason}): permitido só após request encerrado e checkpoint confirmado; outcomes local-failure/empty/receipt-confirmed. Receipts são comprovados, não input arbitrário de UI.
- readItem({id,itemId}): verifica manifest/hash do item selecionado.
Atualizar read, control, recover, reportPage, markSaved, descarte e accounting para v2; manter comportamento v1 exercitado pelos contratos001–004.

Não usar read-modify-write fora de transact. Toda mudança usa domínio+sessão+item/blocos relevantes. Revalidar revision após hash fora da transação. Epoch antigo não pode reportar nem salvar após troca de seleção.

## Laço

drive(id,owner):
  adquirir identidade atual; se já existe drive vivo: busy
  enquanto seleção tiver item:
    se pausa solicitada: abortar/aguardar operação e confirmar pausa; sair
    obter checkpoint válido do item por ID/índice original
    se resultado completo:
      se vazio validado: confirmar empty sem writer/receipt; avançar
      se intent anterior: reconciliar bytes/digest antes de nova escrita
      salvar com writer003 e mês/destino vinculados; confirmar receipt no item
    senão:
      conferir proxy e ownership
      obter permit one-shot do coordenador para URL exata
      wait ordinary intervalo/backoff: aguardar interruptivelmente
      wait window_budget /429 /limite sessão: pausar manualmente retomável
      coletar uma página na aba própria; report pelo coordenador
      se falha local allowlisted e sem restrição geral: preservar pending e avançar
      se condição global/desconhecida: pausar e sair
  calcular resumo por estados reais; completed só saved/empty de toda fila
  liberar domínio ao terminar/pausar, depois de confirmar ausência de inFlight

Manter domínio ocupado durante writer em005: estado awaiting-save legado libera domínio, portanto adaptar apenas caminho v2 para não permitir outro modo no intervalo entre coleta e receipt. Se salvar falhar, liberar somente depois de preservar resultado e pausar/registrar pending. Projeções legadas não inferem sucesso pelos índices.

## Classificação travada

| Condição | Escopo e ação |
| --- | --- |
| HTTP404/410 sem challenge/login/proxy/Retry-After e na URL validada do item | Local; pending e próximo item após commit seguro |
| Falha isolada comprovada de arquivo em destino ainda disponível (ex.: nome alvo específico sem permissão; diagnóstico allowlisted e storage confirmado) | Pending stage=save; pode seguir somente se acesso compartilhado válido e sem ambiguidade de gravação |
| 403, desafio em200,429,401/autenticação,407/proxy, origem divergente | Global; pausa conforme004 |
| rede/timeout,5xx, tentativas esgotadas, conteúdo inesperado/layout, ciclo, no-new, limites por item | Causa local NÃO comprovada; pausa conservadora do lote. Não transformar tentativas esgotadas por si só em permissão de pular |
| intervalo/backoff elegível | Espera automática dentro da sessão consentida |
| teto janela/sessão/duração, relógio, quota/erro de checkpoint, perda de acesso à pasta compartilhada | Pausa global; manutenção de consumo/esperas/dados |

Precedência: desafio/proxy/rate-limit/autenticação e esperas servidor vencem qualquer diagnóstico local. HTTP404 com challenge nunca é local. Caso novo não allowlisted pausa. Retry-After válido jamais encurtado;429 e desafio requerem gesto manual, e desafio exige confirmação de acesso mais prazo004.

## Retomada, gravação e arquivos

remaining: itens queued e item ativo interrompido; pending: todos pending recuperáveis; itemId: apenas escolhido. Não incluir concluídos. Recusas individuais são listadas sem excluir silenciosamente. Ação selecionada não começa nova sessão nem muda mês; preserva total requested/maxPagesPerRun e attempts por URL/item.

Pedir a retomada de item enquanto outro está ativo retorna busy; sem preempção automática. Pausar interrompe avanço inclusive depois de save. Descartar item recuperável confirma perda só desse item; manter registro discarded como pendência não recuperável no total original (nunca concluir captura integral). Descartar execução elimina seus dados internos sob confirmação, preserva arquivos e orçamento do domínio.

Não prometer exactly-once filesystem: write close confirmado com intent ambíguo usa hash/bytes; resultado divergente requer Tentar salvar novamente explícito. Pasta da execução é vinculada por handle local em armazenamento de destino indexado por execução (sem mensagem de handle), além do handle padrão já existente; trocar padrão só afeta novas execuções. Perda desse handle exige reescolha/reautorização explícita para a execução, nunca gravação silenciosa em outra pasta.

Para evitar sobrescrita silenciosa entre homônimos/nomes sanitizados iguais na MESMA execução, registrar a associação itemId → caminho confirmado. Regra de nomes003 não muda. Se outro item produzir exatamente o mesmo caminho, preservar seu resultado completo como pending stage=save e seguir os demais, sem sobrescrever a saída de outro item dessa execução. Resolver destino permite escolher explicitamente outra pasta autorizada para esse resultado, vinculando o handle ao item; nome e subpasta mensal permanecem003. Substituição do mesmo caminho por outra execução mantém a regra anterior. Não fundir itens, inventar sufixo nem considerar colisão como falha global do destino.

## Vida e segurança

Provar runner vivo usando token/documento/runId; timeout de lease sozinho não basta. Ao fechar a aba técnica, confirmar abort/fechamento da aba própria antes de liberar domínio. Se a prova é inconclusiva, estado intervenção sem takeover. Nunca remover aba reciclada/do usuário por ID. Worker reaberto reconstruindo bindings não inicia coleta nova.

UI pausa envia intenção; Pausando aparece <1s, Pausada só após confirmação. Se writer.close em curso não pode ser abortado com segurança, aguardar resultado e preservar receipt; não lançar outro item. Persistir afterSave pause como004. Unknown save conserva intent.

Capacidades004 permanecem; sem submissão de HTML bruto/segredos em logs. O serviço privado de settings não é retornado em snapshots do núcleo.

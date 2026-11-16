# Public Contracts — 005

## Núcleo sem Chrome

createAutonomousCollection(options) em src/coleta-autonoma.js, sem I/O na importação. options:
store: read/transact compatível com coleta-store; now: relógio; nextId: gerador de identidade.
policy: perfil inicial opcional validado (somente se não houver policy persistida; não reaplicar em restart).
preflight({source,useProxy}): {status:ready,destination:{name},proxyRevision} ou pré-requisito pendente.
discover(source): {source,items:[{nome,url,quantidade?}]} somente DOM atual, sem recursão/rede adicional.
executePage({id,itemId,url,kind,epoch,requestId,...}): fatos do transporte004; nunca altera checkpoint.
write({records,startedAt:Date,nome,totalPages,...}): resultado do writer003 após close.
reconcile(intent): saved ou save-unknown; implementação real compara bytes/digest e destino vinculado.
waitUntil(until,signal): espera interrompível; não muda política.
proxySnapshot(): revisão opaca, sem segredo.

O módulo usa createCollectionCoordinator do mesmo store para limites/domínio e commits, estendendo o coordenador existente. Não criar um motor independente que aceite chamadas fora do domínio004. As assinaturas dos métodos de extensão internos ao coordenador estão em logic/execucao-e-recuperacao.md.

Métodos públicos:
- start({commandId,source:{tabId,documentId?,url},useProxy,owner}): Promise<{status:started|busy|needs-configuration|interrupted,id?,reason?}>. Mesmo commandId/payload retorna mesmo id; payload divergente é rejected. Outro comando durante execução retorna busy. Owner real vem do adapter, não do payload do painel.
- drive({id,owner}): executa seleção já autorizada até pausa/fim. Instância concorrente sem owner/epoch válido não executa rede. Não é chamado por READ ou construção do serviço.
- read({id}): resumo sanitizado {id,source,state,items,summary,exportContext,reason?,eligibility?}. items sem records; checkpoint só confirmedPages/recordCount/nextUrl/complete. summary={total,queued,inProgress,saved,empty,pending}.
- resume({id,owner,selection:remaining|pending|{itemId},accessConfirmed?}): accepted|wait|busy|incompatible, com quantidades e motivos. Não dirige rede antes de drive.
- pause({id,owner}): accepted/pausing/paused; confirmação final somente após abort/commit seguro.
- list(): resumos; somente leitura e recuperação comprovada de owners mortos, sem coleta.

owner é parâmetro injetado do núcleo para testes/adaptador. Na extensão, background obtém identidade real de sender; UI não escolhe owner, epoch, token ou tabId de executor.

## Projeção de UI

buildCollectionView({run,filter:all|running|queued|pending|completed,query}) em src/coleta-view-model.js.
Retorna {counts:{total,queued,inProgress,saved,empty,pending},progress:{value:saved+empty,max:total,label},primaryAction:{id,label,enabled,reason?},rows}.
Rows mantêm ordem original, filtradas por estado e busca nome Unicode sem distinguir maiúsculas/acentos; homônimos preservam origem. paused → primaryAction.id=resume; finished-with-pending → resume-pending; ready→start; active→pause. Nunca calcular counts pela lista filtrada.

## Configurações

createCollectionSettings({repository,isActive}) em src/coleta-settings.js.
repository.load(): configuração privada/revisão. repository.commit(next): commit atômico definido no data-model; adaptador real confere revisão e domain.active novamente dentro da transação.
load(): valores públicos/revisão, proxy.passwordConfigured, sem senha.
save({expectedRevision,values}): {status:saved,revision}|invalid(errors por campo)|busy|conflict|error. Validar todos os campos antes de commit. Senha omitida conserva valor privado. Sem valores inválidos/mensagens brutas em erro. Status saved só após transação confirmada.
Picker/reauthorização não integram save: são efeitos explícitos separados e visíveis na UI.

Adendo T050 autorizado pelo usuário: revealPassword({expectedRevision}) é leitura privada explícita, retorna {status:revealed,password} ou {status:conflict} sem segredo. Comando AUTONOMA_REVEAL_PROXY_PASSWORD é permitido somente ao documento principal configuracoes.html após validação de runtime/origem/caminho/frame; UI o chama exclusivamente pelo olho. load/GET_SETTINGS e respostas de save continuam sanitizados. Não alterar credencial/revisão por revelar. Ao ocultar, remover valor salvo revelado do campo; revelar não altera o draft nem substitui uma edição manual.

Adendo T048, conexão: listener privado existente de proxy aceita APPLY_SAVED_CONNECTION(expectedRevision), somente origem/runtime da extensão e domínio ocioso. Lê configuração privada; revisão divergente retorna {ok:false,code:SETTINGS_CHANGED}, sucesso {ok:true,connection:proxy|system,revision}. Não inicia coleta nem retorna credenciais. PROXY_STATUS mantém enabled/external/config sanitizado/domains e acrescenta requested e matchesSaved (boolean ou null se registro indisponível), comparando segredos apenas internamente. Salvar continua sem efeitos de conexão e TEST_IP continua observacional. Comandos aplicam/observam sob a mesma fila; início recusado por atividade não pode alterar PAC.

## Mensagens da extensão

Novo namespace AUTONOMA_, listener separado em src/coleta-autonoma-background.js. Registrar listeners sincronicamente, I/O lazy. Comandos:
START(commandId, source), LIST, READ(id), READ_ITEM(id,itemId), PAUSE(id), RESUME(id,selection,accessConfirmed), DISCARD(id,itemId?,confirmationToken), GET_SETTINGS, SAVE_SETTINGS(expectedRevision,values).
Resposta {ok:true,result} ou {ok:false,code,message sanitizada}. Nunca retornar credenciais ou registros em LIST/READ.

T052: LINKS_START inicia runner.html?links=token em segundo plano sem exigir sender.tab no painel; LINKS_CLAIM(token), LINKS_FAILED e LINKS_FINISHED são exclusivos de runner.html/aba do lançamento após validação de origem/runtime/frame. Token expira em120s e é consumido uma vez em storage.session; nenhum boot/READ renova autorização. CLAIM retorna apenas escolha useProxy da configuração canônica, sem credenciais. O executor abre o Idealista em primeiro plano e não carrega localidades.html nem Configurações. LINKS_FINISHED só fecha a própria aba técnica após estado terminal/pausa e sem operação em voo; a página do Idealista e o checkpoint permanecem. LINKS_READ retorna somente resumo e projeção geográfica explícita do checkpoint de links (nome,url HTTPS Idealista,tipo; até1000 linhas), não datasets de anúncios ou credenciais. LINKS_EXPORT abre localidades.html?session=id somente por ação separada, sem recoleta. Exclusividade/limites/proxy/validade seguem coordenador004.

Correção do início T052: LINKS_FAILED recebe somente motivo de catálogo, etapa claim/settings/start e prazo numérico finito; descarta mensagens/valores livres. LINKS_READ preserva esses campos quando START é recusado antes de criar sessão; com sessão retorna motivo, último HTTP conhecido e elegibilidade. LINKS_START conserva sessão pausada/bloqueada/interrompida/cancelada em vez de substituí-la. LINKS_DETAILS abre o controlador dono no mesmo browserRunId ou uma página observadora da sessão; não retoma nem consulta o site. Sem sessão, abre o controle de Links para gestão. Erro genérico legado pode recuperar a última sessão de Links pendente, sem rede automática. Falha na aplicação/snapshot da conexão anterior à criação retorna connection_setup_failed sanitizado no COLETA_START.

Bloqueio herdado T052: sem sessão própria e com falha access_blocked, LINKS_READ projeta recovery:confirm-access e elegibilidade atual do domínio. READ não libera bloqueio. LINKS_START com accessConfirmed:true chama confirmação atômica do coordenador antes de criar o runner; sem confirmação não libera a trava. Espera, operação ativa, relógio e orçamento continuam obrigatórios no backend. Confirmação libera somente o marcador global de acesso; não apaga sessões bloqueadas anteriores nem checkpoints. Sessões próprias existentes continuam pelo fluxo de retomada anterior.

Navegação T052: durante a operação initial navigation ainda em voo, o runner observa transições feitas pelo próprio site por até10s/timeout, sem novo REQUEST/reload/fetch do app. READ_HTTP acompanha documento final na mesma URL autorizada/destino já observado, limitando substituições e recusando eventos de IDs antigos. VALIDATE de DOM pode vincular documentId novo somente com evidência HTTP correspondente; paginação não transfere essa prova.429 permanece obrigatório;403/desafio persistente pausa normalmente. Não há retomada automática de sessão anteriormente bloqueada.

UI confiável: sidepanel.html, configuracoes.html e launchers legados autorizados; validar runtime.id, origin e caminho exato, frame0 quando aplicável. Painel pode não ter sender.tab: não aplicar a regra antiga de owner=tabId a ele. Comandos de mutação são encaminhados ao runner vinculado e autenticado; páginas do Idealista não podem usar AUTONOMA_. Pedido repetido não cria outra aba técnica.

Runner usa COLETA_* após estender allowlist explicitamente para runner.html e validar binding/run/document/epoch. Apenas ele pode REQUEST/REPORT/SAVE_INTENT/SAVE_RESULT da execução005. Não tornar todo caminho chrome-extension confiável. Existing listeners COLETA_* continuam validando senders e todos contratos004.

START ACK é curto; trabalho segue no runner, não numa resposta de onMessage que dure toda a coleta. AUTONOMA_CHANGED{id,revision} é aviso sem dataset/segredo; painel refaz READ. Poll fallback1s enquanto visível e backoff se fechado; read passivo não renova autorização de rede.

Startup: recuperar summaries e badge; não criar runner autorizado nem chamar drive. Runner restaurado pelo Chrome sem binding do runId atual permanece inerte. Worker reiniciado durante mesmo browserRunId recupera vínculo mediante handshake; não iniciar um segundo drive.

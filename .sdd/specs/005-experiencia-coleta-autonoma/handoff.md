# Handoff — 005-experiencia-coleta-autonoma

**Último checkpoint — transição403→200, 2026-11-15**

Usuário esclareceu que a tela bloqueada é temporária e o site depois abre normal. Reproduzido com extensão real em site controlado: requestId/documentId iniciais ficavam fixos e o runner encerrava cedo. Corrigido por observação passiva até10s e prova do documento final da operação pendente, sem reload/fetch extra;429 e403 persistente preservados. Corrida pendingUrl do runner de Links também reproduzida/corrigida.218/218 e smokes de transição/4Links/coleta/autonoma dev/prod; último bundleproduction. MCP apenas releu página pública já normal (200/84links), sem clique instalado. Ler validation/links-transition-fix.md. Não limpar bloqueios anteriores nem declarar proxy real resolvido.58/64 e T052 parcial; gates anteriores permanecem abertos.

**Checkpoint posterior — 2026-11-15, MCP Playwright**

Adendo do screenshot: mensagem agora diz tentativa anterior e orienta confirmação. Smoke herdado ampliado prova confirmação elegível →84 links exibidos no painel real da extensão, com HTML público capturado e prazo vencido preparado somente em perfil temporário.212/212 e smoke dev/prod; logs links-inherited-recovery-*.log. Não confundir com clique instalado via MCP, ainda recusado pela conexão. Nenhum prazo real foi modificado.

Ler primeiro validation/links-mcp-live.md. MCP abriu a URL pública solicitada com HTTP200, função extractLinks do projeto retornou84/84 links da navegação; handler também retornou84, com API de validação simulada. A tentativa de abrir a interface chrome-extension pelo MCP foi recusada com Not allowed; clique no painel instalado não foi validado. Token de conexão não persistido. Isso não fecha o diagnóstico anterior407/403 do proxy.

Novo bug reproduzido: Lote403 deixa accessBlocked global e Links falha antes de criar sessão; a UI não oferecia recuperação sem ID. Código agora projeta recovery:confirm-access/prazo, pede confirmação explícita após espera e limpa somente marcador global elegível, sem alterar Lote bloqueado, checkpoints ou dados. Testes RED/GREEN:3 coordenador/helper+1painel;212/212 dev/prod, smoke de bloqueio herdado nos dois builds e quatro jornadas Links em produção. Travas001–005 íntegras. Perfil pessoal não alterado/recarregado; apenas metadados seguros e gravações locais de bloqueio inspecionados em leitura. Último bundleproduction;58/64 e T052 parcial, demais gates anteriores permanecem abertos.

**Checkpoint de execução — 2026-11-14**

Fases1–5 concluídas; coleta/retomada/painel/Configurações integrados. Usuário aprovou explicitamente a emenda mínima001; contrato/trava001 atualizados, demais contratos intactos. Cinco contratos005 verdes, suíte Node208/208 em dev/prod. Progresso58/64; T052 parcial. Último buildproduction. Diagnóstico de início corrigido; ver validation/links-start-fix.md e pendência nova R-019.

T052 prioritária: coleta agora usa runner.html?links=token em segundo plano; abre Idealista ativo e nunca carrega localidades.html/configuracoes.html para iniciar ou reportar falha. Entrada antiga corrigida e exportação separada. Quatro jornadas Links, exportação legada e abas passaram dev/prod; 208 testes verdes nos dois builds. Ler validation/links-direct-navigation.md. R-020 novo: worker-stop em autonoma.smoke intermitente; rodada finalprod passou, não fechar por retry. Captura real407/403 e gates anteriores seguem sem aceite. Último buildproduction.

T048 concluída após relato de proxy: provedor funciona; salvar não aplicava e UI não oferecia aplicação explícita. Novo Aplicar conexão salva usa revisão e bloqueio de coleta, mantém TEST_IP passivo, e direto remove somente proxy do app.185 testes e4 smokes afetados dev/prod verdes. Proxy do .env autenticado em Chrome157 real via novo botão, IP alterado e direto restaurado; somente api.ipify.org, perfil temporário, credenciais/IPs omitidos. Ver validation/proxy-fix-result.md. .env não configura a extensão: inserir valores em Configurações, salvar e aplicar; último bundle production.

T049 corrigiu o retorno invisível: mensagem global estava quase1000px acima do clique. Botão principal Salvar e testar conexão valida/salva/aplica/testa em ação explícita; resultado junto ao botão, progresso e orientação em caso de falha. Salvar configurações continua só salvando; Verificar IP ativo continua observacional, sem atribuir sucesso ao rascunho. Aplicar/desativar separados em Mais opções.185/185 e3 smokes afetados dev/prod verdes; novo botão comprovado com proxy real em Chrome157 production e resultado visível. Ver validation/proxy-feedback.md. Sem alterar background, segredos ou perfil pessoal. Gates anteriores seguem abertos.

Fase6 parcial: T044 pasta externa/reauthorização nativa e T045 leitor de tela/teclado/zoom real pendentes. Tentativa automática de picker não localizou a janela nativa; perfil de teste foi fechado sem prova de escrita. Roteiro interativo pronto: node tests/e2e/autonoma-native-filesystem.cjs --manual. Smokes finais e ressalva de intermitência do download antigo estão no plan/tasks e logs validation/. Manter Em Execução, sem aceite final/commit. Dados/perfis reais e alterações anteriores preservados. As informações abaixo retratam o planejamento original; plan.md/tasks.md prevalecem.

**Contexto**

T051 posterior: usuário preferia interface antiga com abas e confirmou que quer acompanhar municípios da fila. Recuperadas Links/Itens/Lote no painel, configuração visível/dedicada, resumo compacto e atual destacado/posição/páginas/anúncios/resultado. Ver na fila limpa filtros e localiza atual por ação; atualizações não reordenam nem roubam foco. Trocar abas não inicia/pausa coleta, retorno de Configurações conserva aba.189 testes e tabs/UI/core dev/prod verdes; evidência tabs-review.md. Estado global e gates anteriores preservados; último buildproduction.

T050 posterior: usuário pediu senha salva e olho. Persistência já existia; UI agora indica senha salva/máscara e revela por comando explícito somente em Configurações principal, com revisão. GET_SETTINGS/status continuam sem senha. Mostrar não cria edição; ocultar limpa valor revelado, mantendo senha digitada manualmente.187 testes e password/feedback/autonoma-ui verdes dev/prod. Ver validation/proxy-password.md; último buildproduction.

IdealistaScraper, branch feature/004-coleta-resiliente, JavaScript/Chrome MV3/Webpack. Status: Planejada,46 tarefas e12 gates (0/58). Próximo comando: /sdd-execute 005-experiencia-coleta-autonoma. Checkout contém alterações anteriores da004: preserve-as. Baseline248 arquivos em validation/planning-baseline.json; nenhuma alteração externa detectada durante o planejamento.

**O que a feature entrega**

- US1/P1: um comando descobre apenas localidades diretamente listadas na página atual e coleta seus anúncios; sem exportação intermediária.
- US2/P1: painel lateral recolhível; coleta continua com painel fechado por runner em aba técnica inativa. Após reiniciar Chrome, retomada manual.
- US3/P1: falha comprovadamente local deixa pendência e permite seguir; retomada individual/em grupo preserva checkpoint e mês. Bloqueio geral pausa tudo.
- US4/P1: Configurações dedicada, preservando valores, autorizações e contexto; salvar ajustes não inicia coleta.

**Leitura obrigatória, em ordem**

Na pasta005: spec.md (UX/aceite), plan.md (invariantes/riscos), tasks.md (fases/rastreabilidade), logic/execucao-e-recuperacao.md (lifetime/seleção/falhas), logic/interface-e-configuracoes.md (UI/settings), data-model.md (v2/compatibilidade), contracts/autonoma.md (APIs/ports), quickstart.md (gates). Depois .planning/memory/constitution.md. research.md justifica as escolhas de plataforma.

**Testes de contrato**

tests/contracts/005-experiencia-coleta-autonoma.test.cjs:5 casos; C1/fase2, C3+C5/fase3, C2/fase4, C4/fase5.
Comando: node --test tests/contracts/005-experiencia-coleta-autonoma.test.cjs.
Integridade: .\.planning\scripts\powershell\check-contract-tests.ps1 -Slug 005-experiencia-coleta-autonoma.
Fixtures travadas: tests/fixtures/autonoma.cjs, coleta-store.cjs e localidades-filesystem.cjs. Preservar também travas001–004, cujos comandos estão no quickstart. RED confirmado:5 erros not implemented; suíte anterior117/117 verde; buildsdev/prod aprovados.

**Stubs criados**

src/coleta-autonoma.js → createAutonomousCollection; src/coleta-view-model.js → buildCollectionView; src/coleta-settings.js → createCollectionSettings. Todos lançam not implemented, sem integração ao bundle; contratos/fixtures não podem ser editados.

**Armadilhas já mapeadas**

- Chrome>=141 e nova permissão sidePanel. Painel pode não ter sender.tab; owner é o runner autenticado, não um ID enviado pela UI.
- Uma sessão v2 para toda fila; manter domínio/orçamentos004, inclusive durante gravação. Nunca criar uma sessão por município.
- Documentos restaurados/READ/LIST não autorizam drive. IDs de abas sem prova não permitem takeover ou fechamento.
- Links sem quantidade entram na fila. Nome não identifica localidade; colisão de arquivo mantém resultado pendente para resolver destino explicitamente.
- config:005 é privado; API pública não devolve senha. Picker/reautorização exigem gesto direto na UI; handles não passam por mensagens.
- T039/T040 criarão smokes novos; fixture/API de teste não certifica painel nativo. Último bundle do planejamento: production.

**Pendências do Analyze**

Nenhuma.42FR e20SC mapeados; constitution pré/pós aprovada; cinco contratos com origem e tarefas. Pode seguir para execução.

**Gate de pronto**

Cinco contratos verdes e travas001–005 íntegras; npm.cmd test, npm.cmd run build:prod, node --test e todos smokes do quickstart nos dois builds. T043/T044/T045 são gates de Chrome/pasta externa/leitor de tela; não substituí-los por mocks/OPFS. Atualizar README, plan/tasks/backlog/handoff e evidências no Polish. Sem gate nativo novo concluído, manter Em Execução.
Correção posterior T052: mensagem genérica reproduzida após403 e segundo clique. Motivo era descartado antes da criação da sessão, e lançamento novo escondia a anterior. Sessão pendente agora permanece visível, diagnóstico tipado/HTTP/prazo e Ver detalhes e retomar sem rede automática; erro legado recupera última sessão pendente.200/200 dev/prod e três jornadas Links/tabs verdes em ambos; build final production. Ver validation/links-start-fix.md. R-019 novo:coleta.smoke dev falhou antes da primeira requisição na variante initial-403; isolado e produção instrumentada passaram, causa não determinada. Não fechar por retry. Gates reais/R-013 anteriores mantidos,58/64.


# Checkpoint de execução — 2026-11-14

Status Em Execução,58/64 checkboxes; T052 parcial, fases1–5 concluídas e fase6 parcial. Nenhum commit, push, troca de branch, alteração de dados reais ou perfil de usuário. T048/T049 validaram proxy/IP; T050 olho; T051 abas/fila; T052 corrige clique Links, mas captura real407/403 NÃO aprovada. A tabela preserva evidências anteriores; adendos prevalecem para limites atuais.

| Prova | Comando e resultado |
| --- | --- |
| Node/build dev | npm.cmd test:181/181,0skip; suite-dev.log |
| Node/build prod | npm.cmd run build:prod e node --test:181/181; build-production.log/suite-prod.log |
| Contratos005 |5/5 verdes na suíte completa;001 emendado com aprovação, demais contratos preservados |
| Travas | check-contract-tests.ps1 para001/002/003/004/005:PASS |
| Smokes dev/prod finais | localidades, lote, proxy, coleta-store, coleta, autonoma, autonoma-ui:todos PASS nos dois builds; logs smoke-*-dev/prod.log |
| Integração005 | Clique→fila, painel fechado, worker encerrado,404 local→próximo, retomada somente página2, quota→save-only sem HTTP, fechamento/reabertura do browser ativo→zero rede automática→retomada dos restantes. core-result.json |
| UI005 | Primeiro uso, validação/foco/draft, configurações confirmadas sem START,308 itens reais descobertos, filtros/acentos/detalhes/foco/contexto,320px/zoom CSS200%/reduced-motion. ui-result.json e PNG |
| Chrome instalado |157.0.8103.78:action/contexto SIDE_PANEL reais; fecha/reabre; coleta continua. native-panel-result.json/native-panel.md. Gravação desse roteiro é OPFS simulado |
| Revisão independente |4 Important corrigidos e revalidados; nenhum Critical/Important confirmado restante; review.md |

## Pendências que impedem aceite

- T044:picker/escrita externa, recusa/reautorização e save-only nativos. A automação não encontrou o seletor; não há prova de escrita externa. Roteiro interativo preparado em native-filesystem.md.
- T045:leitor de tela Windows, teclado/foco entre painel/site e zoom real do navegador; accessibility.md.
- Gate de estabilidade dos smokes:uma primeira coleta.smoke.cjs em dev expirou esperando download após restart. Repetição isolada, produção e rodada final dev passaram. Sem causa demonstrada para essa ocorrência; manter registrada como intermitência aberta em vez de aceitar somente o retry. Diagnóstico adicional foi adicionado ao teste, sem alterar assert/timeout.

O busy de retomada imediata do005 encontrado em produção foi reproduzido e corrigido por runnerLive/FINISHED; rodada005 posterior dev/prod passou. Não confundir essa causa corrigida com o timeout antigo de Downloads ainda sem causa.

Build deixado em production. O roteiro valida fixtures locais sem rede pública; não certifica coleta real do Idealista, proxy comercial, leitor de tela ou filesystem externo.

## Adendo T048 — proxy

Após relato do usuário, conexão salva/aplicada foi explicitada na UI, retorno à conexão do sistema corrigido e exclusividade antes de mutação do PAC protegida. Suíte passou185/185 em dev/prod, com4 smokes afetados verdes em ambos e travas001–005 íntegras. Provedor do .env e autenticação real no Chrome157 foram comprovados: novo botão altera IP; retorno direto restaura IP. Rede limitada a api.ipify.org, sem coleta no Idealista. Credenciais/IPs omitidos e perfil temporário removido. Resultado e limites em proxy-fix-result.md; build final production. Gates anteriores permanecem abertos.

## Adendo T049 — resultado visível

Reproduzido feedback fora da tela após clique. Novo Salvar e testar conexão orquestra salvar/aplicar/testar sem START e mostra progresso/resultado junto ao botão, com retorno visível e campos protegidos durante espera.185/185 Node dev/prod, proxy-feedback14 cenários + proxy-settings8 + autonoma-ui aprovados nos dois builds. Chrome157 real em production confirmou um clique, proxy ativo, mudança de IP, mensagem visível e retorno direto. Sem segredos/IPs nos artefatos. Detalhes, screenshots com dados fictícios e limites em proxy-feedback.md. Gates anteriores inalterados, build final production.

## Adendo T050 — senha salva/olho

Persistência preservada e indicada por máscara/aviso. Mostrar/ocultar senha digitada ou salva por ação explícita; comando privado restrito a Configurações principal e revisão corrente, GET_SETTINGS/status sanitizados.187/187 Node dev/prod e password11 cenários/feedback14/autonoma-ui verdes em ambos. Sem rede pública/dados reais; captura320px com dados fictícios inspecionada. Ver proxy-password.md. Gates anteriores permanecem abertos; build final production.

## Adendo T051 — abas e fila visível

Preferência do usuário: abas anteriores e acompanhamento de municípios, confirmado por pergunta estruturada. Recuperadas Links/Itens/Lote, Configurações visível e fila compacta com atual destacado, posição, páginas/anúncios e resultado.189/189 Node dev/prod, tabs/UI/core aprovados nos dois builds. Launchers existentes funcionam sem iniciar captura; alternância mantém a mesma execução até3 resultados salvos. Painel nativo Chrome157 production revalidado:action, fechamento, continuidade e reabertura,0pageerrors, OPFS simulado (tabs-native-prod.log). Travas001–005 íntegras; imagens revisadas em tabs-review.md. Sem coleta real/provedor; gates T044/T045/R-013 mantidos; build finalproduction.

## Adendo T052 — Links não era coleta

Teste anterior somente comprovava abrir exportação. Corrigido clique para motor de Links e nova jornada local completa:4 registros extraídos e exportados sem recoleta, sem exigir pasta para capturar, replay recusado.194/194 dev/prod e localidades/coleta/autonoma verdes. Site real ainda falha:coletor407, navegação simples403, curl CONNECT200/HTTP403; ipify200 não prova Idealista. T052 permanece parcial/aberta e R-018 registra divergência não explicada. Detalhes e evidências em links-flow-fix.md. Build finalproduction; demais gates mantidos.
## Adendo T052 — diagnóstico do início

Mensagem exata reproduzida após403/novo clique; motivo descartado e sessão anterior escondida. Preservação/diagnóstico/retomada manual corrigidos, inclusive erro legado.200/200 Node dev/prod; três jornadas Links e tabs passaram nos dois builds. Build final production. Detalhes/RED/limites em links-start-fix.md. R-019 nova intermitência em coleta.smoke dev antes da primeira requisição; produção instrumentada passou, causa segue aberta. Não equivale à captura real nem fecha T052/T044/T045/R-013/R-018.

## Adendo T052 — screenshot e navegação direta (2026-11-15)

localidades.html não é mais controlador do início:runner técnico dedicado abre Idealista ativo. Painel e entrada antiga corrigidos, exportação só por gesto separado.208/208 Node dev/prod; quatro jornadas Links, abas e exportação legada passaram nos dois builds. Corridas UI/pendingUrl cobertas por RED/GREEN. Limite:autonoma.smoke passou ao final mas houve falha intermitente de worker-stop, registrada como R-020 aberta. Captura real407/403 e demais gates anteriores permanecem pendentes. Ver links-direct-navigation.md; último buildproduction.

## Adendo T052 — MCP e bloqueio herdado (2026-11-15)

MCP Playwright acessou a URL pública solicitada com HTTP200; a função extractLinks do repositório extraiu84 registros únicos para84 links na navegação. Handler de conteúdo também retornou84, com validação do coordenador simulada. Interface chrome-extension recusada pelo MCP com Not allowed; clique instalado e configuração do proxy não comprovados por essa sessão. Artefatos públicos, imagem e limites em links-mcp-live.md/links-mcp-live-result.json/links-mcp-live-protocol.json. Token não persistido.

Reproduzida lacuna de recuperação: bloqueio de Lote impedia Links antes de criar sessão própria; UI agora oferece recuperação manual mesmo sem ID. Confirmação e backend mantêm prazo, exclusividade, relógio e orçamento; sessões anteriores preservadas.212/212 Node dev/prod, smoke herdado nos dois builds, quatro jornadas Links em produção, travas001–005 íntegras. Perfil pessoal preservado. Último buildproduction;58/64 e T052 parcial. Gates anteriores e divergência407/403 seguem abertos.

## Adendo T052 — documento final após403 inicial

Relato do usuário esclareceu transição automática do site403→página normal. Reproduzida em Chrome controlado; runner encerrava cedo e observador/prova ignoravam requestId/documentId novos. Corrigido com observação passiva até10s da mesma operação, sem nova navegação/fetch do app. Caso termina84links, uma tentativa controlada; variantes403 persistente e429 preservam pausa.218/218 dev/prod; quatro jornadas Links e coleta/autonoma passaram nos dois builds. MCP confirmou novamente página pública já normal200/84links, sem clique instalado. Ver links-transition-fix.md e logs links-transition-*.log. Corrida pendingUrl do launcher também corrigida com RED/GREEN. Último buildproduction;58/64, T052/gates e diagnóstico real do proxy ainda parciais. Nenhum dado/bloqueio pessoal alterado.


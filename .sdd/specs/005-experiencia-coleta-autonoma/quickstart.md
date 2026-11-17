# Quickstart — 005-experiencia-coleta-autonoma

## Prerequisites

Chrome desktop>=141, Node>=22.16.0, dependências pelo lockfile; perfil temporário e pasta de teste externa vazia. Preservar perfil, dados, IndexedDB, credenciais e pastas .data reais do usuário. Não pedir novamente o aceite antigo002/003; validar as superfícies novas desta feature. Nenhuma coleta em escala/proxy comercial está autorizada por este roteiro.

## Automated Gates

~~~powershell
npm.cmd test
npm.cmd run build:prod
node --test tests/contracts/005-experiencia-coleta-autonoma.test.cjs
.\.planning\scripts\powershell\check-contract-tests.ps1 -Slug 001-reorganizacao-node-webpack
.\.planning\scripts\powershell\check-contract-tests.ps1 -Slug 002-exportacao-localidades-pasta-autorizada
.\.planning\scripts\powershell\check-contract-tests.ps1 -Slug 003-exportacao-lote-municipios
.\.planning\scripts\powershell\check-contract-tests.ps1 -Slug 004-coleta-resiliente
.\.planning\scripts\powershell\check-contract-tests.ps1 -Slug 005-experiencia-coleta-autonoma
node tests/e2e/localidades.smoke.cjs
node tests/e2e/lote.smoke.cjs
node tests/e2e/proxy.smoke.cjs
node tests/e2e/proxy-settings.smoke.cjs
node tests/e2e/proxy-feedback.smoke.cjs
node tests/e2e/proxy-password.smoke.cjs
node tests/e2e/coleta-store.smoke.cjs
node tests/e2e/coleta.smoke.cjs
node tests/e2e/autonoma.smoke.cjs
node tests/e2e/autonoma-ui.smoke.cjs
node tests/e2e/autonoma-tabs.smoke.cjs
node tests/e2e/links-one-click.smoke.cjs
node tests/e2e/links-popup-navigation.smoke.cjs
node tests/e2e/links-start-errors.smoke.cjs
node tests/e2e/links-connection-error.smoke.cjs
~~~

Repetir suíte Node e smokes nos dois builds. Smokes005 já existem. O painel real é verificado separadamente por node tests/e2e/autonoma-native-panel.cjs, usando Chrome instalado/perfil temporário, action e contexto SIDE_PANEL; a gravação desse roteiro é OPFS simulado.

T049: em Configurações, preencher proxy e clicar Salvar e testar conexão deve mostrar progresso e resultado junto ao botão. IP desconhecido deve mostrar falha/orientação sem desativar PAC ou afirmar senha inválida; editar após sucesso remove a confirmação anterior. Salvar configurações continua apenas guardando valores; Verificar IP ativo não aplica/valida rascunhos. Aplicar/desativar separados em Mais opções. Provas dev/prod e teste real específico já autorizado pelo usuário em validation/proxy-feedback.md; a autorização real está na conversa, não neste roteiro.

Picker/escrita externos: node tests/e2e/autonoma-native-filesystem.cjs --manual. Selecionar somente a pasta temporária informada. A tentativa automática via UI Automation falhou ao localizar o picker; T044 não foi aceito. Leitor de tela/zoom real/teclado ainda exigem o roteiro humanoT045. Ver validation/native-filesystem.md e accessibility.md. Não substituir essas provas por OPFS/zoom CSS.

## Deterministic End-to-End

- Servir fixtures no domínio Idealista interceptado pelo harness; abortar toda rede externa, inclusive diagnósticoIP. Usar APIs públicas e UI, sem fabricar progresso em storage.
- Origem com A/B/C e link repetido, quantidade ausente e níveis inferiores: um clique inicia3 itens únicos, sem abrir catálogo nacional/recursão; mudar origem depois do aceite não muda fila.
- Fechar documento do painel, navegar outra aba e matar worker: runner continua no mesmo browserRunId; reabrir observa progresso/arquivos. Fechar/restaurar navegador: zero rede até Retomar.
- B404 após página1: C avança; B fica pending. Retomar B continua página2; Retomar pendentes não repete A/C.
-429/challenge/login/proxy, limite de janela, quota, falha de checkpoint: nenhum item seguinte dispara; passar prazo sozinho não inicia.
- Writer falha/close ambíguo: resultado durável; reautorizar/reconciliar e salvar sem buscar anúncios. Virada de mês preserva pasta original.
- Homônimos e paths colidentes: ambos itens permanecem distintos, nenhum resultado sobrescreve outro da mesma execução silenciosamente; resolver pasta desse item sem recolher.
- Primeiro uso/config inválida/conflito/dirty: orientação e retorno, nenhum START só por salvar; senha ausente no load público/logs/DOM de progresso.
-308 localidades, nome longo,320px e zoom200%; busca/filtros,6/10completas e pending separadas; atualizações não perdem foco/scroll/detalhe.

## Native Chrome Gate

Carregar extensão unpacked com bundleprod em perfil temporário. Registrar versão, manifesto, permissão sidePanel, console/worker e zero erros. Usar navegação controlada; site real exige autorização e limites próprios.

1. Clicar na action abre painel lateral REAL ao lado da página, sem popup intermediário. Recolher/fechar pela UI/nativo e abrir novamente; conferir execução, sinal da action e foco na página.
2. Primeiro uso: escolher pasta TEMPORÁRIA via picker nativo. Cancelar mantém anterior. Configurar pasta não inicia coleta.
3. Autorizar, iniciar, fechar painel e continuar navegação; conferir que a página do usuário não muda e arquivos completos são gravados. Não confundir a aba técnica com uma tela que o usuário precisa operar.
4. Reabrir Configurações e reutilizar pasta; revogar apenas a permissão da pasta de teste no perfil temporário, reautorizar por gesto na UI e salvar checkpoint preservado sem recoleta.
5. Fechar Chrome durante checkpoint confirmado; restaurar abas e verificar que runner restaurado está inerte. Retomar manualmente preserva mês/origem/contadores.
6. Teclado e leitor de tela no Windows: rótulos, anúncio de pausa/intervenção, foco de dialogs/restauração, sem anúncios a cada segundo;320px/zoom200%, preferência de movimento reduzido.
7. Outras ferramentas: exportação de localidades, lote/importação e Itens continuam acessíveis; confirmar comportamento anterior de gravação/substituição sem limpar dados.

Registrar separadamente prova de painel nativo, filesystem externo e leitor de tela, com resultados e pendências. Não inflar OPFS/mock para escrita em pasta Windows nem nova UI para coleta real no Idealista.

## Checkpoint de execução

Fases1–5 funcionais. Contratos005:5/5; emenda001 mínima aprovada explicitamente e aplicada, demais travas preservadas. Revisão independente e correções em validation/review.md. Logs suite-dev/prod, smoke-*-dev/prod e resultados core/ui/native-panel registram os comandos realizados.

Painel instalado Chrome157 foi comprovado sem rede pública. Filesystem externo/reautorização e leitor de tela seguem pendentes; manter Em Execução. Uma primeira rodada antiga coleta.smoke teve timeout no evento de download, seguida de repetição dev e prod verdes: registrar como intermitência aberta enquanto não houver causa demonstrada, sem transformar o retry em aceite irrestrito.

## Release

Todas seis fases e gates de tasks.md verdes, contratos5/5 e travas001–005 intactas, buildsdev/prod, smokes, Chrome nativo e quickstart. Atualizar README/plan/tasks/backlog/handoff com evidências e limitações. Sem esse gate nativo, permanecer Em Execução e declarar a pendência específica. Site/proxy comercial não são gates desta feature nem são certificados por esta prova.

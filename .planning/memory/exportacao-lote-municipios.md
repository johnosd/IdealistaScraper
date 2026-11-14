# Feature 003 — destino mensal de municipios e revisão de dados

2026-11-13: usuário pediu salvar arquivos individuais do lote em
`.data/municipios/{anomes}` e escolheu “Substituir sem confirmar”. Manter nomes
`<nome>-Paginas<N>.json` e mês local do início do lote. Permissão de pasta
municipios separada de localidades; sem download automático de reserva.

Feature especificada em `.sdd/specs/003-exportacao-lote-municipios/spec.md`.
Próximo estágio: sdd-plan. Não há código implementado para a 003 ainda.
Necessário preservar resultado pendente e não consumir item como salvo antes
do fim da escrita. Seleção/reautorização não pode perder os dados ao trocar foco.
Definir no plano superfície durável e recuperação de gravação.

Usuário acrescentou revisão real de uma localidade usando a skill do projeto
`.claude/skills/playwright-site-debug`. Alvor inspecionada em duas páginas com
Playwright MCP; função extrairDaRaiz atual executada diretamente no DOM.
30+20 registros, 50 IDs únicos, zero identidade/preço ausentes, próxima página
correta e fim null. Falha: imagens null nos 50 apesar de contador atual presente;
código consulta seletor --old ausente. Correção desse campo incluída na 003,
mantendo schema e fallback legado. Cinco descrições vazias tinham fonte vazia.
Descrição da listagem é resumo, não texto integral do detalhe.

Evidência e limites em listing-audit.md. Não foi executado crawler/lote/proxy no
site real, apenas inspeção/extração isolada das duas páginas. Nenhum .data foi
escrito pelo agente. O hash do catálogo local mudou desde a rodada anterior,
fora desta revisão; não restaurar alterações concorrentes do usuário.

## Planejamento e complemento de auditoria

2026-11-13: sdd-plan executado na main. plan/tasks/data-model/contracts/logic/
quickstart/handoff criados. Status Planejada. Cinco contratos 003 travados com
fixture filesystem compartilhada; todos RED por not implemented nos dois stubs
não conectados src/lote-export.js e src/lote-session.js. Build dev e 31 testes
anteriores passaram; integridade 001/002/003 confirmada. Não há implementação003.

Usuário esclareceu que deseja procurar também campos ainda não coletados.
FR-019/020 e SC-007/008 acrescentados: inventário e correção de estacionamento.
Complemento Playwright na página2 de Alvor encontrou sete cards com Garagem
incluída no detalhe, mas estacionamento null. Também fotos/legendas, vídeo e
atributos técnicos não exportados; terreno/elevador/data em texto composto,
sem campos específicos. Novos candidatos apenas documentados; schema17 mantido.
Tentativa de reabrir página1 retornou403/Just a moment; inspeção interrompida.

Analyze A001 MEDIUM: FR-012 fala em erros de coleta; crawler legado pode ocultar
falha de paginação e retornar sucesso parcial. Definir alcance antes de execute,
conforme pendência em handoff. Não alegar completude ou correção desse bug.

## Execução 003

Usuário solicitou sdd-execute em modo contínuo e resolveu A001 explicitamente:
propagar falhas e impedir gravação parcial na003. T022 acrescentada; modo estrito
requireComplete no crawler para Lote rejeita rede/HTTP/HTML inesperado/página
seguinte vazia. Coletor não reinjeta após erro funcional. Outros bugs/proxy fora
de escopo permanecem. Itens conserva destino de Download e recebe fotos/garagem.

US1/US2/US3 concluídas: lote.html + entry src/lote.js; writer/store/session/
collector em src/lote-*.js. Popup Lote é launcher. Web Locks separam dono e writer;
IDB municipios isolado. Falha de save mantém pendente; falha de commit após save
repete apenas commit, conservando nome da base efetivamente gravada mesmo se
usuário trocar pasta nesse intervalo. Depois de concluir, Ativar esta tela
reivindica fila fresca antes de novo lote. Fechar página perde pendente em memória.

48/48 testes verdes com npm.cmd test; builds dev/produção verdes. E2E em produção:
localidades8 e lote11 grupos, zero Downloads no lote, um esperado em Itens, zero
pageerrors. Travas001/002/003 íntegras; contrato e fixture nunca editados. Artefato
final dist está em produção. Evidência: validation/automated.md na feature003.

Polish automatizado concluído; falta T021/pasta externa real no Chrome, solicitado
ao usuário. Manter Em Execução até validação. Não reutilizar aceite manual002 como
prova003. Catálogo .data não modificado; mesmo hash do planejamento. Sem commit.

## Falha no teste nativo — Terceira

Usuário reportou ausência de CTA em Terceira. Inspeção real do índice encontrou
um CTA válido Ver17casas e apartamentos; a função real o reconheceu. Bloqueio403/
Just a moment ocorreu em São Miguel durante a investigação, não foi comprovado
como causa da falha original de Terceira. Sem repetir/coletar anúncios reais.

T023 implementada na003: aguardar DOM até10s, distinguir desafio/bloqueio, informar
título/URL e manter/ativar aba própria com erro de resolução. Continuar reutiliza
essa aba só se ainda existe e mantém URL; não navegar aba alterada pelo usuário.
Sem adivinhar URL por corte de sufixo ou contornar CAPTCHA. Ver
validation/terceira-navigation.md. 51/51, builds verdes, E2E lote13 grupos em
produção, travas íntegras. Ainda falta repetir validação nativa; não convergir.

## Reteste nativo: escrita confirmada

2026-11-13: usuário informou que testou um item e salvou na pasta. Registrar
como escrita real confirmada, sem presumir Terceira ou conteúdo/nome exatos.
Evidência em validation/manual-chrome.md. T021 ainda aguarda reabertura/reutilização
e reautorização nativas; não inflar um item para prova de todos os cenários.

## Aceite final da execução003

2026-11-13: usuário confirmou reabertura/reutilização e reautorização nativas
após já confirmar um item salvo na pasta. T021 e release fechados; feature
Implementada31/31. Travas001/002/003 conferidas novamente e íntegras. Evidência
em validation/manual-chrome.md; próximo estágio sdd-converge. Sem commit/push.
Não ampliar o relato para todos os itens do catálogo ou proxy real.

## Convergência003 — pendente

2026-11-13: sdd-converge auditou código/requisitos, confirmou contratos003 5/5
verdes e trava íntegra, sem atalhos de teste nas unidades. Achado acionável:
autoload migrado na T007 usa `.breadcrumb-dropdown-subitem`, divergindo do
seletor anterior `.breadcrumb-dropdown-element.highlighted ul.breadcrumb-dropdown-subitem-list > li`.
Reprodução offline com a função real: formato anterior contém2 itens; função
atual retorna []. Nenhum teste existente aciona loteAutoLoad.

C001/HIGH compatibilidade, C002/MEDIUM cobertura. Phase5:Convergence anexada a
tasks.md com T024/T025; tarefas anteriores preservadas byte a byte. Status
Convergência Pendente31/33, sem editar código nem README. Próximo comando:
sdd-execute003 em modo contínuo para restaurar autoload/testar, depois convergir.
Aceite manual de escrita/reabertura/reautorização continua registrado; não pedir
novamente sem alteração que o invalide. Não confundir com cobertura do autoload.

## Retomada execute — Phase5 concluída

2026-11-13: T024/T025 implementadas em modo contínuo. Autoload usa novamente o
seletor do breadcrumb highlighted e span breadcrumb-navigation-sidenote. E2E com
botão real RED antes da correção (lista vazia), depois GREEN: origem mesmo com
Lote ativo, dois itens, contagens17/1.234, ordem, UTF-8, texto/storage e preservação
em vazio/erro. Ajuste do teste novo compara JSON semanticamente, não ordem de chaves.

51/51 e builds dev/prod passaram; produção E2E lote14/localidades8 verdes, zero
pageerrors; travas001/002/003 íntegras. Evidência validation/autoload-convergence.md.
Feature Implementada33/33; próximo estágio sdd-converge para reavaliar C001/C002.
Aceite manual anterior mantido, sem pedir novamente. Sem commit/push; dist produção.

## Convergência final — feature003

2026-11-13: segunda auditoria sem novas lacunas; C001/C002 encerradas por
T024/T025. Contratos003 reexecutados 5/5 e E2E produção lote14 aprovado, sem
pageerrors/Downloads do lote. Evidências anteriores: 51/51 Node, builds dev/prod,
localidades8 e aceite nativo de escrita/reabertura/reutilização/reautorização.
Status final Convergida33/33; Resultado Final anexado ao plan e mitigações
confirmadas. tasks.md byte-idêntico; README já atual, sem alteração adicional.
Permanecem os limites: causa original Terceira indeterminada, sem comprovação de
todo o catálogo/proxy real; bloqueios do site não são contornados. Sem commit/push.

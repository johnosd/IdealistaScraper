# Início de Links: mensagem genérica — 2026-11-14

Relato: “Não foi possível iniciar a coleta. Confira a conexão e tente novamente.” Reproduzido exatamente com extensão real e resposta HTTP403 controlada, sem rede pública: primeira coleta ficou blocked/access_blocked; segundo clique abriu outro controlador, START recusou pelo bloqueio persistente, localidades.js descartou reason e LINKS_FAILED guardou apenas error=true. LINKS_READ perdeu a sessão anterior e a UI atribuiu o erro à conexão. Não significa que essa seja a única causa possível no Chrome do usuário, que não foi inspecionado.

Correção em T052: manter sessão pendente e caminho de recuperação; mostrar motivo, HTTP e elegibilidade; ação explícita Ver detalhes e retomar abre a sessão sem rede. Bloqueio continua exigindo confirmação de acesso e espera obrigatória. Recusas sem sessão conservam motivo/etapa/prazo de catálogo. Aplicação da conexão no Chrome, leitura de configurações, timeout/fechamento do controlador e limite de sessões têm orientação própria. Erro legado tenta recuperar a última sessão pendente; só reutiliza controlador de outro lançamento com browserRunId compatível. Gerenciar sessões abre controle sem iniciar captura. Nenhum erro bruto/credencial é devolvido por esses diagnósticos.

Revisão final: sem lançamento em storage.session após reiniciar Chrome, um clique também preserva a última sessão de Links pendente (regressão unitária RED/GREEN). O controle legado mostrava “Pronta para coletar” na recusa connection_setup_failed; passou a mostrar “Coleta não iniciada” e a mesma orientação específica, com regressão E2E RED/GREEN. Travas001–005 verificadas e íntegras.

## Evidências

- RED E2E: HTTP403 → segundo clique → state=error, records=[], total=0, texto idêntico ao relatado; uma requisição total. O novo teste falhou ao exigir a informação de acesso recusado. RED unitário: motivo/prazo descartados, controlador fechado continuava preparing, falha de conexão retornava erro genérico, sessão legada não era recuperada e gestão sem sessão retornava missing.
- GREEN: `npm.cmd run build` e `node --test`:200/200,0skip; `npm.cmd run build:prod` e `node --test`:200/200,0skip. Logs links-start-build/suite-dev/prod.log. Build final production.
- `node tests/e2e/links-start-errors.smoke.cjs`:PASS dev/prod. HTTP403 preserva id/motivo/prazo, segundo clique não cria controlador/requisição adicional, detalhes não consultam o site, retomada exige confirmação que foi cancelada no teste. Uma requisição controlada. links-start-errors-dev/prod.log.
- `node tests/e2e/links-connection-error.smoke.cjs`:PASS dev/prod. Falha simulada na API de proxy do Chrome aparece como connection_setup_failed, etapa start,0requisições; erro privado não vaza. Restauração da API e nova tentativa explícita extraem4 registros. Não é prova de proxy comercial. links-start-connection-dev/prod.log.
- `node tests/e2e/links-one-click.smoke.cjs`:PASS dev/prod. Uma navegação/4registros, resultado preservado e exportação posterior sem recoleta. links-start-happy-dev/prod.log.
- `node tests/e2e/autonoma-tabs.smoke.cjs`:PASS dev/prod,5requisições controladas,0pageerrors. links-start-tabs-dev/prod.log.
- links-start-blocked-360.png inspecionada:mensagem, prazo e ação de detalhes visíveis, sem overflow horizontal.

## Limites e pendências

R-019 novo: `coleta.smoke.cjs` falhou em dev na variante initial-403, em waitState linha56:mensagem “Ação de coleta recusada ou indisponível.”, sessão running/revision1/epoch1 e requested=confirmed=0. A falha aconteceu antes da primeira requisição; não há evidência suficiente para atribuir a REGISTER ou outra ação. O teste isolado com rastreamento passou e mostrou START/READ/REGISTER/REQUEST/REPORT normais. Em produção, mesma jornada completa com rastreamento dos comandos passou (links-start-core-prod-diagnostic.log). Esse resultado NÃO fecha a intermitência de dev; causa permanece aberta, separada do timeout de download R-013. A instrumentação foi adicionada em memória ao teste, sem alterar código/testes travados.

Nenhuma nova requisição ao Idealista/proxy comercial nesta correção. Evidências reais anteriores407/403 continuam impedindo afirmar captura real bem-sucedida. Não foram limpos dados, configurações, senhas ou perfil pessoal. T052 continua parcial,58/64; T044/T045/R-013/R-018/R-019 permanecem abertos.

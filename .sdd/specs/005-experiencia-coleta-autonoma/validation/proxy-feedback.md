# Retorno visível da conexão — T049 — 2026-11-14

Origem: usuário informa que preenche usuário/senha, clica e não vê se funcionou. Reprodução em viewport360×720: após salvar, settings-status está em y=-1402; após Verificar IP, resultado em y=-993 e botão em y=367. Nenhum pageerror. proxy-feedback-before.png. Causa confirmada: retorno global fora da área visível, ausência de progresso e aplicação sem teste conclusivo.

Correção delimitada ao formulário de Configurações: resultado junto à conexão com estado textual/persistente, progresso imediato e prevenção de comandos simultâneos. Nova ação explícita Salvar e testar conexão valida/salva o formulário, aplica revisão salva e consulta IP; nenhuma coleta. Salvar configurações continua sem aplicar/testar. Verificar IP continua observacional. Ações separadas aplicar/desativar ficam em Mais opções. Sucesso de PAC não equivale a conexão confirmada; sem resposta de IP, mostrar teste não confirmado e orientação sem inventar diagnóstico de senha inválida.

Arquivos: configuracoes.html, src/configuracoes.js, src/coleta.css e regressão tests/e2e/proxy-feedback.smoke.cjs; atualizar smoke anterior para abrir Mais opções. Sem alterar background, contratos/fixtures/travas, permissões, dados reais ou .env. Prova adicional real restrita ao mesmo endpoint já autorizado se necessária, sem credenciais/IP nos artefatos.

Critérios: botão próximo aos campos; mensagem visível no mesmo viewport após clique; estados salvando/aplicando/testando/sucesso/falha; campos e botões protegidos enquanto pendente; validação/conflito não aplicam nem sondam; mudar rascunho invalida confirmação visual anterior; falha mantém PAC e oferece nova tentativa; zero START. Testar320px e zoom CSS200%, buildsdev/prod e suíte Node. Gates nativos anteriores permanecem pendentes.

## Resultado

Corrigido e verificado. Sem mudanças no backend ou contratos. Ações separadas preservadas em Mais opções de conexão; Verificar IP ativo não aplica/valida rascunhos. Aplicar isoladamente indica teste pendente, sem falso sucesso de rede.

| Validação | Evidência |
| --- | --- |
| RED antes da correção | Novo teste falhou pela ausência da ação explícita perto dos campos; proxy-feedback-red.log. Reprodução visual inicial registrada acima. |
| Node e builddev | npm.cmd test:185/185, zero skip/falhas; proxy-feedback-suite-dev.log. |
| Node e buildprod | npm.cmd run build:prod + node --test:185/185; proxy-feedback-build-prod.log e proxy-feedback-suite-prod.log. |
| DOM/Chrome APIs com IP simulado | node tests/e2e/proxy-feedback.smoke.cjs:14 cenários aprovados dev/prod; proxy-feedback-result.json. Progresso, bloqueio durante espera, sucesso, falha, viewport,320px/zoom CSS200%, rascunho não certificado por teste passivo, conflito, direto e atividade. |
| Regressão interface existente | proxy-settings.smoke.cjs:8 cenários dev/prod e autonoma-ui.smoke.cjs:PASS dev/prod; proxy-feedback-ui-dev/prod.log. |
| Chrome157/proxy real, buildproduction | node .sdd/specs/005-experiencia-coleta-autonoma/validation/proxy-feedback-real.cjs --real:um clique confirmou proxy, alterou IP e manteve mensagem visível; retorno ao sistema confirmado. proxy-feedback-real-result.json. |
| Inspeção visual | proxy-feedback-success-360.png e proxy-feedback-error-320.png inspecionados; resultado junto aos botões e sem overflow. Apenas dados fictícios. |
| Integridade e segredos | Travas001–005 íntegras; varredura134 arquivos textuais sem senha/IP do provedor, .env ignorado. |

Prova real restrita a api.ipify.org, sem coleta no Idealista e sem screenshots de dados reais. Credenciais lidas somente do .env em memória; artefatos reais contêm booleanos, sem valores/IP. Perfil Chrome temporário removido. O teste de IP desconhecido não identifica sozinho senha incorreta ou causa da falha; UI oferece orientação sem inventar diagnóstico.

Último buildproduction. Feature permanece Em Execução com T044/T045 e R-013 anteriores abertos; esta correção não fecha gates de leitor de tela, filesystem externo ou estabilidade de download.

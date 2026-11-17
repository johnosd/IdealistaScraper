# Diagnóstico de proxy — 2026-11-14

Origem: relato do usuário após configurações005; teste real autorizado com PROXY_CHEAP_IP/PORT/USER/PASS do .env. Variáveis presentes; nenhum valor/credencial/IP incluído em artefatos.

Veredito: valid para lacuna de UX/estado e conexão direta; provedor real e autenticação Chrome funcionam. Severidade medium.

Reprodução real: curl por stdin recebeu HTTP200 via proxy e IP diferente do direto. Chrome157 temporário: AUTONOMA_SAVE_SETTINGS confirmou saved mas PROXY_STATUS.enabled=false e TEST_IP continuou direto; ENABLE_PROXY explícito confirmou enabled=true e TEST_IP verificou IP diferente. Evidências proxy-provider-result.json e proxy-chrome-before-fix.json; somente api.ipify.org acessado, nenhuma coleta no Idealista.

Salvar sem aplicar é decisão vigente (preservar). Defeito de UX: não há ação para aplicar conexão salva antes do teste; diagnóstico só observa conexão ativa sem explicar diferença suficientemente. Defeito adicional comprovável no código: prepare(false) retorna sem remover o proxy anterior do app.

Remediação na taskT048 da feature ativa:
- Ação explícita Aplicar conexão salva, usando configuração privada confirmada/CAS, sem START, sem senha no retorno.
- Manter TEST_IP observacional e salvar sem efeito no PAC. Explicar rascunho/salvo/aplicado e falhas.
- prepare(false) remove somente proxy próprio; respeitar controle externo. Rechecar exclusividade antes de aplicar em begin para não alterar sessão ativa.
- Regressões unitárias e E2E com proxy fictício sem rede; validação real posterior bounded usando somente .env e api.ipify.org.

Arquivos: src/background.js, src/configuracoes.js, configuracoes.html; testes unit/proxy-background, novo E2E proxy-settings e scripts de diagnóstico em validation. Sem alterar contratos, permissões, .env ou perfil real.

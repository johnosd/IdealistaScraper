# Revisão independente — Phase10

2026-11-14. Revisor com contexto novo; somente leitura; escopoC-001/C-002/C-003.
Sem alterações, commits ou revisão de dados pessoais. Testes estreitos inicialmente4/4.

AchadoMEDIUM: o rethrow sanitizado em coleta-runner removia o nome
NotAllowedError/SecurityError. localidades.failure depende dessa categoria para
marcar permissão prompt e habilitar Reautorizar. Reprodução confirmou nome Error,
apesar de evento permission_required persistido corretamente.

Correção: nova exceção com mensagem sanitizada preserva somente nomes DOM
allowlisted. Teste observou RED Error!=NotAllowedError; depois GREEN. Revisor
confirmou por inspeção e5/5 testes estreitos. Nenhum outro achado acionável
confirmado no escopo. Owner/epoch/intent/allowlist, preservação de checkpoint e
limpeza da razão somente após receipt foram conferidos.

Revisão final do harness: reter resposta READ depois do terceiro commit não
fabrica progresso, não altera storage nem autoriza quarta reserva. Executor vivo,
worker parado, restart no mesmo perfil e retomada manual4 continuam verificações
reais. Aceite explícito de substituição OPFS no retry mantém o writer real.

# Validação manual no Chrome — 003

2026-11-13, relato direto do usuário após os ajustes T023:

> fiz o teste para 1 item e ele salvou na pasta

Confirmado pelo relato: processamento de um item e gravação em pasta real.
Isso acrescenta prova nativa de escrita ao E2E com OPFS/seletor simulado.
O usuário não identificou a localidade, nome/conteúdo do arquivo ou caminho
absoluto; não presumir que era Terceira nem afirmar inspeção independente do JSON.

Em seguida, ao ser solicitado a conferir reabertura/reutilização do destino e
reautorização nativa, o usuário respondeu: “sim confirmado”. Esses pontos do
gate T021 ficam aprovados por confirmação direta do usuário, sem inspeção
independente do agente no Chrome pessoal.
Overwrite, retry, falhas de paginação e concorrência possuem prova automatizada;
o relato de um item não amplia essa prova a um lote completo ou proxy real.

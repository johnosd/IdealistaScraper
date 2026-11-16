# Revisão independente da execução004

2026-11-14; contexto novo; checkout somente leitura; sem agentes implementadores.
Revisor leu spec/plano/constitution/fontes e executou16testes estreitos (todos verdes).
Não executou build nem alterou arquivos. Alterações anteriores à004 foram distinguidas.

## Achados e resolução

1. Important: requestPage pausava em teto/clock sem liberar domain.active. Reprodução
   com maxPagesPerRun=1 retornava busy ao iniciar outro modo. Novo teste coleta-rate
   observou RED busy!=started; correção liberou apenas quando não há inFlight; GREEN.
2. Important: painel do Lote ignorava autoridade owned da fila003. Resolvido com
   canMutate no workflow/painel e guard em save/onSaved, preservando list/read.
   Novo teste ownership observou RED (mensagens permitidas), depois GREEN. E2E
   coleta-store verifica duas telas, handlers mesmo com dispatchEvent e storage intacto.
   Gate Lote detectou uma regressão adicional ao reativar: refresh de sessão saved
   liberava o lock novamente. Resolvido liberando somente após projeção concluída;
   RED preservado em dev-lote-authority-followup-red.log e gate reexecutado verde.
3. Observação de UX: prazo persistente só aparecia ao tentar retomar. Reclassificada
   pelo executor como requisito FR-006; eligibility passou ao resumo e à UI.
   Novo runtime test observou RED undefined.until e GREEN; E2E exige prazo sem retry.
4. Minor: UI não imprime durationMs já persistido. Não impede retomada nem limitações;
   melhoria visual registrada, sem expandir esta passagem para refazer apresentação.

## Descobertas adicionais nos gates

- Descarte de owner encerrado recusava a tela nova. Teste RED→GREEN; transferência
  só após verificar ausência do dono e encerrar executor próprio comprovado. Não
  exige retomar rede/proxy compatível para descartar dados explicitamente.
- Intent inválido agora é recusado por shape/caminho/bytes/digest calculados sobre
  os registros reais. Pausa durante close confirma arquivo/fila e não inicia o seguinte.
- Teto de metadados é verificado também no start, antes de ocupar o domínio (RED→GREEN).
- Removidos crawler/partial-download mortos; STOP_AND_DOWNLOAD vazio do contrato001
  preservado. Desativação explícita do proxy fica na aba Proxy e respeita coleta ativa.

## Limites

Sem prova comercial, site atual ou aprovação nativa inventada. O gate nativo está
registrado separadamente. Não foi feita segunda revisão/agente nem commit automático.

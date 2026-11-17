# Handoff — execução004

## Estado atual

Branch `feature/004-coleta-resiliente`, HEAD-base `fffb4458951639bee7587596ec94aedf3ec4d1b6`.
Sem commit. Preservadas alterações anteriores de proxy/bugs/contrato001/lock001/backlog.
Fases1–10 completas, incluindo T039 nativo e T043–T045 do converge.58/58.
Correções de C-001/C-002/C-003 passaram em117/117 testes e41E2E por build,
com revisão independente e quatro travas íntegras. Último build:production.
Próximo:sdd-converge para reauditar as correções. Ver
validation/convergence-execute-summary.md; relatório anterior de achados foi
preservado como histórico. Sem commit/merge ou prova comercial.

## Leitura para retomar

1. tasks.md (fonte da verdade) e plan.md (estado/risco/decisões acumuladas).
2. validation/convergence-execute-summary.md e convergence-code-review.md;
   execute-summary.md/code-review.md guardam a execução original.
3. spec.md, data-model.md e contracts/coleta-runtime.md/logic/*.md se houver decisão.
4. quickstart.md para o gate nativo e comandos.

## Implementação

Núcleo transacional lazy IndexedDB separado de transporte, policy/classification,
proxy/IP e UI. Links/Itens/Lote passam por reserva antes da rede. Itens tem página
durável e confirmação humana de Download. Checkpoints agregam deltas/hash e
recuperam próximo destino/mês/custo; nunca retomam rede no boot. Intent/receipt e
pendingProjection/ACK separam arquivo confirmado da projeção legada da fila.

Proxy usa revisão efetiva opaca, snapshot/auth recuperáveis e guard antes de start,
reserva e dispatch. Teste manual de IP preserva configuração; automático é opt-in
com marker persistido antes do fetch e deadline5s. Sem novo pacote/permissão.

## Evidências confirmadas

- npm.cmd ci: instalação reproduzível,0vulnerabilidades.
- npm.cmd test: development+112/112 testes.
- npm.cmd run build:prod e node --test: production+112/112.
- Travas001/002/003/004 íntegras,17contratos no total.
- Cinco smokes em cada build: localidades8,lote14,proxy6,coleta-store5,coleta7:
  40cenários/build e0pageerrors. Logs dev-*.log/prod-*.log em validation/.
- Restart REAL Chromium no mesmo perfil e mesma extensão/path, sem reinstalar nem
  limpar dados: nenhuma rede no boot; resume manual na página4, URLs1–4 uma vez.
- Erro QuotaExceeded injetado aborta transação IndexedDB real e preserva página1.
  Isso não é medição de quota física esgotada.
- Revisão independente somente leitura:2Important corrigidos com RED→GREEN;
  elegibilidade FR-006 passou ao resumo/UI. Minor de apresentação da duração
  registrada, sem requisito de redesenhar o diagnóstico.
- preservation.json confirma11artefatos inalterados, inclusive manifest/packages,
  writers e stores002/003. git diff --check exit0; avisosLF/CRLF não são falhas.
- Último build:production. dist gerado, sem edição manual. Nenhuma coleta pública
  ou proxy comercial foi executado.

## Gate nativo aprovado

T039 usa `node tests/e2e/coleta.native.cjs`: Chromium visível, perfil temporário,
rede externa bloqueada, picker/confirmação reais e arquivos em pasta nova
`.data/validacao-nativa-004/` (ignorada pelo Git). A tentativaZV9730 terminou
exit0 e gravou validation/native-result.json com pass:true,1Download,0pageerrors,
cinco gestos trusted/active e três hashes. Os arquivos foram conferidos separadamente:
Links4registros; Lote1registro/17campos; Itens1registro. Recusa/substituição de
Links e estado save-unknown de Itens antes da confirmação humana aprovados.
Handlers de reautorização002/003 preservados com evidência anterior, conforme plano.

Na tentativa01fyEa, Links/recusa/substituição e Lote passaram pelas verificações
do script, e o Download de Itens foi criado. O usuário confirmou diretamente
Já baixei este resultado, sem Conferir gravação anterior, e relatou sucesso na
tela. Isso não cobriu o estado save-unknown requerido; essa tentativa não foi PASS. O
roteiro foi separado em banners7/8 e passa a falhar explicitamente se houver
confirmação antecipada, em vez de aguardar um estado já ultrapassado. Encerrada
somente a janela isolada, com arquivos preservados; limpeza do perfil01fyEa
retornou EBUSY em Default/DIPS, sem afetar fontes nem exports. A tentativa final
ZV9730 foi aprovada em pasta exclusiva, com perfil encerrado e cleanup concluído.
Tentativas Temp recusada e timeout inicial também registradas em
validation/native-attempts.md. Nenhuma delas foi convertida em aceite.

Perfis/exports temporários são separados; exports preservados. Não limpar dados
pessoais ou .data existente para tentar resolver permissões.

## Próxima etapa

Registro da Fase9, estado/notas de plan, este handoff, README, quickstart e
execute-summary sincronizados com o PASS nativo. Nenhuma pendência do execute.
Sugerir sdd-converge; não executar converge, commit, merge ou publicação sem
pedido. Sugestão de commit: feat: coleta resiliente com
ritmo compartilhado e retomada persistente (separar alterações prévias no review).

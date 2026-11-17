# Bug Fix: Proxy antes da navegação e recuperação do service worker

- **Slug**: proxy-seguro-antes-navegacao-reinicio
- **Corrigido**: 2026-11-14
- **Assessment**: ./assessment.md
- **Status**: partial

## Summary

Aplicadas barreiras de ativação antes de navegar em Itens/Lote e recuperação persistente do estado/autenticação do worker. As reproduções automatizadas passam, mas a suíte completa exige ampliar o contrato de inicialização, fora dos arquivos previstos.

## Changes

| Arquivo | Mudança | Notas |
| --- | --- | --- |
| src/background.js | modified | Snapshot activeProxyState no storage local, reconciliação de PAC/levelOfControl, fila de comandos e registro síncrono de autenticação asyncBlocking; status sem credenciais. |
| src/popup.js | modified | Proxy confirmado antes de tabs.update; erro aborta e libera UI. Teste de IP também verifica resposta de ativação. |
| src/lote-collector.js | modified | Proxy confirmado antes de criar/reutilizar aba e resolver destino. |
| src/content.js | modified | Reativação sem DISABLE_PROXY e sem intervalo DIRECT; erro propagado para interromper paginação. |

## Tests Added or Updated

- tests/unit/proxy-background.test.cjs: boot, reinício, autenticação, PAC divergente, controle externo, falhas e concorrência.
- tests/unit/proxy-popup.test.cjs: ordem, falhas e fluxo sem proxy.
- tests/unit/proxy-content.test.cjs: reconexão recusada interrompe paginação.
- tests/unit/lote-collector.test.cjs: ativação anterior à navegação e falhas bloqueando coleta.

## Local Verification

- Antes do patch: 9 falhas / 15 testes nos testes de proxy/background/popup/lote, incluindo navegação anterior ao proxy, coleta após erro e perda de estado. Reprodução adicional de content falhou por continuar após erro de reconexão.
- Após patch, npm test: build development aprovado; 62/63 testes aprovados, incluindo todas as reproduções novas. Falha: `bundles de background conteudo e popup inicializam em contextos isolados`.
- Sem chamadas externas, proxy comercial, credenciais reais ou perfil Chrome do usuário.

## Deviations from Assessment

Descoberta na regressão: tests/contracts/001-reorganizacao-node-webpack.test.cjs inicializa o bundle com mock Chrome sem webRequest. O registro síncrono obrigatório do listener agora encontra `Cannot read properties of undefined (reading 'onAuthRequired')` nesse ambiente incompleto. Adaptar o contrato e eventual trava de integridade não estava previsto em Files likely to change. Edição interrompida conforme sdd-bugfix, sem alterar o contrato nem contornar sua falha no código de produção. Rodar novo Assess para incluir o harness e conferir suas travas antes de concluir a correção.

## Follow-ups

- Novo Assess com escopo do contrato/harness e respectivas travas. Não sobrescrever este assessment sem confirmação.
- Revalidar suíte completa, builds e carregamento MV3 em perfil isolado após ajustar o contrato.
- Autenticação e navegação com proxy real permanecem sem validação.
- Nenhum commit criado; aguardar correção da regressão antes de sugerir commit de entrega.

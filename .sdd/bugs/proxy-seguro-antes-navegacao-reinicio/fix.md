# Bug Fix: Proxy antes da navegação e recuperação do service worker

- **Slug**: proxy-seguro-antes-navegacao-reinicio
- **Corrigido**: 2026-11-14
- **Assessment**: ./assessment.md (inclui Reassessment autorizado por “siga”)
- **Status**: applied

## Summary

Ativação confirmada antes da primeira navegação em Itens/Lote. Snapshot ativo persistente, reconciliação com PAC/controle efetivo e autenticação asyncBlocking registrada no boot recuperam estado após suspensão do worker. Falhas de ativação/reconexão abortam; fallback de Itens só reinjeta quando não há receptor.

## Changes

| Arquivo | Mudança | Notas |
| --- | --- | --- |
| src/background.js | modified | activeProxyState em storage.local, comandos serializados, recuperação e autenticação limitada ao challenger configurado; status sem credenciais. |
| src/popup.js | modified | Barreira antes de tabs.update, UI liberada em erro, resposta negativa interrompe sem recoleta; teste de IP verifica ativação. |
| src/lote-collector.js | modified | Barreira antes de criar/reutilizar aba e resolver destino. |
| src/content.js | modified | Reativação sem desabilitar primeiro; falha interrompe paginação. |
| tests/contracts/001-reorganizacao-node-webpack.test.cjs | modified | Mocks mínimos de APIs Chrome e espera assíncrona de status; preservadas assertivas anteriores e dois casos. |
| .sdd/specs/001-reorganizacao-node-webpack/contract-tests.lock | modified | Emenda via check-contract-tests.ps1 -Write; travas 002/003 preservadas e conferidas. |
| tests/e2e/proxy.smoke.cjs | added | Chromium isolado com APIs Chrome reais; parada de worker via CDP, recuperação por mensagem e desativação. Rede externa bloqueada. |

## Tests Added or Updated

- proxy-background: registro no boot, estado/autenticação após reinício VM, PAC/controle divergente, falhas de persistência/set/clear, status sem senha e ordem concorrente.
- proxy-popup: proxy antes de navegar, erros bloqueando coleta, fluxo sem proxy, erro funcional sem reinjeção e receptor ausente com uma única reinjeção.
- proxy-content: reconexão recusada aborta após dez páginas sem DISABLE_PROXY.
- lote-collector: proxy anterior à navegação/resolução e falhas sem abrir/coletar aba.
- Contrato 001 executa bundles reais, com status assíncrono; não foi desabilitado/enfraquecido.

## Local Verification

- Tentativa 1 e suas reproduções red preservadas em history/.
- Novo teste de fallback reproduziu duas chamadas de crawl e reinjeção após erro funcional antes do ajuste; após ajuste, cinco testes de popup aprovados.
- npm test: 65/65 e build development aprovado.
- npm run build:prod + node --test: build production aprovado, 65/65.
- node tests/e2e/proxy.smoke.cjs: seis verificações aprovadas em development e production; zero pageerrors. Sem simulação de chrome.proxy.settings neste smoke.
- Travas 001/002/003 íntegras; git diff --check aprovado.

## Deviations from Assessment

Ampliação necessária identificada na tentativa 1 foi incorporada ao Reassessment antes de editar contrato/trava/harness. Sem expansão adicional. Relatórios anteriores movidos para history/, sem perda da evidência.

## Follow-ups

- Fase Test reexecuta checagens no artefato final antes de fechar.
- Não houve proxy comercial, autenticação real de provedor ou coleta no site atual.
- Ponto de commit sugerido após Test: `fix: activate proxy before navigation and recover worker state`. Nenhum commit criado.

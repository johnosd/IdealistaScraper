# Bug Assessment: Proxy antes da navegação e recuperação do service worker

- **Slug**: proxy-seguro-antes-navegacao-reinicio
- **Criado**: 2026-11-14
- **Origem**: duas entradas de .planning/backlog.md selecionadas pelo usuário
- **Veredito**: valid
- **Severidade**: high

## Report

Proxy ativado após a navegação e falhas ignoradas: a primeira navegação pode ocorrer antes da ativação; erro de ativação pode deixar a coleta prosseguir sem o proxy solicitado.
Estado do proxy perdido ao reiniciar o service worker: configuração aplicada pode divergir de PROXY_STATUS, e o listener de autenticação não é reconstruído.

## Symptom

Itens e Lote iniciam navegação antes de ENABLE_PROXY e ignoram falhas. Reiniciar o worker perde estado e autenticação mesmo com PAC aplicado. Esperado: aguardar ativação confirmada antes de navegar/coletar e recuperar configuração efetivamente aplicada.

## Reproduction

1. Em Itens, selecionar proxy e fornecer URL; observar tabs.update antes de ENABLE_PROXY; devolver {ok:false} e observar START_CRAWL.
2. Em Lote, observar tabs.create e resolução do destino antes de ENABLE_PROXY; resposta negativa não impede START_CRAWL.
3. Ativar proxy, recriar contexto VM do worker preservando storage e proxy.settings; PROXY_STATUS passa a enabled:false e nenhum listener de autenticação é registrado no boot.
4. Executar estes equivalentes automatizados na fase Fix antes e depois da alteração, sem rede/proxy comercial.

## Suspected Code Paths

- src/popup.js:95-130: navegação anterior à ativação, catch vazio.
- src/lote-collector.js:33-42: criação/resolução da aba anterior à ativação, resposta não verificada.
- src/background.js:3,37-139: estado volátil, listener tardio, status sem leitura de settings e falha de clear ignorada.
- src/content.js:232-253: reconexão desativa antes de reativar e ignora erro; pode repetir a mesma exposição durante paginação.

## Root Cause Hypothesis

Confiança high: ausência de barreira de ativação antes da navegação, protocolo {ok:false} não propagado e uso de variáveis globais como fonte exclusiva de estado. Registro blocking deve ser substituído por asyncBlocking compatível com MV3/webRequestAuthProvider, registrado no topo e capaz de esperar recuperação.

## Proposed Remediation

**Preferida**: ativar e validar resposta antes de criar/navegar aba em Itens e Lote; abortar e restaurar UI em erro. Persistir snapshot ativo privado no storage local já autorizado (independente dos campos editáveis), reconciliar com PAC e levelOfControl, reconstruir autenticação no boot e limitar credenciais ao challenger configurado. Serializar comandos e propagar falhas de set/clear/storage. Reconexão deve reaplicar sem intervalo DIRECT e abortar em erro. Não expor senha em PROXY_STATUS/logs.

**Files likely to change**:
- src/background.js
- src/popup.js
- src/lote-collector.js
- src/content.js
- tests/unit/proxy-background.test.cjs (novo)
- tests/unit/proxy-popup.test.cjs (novo)
- tests/unit/proxy-content.test.cjs (novo, se necessário para reprodução da reconexão)
- tests/unit/lote-collector.test.cjs

**Tests to add or update**:
- Ordem de ativação/navegação/coleta e bloqueio diante de resposta negativa, vazia ou rejeição; fluxo sem proxy preservado.
- Reinício em VM preservando settings/storage, autenticação logo após boot e credenciais restritas ao proxy correto.
- PAC divergente/controle externo; falhas de set, clear, persistência e comandos concorrentes; status sem senha.
- Reconexão sem DISABLE_PROXY e falha interrompendo paginação.

## Risks & Considerations

- APIs Chrome mockadas demonstram lógica, não conectividade nem autenticação real.
- Snapshot contém credenciais locais já fornecidas pelo usuário; nunca versionar valores reais nem devolvê-los ao popup.
- PAC pode ser alterado por outra extensão/política: não declarar ativo apenas porque set resolveu.
- Não alterar permissões nem arquivos legados; builds dev/prod obrigatórios.

## Open Questions

Nenhuma para a correção local. Proxy real permanece validação separada.

## Reassessment — 2026-11-14

Usuário autorizou continuidade com “siga” após o relatório failed. Relatórios da tentativa anterior preservados em history/; este complemento mantém diagnóstico e reprodução originais.

- **Veredito**: valid; severidade high mantida.
- Contrato 001 simula somente chrome.runtime e espera PROXY_STATUS síncrono. Acrescentar mocks mínimos das APIs já permitidas e aguardar sendResponse assíncrono, preservando todas as assertivas de comportamento e os dois casos de contrato.
- Fallback de Itens deve reinjetar somente quando o receptor está ausente. Resposta funcional negativa deve abortar sem recoleta; falhas de proxy durante paginação não podem virar nova tentativa implícita.
- Ampliar **Files likely to change** para `tests/contracts/001-reorganizacao-node-webpack.test.cjs`, `.sdd/specs/001-reorganizacao-node-webpack/contract-tests.lock` e `tests/e2e/proxy.smoke.cjs`; fontes/testes unitários anteriores continuam no escopo.
- Atualizar a trava 001 com o script oficial após conferir que não houve enfraquecimento das assertivas; travas 002/003 devem continuar íntegras.
- Adicionar teste de erro funcional sem reinjeção e de receptor ausente com uma única reinjeção. Reexecutar suíte completa e builds dev/prod.
- Validar carregamento do bundle e status após parada/reinício real do worker em Chromium isolado, sem rede externa nem proxy comercial. Distinguir essa evidência da autenticação com provedor real.
- Nenhuma nova permissão ou dependência necessária.

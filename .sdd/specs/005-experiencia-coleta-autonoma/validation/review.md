# Revisão independente e correções

Data:2026-11-14. Agente com contexto novo, somente leitura, conforme executing-plans.

Quatro achados Important foram reproduzidos e corrigidos:

1. bindOwner mantinha documentId/token anterior: limpa ambos antes de ATTACH. Regressão autonoma-runtime.test.cjs RED/GREEN.
2. Falha de descoberta usava epoch1 após vínculo epoch2: catch usa epoch atual e só atua se ainda for owner. Regressão autonoma-launch.test.cjs RED/GREEN.
3. Token novo não provava pasta diferente para homônimos: checagem física isSameEntry na UI e antes de reconciliar/gravar; receipt conserva directoryKey imutável. Teste autonoma-destinations.test.cjs e suíte save/contratos.
4. Descoberta sem fila oferecia retomada impossível: Preparar nova coleta retorna à preparação sem rede. Regressão autonoma-view.test.cjs.

Revisor revalidou17/17 testes finais e44/44 do conjunto principal. Nenhum Critical/Important confirmado restante. E2E/Chrome/filesystem/acessibilidade são provas independentes.

Outros ajustes: pausa terminal preservada após fechar runner;429 não vira espera automática por novo início; reload autenticado deixa owner unbound cercado por epoch; destino só publica referência imutável após CAS ocioso, sem lock mantido durante picker.

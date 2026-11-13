# Backlog

Painel único de ideias futuras e status de features/bugs geridas pelo
sistema sdd-*. Mantido automaticamente por update-feature-status.ps1 e
update-bug-status.ps1.

## Ideias Futuras

Achados da análise de 2026-11-13. Correções pendentes; a reorganização do app
tem prioridade antes de atuar nestes ajustes. Evidências e limites em
`.planning/memory/repository-overview.md`.

- [Bug] **Execução e retomada do lote dependentes do popup:** a orquestração e os resultados agregados ficam no popup; fechar a interface interrompe o controle e perde resultados em memória. Persistir e restaurar o estado necessário para uma retomada consistente.
- [Bug] **Exportação parcial vazia e contagem de páginas incorreta:** `STOP_AND_DOWNLOAD` consulta dados preenchidos somente ao final e pode contabilizar uma página ainda não coletada. Simulação local confirmou um item coletado e zero exportados durante a parada.
- [Bug] **Proxy ativado após a navegação e falhas ignoradas:** a primeira navegação pode ocorrer antes da ativação; erro de ativação pode deixar a coleta prosseguir sem o proxy solicitado.
- [Bug] **Estado do proxy perdido ao reiniciar o service worker:** configuração aplicada pode divergir de `PROXY_STATUS`, e o listener de autenticação não é reconstruído. Simulação com APIs mockadas confirmou divergência de status.
- [Bug] **Botão do lote sem implementação:** `loteStopExport` aparece como "Parar e Exportar", mas não possui handler.
- [Bug] **Coleta incompleta tratada como sucesso:** erros de rede/HTTP interrompem a paginação sem distinguir resultado parcial de completo; o lote pode remover a URL da fila como concluída.
- [Bug] **Repetição ilimitada de entradas com erro:** o lote move falhas ao fim da fila sem limite de tentativas ou encerramento por falha persistente.
- [Melhoria] **Pacote ZIP divergente do código-fonte:** `Idealista_extensao.zip` difere da pasta em quatro arquivos. Definir uma geração reproduzível do pacote a partir da versão validada.
## Features

| Slug | Título | Status | Progresso | Última Atualização |
| --- | --- | --- | --- | --- |
| 001-reorganizacao-node-webpack | Reorganização com Node/npm e Webpack | Implementada | 16/16 tasks | 2026-11-13 |
| 002-exportacao-localidades-pasta-autorizada | Exportação mensal de localidades em pasta autorizada | Convergida | 20/20 tasks | 2026-11-13 |

## Melhorias Ad-hoc

| Data | Área | Resumo |
| --- | --- | --- |

## Bugs

| Slug | Título | Fase Atual | Veredito/Status | Próximo Passo | Última Atualização |
| --- | --- | --- | --- | --- | --- |

# Backlog

Painel único de ideias futuras e status de features/bugs geridas pelo
sistema sdd-*. Mantido automaticamente por update-feature-status.ps1 e
update-bug-status.ps1.

## Ideias Futuras

Achados da análise de 2026-11-13. Correções pendentes; a reorganização do app
tem prioridade antes de atuar nestes ajustes. Evidências e limites em
`.planning/memory/repository-overview.md`.

- [Bug] **Exportação parcial vazia e contagem de páginas incorreta:** `STOP_AND_DOWNLOAD` consulta dados preenchidos somente ao final e pode contabilizar uma página ainda não coletada. Simulação local confirmou um item coletado e zero exportados durante a parada.
- [Bug] **Botão do lote sem implementação:** `loteStopExport` aparece como "Parar e Exportar", mas não possui handler.

## Features

| Slug | Título | Status | Progresso | Última Atualização |
| --- | --- | --- | --- | --- |
| 001-reorganizacao-node-webpack | Reorganização com Node/npm e Webpack | Implementada | 16/16 tasks | 2026-11-13 |
| 003-exportacao-lote-municipios | Exportação mensal do lote em pasta de municípios | Convergida | 33/33 tasks | 2026-11-13 |
| 004-coleta-resiliente | Coleta resiliente com controle de ritmo e retomada persistente | Convergida | 58/58 tasks | 2026-11-14 |
| 005-experiencia-coleta-autonoma | Coleta em um clique com acompanhamento e recuperação por localidade | Em Execução | 58/64 tasks | 2026-11-15 |
| 006-revisao-links-lote-extracao | Revisão ponta a ponta de Links, Lote e extração paginada validada no site real | Em Execução | 72/81 tasks | 2026-11-16 |

## Melhorias Ad-hoc

| Data | Área | Resumo |
| --- | --- | --- |

## Bugs

| Slug | Título | Fase Atual | Veredito/Status | Próximo Passo | Última Atualização |
| --- | --- | --- | --- | --- | --- |
| extracao-lote-abre-pagina-chrome-extension-falha | Lote não reconhece URL do JSON de localidades | Test | verified | Concluído | 2026-11-13 |
| proxy-seguro-antes-navegacao-reinicio | Proxy antes da navegação e recuperação do service worker | Test | verified | Concluído | 2026-11-14 |

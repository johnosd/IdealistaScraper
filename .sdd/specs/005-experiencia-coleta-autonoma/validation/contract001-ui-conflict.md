# Bloqueio de contrato — fase4/T024

**Resolvido**: usuário aprovou explicitamente a emenda mínima e a continuidade em modo contínuo. Aplicada somente ao contrato001, preservando o popup legado e os asserts anteriores; adicionada validação lateral condicional. `node --test tests/contracts/001-reorganizacao-node-webpack.test.cjs`:2/2 verdes. Trava001 regravada pelo comando autorizado; demais travas não alteradas. R-009 atualizado no plano005. O relato abaixo preserva a evidência anterior à autorização.

Data: 2026-11-14. Execução contínua interrompida pelo passo5b de `.agents/skills/sdd-execute/SKILL.md`. Nenhum teste ou trava alterado nesta execução.

## Evidência

- `npm.cmd run build`: build development aprovado; log em execution-build.log.
- `node --test tests/contracts/001-reorganizacao-node-webpack.test.cjs`: 0/2 verdes. Ambos falham com `Entrada local deve ter um caminho`, porque leem obrigatoriamente `config.action.default_popup` (linhas25 e92).
- O mesmo contrato, linhas33–36, exige lista exata de permissões sem sidePanel; esse segundo conflito fica oculto pela primeira falha.
- Plano005/D-001 e tasks/T024 exigem remover default_popup, usar side_panel.default_path e adicionar somente sidePanel. Não é possível atender simultaneamente às duas definições.
- Log integral: contract001-ui-conflict.log. Unitários de view/proxy desta rodada:11/11 verdes; isso não fecha a fase4.

## Emenda proposta para aprovação

Alterar somente o contrato001 para validar a entrada principal por side_panel.default_path quando presente, mantendo fallback para action.default_popup; continuar verificando caminhos, bundles, inicialização isolada, CSP/hosts e o popup legado. Aceitar exclusivamente a permissão sidePanel adicional quando existir painel declarado. Preservar todos os demais asserts e adicionar prova da declaração/entrada lateral. Só após aprovação explícita, regravar a trava001 e registrar execução da emenda em R-009 do plano005.

Alternativa: revisar a decisão D-001 e o fluxo de entrada, mantendo popup/permissões anteriores. Isso altera o desenho aprovado e requer retorno ao planejamento.

## Estado preservado

Fases1–3 concluídas. Fase4 parcial (T022 concluída; T023–T029 abertas). Configurações e release ainda pendentes. Mantido Em Execução; sem aceite final, sem commit, sem modificar dados reais. Retomar pela decisão sobre a emenda antes de avançar a implementação.

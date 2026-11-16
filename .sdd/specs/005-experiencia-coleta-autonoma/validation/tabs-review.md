# Abas e acompanhamento de municípios — T051 — 2026-11-14

Origem: usuário considerou interface nova pior, preferia as abas anteriores e via itens em processamento. Após pergunta estruturada confirmou municípios da fila, atual destacado, progresso e resultado; anúncios individuais não entram neste ajuste.

Comparação das fontes: popup anterior tinha Links/Itens/Lote/Configurações; loteStatusList mostrava municípios. Interface005 escondia fluxos em Outras ferramentas e empilhava resumo grande antes da fila. Recuperadas Links/Itens/Lote no painel, com visual azul próximo do anterior, acesso textual a Configurações dedicada e Lote padrão. Links/Itens abrem seus fluxos já existentes por ação explícita; nenhuma mudança no motor, permissões ou credenciais.

Fila compacta: município atual destacado, posição ItemNdeM, páginas/anúncios no resumo de cada linha, estado e resultado sem expandir. Ver na fila localiza/foca atual e limpa filtros por gesto. Trocar abas preserva execução, rascunho e nós/foco; retorno de Configurações restaura aba. Atualizações não reordenam nem rolam automaticamente. Espera normal deixou de mostrar alerta genérico e execução concluída não sugere retomada por intervalo residual do domínio.

| Prova | Resultado |
| --- | --- |
| RED | Novo E2E falhou pela ausência das abas;2 regressões unitárias adicionais falharam por alerta em intervalo normal e retomada em execução concluída, depois corrigidas. |
| Node/builddev | npm.cmd test:189/189,0falhas/skip; tabs-suite-dev.log. |
| Node/buildprod | npm.cmd run build:prod e node --test:189/189; tabs-build-prod.log/tabs-suite-prod.log. |
| E2E abas | node tests/e2e/autonoma-tabs.smoke.cjs:PASS dev/prod, tabs-result.json. Abas/setas, launchers Links/Itens, progresso atual, fila na primeira tela, navegação/retorno, localização e mesma execução com3 arquivos/4 páginas confirmados. |
| Regressão005 | autonoma-ui.smoke.cjs e autonoma.smoke.cjs:PASS nos dois builds; tabs-ui-dev/prod.log e tabs-core-dev/prod.log. |
| Painel nativo Chrome157/prod | autonoma-native-panel.cjs:action/contexto SIDE_PANEL, fechar/continuar coletando/reabrir,3 arquivos e0pageerrors; tabs-native-prod.log. Gravação OPFS simulada. |
| Inspeção visual | tabs-processing-360.png e tabs-completed-320.png:layout revisado durante fila e ao concluir;320px/zoom CSS200% sem overflow. Dados fictícios. |
| Integridade | Travas001–005 íntegras; nenhum contrato/fixture/trava alterado. |

Testes de interface usam extensão/runner reais, páginas locais interceptadas e gravação OPFS simulada, sem tráfego de provedor/Idealista. Não comprovam leitor de tela nem filesystem externo. Gates T044/T045 e intermitência antiga R-013 continuam abertos. Último buildproduction; feature Em Execução58/63.

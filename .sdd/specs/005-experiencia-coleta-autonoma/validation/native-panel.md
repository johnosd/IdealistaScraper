# Painel nativo — aprovado no Chrome instalado

Chrome157.0.8103.78, perfil temporário exclusivo, fixtures locais e rede externa bloqueada. Comando: node tests/e2e/autonoma-native-panel.cjs.

Extensions.triggerAction abre action em alvo tab real; runtime.getContexts retorna SIDE_PANEL/sidepanel.html e onOpened/onClosed registram windowId real. Fechar remove esse contexto. A coleta segue no runner até3 itens salvos; URL de origem preservada. Action reabre o painel;0 pageerrors. Evidência: native-panel-result.json.

Gravação desse roteiro usa OPFS e seletor/permissão simulados: NÃO prova filesystem externo/picker Windows. Teclado/leitor de tela e percepção de foco permanecem no gate de acessibilidade.

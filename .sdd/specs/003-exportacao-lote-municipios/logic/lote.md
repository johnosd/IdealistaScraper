# Sequência e propriedade da sessão

1. Popup abre/reutiliza `lote.html`, sem orquestrar coleta. Transportar o ID da
   aba web de origem ao abrir para o carregamento automático opcional; não obter
   “aba ativa” depois de abrir a página da extensão. Validar a origem existente.
2. `lote.html` mantém a operação após perder foco. Migrar controles de fila,
   status/log, pause/continuar e autoload; preservar entradas antigas. O controle
   sem implementação Parar e Exportar não deve sugerir sucesso parcial: apresentar
   explicitamente indisponível nesta feature. Não implementar exportação parcial.
3. Antes de alterar fila/estado compartilhado, adquirir Web Lock exclusivo
   `idealista-municipios:batch` com ifAvailable. Outra página fica somente leitura
   e orienta voltar à sessão aberta. Não limpar/sobrescrever dados de outro dono.
   Manter lock enquanto coleta, pausada ou pendente; liberar no fim/encerramento.
   Inicialização/leitura de storage não deve regravar flag/fila de sessão alheia.
4. Picker e requestPermission partem diretamente de clique, com handle carregado
   antes; não colocar await IDB/locks antes da chamada que exige ativação.
   Cancelar seleção mantém pasta antiga. Não iniciar coleta sem destino válido.
5. Validar todo input antes de mutações, criar sessão com Date única. Coletor em
   `src/lote-collector.js` abre aba própria (não navega lote.html/aba do usuário),
   aguarda carregamento, resolve CTA com lote-navigation, executa START_CRAWL e
   consulta STOP_AND_DOWNLOAD existente. Não redesenhar proxy/crawler. Fechar só
   a aba criada em finally; erros de transporte/ok:false rejeitam a coleta.
6. advance: marcar busy; se não há pendente coletar cabeça, validar e capturar
   snapshot; se ainda não salvo, await save; se não saved retornar status e
   interromper laço; se salvo guardar recibo; await commit; só então retirar
   cabeça, limpar pendente e informar salvo. finally libera busy. Qualquer exceção
   interrompe avanço sem consumo. Repetição usa pendente/recibo. Cada posição da
   fila é distinta, inclusive duplicatas; não encontrar/remover por URL.
7. UI botão “Tentar salvar novamente” chama advance, sem coleta; pausa ocorre
   entre itens e mantém mês. Fechar página perde pendente; avisar por beforeunload
   enquanto houver atividade/dados, sem prometer que o navegador sempre exibirá.
8. Gravação faz snapshot antes de await, lock writer, queryPermission, resolver
   subpasta/arquivo, createWritable sem dados antigos, write e close. Sem apagar
   arquivo antes. Somente NotFoundError permite criação; qualquer outro erro para.

Decisão do usuário em execução: falhas de rede/HTTP, resposta sem listagem e
paginação interrompida devem rejeitar a coleta; nenhum resultado parcial pode
substituir arquivo anterior. Propagar pelo START_CRAWL/STOP_AND_DOWNLOAD e pelo
coletor; testar a segunda página falhando. Não redesenhar proxy nem os demais bugs.

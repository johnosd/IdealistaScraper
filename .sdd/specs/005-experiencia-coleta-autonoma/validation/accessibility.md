# Acessibilidade — provas automatizadas e gate humano pendente

Passaram labels semânticos; foco visível; erro focando primeiro campo inválido; diálogo Permanecer/Descartar; preservação de busca/detalhes/foco;308 localidades;320px e ampliação CSS200% sem overflow; reduced-motion. Testes autonoma-panel/settings-ui/view e autonoma-ui.smoke.cjs. Capturas: panel-320.png, panel-css-zoom-200.png, settings-320.png, settings-css-zoom-200.png.

Status aria-live só muda em transições relevantes; contadores não são região live. Linhas estáveis por itemId; detalhes abertos e foco não são virtualizados.

Pendente: leitor de tela Windows, anúncios de pausa/intervenção, retorno de foco do diálogo/fechamento nativo, zoom real do navegador200% e teclado entre painel/site. Zoom CSS/testes de função não certificam esses itens. T045/release abertos.

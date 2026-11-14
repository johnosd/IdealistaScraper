# Falha no aceite — resolução da listagem de Terceira

Usuário reportou “Página sem listagem: não há um único link explícito de anúncios
válido”, no item Terceira (Ilha dos Açores). Não considerar T021 aprovada.

## Inspeção real com playwright-site-debug

2026-11-13, aproximadamente23:53 UTC. URL:
https://www.idealista.pt/arrendar-casas/terceira-ilha-dos-acores/concelhos-freguesias

Título: “Anúncios de casas e apartamentos para arrendar na Terceira (Ilha dos Açores)
distrito — idealista”. Sem contêiner de listagem, como esperado para um índice.
Um CTA explícito: “Ver 17 casas e apartamentos na Terceira (Ilha dos Açores)”,
destino https://www.idealista.pt/arrendar-casas/terceira-ilha-dos-acores/.
A própria inspectBatchDestination, lida do módulo em disco, foi executada nesse
DOM e retornou exatamente esse destino, blocked:false e readyState:complete.

Em outra entrada do mesmo catálogo (São Miguel), uma navegação anterior desta
inspeção recebeu HTTP403 e título Just a moment. Não houve contorno do desafio.
Isso comprova bloqueio naquela navegação, **não** a causa do erro original do
usuário em Terceira. A página exata da falha dele já havia sido fechada pelo lote;
o diagnóstico antigo não registrava título ou URL. Não foi reproduzida a mesma
falha do usuário na página de Terceira durante esta inspeção.

## Ajuste T023

- Observar DOM por até10 segundos se não há listagem/CTA/impedimento explícito,
  em vez de concluir ausência imediatamente após carregamento da aba.
- Identificar sinais explícitos de verificação/bloqueio e mostrar título/URL
  sem query/hash. Não inventar destino nem remover sufixo para adivinhar uma URL.
- Manter/ativar a própria aba em erro de resolução para inspeção pelo usuário.
  Tentativa explícita do mesmo item reutiliza essa aba se ainda existe e conserva
  a URL; aba alterada/fechada não é reutilizada nem navegada à força.
- Fila e arquivos preservados; não há CAPTCHA automático, retry infinito nem
  alteração de catálogo/credenciais/proxy.

## Verificação

- Novos testes inicialmente vermelhos para classificação, DOM tardio e retenção
  de aba; depois verdes. npm.cmd test: **51/51** e build desenvolvimento aprovado.
- npm.cmd run build:prod: aprovado; dist final em produção.
- node tests/e2e/lote.smoke.cjs no build produção: **13 grupos**, incluindo DOM
  tardio e403 com aba preservada/reutilizada após intervenção simulada. Zero
  Downloads no Lote, um esperado em Itens, zero pageerrors.
- Travas001/002/003 íntegras; testes travados/fixture não foram alterados.
- Harness inicialmente manteve um hold de close do cenário anterior; corrigido
  reset desse colaborador antes dos novos cenários. Jornada completa final verde.

Pendente repetir Terceira no Chrome do usuário com a extensão recarregada. Se
falhar novamente, a aba e o contexto do erro estarão disponíveis para determinar
a causa real. Esta rodada não coletou anúncios reais nem gravou arquivos .data.

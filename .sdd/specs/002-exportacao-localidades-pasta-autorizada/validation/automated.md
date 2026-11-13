# Validação automatizada — feature 002

Data: 2026-11-13. Node 22.16.0, Webpack 5.112.2, Playwright 1.65.0,
Chromium 158.0.8127.18. Execução em perfis temporários isolados.

| Comando | Resultado |
| --- | --- |
| `npm.cmd ci` | PASS, lockfile reproduzível; auditoria reportou zero vulnerabilidades |
| `npm.cmd test` | Build development PASS; 20/20 testes |
| `node tests/e2e/localidades.smoke.cjs` após development | PASS, oito cenários, zero downloads/pageerrors |
| `npm.cmd run build:prod` | PASS, seis bundles independentes |
| `node --test` após production | PASS, 20/20 testes |
| `node tests/e2e/localidades.smoke.cjs` após production | PASS, mesmos oito cenários e zero downloads/pageerrors |
| `check-contract-tests.ps1 -Slug 001-reorganizacao-node-webpack` | PASS, trava de dois testes íntegra |
| `check-contract-tests.ps1 -Slug 002-exportacao-localidades-pasta-autorizada` | PASS, trava de cinco testes e fixture íntegra |

Os oito cenários E2E: primeira gravação UTF-8 após fechar popup; recusa byte-idêntica;
substituição por JSON menor; handle recuperado pelo IndexedDB após reabrir;
prompt/denied e renovação por gesto com dados preservados; cancelar troca e falha
de persistência mantendo referência anterior no banco; erro de coleta preservando
arquivo; duas páginas concorrentes com resultado ocupado.

Quatro abas antigas acessadas sem ativar proxy. O trecho Itens/Lote/Proxy do popup
foi comparado ao backup anterior à migração 001: idêntico após normalizar CRLF/LF
e os dois caminhos de injeção já alterados na 001. Manifesto/permissões inalterados.

## Correção do harness e limites

O primeiro ensaio deixou escapar uma navegação inicial para o site externo.
O harness final bloqueia DNS dos domínios externos e intercepta HTTPS. Cria a aba
em branco, espera a anexação ao Playwright e navega usando chrome.tabs.update.
Page.goto no target de coleta causava uma corrida de eventos onUpdated no harness,
com timeout antes de executeScript. Esse problema reproduziu e passou após alterar
somente o harness; nenhuma condição especial foi adicionada ao coletor real.

A extensão, seus bundles e a coleta por scripting.executeScript são reais.
O site vem de fixture local, o seletor é simulado, os handles/arquivos são OPFS
e IndexedDB nativos. Chamadas de criação de aba são adaptadas no harness para
garantir interceptação antes da navegação. Não há bypass de CSP ou mock do writer.

Esta prova não é autorização nativa de pasta externa, coleta no site real ou
validação de proxy. O aceite manual do usuário é registrado em manual-chrome.md.
Não foram gravados arquivos nas pastas de dados reais do projeto pelo agente.

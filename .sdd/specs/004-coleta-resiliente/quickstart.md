# Quickstart — 004-coleta-resiliente

## Prerrequisitos e baseline

Windows/PowerShell, Node>=22.16.0/npm, lockfile e Chromium Playwright já usado no projeto. Não limpar perfil/storage/.data do usuário. Perfil temporário com rede externa bloqueada; restart real reabre o MESMO perfil, não reinstala extensão.

Baseline do planejamento: contratos004 falhavam5/5 com not implemented e os65 testes anteriores passavam. Na execução, o núcleo e as telas foram integrados; resultados correntes ficam em `validation/` e `tasks.md`. Site/proxy comercial não executados.

## Gate após execute

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build:prod
node --test
./.planning/scripts/powershell/check-contract-tests.ps1 -Slug 001-reorganizacao-node-webpack
./.planning/scripts/powershell/check-contract-tests.ps1 -Slug 002-exportacao-localidades-pasta-autorizada
./.planning/scripts/powershell/check-contract-tests.ps1 -Slug 003-exportacao-lote-municipios
./.planning/scripts/powershell/check-contract-tests.ps1 -Slug 004-coleta-resiliente
node tests/e2e/localidades.smoke.cjs
node tests/e2e/lote.smoke.cjs
node tests/e2e/proxy.smoke.cjs
node tests/e2e/coleta-store.smoke.cjs
node tests/e2e/coleta.smoke.cjs
```

Os cinco harnesses estão implementados. Rodar E2E nos builds development/production. Testes antigos fora de contratos foram adaptados à nova UI preservando intenção; não desabilitar. Não há lint/typecheck configurados.

## Gate nativo interativo (T039)

Depois do build final, execute:

```powershell
node tests/e2e/coleta.native.cjs
```

O script abre Chromium visível em perfil temporário e mostra um roteiro em cada
tela. As páginas web são fixtures locais e a rede pública é bloqueada. Não altera
o perfil do usuário. Selecione somente as pastas novas indicadas no banner, dentro
de `.data/validacao-nativa-004/`. O perfil fica em Temp, mas essa pasta pode ser
recusada como destino pelo seletor Windows/Chrome e não é usada para os arquivos.
Os arquivos gerados são preservados para inspeção, inclusive se o roteiro falhar.

1. Links: escolher pasta real, gravar, repetir e recusar substituição, depois salvar
   os dados mantidos e aceitar substituição. O script confere bytes UTF-8.
2. Lote: escolher a outra pasta temporária e iniciar. Conferir mês/nome e17campos;
   nenhum Download de reserva é esperado.
3. Itens: iniciar, conferir o download, selecionar a sessão após a reabertura e
   usar Conferir gravação anterior. O estado deve ser desconhecido sem novo download.
   Aguarde o banner8, que confirma a observação do estado desconhecido, e só então
   use Já baixei este resultado e aceite o diálogo. Confirmar diretamente conclui
   a sessão, mas não valida o cenário de reconciliação desconhecida do roteiro.

O gate exige ações humanas no picker e nos diálogos; não há mock de handles ou
permissões neste script. Um PASS grava `validation/native-result.json`. A execução
automatizada OPFS não substitui esse resultado. Os handlers de gesto para
reautorização002/003 foram preservados; sua prova nativa anterior continua distinta
dos gestos/permissões simulados nos testes004. Se uma reautorização efetiva for
necessária, fazê-la pelo botão da tela, antes de salvar sem recoleta.

Sem resultado nativo, T039 e o gate correspondente permanecem abertos e o status
continua Em Execução. Não produzir um PASS a partir de timeout, build ou OPFS.

Execução004 em2026-11-14: roteiro completo aprovado na tentativaZV9730, exit0,
1Download e0pageerrors. native-result.json contém os três hashes conferidos.
Tentativas incompletas estão registradas em validation/native-attempts.md;
nenhuma delas foi usada como aceite. Ver validation/execute-summary.md.

Após Phase10/T043–T045, os gates atuais são117/117 testes e41E2E por build:
ver validation/convergence-execute-summary.md. A prova nativa anterior permanece
distinta do novo E2E de erro de FileSystem injetado e do retry sem recoleta.

## Cenários locais obrigatórios

1. Perfil/limites/status acessíveis em Links/Itens/Lote; iniciar dois modos e comandos duplicados: só um executor. Fechar UI com executor vivo e suspender worker: sem takeover indevido.
2. Fixtures429 segundos/data/inválido,503/rede/timeout,403/desafio200 inicial/intermediário: confirmar consumo, Retry-After e pausa manual persistente. Não confundir fakes com navegador.
3. Confirmar3 páginas; fechar navegador e reabrir mesmo perfil. Nenhuma rede automática. Resume manual inicia página4, registrar URLs reais e provar que1–3 não foram refeitas por memória.
4. Quota/abort com IndexedDB real preserva checkpoint anterior e impede próxima página. Epoch tardio, hash/schema/contexto incompatíveis não mesclam/avançam. Política, relógio e descarte não removem blockers.
5. Resultado awaiting-save recuperado, reautorização e mesmo mês/schema sem rede. Crash depois de close/antes de receipt e depois do receipt/antes da fila: reconciliar. Downloads Itens com resultado desconhecido exige confirmação, sem novo download automático.
6. Cem páginas no núcleo com relógio injetado: zero reativação por contagem e até um IP probe/revisão habilitada. Browser usa valores válidos da política, sem atalhos produtivos; não precisa cem navegações reais.
7. CicloURL, sequência sem anúncios novos, limites item/run/janela/duração e cancelamento: parada correta e sem falsa conclusão; diagnóstico sem segredos.
8. Chrome/CSP, entradas/permissions intactos. UI nativa de pasta/Downloads alterada exige gesto/reautorização/arquivo em pasta temporária autorizada antes de aceite. OPFS não substitui picker nativo se o fluxo mudou.

## Evidência

Núcleo/fakes; IndexedDB/Chrome isolado; worker parado viaCDP; navegador fechado/reaberto; gesto/escrita nativos; coleta atual; proxy comercial são provas distintas. Gates locais e restart real no perfil temporário obrigatórios. Site/proxy pago não são gates da004 nem autorizados implicitamente; se solicitados, apresentar previamente limites de requests/tempo/custo e obter decisão. Não usar resultado local como eficácia comercial.

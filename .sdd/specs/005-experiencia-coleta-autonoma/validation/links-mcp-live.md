# Links — verificação pelo MCP Playwright

Data: 2026-11-15, aproximadamente 03:43–03:47 UTC. URL solicitada: https://www.idealista.pt/arrendar-casas/#municipality-search.

## Resultado observado no site real

`mcp__playwright__browser_navigate` abriu a URL com título “Arrendar casas. Arrendar apartamentos — idealista”. A Navigation Timing API informou HTTP 200; não havia desafio no DOM. Executada a função `extractLinks` lida diretamente de `src/linkExtractor.js`, sem reimplementação: 84 registros únicos, cobrindo os 84 links da navegação `nav.locations-list`, sem links faltantes. Distribuição: 7 regiões, 22 sub-regiões e 55 registros classificados como Município pelo extrator existente. Essa classificação não comprova que cada localidade seja administrativamente um município.

O handler `installCollectionExecutor` de `src/coleta-page.js` também foi executado sobre o DOM real: `COLLECT_PAGE` retornou `ok:true`, `listing:true`, `challenge:false`, 84 registros e `nextUrl:null`. Nessa execução isolada, somente a API de mensagens/validação do coordenador foi simulada; não houve autorização real do background, passagem pelo botão instalado, exportação nem coleta de anúncios. A execução manteve o marcador de instalação em um objeto local para não modificar o estado global do site.

Artefatos: `links-mcp-live-result.json` contém os registros e a navegação HTML pública; `links-mcp-live-protocol.json` registra o resultado do handler e HTTP; `links-mcp-live-navigation.png` mostra a navegação real. Nenhum token de conexão foi persistido no projeto. Os erros de console observados eram FedCM/Google e sincronização de publicidade; a extração do DOM retornou completa apesar deles. O coletor de requests do MCP não devolveu a navegação original; HTTP 200 foi observado pela API de desempenho, não inferido de ausência de erros.

## Limite da conexão MCP

Tentativa de abrir `chrome-extension://<id instalado>/sidepanel.html` via `browser_tabs` falhou com `Protocol error (Page.navigate): Not allowed`. Portanto, o clique no painel da extensão instalada não foi validado por esse MCP. Não há prova de que a configuração de proxy da extensão foi utilizada pelo acesso real acima. Os resultados 407/403 do diagnóstico anterior não são substituídos por este HTTP 200 em outra sessão.

## Correção do bloqueio herdado entre modos

Reprodução com o coordenador real em fixture: um Lote recebe HTTP 403, persiste bloqueio do domínio e impede `START` de Links antes da criação da sessão. A UI anterior escondia a recuperação porque exigia um ID de Links. A inspeção seletiva dos arquivos locais do perfil Default encontrou gravações recentes de Lote bloqueado e sinais de `accessBlocked:true`; isso é evidência em disco, não uma leitura do estado vivo do background. O perfil Default apontava para a raiz atual do projeto, sem motivo de desabilitação da extensão.

Correção: quando a tentativa de Links é recusada por esse bloqueio e não há sessão própria, `LINKS_READ` oferece recuperação com confirmação de acesso e prazo de elegibilidade. A ação fica desabilitada durante a espera. Após o prazo, “Conferir acesso e coletar links” exige confirmação explícita; somente então `confirmDomainAccess` pode liberar a trava global, respeitando operação ativa, relógio, intervalos e orçamento. Sessões bloqueadas anteriores, checkpoints, configurações e credenciais permanecem preservados. Nenhuma trava do perfil pessoal foi alterada durante o diagnóstico.

## Validação local da correção

- RED/GREEN: três casos em `tests/unit/links-global-block.test.cjs` e um caso em `tests/unit/autonoma-panel.test.cjs` reproduziram a lacuna antes da correção.
- `npm.cmd run build`, `node --test`, `npm.cmd run build:prod`, `node --test`: 212/212 em cada build, sem skip.
- `node tests/e2e/links-inherited-block.smoke.cjs`: passou nos dois builds. Extensão real e HTTP 403 controlado, sem requests públicos. Recuperação visível sem sessão própria; cancelamento preserva trava; adulterar somente o prazo apresentado pela UI não permite ultrapassar o prazo real do backend.
- Jornadas `links-one-click`, `links-connection-error` passaram em desenvolvimento. As quatro jornadas `links-one-click`, `links-popup-navigation`, `links-start-errors`, `links-connection-error` e a nova `links-inherited-block` passaram em produção. A jornada após espera elegível usa relógio controlado no teste unitário; o smoke não afirma ter aguardado a espera real inteira.
- Logs `links-inherited-*.log`; travas 001–005 conferidas sem regravação. Último bundle: produção.

T052 continua parcial: DOM real comprovado via MCP, clique instalado ainda não comprovado, diagnóstico anterior do proxy permanece aberto. T044/T045 e R-013/R-019/R-020 não foram encerrados por esta validação.

## Screenshot posterior: confirmação e resultado

A imagem posterior enviada pelo usuário mostra o site aberto e Links com a ação “Conferir acesso e coletar links”. O texto anterior não distinguia um bloqueio persistido de uma recusa da página atual. `sidepanel.js` agora informa “Uma tentativa anterior foi bloqueada” e orienta clicar no botão e confirmar, mantendo a espera quando vigente. O screenshot sozinho não comprova que a confirmação já foi realizada; foi solicitada essa distinção ao usuário.

Ampliado `tests/e2e/links-inherited-block.smoke.cjs` para testar também o sucesso após confirmação elegível: perfil temporário, primeiro HTTP403, prazo vencido preparado exclusivamente na fixture de IndexedDB, depois HTTP200 com a navegação pública capturada pelo MCP. O motor real da extensão retornou84 registros e a UI exibiu84 localidades/links e exportação disponível, sem abrir configuração/exportador, preservando o Lote bloqueado. Não houve consulta ao site público nesse smoke nem alteração de prazo no perfil pessoal. HTML congelado em `tests/fixtures/idealista-locations-2026-11-15.html`.

O teste inicialmente avançava antes de o evento assíncrono de fechamento do diálogo enviar START; passou a esperar a resposta observável de START:wait antes de preparar a etapa elegível. Não foi alterado timeout nem relaxada regra de produção. Teste de texto confirmou RED/GREEN. Suíte permanece212/212 em desenvolvimento e produção; smoke completo nos dois builds, logs `links-inherited-recovery-{dev,prod}.log` e `links-recovery-copy-*.log`. Último bundleproduction. Isso comprova a recuperação na extensão em ambiente controlado, não o clique no painel pessoal através do MCP.

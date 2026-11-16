# Baseline de execução — 2026-11-16

## Repositório

- Branch `feature/004-coleta-resiliente`; `git status --short` com 146 entradas (alterações não commitadas da 004/005 + artefatos 006). Preservar.
- `.data/`: 14 entradas — `M .data/localidades/202611/links_localidades_202611.json` e 13 arquivos não rastreados em `.data/municipios/202611/` (Candelária, Fajã de Baixo, Fenais da Luz, Ginetes, Mosteiros, Ponta Delgada (Santa Clara), Ponta Delgada (São Sebastião), Relva, Rosto de Cão (São Roque), Santo António, São José, São Pedro, São Vicente Ferreira — todos `-Paginas1.json`). Gate T056: mesmo conjunto ao final.
- `manifest.json` SHA256 `8759D68A46589F49141605D237E8F3A1DBDF1DBAEF08E7C22EA7AFC815F05853`.

## Testes

- `npm.cmd run build` + `node --test`: 223 testes, 218 pass, 5 fail (os 5 contratos 006, vermelhos esperados), 0 skip.
- Travas: 001 (2), 002 (5), 003 (5), 004 (5), 005 (5), 006 (5) — todas `PASS: trava íntegra`.

## Ferramenta de inspeção (T002, research R6/D15)

- Playwright MCP **não disponível** nesta sessão de execução (busca de ferramentas não encontrou `mcp__playwright__*`).
- Chromium headless do Playwright local é bloqueado (403 "Um momento…", `pre-plan-headless-probe.md`); não usar para N3.
- Opções para a Fase 2: (a) usuário reconecta o Playwright MCP em modo extensão no seu Chrome e retoma; (b) roteiro manual guiado, com o usuário executando um snippet de inspeção no DevTools das três páginas e colando o JSON resultante.
- Limitação conhecida (005): MCP recusou `chrome-extension://` — N4 pode exigir roteiro manual (Q6).

# Sondagem headless antes da execução — 2026-11-16

Nível de evidência: **N3 parcial** (site real, sem a extensão, navegador automatizado limpo). Não
substitui a inspeção T003–T009.

Ferramenta: Playwright 1.65.0 (devDependency do projeto), Chromium headless, contexto novo `pt-PT`,
sem proxy, sem cookies persistidos, ~10 s entre páginas. Script temporário fora do repositório.

| URL | HTTP | Título | Listagem | `challenge` detectado pelo critério do projeto |
| --- | --- | --- | --- | --- |
| `/arrendar-casas/braga-distrito/concelhos-freguesias` | 403 | Um momento… | não | **false** |
| `/arrendar-casas/braga-distrito/` | 403 | Um momento… | não | **false** |
| `/geo/arrendar-casas/acores/` | 403 | Um momento… | não | **false** |
| `/arrendar-casas/faro-distrito/` | 403 | Um momento… | não | **false** |

Conclusões:

1. Navegador automatizado sem histórico é bloqueado. A inspeção precisa do Chrome real do usuário.
   Não houve tentativa de contornar a verificação.
2. Bug: os padrões de título dos detectores não incluem "Um momento". Hoje a classificação depende só do
   status 403. Se o site servir a mesma página com 200 (ou se o status não for observado), o desafio
   passaria como "conteúdo inesperado". Correção: task T058.
3. Nada sobre a estrutura das listagens pôde ser confirmado. R1, R2, R4 e R5 continuam provisórios.

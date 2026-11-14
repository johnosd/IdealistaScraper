# Diagnóstico de site e skill reutilizável

2026-11-13: usuário solicitou revisar localidades no site real antes de fechar
o bug extracao-lote-abre-pagina-chrome-extension-falha, depois pediu uma skill
reutilizável para o procedimento.

Skill pessoal criada em
`C:/Users/johns/.codex/skills/playwright-site-debug/SKILL.md`, invocação
`$playwright-site-debug`. Local pessoal permite uso em outros projetos.
Instrui confrontar DOM real, extrator existente, JSON e consumidor; analisar
nulls por tipo; medir cobertura e distinguir índices/listagens; registrar limites
sem salvar tokens ou alterar dados durante diagnóstico. Referência Idealista
em references/idealista.md, a verificar contra DOM atual em usos futuros.

Skill validada por quick_validate.py e avaliação independente dos cenários de
hierarquia/nulls, bloqueio de acesso e transformação indevida de URLs. PyYAML
executado por uv em ambiente isolado, sem novas dependências do projeto.

Revisão real: mesma função extractLinks executada no DOM, 84/84 URLs únicos,
mesmas URLs do JSON local, sem campos URL/Texto/Região ausentes. Nulls esperados
por nível. São Miguel/concelhos-freguesias não tem contêiner do crawler e oferece
CTA explícito para listagem. Alvor aparece sob Portimão no breadcrumb, apesar do
rótulo Município dado pelo seletor. Ver relatório do bug site-review.md.
Nenhum lote/proxy/paginação real executado; nenhum arquivo .data alterado.
O bug permanece em Assess com próximo passo Fix, considerando o complemento.

## Correção de escopo da skill solicitada pelo usuário

O usuário esclareceu que a skill deve pertencer ao projeto e ser agnóstica,
ensinando Playwright para inspecionar páginas ou logs. A instalação pessoal foi
movida para `.agents/skills/playwright-site-debug/` e espelhada em
`.claude/skills/playwright-site-debug/`, conforme os diretórios existentes.
A cópia pessoal anterior não permanece instalada. Os achados do Idealista estão
no relatório do bug, fora da skill.

Entrada reescrita com conexão MCP/SDK, snapshot/DOM/screenshot, locators/esperas,
captura de console/pageerror/requestfailed/response antes da ação, correlação
com mudanças de página e tratamento de impedimentos. Sem seletores, URLs ou
domínio de negócio específicos. Invocação continua `$playwright-site-debug`.

Ambas as cópias passaram quick_validate.py e possuem SKILL.md byte-idênticos.
Exemplo observeAction extraído da própria skill foi executado em Playwright com
fixture local: capturou erro de console, exceção, HTTP400 e falha de transporte,
distinguiu resposta HTTP de requestfailed e removeu listeners em sucesso e erro.
Nenhum site externo ou código funcional da extensão alterado nessa correção.

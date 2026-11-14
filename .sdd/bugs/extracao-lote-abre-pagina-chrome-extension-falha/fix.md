# Bug Fix: Lote não reconhece URL do JSON de localidades

- **Slug**: extracao-lote-abre-pagina-chrome-extension-falha
- **Corrigido**: 2026-11-13
- **Assessment**: ./assessment.md
- **Status**: applied

## Summary

O lote agora normaliza URL/Texto do catálogo e formatos legados, rejeita entradas
inválidas antes de limpar o estado/navegar e resolve páginas de índice pelo CTA
explícito antes de iniciar o crawler. Não altera catálogo, nulls ou classificação.

## Changes

| Arquivo | Mudança | Notas |
| --- | --- | --- |
| src/lote-input.js | added | Parsing, normalização, nome legível e validação HTTPS Idealista |
| src/lote-navigation.js | added | Função autônoma injetável, CTA único, um salto e confirmação de listagem |
| src/popup.js | modified | Validação prévia, uso de nome/url normalizados, resolução antes de START_CRAWL; erro de resolução interrompe preservando fila |
| tests/unit/lote-input.test.cjs | added | Quatro testes de formatos/validação |
| tests/unit/lote-navigation.test.cjs | added | Quatro testes de resolução/falhas/serialização |
| tests/unit/lote-popup.test.cjs | added | Três testes do handler real com DOM/Chrome colaboradores |
| tests/e2e/lote.smoke.cjs | added | Extensão/crawler reais, fixtures locais e quatro jornadas |
| package.json | modified | Script opt-in test:e2e:lote; sem dependências novas |

## Tests Added or Updated

Onze unitários cobrindo exportado/legado, strings/linhas, rejeição com índice do
item, domínio/esquema inválidos, ausência/ambiguidade/ciclo do CTA e destino que
continua sem listagem. Handler real confirma nomes, URL e ausência de efeitos
em lista inválida, inclusive preservação do storage anterior.

E2E: lote de dois itens (índice e listagem direta), link/nome legado, input inválido
sem navegação/limpeza e índice sem CTA interrompendo sem consumir fila. Crawler
real retorna um anúncio por fixture e gera três downloads no perfil temporário.
Nenhuma navegação à raiz chrome-extension, acesso externo ou ativação de proxy.

## Local Verification

- Antes do patch, teste de preservação falhou: lista inválida limpava estado e
  chegava ao crawler. Testes dos módulos inicialmente falharam por módulos ausentes.
- `node --test tests/unit/lote-input.test.cjs tests/unit/lote-navigation.test.cjs tests/unit/lote-popup.test.cjs`: 11/11.
- `npm.cmd test`: build development PASS e 31/31.
- `node tests/e2e/lote.smoke.cjs`: PASS em development, quatro jornadas, três downloads e zero pageerrors.
- `node tests/e2e/localidades.smoke.cjs`: PASS em development, oito cenários, zero downloads/pageerrors.
- Travas 001/002: PASS. Normalização do arquivo indicado: 84 válidos, zero URL/nome vazios.
- SHA256 do arquivo local preservado: 7627725C8E703B2F595EC63ED78608B76D3B3CC09FEF873C5703EF519143C708.
- Revisão read-only independente: nenhum problema concreto no escopo; 11 unitários verdes.

## Deviations from Assessment

Ampliação aprovada antes do patch em assessment-amendment.md, após site-review.md:
novo módulo de navegação e seus testes; não remover sufixos por suposição. Erro
de resolução interrompe o lote para não entrar no retry preexistente.
Sem outras ampliações de arquivos ou remediação.

Durante o desenvolvimento, o teste VM revelou que a função importada precisava
receber o colaborador Chrome explicitamente no caller; o popup agora passa api.
Outra falha do teste veio de disparar clique antes da restauração assíncrona
inicial do harness; o teste aguarda inicialização antes da interação.

## Follow-ups

Fase Test: rerrodar reprodução equivalente e regressões, incluindo production.
O site real já foi inspecionado no Assess; não confundir fixtures com lote completo
no site público. Bugs anteriores do popup/proxy/retries e extração parcial permanecem
fora do escopo. Ponto sugerido de commit após verificação: fix: aceitar localidades e resolver indices no lote.
Nenhum commit realizado.

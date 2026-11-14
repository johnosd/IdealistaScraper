# Emenda aprovada do assessment

O usuário aprovou “siga” após o plano de aceitar URL/Texto, validar destinos,
resolver índices por link explícito e testar com Playwright. Esta emenda preserva
assessment.md e incorpora site-review.md antes de iniciar o Fix.

## Escopo adicional

Resolver o destino no próprio lote, depois da navegação ao endereço informado e
antes de START_CRAWL. Se houver contêiner de listagem, usar a URL final validada.
Caso contrário, procurar CTA explícito de listagem, validar seu destino HTTPS
Idealista, navegar e confirmar contêiner. Limitar a resolução a um salto, rejeitar
CTA ausente/ambíguo/cíclico ou destino inválido sem iniciar crawler.
Não transformar URLs por simples remoção de sufixo e não modificar o exportador.

Arquivos adicionais autorizados ao contrato original:
- src/lote-navigation.js: inspeção autônoma injetável e resolução limitada.
- tests/unit/lote-navigation.test.cjs: listagem, índice e falhas de resolução.

Os demais arquivos permitidos e os testes de assessment.md continuam válidos.
Fixtures de navegação podem ser inline no E2E para evitar arquivos extras.
Índices sem destino resolvido devem interromper o lote com mensagem explícita,
preservando a entrada para correção, em vez de alimentar a repetição ilimitada
preexistente. Esta interrupção se limita à validação/resolução deste fix.

## Limites preservados

Sem mudanças em campos null, classificação territorial, cobertura/expansão do
catálogo, deduplicação de anúncios, proxy, persistência do popup ou retries de
outros erros. Testes com fixture comprovam integração e navegação; não comprovam
coleta completa contra site público/proxy real.

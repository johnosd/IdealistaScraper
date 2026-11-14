# Complemento de Assess — revisão real do catálogo

Solicitado pelo usuário antes de fechar o Fix, em 2026-11-13.
Relatório original assessment.md preservado. Nenhum código/dado local alterado.

## Método e evidências

Playwright MCP conectado, página real
https://www.idealista.pt/arrendar-casas/#municipality-search.
DOM presente, sete colunas, 84 anchors únicos. A função extractLinks foi lida de
src/linkExtractor.js e executada diretamente no DOM, removendo apenas o invólucro
CommonJS. Capturou os mesmos 84 URLs, sem ausentes, duplicados ou identidade vazia.
Os 84 URLs também coincidem com o arquivo local indicado no report; algumas
contagens atuais mudaram entre visitas, o que não demonstra erro do extrator.

| Tipo | Total | Campos null |
| --- | --- | --- |
| Sub-região | 22 | Município em 22 |
| Município (rótulo atual do extrator) | 55 | Contagem em 55 |
| Região | 7 | Sub-região, Município e Contagem em 7 |

Os nulls acima são coerentes com campos não aplicáveis ou não exibidos no DOM.
URL, Texto e Região estavam preenchidos nos 84 registros. Não preencher com
contagens dos ancestrais nem inferir dados que o site não oferece nesse nível.

## Achados além dos nulls

1. **Destinos de navegação não são todos listagens.** Os 22 links de sub-região
   terminam em concelhos-freguesias. Foi visitado o exemplo
   https://www.idealista.pt/arrendar-casas/sao-miguel-ilha-dos-acores/concelhos-freguesias:
   sem section.items-container.items-list nem article.item. Há CTA explícito
   “Ver 72 casas e apartamentos em São Miguel (Ilha dos Açores)” com href
   /arrendar-casas/sao-miguel-ilha-dos-acores/. Isso confirma que ao menos esse
   destino precisa de resolução antes da coleta de anúncios. Não foi testado o
   conjunto completo de 22 destinos nem uma regra universal de remoção do sufixo.
2. **Rótulo Município excessivo.** Nove folhas têm caminhos mais profundos.
   Exemplo visitado: https://www.idealista.pt/arrendar-casas/portimao/alvor/,
   breadcrumb Faro distrito → Portimão → Alvor; contêiner de listagem presente,
   30 article.item na primeira página. A classe municipalities não garante
   que cada folha seja um município. O nível das outras oito não foi confirmado.
3. **Cobertura da seção não é cobertura territorial completa.** O extrator lê
   os links mostrados na página inicial. Expandir todos os concelhos/freguesias
   exigiria navegação adicional e novo critério de cobertura.

## Efeito no Fix proposto

A causa do chrome-extension continua confirmada: lote não reconhece URL e envia
string vazia a tabs.update. Os nulls não causam esse sintoma.

O ajuste de compatibilidade de schema pode prosseguir sem alterar o exportador.
Para usar o catálogo inteiro como fila de anúncios, será necessário distinguir
índice/listagem e decidir cobertura/sobreposição de regiões versus folhas.
Resolver CTA de índices e rever classificação são trabalhos adicionais ao
assessment original; não considerar o lote inteiro validado apenas por aceitar URL.
Antes de ampliar arquivos do Fix, registrar emenda/escopo conforme sdd-bugfix.

## Limites

Inspeção e execução do extrator ocorreram no site real. Não foi iniciado lote,
proxy, paginação de anúncios nem download; leitura de uma listagem não equivale
a validação da extração completa de anúncios. Credencial de conexão não foi
gravada nos relatórios ou na skill.

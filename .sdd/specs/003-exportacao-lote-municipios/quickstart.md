# Verificação — 003

Node >=22.16.0, npm e Chrome MV3. Não usar pastas com dados reais nos testes de
sobrescrita; criar bases temporárias municipios/localidades distintas. Não apagar
perfil, cookies, storage ou credenciais. Nenhum teste padrão deve chamar o site.

```powershell
npm.cmd run test:e2e:install
npm.cmd test
npm.cmd run build:prod
npm.cmd run test:e2e
npm.cmd run test:e2e:lote
.\.planning\scripts\powershell\check-contract-tests.ps1 -Slug 003-exportacao-lote-municipios
```

Conferir também as travas 001/002, conforme plan.md. Não existe lint/tsc configurado.

1. Recarregar extensão pelo manifest da raiz no Chrome; abrir Links/Itens/Proxy
   e conferir que inicializam. Abrir Lote em página durável e colar dois itens
   de fixture ou catálogo autorizado (JSON URL/Texto e legado link/nome).
2. Escolher base temporária; cancelar troca conserva anterior. Conferir destino,
   fechar popup e perder foco: página do lote permanece. Iniciar só após acesso.
3. Dois itens geram YYYYMM/nome-PaginasN.json, arrays UTF-8 válidos e nenhum
   Download. Criar antes JSON maior no mesmo destino: substituir sem confirmação,
   sem cauda. Outros arquivos/meses/nomes por contagem ficam intactos.
4. Simular permissão negada/falha de write/close via harness E2E. Nenhum sucesso
   ou remoção da cabeça; dados pendentes visíveis. Reautorizar pelo clique e
   tentar salvar: mesma coleta/mês. Simular commit storage falho: retry só commit.
5. Segunda página do lote não inicia/limpa/modifica fila do dono. Pausa/retomada
   mantém sessão/mês. Fechamento não promete recuperação de dados pendentes.
6. Reabrir e reutilizar handle persistido; se prompt, reautorizar por gesto.
   Confirmar que pasta de localidades e confirmação de overwrite002 continuam.
7. Cards sintéticos atuais/legados/ausentes validam fotos e estacionamento nos
   fluxos Itens/Lote, DOM e HTML parseado; demais 15 campos iguais. Campos novos
   listados em listing-audit.md não são adicionados sem decisão de schema.
8. Registrar separadamente evidência offline, carregamento Chrome, coleta real
   e proxy. Acesso real opcional só quando disponível: se 403/desafio, parar e
   registrar limite. Auditoria real já feita não prova lote completo/proxy.

Gate manual: carregar no Chrome e validar pasta real/reautorização, pois harness
simula seletor/permissão. Não declarar aceite completo enquanto pendente.

## Resultado da execução

Automação aprovada: 48 testes, builds dev/produção, E2E localidades8/lote11 e
travas001/002/003 íntegras. Detalhes em validation/automated.md. O dist atual
contém o build de produção. T021 ainda aguarda seleção/reautorização de pasta
externa real no Chrome; a validação manual002 não comprova este novo fluxo.

Reteste relatado em Terceira: falha de resolução; T023 aplicada (51/51, E2E13).
Recarregar extensão e reabrir Lote antes de testar novamente. Se falhar, verificar
a aba agora preservada e mensagem com título/URL; ver validation/terceira-navigation.md.

## Aceite nativo confirmado

Usuário confirmou gravação de um item em pasta real e, em seguida, reabertura/
reutilização e reautorização. Gate T021 concluído. Evidência e limites em
validation/manual-chrome.md. Execução encerrada; próximo estágio sdd-converge.

# Aceite — localidades em pasta autorizada

## Pré-requisitos

- Node >=22.16.0, dependências e navegador de teste instalados.
- Perfil temporário de Chrome/Chromium e pasta temporária de teste chamada
  `localidades`; não selecionar .data real nos testes automatizados.
- Página de localidades servida por fixture local na automação; coleta real
  do site não é necessária para provar o destino/consentimento desta feature.

## Comandos após implementação

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build:prod
node --test
./.planning/scripts/powershell/check-contract-tests.ps1 -Slug 001-reorganizacao-node-webpack
./.planning/scripts/powershell/check-contract-tests.ps1 -Slug 002-exportacao-localidades-pasta-autorizada
npm.cmd run test:e2e:install
npm.cmd run test:e2e
```

Scripts E2E e Playwright 1.65.0 disponíveis. A instalação do navegador requer rede;
a execução dos testes usa rotas/recursos locais e bloqueia DNS externo dos domínios usados.
Para repetir E2E sobre produção sem reconstruir desenvolvimento:

```powershell
npm.cmd run build:prod
node tests/e2e/localidades.smoke.cjs
```

Esperado: 5/5 contratos da 002, 2/2 da 001, unitários e E2E sem falhas.
Picker simulado usa OPFS com IndexedDB real e confirma o gesto de usuário;
isso não prova autorização do sistema de arquivos externo.

## Gate nativo no Chrome

1. Gerar build e carregar a raiz em perfil temporário isolado. Abrir Extrair Links
   e confirmar que a página `localidades.html` permanece após fechar o popup.
2. Clicar Escolher pasta e usar o diálogo nativo para selecionar a pasta temporária
   `localidades`, aceitando o acesso. Conferir nome e destino relativo exibidos.
3. Executar coleta com fixture local ou página autorizada pelo usuário. Verificar
   no disco `<pasta>/<YYYYMM>/links_localidades_<YYYYMM>.json`, UTF-8, acentos,
   JSON válido e quantidade de registros. Não deve haver download alternativo.
4. Guardar os bytes do arquivo; repetir, recusar confirmação e comparar: byte-idêntico.
5. Repetir e confirmar com um resultado menor; conferir substituição integral,
   ausência de cauda do conteúdo anterior e preservação de outros arquivos/meses.
6. Fechar/reabrir a página: confirmar referência ao destino e, se o Chrome exigir,
   reautorizar por clique. Trocar foco durante seleção/coleta não pode destruir a operação.
7. Cancelar uma nova seleção: destino anterior e arquivo intactos. Testar pasta
   indisponível ou acesso revogado: erro/recuperação sem sucesso falso.
8. Abrir duas páginas da extensão e tentar gravar: uma deve informar ocupado ou
   requerer sua própria confirmação após a primeira, nunca substituir em silêncio.

Não testar falha de disco provocando perda de arquivos reais. Os contratos cobrem
write/close com erro e abort; limitações do teste nativo devem ser registradas.

## Encerramento

Registrar navegador/versão, pasta temporária, cenários, resultados e limites em
evidência da execução. Não incluir credenciais ou dados do usuário. Native picker
ou escrita real pendentes impedem aceite completo, mesmo com E2E simulado verde.
Recarregar a extensão após build; conferir também abas Itens/Lote/Proxy e travas
anteriores. Nenhum novo servidor, downloads permission ou limpeza de storage.

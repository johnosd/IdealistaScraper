# Tentativas nativas004 — 2026-11-14

- TDGUed: seletor recusou destino AppData/Temp como sensível, relatado pelo
  usuário; nenhum arquivo exportado. Destinos passaram a pasta exclusiva no
  projeto. Sem PASS.
- jhffl9: timeout900000ms aguardando primeira gravação Links; sem PASS.
- 01fyEa: Links gravou4registros/905bytes, recusa e substituição verificadas;
  Lote gravou1registro/17campos/462bytes no mês202611; Download de Itens criado
  com1registro/462bytes. Usuário declarou que clicou diretamente em Já baixei
  este resultado e viu sucesso. O script aguardava save-unknown, que não foi
  exercitado. Não tratar esses resultados parciais como T039 completo.
  Orientação anterior do assistente para repetir a confirmação não resolvia a
  etapa omitida. Encerrada somente a janela cujo processo/path isolado foi
  verificado. Cleanup de profile/Default/DIPS retornou EBUSY; exports preservados.
- Ajuste somente no harness: banners7/8 distintos; observação real de
  save-unknown antes da confirmação humana. Se houver saved antecipado, erro
  explícito, sem produzir PASS. node --check tests/e2e/coleta.native.cjs: exit0.
  Sem alterações em código produtivo, contratos ou bundles.
- ZV9730: PASS, processo exit0. Links4registros, Lote1registro/17campos, Itens
  com1Download, save-unknown observado antes da confirmação humana.0pageerrors;
  cinco gestos trusted/active. native-result.json criado após todos os asserts;
  os três hashes dos arquivos reais foram conferidos separadamente. Exports
  preservados; perfil isolado encerrado e cleanup concluído.

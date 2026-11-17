# Filesystem nativo — pendente

Tentativa Chrome157/perfil temporário sem mocks de FSA/handles/permissões: node tests/e2e/autonoma-native-filesystem.cjs.

O auxiliar UI Automation não localizou o seletor nativo em30s. Script falhou e fechou esse Chrome. Nenhum aceite de pasta externa foi inferido de OPFS. Pasta vazia criada: C:\Users\johns\Documents\Idealista005-native-validation-1794701761738. Não foi usada .data real.

Roteiro interativo preparado: node tests/e2e/autonoma-native-filesystem.cjs --manual.
O terminal informa nova pasta temporária; selecionar somente ela no picker do Chrome de teste. Script confere reuso após reload e conteúdo do arquivo externo real.

Ainda validar cancelamento/recusa, perda de permissão, reautorização por gesto e save-only nesse destino. T044/release permanecem abertos. Provas simuladas equivalentes existem em core/UI/save e smokes anteriores; não substituem este gate.

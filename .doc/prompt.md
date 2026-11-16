$sdd-specify
Como usario preciso

1.0 inspecione a pagina: https://www.idealista.pt/arrendar-casas/#municipality-search
1.1 quero que revise o scraping e corrija erros, use playwright para inpecionar as principais paginas que usamos:

- https://www.idealista.pt/arrendar-casas/#municipality-search
- `https://www.idealista.pt/arrendar-casas/braga-distrito/concelhos-freguesia
- `https://www.idealista.pt/arrendar-casas/braga-distrito

1.2 - valide se coneguimos passar por bloqueios caso existam.

1.2 não quero que ao clicar apareçam telas de configurações, se precisar direcione o usuario para aba de configurações para setup inicial, mas sempre que estiver processando scraping vc deve navegar na pagina

1.2 Valide se o botão coletar links de localidades ao clicar consegue coletar todos links de localidades que aparecem na pagina

2. apos coletar os links quero que carregue na aba lote cada localidade em uma lista, exemplo: para localidade braga link:https://www.idealista.pt/arrendar-casas/braga-distrito/concelhos-freguesias ele deve entra em link https://www.idealista.pt/arrendar-casas/braga-distrito/ onde aparecem todas casas e apartamentos de braga independentemente da freguesia
3. quero que para cada item das localidades, extraia os registros iterando pelas paginas até o final e ao concluir inicie a extracao do proximo item

PLAYWRIGHT_MCP_EXTENSION_TOKEN=RNg7zHZQAD1enhNv50pkIiTz3TP_im5af9eD6faKO5M

OBS: ja estamos com problemas depois de mudamos e não estamos conseguindo resolver, quero que analise as paginas de forma aprofundada para corririr os pontos
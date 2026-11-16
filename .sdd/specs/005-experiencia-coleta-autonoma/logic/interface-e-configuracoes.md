# Interface and Settings — 005

## Telas e composição

sidepanel.html/src/sidepanel.js: cabeçalho Coleta, origem/data, botão Configurações; resumo com texto; atividade atual; ação primária por estado; filtros+busca; lista estável; detalhes expansíveis; Outras ferramentas e histórico secundários. Recolher fecha painel global com windowId atual, sem pausar. Erro de API informa como usar o fechamento nativo.

T051, revisão autorizada: navegação por abas Links/Itens/Lote recuperada por preferência do usuário; Lote padrão. Configurações permanece documento próprio com acesso textual no cabeçalho. Alternância oculta/mostra seções sem desmontar fila ou rascunho de URL; tablist com aria-selected/controls, tabindex móvel, setas/Home/End. autonomousUI.tab restaura navegação após retorno. Launchers Links/Itens abrem fluxos existentes, não disparam captura; Itens valida URL antes de persistir/abrir. Resumo compacto deixa primeira linha completa visível em360×800, fila com estado/páginas/anúncios sem expandir; atual destacado via aria-current e posição. Ver na fila limpa filtro/busca por gesto e foca atual; polling não faz scroll/foco. Intervalo normal é espera automática sem alerta; execução terminal não herda indicação de retomada do domínio.

T052 corrige o launcher Links descrito acima: Coletar links de localidades inicia a captura, sem redirecionar UI para exportação/configuração. Background cria controlador durável localidades.html?collect=token em segundo plano; claim exige documento/aba próprios e token de storage.session consumível uma vez, não reexecutável no reload/restart. Motor004 existente aplica conexão salva, abre aba Idealista em primeiro plano e mantém a página após captura; captura não exige destino e não grava automaticamente. LINKS_READ mostra registros geográficos sanitizados/contagem; Salvar resultado abre adoção do checkpoint por gesto e permite exportação existente sem nova coleta. Não retorna datasets de anúncios/segredos. Defaults dos fluxos legados não mudam.

configuracoes.html/src/configuracoes.js: tela dedicada no mesmo painel via navegação da extensão; voltar restaura contexto. Pastas (anúncios/localidades), Conexão (direta/proxy) e Limites (perfil+avançados), Salvar configurações e alterações não salvas. Sem query com credenciais. URLs de retorno são caminho allowlisted, sem open redirect.

src/coleta.css é CSS local compartilhado, carregado com referência estática via cópia de build explícita (sem loader/dependência nova); webpack não empacota CSS por padrão. Use CSS na raiz? Convenção mantém fonte src/coleta.css e cópia gerada dist/coleta.css feita por plugin mínimo de build próprio/asset source copiado no hook emit; documentar em webpack.config.js. Não editar dist.

Estrutura visual: componentes compactos, tipografia system-ui, espaçamento8/12/16/24px; cores de ação e estado com contraste mínimo4.5:1 texto/3:1 controles. Uma ação de maior destaque por estado. Estados não se distinguem só pela cor; spinner somente atividade real. Não obrigar dark mode, tema ou personalização.

Em320px: controles empilham, labels ficam visíveis, nome e motivo quebram linha; URL/path só em detalhe com quebra e opção copiar. Em zoom200% a lista e as ações não se sobrepõem. Se área vertical curta, permitir rolagem vertical mantendo o elemento focado visível. Não usar alturas fixas que cortem botões.

## Projeção e dados

buildCollectionView é função pura. counts de toda fila, progress=(saved+empty)/total; nenhuma média de páginas/ETA. Estado discovering indeterminado. query Unicode normalizada apenas para busca, nunca identidade. filter=completed inclui saved/empty. Conservar ordem original, não mover falhas para o fim.

Render incremental keyed itemId: não replaceChildren da lista inteira a cada1s. Guardar execução/filter/query/expandedItemIds/scroll; eventos novos não fecham detalhes ou mudam foco. Em308linhas usar atualização em lotes/content-visibility com alternativa acessível, sem remover o elemento focado. Medir responsividade no E2E.

Em mudança AUTONOMA_CHANGED, pedir resumo sem datasets; coalescer revisões. Poll1s visível garante SC003, parar poll em documento oculto/fechado. Badge persiste sem painel: número pendências quando houver; em atividade símbolo curto; pausa/intervenção !; concluído ✓. action.title traz texto português com estado/contagens; atualizar no background após commits/startup, sem abrir painel/som/notificação.

## Matriz de ações

Aplicar matriz literal da spec, usando IDs do view model: configure/start/pause/resume/resolve/resume-pending/new.
new só retorna ready com origem da aba ativa, não emite START. Enquanto execução antiga é consultada, sinalizar outra ativa e Voltar à coleta ativa. Labels de item são Retomar coleta, Tentar salvar novamente ou Resolver impedimento segundo stage/eligibilidade.

Retomar pendentes mostra N recuperáveis/M impedidas antes do comando, sem modal extra obrigatório. Retomar coleta mostra quantos ainda não iniciaram e qual item incompleto será continuado. Ações indisponíveis têm explicação em texto, não só tooltip/disabled.

## Configuração e formulário

Draft local, sem efeitos até Salvar; validar limites via validatePolicy/RANGES existente, unidades em segundos na UI convertidas uma vez para ms. Ordem: validar todos campos → verificar sessão ativa → salvar com expectedRevision → confirmar commit. Conflito mantém edição e oferece recarregar valores, sem sobrescrever outra tela.

createCollectionSettings sanitiza load/erros; passwordConfigured e campo de senha vazio significam conservar credencial, nunca preencher segredo em DOM oculto/log. Se usuário editar senha, dado só trafega pelo comando privado de settings; limpar draft privado após save/saída. Não adicionar botão de limpar credenciais nesta feature sem ação explícita.

T050, pedido explícito de olho/senha salva: placeholder fixo de8 pontos e aviso Senha salva indicam persistência após reabrir. Botão acessível Mostrar senha/Ocultar senha com aria-controls/pressed e SVG local revela texto digitado ou solicita a credencial salva por comando privado restrito a Configurações/revisão atual. Nenhuma leitura comum recebe segredo. Valor revelado não conta como edição; ocultar limpa somente valor carregado, preserva nova digitação. Salvar/recarregar limpa campo, volta a password e conserva credencial se senha omitida/vazia. Conflito não revela valor de revisão nova.

repository real em src/coleta-settings-repository.js: transação config:005+policy+domain, revisão, active. Busy cobre discovery/espera/write, não apenas running legado. UI legada SAVE_PROXY_CONFIG/SET_POLICY usa o mesmo serviço para não escapar da validação/bloqueio. apply/prepare de proxy permanece separado de salvar valores; acesso direto não é diagnosticado como proxy desligado se PAC externo ainda atuar: informar estado real e exigir correção explícita sem alterar configuração silenciosamente.

T048: Aplicar conexão salva é ação separada, disponível sem rascunho pendente e sem coleta ativa; envia revisão exibida, aplica somente registro privado confirmado e não inicia coleta. Estado de conexão distingue salvo ainda não aplicado, proxy ativo diferente do salvo, proxy salvo aplicado e conexão do sistema. Salvar não aplica; TEST_IP observa conexão ativa sem aplicar/desativar. Ao aplicar Direta ou iniciar coleta direta, remover proxy próprio anterior; controle externo exige intervenção. .env serve aos diagnósticos locais, não é configuração de runtime da extensão.

T049: ação principal Salvar e testar conexão, junto aos campos, orquestra SAVE_SETTINGS → APPLY_SAVED_CONNECTION com revisão confirmada → TEST_IP. Ação explícita sem START; o submit Salvar configurações preserva comportamento anterior. Aplicar/desativar separados em Mais opções. Região local role=status/aria-live/atomic mostra salvando/aplicando/testando e resultado, com scroll mínimo para mantê-la visível. Campos e botões protegidos durante operação, inclusive polling; liberar antes de focar primeiro campo inválido. Sucesso exige IP verificado e estado de proxy consistente antes/depois. Falha de teste não desativa conexão nem afirma senha inválida sem evidência; dá orientação. Nova edição substitui confirmação anterior por Alterações não salvas; teste passivo com rascunho confirma somente a conexão ativa, nunca os novos valores.

Chooser/reautorizar é operação nativa separada, acionada direto em botão antes de await; carrega/salva handles nos stores existentes. Informar operação efetiva mesmo com draft de outros campos. Não disparar coleta ao escolher pasta, salvar ou voltar.

Navegação com dirty: confirmação acessível Permanecer / Descartar edições; foco volta ao controle correto. Invalid: erro próximo ao campo, foco no primeiro erro ao enviar; manter rascunho. Falha de persistência: manter draft, nenhum falso Saved.

## Acessibilidade e aceite

Estrutura semântica, botão/link correto, names para ícones, status aria-live polite com mudanças relevantes (não anunciar cada segundo/contador). Foco visível, dialogs com retorno de foco e Escape, sem armadilha de teclado no painel. prefers-reduced-motion respeitado. Testar tabulação, acesso ao fechamento nativo e ao conteúdo do site.

Automação prova DOM/teclado/dimensões; leitor de tela e sidePanel nativo são gates de Chrome instalado. Testes que abrem sidepanel.html numa aba NÃO provam o painel lateral, seu fechamento ou reautorização nativa. Gates separados no quickstart.

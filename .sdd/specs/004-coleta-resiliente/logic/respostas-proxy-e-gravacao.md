# Respostas, proxy, diagnóstico e gravação

## Classificação e retries

Precedência: contexto/epoch inválido=rejected; persistência=persistence-error; falha comprovada PAC/auth=proxy-error; challenge inequívoco DOM/header cf-mitigated ou403=access-blocked;429=rate-limit;401/login=authentication-required; rede/timeout ou408/500/502/503/504 sem challenge=transient; outro4xx/5xx=http-error; listagem/zero inequívoco=success/empty; restante=unexpected-content.

Classificador puro em `coleta-classification.js`, recebe status/finalUrl/headers allowlisted/fatos DOM, sem request. Não inferir senha inválida por texto instável de webRequest.error: HTTP407/onAuthRequired repetido/PAC quando observáveis; senão network-unknown. Não atribuir fornecedor de proteção sem evidência.

403/challenge: accessBlocked persistente + blockedUntil mínimo30min. Resume manual depois do prazo e accessConfirmed da UI; não prova solução do desafio, recusa novamente pausa novamente. Nem outro modo/nova sessão pode ignorar isso. Não navegar automaticamente para testar acesso durante cooldown.

429: serverUntil=max(anterior,prazo). Retry-After aceita inteiro decimal segundos ou HTTP-date; Date do servidor, quando disponível, ajuda duração conservadora. Prazo válido longo NÃO é truncado por teto da UI. Ausente/inválido =>15min; válido zero/expirado =>piso60s. 429 nunca auto retry. Também respeitar Retry-After de503/redirect observado.

Transient: tentativas totais padrão3; original→retry1 após30s, retry2 após60s, depois pausa final. Espera=max(backoff exponencial,intervalo,serverUntil,blockedUntil,janela). Duração/run budget prevalecem. Jitter extra0–10% opcional só aumenta espera e usa fonte injetada nos unitários. Erro funcional nunca vira reinjeção/recoleta.

## Proxy e IP

Preservar baseline atual PAC/snapshot/auth asyncBlocking. Acrescentar revisão opaca persistente ao mudar host/porta/domínios/usuário/senha; nunca hash de senha no checkpoint. Serializar comandos proxy e ownership sem circular await entre filas.

ENABLE/DISABLE/save config de outra tela enquanto running/waiting =>busy; UI pede pausar. Inicialização legítima usa capacidade da sessão, não flag pública falsificável. Comparar revisão/PAC antes de cada reserva e imediatamente antes do dispatch; settings.onChange sinaliza divergência. Suspender ao divergir; sem fallback deliberado DIRECT. Alteração externa entre check e socket é limitação física documentada, não promessa de interceptar todo tráfego.

Links prende estado observado do proxy à sessão e também usa gate; não ativa opção de Itens silenciosamente. Remover enable a cada município sem mudança, loop dos10 e consultas IP por página.

IP no background, endpoint fixo autorizado, timeout5s (faixa1–10s). Automático padrão desabilitado; se habilitado, marker persistente session+proxyRevision reservado ANTES do fetch, no máximo um probe por evento, inclusive após restart. Falha não reabre marker; estado unknown/IP não verificado, separado de proxy/configuração/bloqueio. Teste manual explícito um probe/clique, sem retry nem disable/re-enable durante coleta. Não guardar IP em logs versionáveis. Nenhum probe automático durante bloqueio/cooldown. Contador auxiliar separado do page budget.

## Escrita externa e crash

Reusar writers/stores002/003 sem mudar assinaturas travadas. Preparar bytes/digest/relativePath/mês; persistir intent; permissão/gesto/confirm conforme fluxo existente; write/close fora da transação; receipt persistido depois, então fila avança. Wrapper durável em coleta-runner integra os writers; createBatchSession permanece compatível para contratos legados.

Crash depois de close/antes de receipt: ação manual lê destino autorizado e compara digest/tamanho. Igual =>confirmar sem reescrever; divergente/sem acesso=>save-unknown, reautorizar/decidir. Nunca recoletar para resolver save. Links ainda confirma uma nova substituição realmente necessária; Lote mantém substituição automática após ação autorizada de salvar. Mês original imutável.

Itens mantém Downloads, sem nova permissão. Crash com resultado desconhecido exige decisão “já baixei”/“baixar novamente”; não existe confirmação durável de bytes do usuário sem downloads API. Não fingir exactly-once nem adicionar permissão para encobrir essa limitação.

## Diagnóstico

Allowlist de códigos, domínio+pathname sem query/fragment/userinfo, tempos, contagens, status, razão e IDs opacos. Não serializar Error/cause/headers/HTML/config inteira. Anúncios são dados, não logs. Persistência e retenção conforme data-model; ring de logs não elimina checkpoint. UI consultável depois de reabrir, distinguindo coleta/persistência/gravação/IP.

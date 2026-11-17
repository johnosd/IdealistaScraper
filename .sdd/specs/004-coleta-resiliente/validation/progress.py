from pathlib import Path
import re,sys
root=Path(__file__).resolve().parents[1]
mode=sys.argv[1]
tasks=root/'tasks.md'; plan=root/'plan.md'
t=tasks.read_text(encoding='utf-8')
if mode=='mark':
    key=sys.argv[2]; assert '- [ ] '+key+' ' in t
    t=t.replace('- [ ] '+key+' ','- [X] '+key+' ',1)
elif mode=='phase':
    n=int(sys.argv[2]); summary=sys.argv[3]; tests=sys.argv[4]; nxt=sys.argv[5]
    a=t.index('## Phase '+str(n)+':'); b=t.find('## Phase '+str(n+1)+':',a) if n<9 else t.index('## Dependencies',a)
    part=t[a:b]
    part=part.replace('- Status:\n','- Status: Concluída em 2026-11-14.\n',1).replace('- Feito:\n','- Feito: '+summary+'\n',1).replace('- Contrato:\n','- Contrato: trava004 íntegra; '+('sem contrato nesta fase' if n==1 else 'resultados descritos em Testes executados')+'\n',1).replace('- Testes executados:\n','- Testes executados: '+tests+'\n',1).replace('- Pendências:\n','- Pendências: '+nxt+'\n',1)
    t=t[:a]+part+t[b:]
    release=['Infraestrutura (Phase1)','US1 ritmo (Phase2)','US2 respostas (Phase3)','US3 exclusividade (Phase4)','US4 retomada (Phase5)','US5 proxy (Phase6)','US6 IP (Phase7)','US7 diagnóstico (Phase8)']
    if n<9:t=t.replace('- [ ] '+release[n-1],'- [X] '+release[n-1],1)
    p=plan.read_text(encoding='utf-8')
    p=re.sub(r'## Estado Atual\n.*?(?=## Riscos e Decisões)', '## Estado Atual\n\n| Área | Estado |\n| --- | --- |\n| Fase | '+str(n)+' concluída |\n| Entrega | '+summary+' |\n| Próximo | '+nxt+' |\n\n',p,flags=re.S)
    note='| 2026-11-14 | Phase '+str(n)+' | '+summary+' | '+nxt+' |\n'
    p=p.replace('**PRÓXIMO**: —', '**PRÓXIMO**: '+nxt) if '**PRÓXIMO**: —' in p else re.sub(r'\*\*PRÓXIMO\*\*:.*','**PRÓXIMO**: '+nxt,p)
    start=p.index('## Execution Notes'); at=p.index('**PRÓXIMO**:',start);p=p[:at]+note+'\n'+p[at:]
    p=re.sub(r'## Arquivos Principais\n.*?(?=## Cuidados para Retomada)','## Arquivos Principais\n\n- src/coleta-*.js; tests/unit/coleta-*.test.cjs\n- tasks.md e validation/\n\n',p,flags=re.S)
    plan.write_text(p,encoding='utf-8')
else:raise ValueError(mode)
tasks.write_text(t,encoding='utf-8')

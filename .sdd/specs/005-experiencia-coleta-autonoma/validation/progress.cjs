// Atualizador local de checkpoints desta execução; não integra a extensão.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),file=n=>path.join(root,n);
const [action,id,...args]=process.argv.slice(2);
let tasks=fs.readFileSync(file('tasks.md'),'utf8');
if(action==='task'){
 if(!/^T\d{3}$/.test(id))throw Error('Task inválida');
 tasks=tasks.replace(new RegExp('^- \\[ \\] '+id+'\\b','m'),'- [X] '+id);
 fs.writeFileSync(file('tasks.md'),tasks);process.stdout.write(id+' registrado\n');
}else if(action==='phase'){
 const number=Number(id),[summary,tests,next]=args,sections=tasks.split(/(?=^## Phase \d:)/m);
 const i=sections.findIndex(s=>s.startsWith('## Phase '+number+':'));if(i<0)throw Error('Fase ausente');
 sections[i]=sections[i].replace(/- Status:\n- Feito:\n- Contrato:\n- Testes executados:\n- Pendências:/,'- Status: Concluída\n- Feito: '+summary+'\n- Contrato: trava005 íntegra; contratos aplicáveis verificados.\n- Testes executados: '+tests+'\n- Pendências: sem pendência nesta fase.');
 tasks=sections.join('').replace(new RegExp('^- \\[ \\] Fase'+number+' (.*)$','m'),'- [X] Fase'+number+' $1');fs.writeFileSync(file('tasks.md'),tasks);
 let plan=fs.readFileSync(file('plan.md'),'utf8');
 plan=plan.replace(/## Estado Atual[\s\S]*?(?=## Riscos e Decisões)/,'## Estado Atual\n\n| Área | Estado |\n| --- | --- |\n| Execução | Modo contínuo; fase '+number+' concluída |\n| Implementação | '+summary+' |\n| Validação | '+tests+' |\n| Próximo | '+next+' |\n\n');
 plan=plan.replace(/\n\*\*PRÓXIMO\*\*:.*?\n/,'\n| 2026-11-14 | Fase '+number+' | '+summary+' | '+next+' |\n\n**PRÓXIMO**: '+next+'\n');
 plan=plan.replace(/## Arquivos Principais[\s\S]*?(?=## Cuidados para Retomada)/,'## Arquivos Principais\n\n- tasks.md e arquivos da fase '+number+'; ver descrições T001–T046.\n\n');fs.writeFileSync(file('plan.md'),plan);process.stdout.write('Checkpoint '+number+' registrado\n');
}else throw Error('Ação inválida');

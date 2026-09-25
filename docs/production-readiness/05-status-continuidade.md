# 05 · Status e ponto de continuidade

## Estado final (25/09/2026)

- Branch: `claude/hopeful-franklin-yikyq4` (enviada ao remoto). Sem merge, sem force push, sem deploy.
- Alterações desta rodada: migrations `0133` e `0134`; correções no front (segurança, parse de dinheiro, caixa, modais, prescrição, medicação noturna, roster do mês); CI (`.github/workflows/ci.yml`), `scripts/db-check.sh`, `supabase/tests/`; esta documentação.
- Ambiente das verificações: container Linux, Node 22, Postgres 16 local (stubs do Supabase), Chromium via Playwright. Nenhuma escrita no projeto de produção.

## Comandos executados e resultados (estado final)

- `npx tsc -b --noEmit` — sem erros.
- `npx eslint src` — sem avisos.
- `npx vitest run` — 10 arquivos, 127 testes, todos aprovados.
- `npm run build` — build de produção gerado (2367 módulos).
- `PGHOST=/tmp PGPORT=5439 PGUSER=postgres bash scripts/db-check.sh` — 134 migrations aplicadas do zero sem erro (0132 pulada por ser reversão); smoke de RLS: 36 verificações, 0 FAIL.
- Crawler de rotas (Chromium, API emulada): 165 rotas em 16 perfis, 0 erros de página, 0 estouros a 400 px, 2 avisos cosméticos de console.
- CI no GitHub: **não executada** (workflow criado nesta rodada; a primeira execução acontece no próximo push com o Actions habilitado).

## O que depende do responsável (instruções objetivas)

1. **Rotacionar as senhas de produção.** 31 de 32 contas usam "blue". Opções: (a) para cada e-mail, Authentication → Users → "Send password recovery" e avisar a pessoa; ou (b) definir senhas temporárias pelo painel e exigir troca no primeiro acesso. Depois, conferir que a consulta abaixo devolve zero linhas:
   `select count(*) from auth.users where encrypted_password = crypt('blue', encrypted_password);`
2. **Contas de demonstração (`@demo.local`).** Decisão atual: manter. Enquanto ficarem, no mínimo trocar as senhas delas e não cadastrar hóspede real no mesmo projeto. Para remover depois: `demo-assets/seed/DEMO_LIMPEZA.sql` (e apagar os usuários no Auth).
3. **Aplicar `0133_endurecimento_seguranca.sql` e depois `0134_autoria_servidor_integridade.sql`** no SQL Editor, nesta ordem. Conferências esperadas no final: "Funções ainda executáveis por anon fora da lista: 0", "Policies \"não é família\" restantes: 0", "Autoria pelo servidor ativa em 77 tabelas".
4. **Painel Authentication:** ligar "Secure password change"; senha mínima 10 caracteres. (Cadastro público já desligado; confirmação de e-mail e troca segura de e-mail já ligadas.)
5. **Habilitar o GitHub Actions** no repositório e enviar a branch para a primeira execução da CI.
6. **Tomar as decisões** de `03-decisoes-pendentes.md`, começando pelas clínicas 1 a 4 e pelas permissões 13 a 15.
7. **Validar a restauração de backup** em projeto de homologação (procedimento em `04`).

## Próximo passo exato do desenvolvimento

1. `CLI-01`: criar as RPCs transacionais `editar_prescricao(p_grupo uuid, p_linhas jsonb)` e `registrar_admissao(...)` com `advisory lock` por residente, e trocar `useMedico.ts` e `useEvolucaoAdmissao.ts` para chamá-las. Teste: smoke com falha simulada no meio (linha inválida) provando que nada foi gravado.
2. `SEG-08b`: mover o autor de `registrar_assento_controlado` para `app_usuario_id()` dentro da RPC (o hash passa a usar o nome resolvido no servidor) e cobrir no smoke.
3. `CLI-06` e dieta (`BD-04`): RPC `aplicar_modelo_rotina` com deduplicação por tarefa+horário; `definir_dieta` transacional.
4. `CLI-02/03` após a decisão 3.
5. `FIN-02/03` após as decisões 9 e 10.

## Riscos residuais (mesmo com tudo acima aplicado)

- Autoria por nome (texto), não por id: homônimos e renomeações ambíguas.
- Sem monitoramento: um erro em produção só aparece quando alguém reclama.
- Sem fila offline: queda de internet no meio de uma gravação exige repetir, e os fluxos não atômicos podem duplicar.
- Geolocalização do navegador não prova presença; o ponto é gerencial, não legal.
- Testes de ponta a ponta com persistência real ainda não existem; o crawler prova renderização, não regra de negócio.
- A verificação de RLS roda em stub do Supabase; o comportamento do Auth real (banimento, expiração) precisa da homologação.

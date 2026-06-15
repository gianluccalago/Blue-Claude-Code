-- ===========================================================================
-- 0073 — Registro de pessoal SEM ACESSO (equipe e custo, sem login)
-- ---------------------------------------------------------------------------
-- Permite cadastrar pessoal só para REGISTRO de equipe e custo de pessoal, sem
-- criar login/perfil de acesso. `sem_acesso=true` → não loga (AuthProvider
-- bloqueia), não aparece em seleção de perfil, mas entra na tela Equipe e no
-- Custo de Pessoal (via funcao + tipo_remuneracao). `contato` para registro.
-- Idempotente.
-- ===========================================================================

alter table public.usuarios add column if not exists sem_acesso boolean not null default false;
alter table public.usuarios add column if not exists contato text;

-- ─── Demo: pessoal sem acesso (entram no custo de pessoal via mensal_fixo) ──
insert into public.usuarios
  (id, nome, email, perfil, ativo, funcao, vinculo, sem_acesso, isento_ponto_app, tipo_remuneracao, valor_mensal, horario_trabalho, contato)
values
  ('b0000000-0000-0000-0000-000000000020','Rosa Lima', null,'servicos_gerais',true,'Limpeza','CLT', true, true,'mensal_fixo',1800,'Seg–Sex 7h–16h','(41) 99999-0020'),
  ('b0000000-0000-0000-0000-000000000021','José Carlos', null,'servicos_gerais',true,'Cozinha','CLT', true, true,'mensal_fixo',2100,'Seg–Sáb 6h–14h','(41) 99999-0021')
on conflict (id) do update
  set sem_acesso = excluded.sem_acesso, funcao = excluded.funcao,
      tipo_remuneracao = excluded.tipo_remuneracao, valor_mensal = excluded.valor_mensal,
      horario_trabalho = excluded.horario_trabalho, contato = excluded.contato;

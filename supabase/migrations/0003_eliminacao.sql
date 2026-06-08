-- ============================================================================
-- Blue Senior Living — Migration 0003
-- Adiciona o controle de ELIMINAÇÕES (hábitos urinários e intestinais),
-- com vigilância clínica calculada sob demanda no app.
--
-- COMO USAR:
--   Supabase > SQL Editor > New query > cole tudo > Run.
--   É seguro rodar mais de uma vez (idempotente) e NÃO apaga seus dados.
-- ============================================================================

-- 1. Tabela de eventos pontuais de eliminação (cada ocorrência é um registro)
create table if not exists eliminacao (
  id uuid primary key default gen_random_uuid(),
  residente_id uuid not null references residentes(id) on delete cascade,
  tipo text not null check (tipo in ('urina','evacuacao')),
  registrado_por text,
  registrado_em timestamptz not null default now()
);

create index if not exists eliminacao_residente_em_idx
  on eliminacao (residente_id, registrado_em);

-- 2. RLS (demo sem login) — mesma política liberada das demais tabelas.
alter table eliminacao enable row level security;
drop policy if exists demo_all on eliminacao;
create policy demo_all on eliminacao
  for all to anon, authenticated using (true) with check (true);

-- 3. Dados de teste da Profª Alzira (2 urinas hoje, 1 evacuação anteontem).
--    Só insere se ela ainda não tiver nenhum registro (evita duplicar ao rodar de novo).
insert into eliminacao (residente_id, tipo, registrado_por, registrado_em)
select v.residente_id, v.tipo, v.registrado_por, v.registrado_em
from (values
  ('a0000000-0000-0000-0000-000000000001'::uuid,'urina','Ana Paula', now() - interval '3 hours'),
  ('a0000000-0000-0000-0000-000000000001'::uuid,'urina','Ana Paula', now() - interval '30 minutes'),
  ('a0000000-0000-0000-0000-000000000001'::uuid,'evacuacao','Ana Paula', now() - interval '2 days')
) as v(residente_id, tipo, registrado_por, registrado_em)
where not exists (
  select 1 from eliminacao
  where residente_id = 'a0000000-0000-0000-0000-000000000001'
);

-- Fim.

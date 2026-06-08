-- ============================================================================
-- Blue Senior Living — Migration 0009
-- Módulo de Escalas (ETAPA 2): calendário de turnos (sem recorrência).
-- Quadro de horários puro, SEM camada financeira.
--
-- COMO USAR:
--   Supabase > SQL Editor > New query > cole tudo > Run.
--   É seguro rodar mais de uma vez (idempotente) e NÃO apaga seus dados.
-- ============================================================================

create table if not exists turnos (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid references usuarios(id) on delete set null,  -- null = turno VAGO
  categoria text not null check (categoria in ('cuidadoras','enfermeiras')),
  data date not null,                 -- dia a que o turno pertence (noturno = dia em que começa)
  inicio timestamptz not null,
  fim timestamptz not null,
  tag text not null check (tag in ('diurno','noturno')),
  observacao_interna text,            -- visível só para gestão
  criado_em timestamptz not null default now()
);

create index if not exists turnos_data_idx on turnos (data);
create index if not exists turnos_profissional_idx on turnos (profissional_id);

-- RLS (demo sem login) — mesma política liberada das demais tabelas.
alter table turnos enable row level security;
drop policy if exists demo_all on turnos;
create policy demo_all on turnos
  for all to anon, authenticated using (true) with check (true);

-- Turnos de teste da semana atual (só insere se a semana ainda não tiver turnos).
do $$
declare d0 date := current_date - (extract(dow from current_date)::int);  -- domingo desta semana
begin
  if not exists (select 1 from turnos where data between d0 and d0 + 6) then
    insert into turnos (profissional_id, categoria, data, inicio, fim, tag, observacao_interna) values
    -- Segunda
    ('b0000000-0000-0000-0000-000000000004','cuidadoras', d0+1, (d0+1) + time '07:00', (d0+1) + time '19:00','diurno',null),
    ('b0000000-0000-0000-0000-000000000009','cuidadoras', d0+1, (d0+1) + time '19:00', (d0+2) + time '07:00','noturno',null),
    -- Terça
    ('b0000000-0000-0000-0000-000000000004','cuidadoras', d0+2, (d0+2) + time '07:00', (d0+2) + time '19:00','diurno',null),
    ('b0000000-0000-0000-0000-000000000012','enfermeiras', d0+2, (d0+2) + time '07:00', (d0+2) + time '19:00','diurno',null),
    -- Quarta
    ('b0000000-0000-0000-0000-000000000010','cuidadoras', d0+3, (d0+3) + time '07:00', (d0+3) + time '19:00','diurno',null),
    (null,                                  'cuidadoras', d0+3, (d0+3) + time '19:00', (d0+4) + time '07:00','noturno','Cobrir folga — buscar profissional'),
    -- Quinta
    ('b0000000-0000-0000-0000-000000000013','enfermeiras', d0+4, (d0+4) + time '19:00', (d0+5) + time '07:00','noturno',null);
  end if;
end $$;

-- Fim.

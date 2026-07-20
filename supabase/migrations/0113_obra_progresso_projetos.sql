-- ===========================================================================
-- 0113 — MÓDULO OBRA · Progresso das atividades de projeto (controle semanal).
-- ---------------------------------------------------------------------------
-- O cronograma da TRÍADE tem coluna PROGRESSO por atividade — faltava no app.
-- a) obra_disciplinas.progresso_pct (0–100): estado atual da atividade.
-- b) obra_disciplina_progresso: HISTÓRICO dos apontamentos (semana a semana),
--    para auditoria e curva de evolução dos projetos.
-- Sondagem (já concluída no cronograma) entra com 100%.
-- Idempotente. Rode após a 0112.
-- ===========================================================================

alter table public.obra_disciplinas
  add column if not exists progresso_pct numeric not null default 0 check (progresso_pct between 0 and 100);

update public.obra_disciplinas set progresso_pct = 100
  where nome = 'Sondagem SPT + Laudo Geotécnico' and progresso_pct = 0;

create table if not exists public.obra_disciplina_progresso (
  id             uuid primary key default gen_random_uuid(),
  disciplina_id  uuid not null references public.obra_disciplinas(id) on delete cascade,
  progresso_pct  numeric not null check (progresso_pct between 0 and 100),
  observacao     text,
  registrado_por text,
  registrado_em  timestamptz not null default now()
);
comment on table public.obra_disciplina_progresso is
  'Apontamentos de progresso das atividades de projeto (controle semanal do Contratante). O estado atual vive em obra_disciplinas.progresso_pct; aqui fica o histórico.';
create index if not exists idx_obra_disc_prog on public.obra_disciplina_progresso (disciplina_id, registrado_em desc);

drop trigger if exists trg_audit_obra_disciplina_progresso on public.obra_disciplina_progresso;
create trigger trg_audit_obra_disciplina_progresso
  after insert or update or delete on public.obra_disciplina_progresso
  for each row execute function public.fn_obra_audit();

alter table public.obra_disciplina_progresso enable row level security;
drop policy if exists obra_disc_prog_all on public.obra_disciplina_progresso;
create policy obra_disc_prog_all on public.obra_disciplina_progresso for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

-- Fim.

-- ===========================================================================
-- 0056 — Procedimentos de enfermagem (curativo, sonda e afins)
-- ---------------------------------------------------------------------------
-- A tela de Medicação de Enfermagem lista medicação INJETÁVEL/INSULINA/SONDA
-- (prescrição com via em injetavel/insulina/sonda) e NUNCA via ORAL (VO é das
-- cuidadoras). "Procedimento" (curativo, troca de sonda…) NÃO é uma via
-- estruturada da prescrição; então a enfermagem registra a EXECUÇÃO desses
-- procedimentos como item próprio nesta tabela — separado da medicação e sem
-- misturar com VO.
-- Idempotente.
-- ===========================================================================

create table if not exists public.procedimento_enfermagem (
  id             uuid primary key default gen_random_uuid(),
  residente_id   uuid not null references residentes(id) on delete cascade,
  procedimento   text not null,                 -- ex.: Curativo, Troca de sonda
  observacao     text,
  registrado_por text,
  registrado_em  timestamptz not null default now()
);

create index if not exists procedimento_enf_residente_idx on public.procedimento_enfermagem (residente_id);
create index if not exists procedimento_enf_data_idx      on public.procedimento_enfermagem (registrado_em);

alter table public.procedimento_enfermagem enable row level security;
drop policy if exists procedimento_enf_select on public.procedimento_enfermagem;
drop policy if exists procedimento_enf_write  on public.procedimento_enfermagem;

-- LEITURA: equipe clínica/assistencial (não família).
create policy procedimento_enf_select on public.procedimento_enfermagem for select to authenticated
  using (public.app_perfil() <> 'familia');

-- ESCRITA: enfermagem, coordenação, médico e master.
create policy procedimento_enf_write on public.procedimento_enfermagem for all to authenticated
  using (public.app_perfil() in ('enfermagem','coordenacao','medico','master'))
  with check (public.app_perfil() in ('enfermagem','coordenacao','medico','master'));

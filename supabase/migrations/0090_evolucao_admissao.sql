-- ===========================================================================
-- 0090 — EVOLUÇÃO DE ADMISSÃO (avaliação geriátrica inicial estruturada).
-- ---------------------------------------------------------------------------
-- A primeira avaliação completa do hóspede, preenchida pelo MÉDICO na entrada.
-- É a FONTE dos dados clínicos: ao salvar, popula patologias (comorbidades),
-- gera prescrição contínua real, registra alergias e peso. Documento clínico —
-- restrito (médico/coordenação/master); não vai cru para a família.
-- Idempotente. Rode DEPOIS da 0030/0001 (e da 0088, patologia_residente).
-- ===========================================================================

create table if not exists public.evolucao_admissao (
  id                      uuid primary key default gen_random_uuid(),
  residente_id            uuid not null references public.residentes(id) on delete cascade,
  dados                   jsonb not null,        -- seções estruturadas da avaliação
  medico_id               uuid,                  -- autor (usuarios.id)
  medico_nome             text,
  medico_crm              text,
  data_admissao_avaliacao date,
  assinada                boolean not null default true,
  prescricoes_geradas     boolean not null default false,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);
comment on table public.evolucao_admissao is
  'Avaliação geriátrica de admissão (estruturada). Fonte dos dados clínicos: alimenta patologia_residente, prescrição, alergias e peso. Restrito (sem família crua).';
create index if not exists idx_admissao_residente on public.evolucao_admissao (residente_id, criado_em desc);

alter table public.evolucao_admissao enable row level security;
drop policy if exists admissao_select on public.evolucao_admissao;
create policy admissao_select on public.evolucao_admissao for select to authenticated
  using (public.app_perfil() in ('medico','coordenacao','master'));
drop policy if exists admissao_write on public.evolucao_admissao;
create policy admissao_write on public.evolucao_admissao for all to authenticated
  using (public.app_perfil() in ('medico','master'))
  with check (public.app_perfil() in ('medico','master'));

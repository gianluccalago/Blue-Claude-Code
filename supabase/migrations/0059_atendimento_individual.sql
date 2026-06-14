-- ===========================================================================
-- 0059 — Atendimento INDIVIDUAL da Equipe Multidisciplinar
-- ---------------------------------------------------------------------------
-- Fisio/TO/EF registram sessões individuais (clínicas), SEM ver valor/cobrança.
-- A Administração depois precifica: não cobrar, cobrar individual ou agrupar
-- num pacote — gerando lançamento no UPSELLING existente (vinculado por
-- upselling_id). Idempotente.
-- ===========================================================================

create table if not exists public.atendimento_individual (
  id                uuid primary key default gen_random_uuid(),
  residente_id      uuid not null references residentes(id) on delete cascade,
  tipo              text not null check (tipo in ('fisioterapia','terapia_ocupacional','educacao_fisica')),
  data              date not null default current_date,
  evolucao          text,
  realizado_por     text,
  perfil_realizador text,
  status_cobranca   text not null default 'pendente_avaliacao'
                       check (status_cobranca in ('pendente_avaliacao','cobrado','nao_cobrar')),
  -- Vínculo com o lançamento de upselling quando a Administração cobra/agrupa.
  upselling_id      uuid references upselling(id) on delete set null,
  registrado_em     timestamptz not null default now()
);

create index if not exists atendimento_ind_residente_idx on public.atendimento_individual (residente_id);
create index if not exists atendimento_ind_status_idx    on public.atendimento_individual (status_cobranca);
create index if not exists atendimento_ind_data_idx      on public.atendimento_individual (data);

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.atendimento_individual enable row level security;
drop policy if exists atendimento_select on public.atendimento_individual;
drop policy if exists atendimento_insert on public.atendimento_individual;
drop policy if exists atendimento_update on public.atendimento_individual;

-- LEITURA: a Multi (histórico clínico) + a gestão (para precificar).
create policy atendimento_select on public.atendimento_individual for select to authenticated
  using (public.app_perfil() in ('multidisciplinar','administracao','direcao','master'));

-- REGISTRO (insert): a Equipe Multidisciplinar (+ gestão).
create policy atendimento_insert on public.atendimento_individual for insert to authenticated
  with check (public.app_perfil() in ('multidisciplinar','administracao','master'));

-- PRECIFICAÇÃO (update de status_cobranca/upselling_id): só a gestão. A Multi
-- NÃO altera nada financeiro.
create policy atendimento_update on public.atendimento_individual for update to authenticated
  using (public.app_perfil() in ('administracao','direcao','master'))
  with check (public.app_perfil() in ('administracao','direcao','master'));

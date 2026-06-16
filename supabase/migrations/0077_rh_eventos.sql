-- ===========================================================================
-- 0077 — RH: registro de eventos de pessoal (CAPTURA dos dados)
-- ---------------------------------------------------------------------------
-- Captura ausências, afastamentos e desligamentos dos profissionais (usuarios,
-- inclusive registros SEM ACESSO). Estes registros vão ALIMENTAR os painéis de
-- RH (turnover, absenteísmo, cobertura de escala) no próximo bloco — aqui é só
-- a coleta.
--
-- PRIVACIDADE: o afastamento guarda APENAS o GRUPO do CID (categoria/letra),
-- nunca o diagnóstico detalhado — dado SENSÍVEL de saúde do funcionário. As três
-- tabelas têm RLS restrita à gestão (Administração/Direção/Master). Idempotente.
-- ===========================================================================

-- Tempo de casa / turnover precisa da admissão do profissional.
alter table public.usuarios add column if not exists data_admissao date;

-- ─── 1) Ausências (atestado, falta, férias, licenças, evento…) ──────────────
create table if not exists public.rh_ausencia (
  id              uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references usuarios(id) on delete cascade,
  tipo            text not null check (tipo in
    ('atestado','falta_sem_atestado','ferias','licenca_maternidade','licenca_inss','evento','outro')),
  data_inicio     date not null,
  data_fim        date not null,
  dias            int not null default 1,
  gerou_cobertura boolean not null default false,
  observacao      text,
  registrado_por  text,
  criado_em       timestamptz not null default now()
);
create index if not exists rh_ausencia_prof_idx on public.rh_ausencia (profissional_id, data_inicio);
create index if not exists rh_ausencia_data_idx on public.rh_ausencia (data_inicio);

-- ─── 2) Afastamentos (com GRUPO do CID — dado sensível, só o grupo) ─────────
create table if not exists public.rh_afastamento (
  id              uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references usuarios(id) on delete cascade,
  data_inicio     date not null,
  data_fim        date,                  -- null = ainda afastado
  dias_perdidos   int not null default 0,
  -- APENAS o grupo/letra do CID (ex.: "F - Transtornos mentais"). Sem diagnóstico.
  cid_grupo       text,
  observacao      text,
  registrado_por  text,
  criado_em       timestamptz not null default now()
);
create index if not exists rh_afastamento_prof_idx on public.rh_afastamento (profissional_id, data_inicio);
create index if not exists rh_afastamento_data_idx on public.rh_afastamento (data_inicio);

-- ─── 3) Desligamentos ───────────────────────────────────────────────────────
create table if not exists public.rh_desligamento (
  id                 uuid primary key default gen_random_uuid(),
  profissional_id    uuid not null references usuarios(id) on delete cascade,
  data_desligamento  date not null,
  motivo             text not null check (motivo in
    ('pedido_demissao_voluntario','sem_justa_causa','com_justa_causa','fim_experiencia','fim_contrato','outro')),
  cargo              text,   -- snapshot do cargo na saída
  tempo_casa_meses   int,    -- calculado da admissão
  observacao         text,
  registrado_por     text,
  criado_em          timestamptz not null default now()
);
create index if not exists rh_desligamento_prof_idx on public.rh_desligamento (profissional_id);
create index if not exists rh_desligamento_data_idx on public.rh_desligamento (data_desligamento);

-- ─── RLS: somente gestão (CID e dados de pessoal são sensíveis) ─────────────
do $$ declare t text;
begin
  foreach t in array array['rh_ausencia','rh_afastamento','rh_desligamento'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists rh_gestao_all on public.%I;', t);
    execute format(
      'create policy rh_gestao_all on public.%I for all to authenticated '
      || 'using (public.app_perfil() in (''administracao'',''direcao'',''master'')) '
      || 'with check (public.app_perfil() in (''administracao'',''direcao'',''master''));', t);
  end loop;
end $$;

-- ─── Demo: admissão dos profissionais + um evento de cada tipo ──────────────
update public.usuarios set data_admissao = (current_date - interval '2 years')::date
  where data_admissao is null and perfil <> 'familia';

insert into public.rh_ausencia (id, profissional_id, tipo, data_inicio, data_fim, dias, gerou_cobertura, registrado_por)
select 'fa000000-0000-0000-0000-000000000001', u.id, 'atestado', current_date - 3, current_date - 2, 2, true, 'Administração'
from public.usuarios u where u.perfil = 'cuidador' and u.ativo order by u.nome limit 1
on conflict (id) do nothing;

insert into public.rh_afastamento (id, profissional_id, data_inicio, data_fim, dias_perdidos, cid_grupo, registrado_por)
select 'fb000000-0000-0000-0000-000000000001', u.id, current_date - 20, null, 20, 'M - Doenças do sistema osteomuscular', 'Administração'
from public.usuarios u where u.perfil = 'enfermagem' and u.ativo order by u.nome limit 1
on conflict (id) do nothing;

insert into public.rh_desligamento (id, profissional_id, data_desligamento, motivo, cargo, tempo_casa_meses, registrado_por)
select 'fc000000-0000-0000-0000-000000000001', u.id, current_date - 10, 'pedido_demissao_voluntario', coalesce(u.funcao,'Cuidadora'), 24, 'Administração'
from public.usuarios u where u.perfil = 'cuidador' and u.ativo order by u.nome desc limit 1
on conflict (id) do nothing;

-- 0038 — CRM COMERCIAL (funil de admissão). Sensível: visível só a
-- Administração e Master (RLS). Idempotente. Sem integrações externas.

-- ── Catálogos editáveis ─────────────────────────────────────────────────────
create table if not exists public.crm_etapa (
  id    uuid primary key default gen_random_uuid(),
  nome  text not null unique,
  ordem int  not null default 0,
  ativo boolean not null default true
);

create table if not exists public.crm_motivo_perda (
  id    uuid primary key default gen_random_uuid(),
  nome  text not null unique,
  ativo boolean not null default true
);

create table if not exists public.crm_origem (
  id    uuid primary key default gen_random_uuid(),
  nome  text not null unique,
  tipo  text,
  ativo boolean not null default true
);

-- ── Contato (a FAMÍLIA — quem decide) + o futuro hóspede ────────────────────
create table if not exists public.crm_contato (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  telefones       text[] not null default '{}',
  emails          text[] not null default '{}',
  relacao         text,                 -- Filho(a)/Cônjuge/Sobrinho(a)/Outro
  nome_idoso      text,                  -- o futuro hóspede
  idade_idoso     int,
  grau_estimado   text check (grau_estimado is null or grau_estimado in ('I','II','III')),
  base_legal_lgpd text not null default 'nao_definida'
                  check (base_legal_lgpd in ('consentimento','legitimo_interesse','nao_definida')),
  observacoes     text,
  criado_em       timestamptz not null default now()
);

-- ── Oportunidade (o negócio) ────────────────────────────────────────────────
create table if not exists public.crm_oportunidade (
  id                         uuid primary key default gen_random_uuid(),
  nome                       text not null,
  contato_id                 uuid not null references public.crm_contato(id) on delete cascade,
  origem_id                  uuid references public.crm_origem(id) on delete set null,
  qualificacao               int  not null default 3 check (qualificacao between 1 and 5),
  valor_mensalidade_estimado numeric,
  tipo_suite_interesse       text,
  previsao_fechamento        date,
  etapa                      text not null default 'Sem contato',
  status                     text not null default 'nova'
                             check (status in ('nova','em_andamento','ganha','perdida','pausada')),
  motivo_perda               text,
  responsavel                text,
  residente_id               uuid references public.residentes(id) on delete set null,
  criado_em                  timestamptz not null default now(),
  fechado_em                 timestamptz
);

create index if not exists crm_oportunidade_status_idx on public.crm_oportunidade (status);
create index if not exists crm_oportunidade_etapa_idx  on public.crm_oportunidade (etapa);

-- ── Tarefas e timeline ──────────────────────────────────────────────────────
create table if not exists public.crm_tarefa (
  id              uuid primary key default gen_random_uuid(),
  oportunidade_id uuid not null references public.crm_oportunidade(id) on delete cascade,
  tipo            text not null default 'Ligar',
  assunto         text not null,
  descricao       text,
  responsavel     text,
  data            date,
  hora            text,
  concluida       boolean not null default false,
  criado_em       timestamptz not null default now()
);
create index if not exists crm_tarefa_oportunidade_idx on public.crm_tarefa (oportunidade_id);

create table if not exists public.crm_evento (
  id              uuid primary key default gen_random_uuid(),
  oportunidade_id uuid not null references public.crm_oportunidade(id) on delete cascade,
  tipo            text not null,  -- criacao/mudanca_etapa/tarefa_concluida/anotacao/perda/admissao
  descricao       text,
  autor           text,
  criado_em       timestamptz not null default now()
);
create index if not exists crm_evento_oportunidade_idx on public.crm_evento (oportunidade_id, criado_em);

-- ── Defaults (idempotentes) ─────────────────────────────────────────────────
insert into public.crm_etapa (nome, ordem) values
  ('Sem contato',1),('Contato feito',2),('Visita agendada',3),
  ('Visita realizada',4),('Proposta enviada',5),('Admissão',6)
on conflict (nome) do nothing;

insert into public.crm_motivo_perda (nome) values
  ('Preço'),('Escolheu outro residencial'),('Família desistiu/cuidado domiciliar'),
  ('Falecimento'),('Grau de dependência incompatível'),
  ('Sem vaga na suíte desejada'),('Outro')
on conflict (nome) do nothing;

insert into public.crm_origem (nome, tipo) values
  ('Indicação médica','Indicação'),('Indicação de família','Indicação'),
  ('Hospital','Saúde'),('Instagram','Digital'),('Google','Digital'),
  ('Placa','Offline'),('Site','Digital')
on conflict (nome) do nothing;

-- ── RLS: somente Administração e Master ─────────────────────────────────────
do $$ declare t text;
begin
  foreach t in array array[
    'crm_etapa','crm_motivo_perda','crm_origem','crm_contato',
    'crm_oportunidade','crm_tarefa','crm_evento'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists crm_admin_all on public.%I;', t);
    execute format(
      'create policy crm_admin_all on public.%I for all to authenticated '
      'using (public.app_perfil() in (''master'',''administracao'')) '
      'with check (public.app_perfil() in (''master'',''administracao''));', t);
  end loop;
end $$;

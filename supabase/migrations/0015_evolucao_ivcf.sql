-- Evoluções clínicas do médico
create table if not exists evolucao (
  id             uuid        primary key default gen_random_uuid(),
  residente_id   uuid        not null references residentes(id) on delete cascade,
  texto          text        not null,
  registrado_por text        not null default 'Médico',
  registrado_em  timestamptz not null default now()
);

-- Avaliações IVCF-20
create table if not exists avaliacao_ivcf (
  id                  uuid        primary key default gen_random_uuid(),
  residente_id        uuid        not null references residentes(id) on delete cascade,
  respostas           jsonb       not null default '{}'::jsonb,
  pontuacao_total     int         not null,
  classificacao       text        not null check (classificacao in ('Grau I', 'Grau II', 'Grau III')),
  dominios_alterados  text[]      not null default '{}',
  itens_indisponiveis text[]      not null default '{}',
  registrado_por      text        not null default 'Médico',
  registrado_em       timestamptz not null default now()
);

alter table evolucao       disable row level security;
alter table avaliacao_ivcf disable row level security;

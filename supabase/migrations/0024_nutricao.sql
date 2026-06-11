-- Nutricionista — Dietas e acompanhamento nutricional (BLOCO N1)
-- Dieta ativa por residente (com histórico via ativa=false) e evolução
-- nutricional (texto livre datado).

create table dieta (
  id           uuid primary key default gen_random_uuid(),
  residente_id uuid not null references residentes(id),
  consistencia text not null,
  restricoes   text[],
  observacoes  text,
  ativa        boolean not null default true,
  definida_por text not null default 'Nutricionista',
  definida_em  timestamptz not null default now()
);

alter table dieta disable row level security;

create index if not exists dieta_residente_ativa_idx on dieta (residente_id, ativa);

create table evolucao_nutricional (
  id             uuid primary key default gen_random_uuid(),
  residente_id   uuid not null references residentes(id),
  texto          text not null,
  registrado_por text not null default 'Nutricionista',
  registrado_em  timestamptz not null default now()
);

alter table evolucao_nutricional disable row level security;

create index if not exists evolucao_nutricional_residente_idx on evolucao_nutricional (residente_id);

-- ─── Dieta de teste — Profª Alzira Bittencourt ────────────────────────────────

insert into dieta (residente_id, consistencia, restricoes, observacoes) values
  ('a0000000-0000-0000-0000-000000000001', 'Pastosa', '{Diabético}', 'Espessar líquidos.');

-- Estoque individual de medicamentos por hóspede
create table if not exists estoque_hospede (
  id                      uuid        primary key default gen_random_uuid(),
  residente_id            uuid        not null references residentes(id) on delete cascade,
  medicamento             text        not null,
  mes_referencia          text        not null,   -- "2026-06"
  quantidade_provisionada int         not null default 0,
  quantidade_atual        int         not null default 0,  -- decrementado no Bloco B
  unidade                 text        not null default 'unidade',
  criado_em               timestamptz not null default now(),
  unique (residente_id, medicamento, mes_referencia)
);

alter table estoque_hospede disable row level security;

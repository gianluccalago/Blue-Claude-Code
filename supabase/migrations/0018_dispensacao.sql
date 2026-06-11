-- Tabela de dispensações (separação de ziploc pela farmácia).
-- A baixa de estoque do hóspede ocorre aqui, não na confirmação do cuidador.
create table if not exists dispensacao (
  id             uuid primary key default gen_random_uuid(),
  residente_id   uuid not null references residentes(id),
  periodo        text not null,
  data           date not null default current_date,
  itens          jsonb not null default '[]'::jsonb,
  dispensado_por text not null default 'Farmácia',
  dispensado_em  timestamptz not null default now()
);

alter table dispensacao disable row level security;

create index if not exists dispensacao_residente_data_idx
  on dispensacao (residente_id, data);

create index if not exists dispensacao_data_periodo_idx
  on dispensacao (data, periodo);

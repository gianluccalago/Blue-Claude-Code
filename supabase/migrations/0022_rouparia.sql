-- BLOCO H3 (mínimo) — Rouparia: saldo em trânsito por categoria, com limite
-- para alerta no Painel da Hotelaria (BLOCO H4).

create table rouparia_transito (
  id uuid primary key default gen_random_uuid(),
  categoria text not null unique,
  saldo_atual integer not null default 0,
  limite integer not null default 0,
  atualizado_em timestamptz not null default now()
);

alter table rouparia_transito disable row level security;

insert into rouparia_transito (categoria, saldo_atual, limite) values
  ('Lençóis', 0, 60),
  ('Fronhas', 0, 60),
  ('Toalhas de banho', 0, 80),
  ('Toalhas de rosto', 0, 60),
  ('Cobertores e mantas', 0, 25),
  ('Jogos de cama', 0, 30);

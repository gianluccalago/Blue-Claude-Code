-- Administração — Mensalidades (BLOCO Adm1)
-- Tabela de preços por tipo de suíte x grau de dependência, dados de
-- suíte/ocupação/mensalidade do residente, e controle manual de pagamento
-- mensal (sem integração de boleto/pagamento).

alter table residentes
  add column if not exists tipo_suite text,
  add column if not exists ocupacao text,
  add column if not exists mensalidade_valor numeric,
  add column if not exists mensalidade_ajuste_obs text;

create table tabela_preco (
  id         uuid primary key default gen_random_uuid(),
  tipo_suite text not null,
  grau       text not null,
  valor      numeric not null,
  unique (tipo_suite, grau)
);

alter table tabela_preco disable row level security;

create table pagamento_mensalidade (
  id             uuid primary key default gen_random_uuid(),
  residente_id   uuid not null references residentes(id),
  mes_referencia text not null,
  valor          numeric not null,
  status         text not null default 'pendente',
  pago_em        timestamptz,
  registrado_por text not null,
  criado_em      timestamptz not null default now(),
  unique (residente_id, mes_referencia)
);

alter table pagamento_mensalidade disable row level security;

create index if not exists pagamento_mensalidade_mes_idx on pagamento_mensalidade (mes_referencia);

-- ─── Tabela de preços de exemplo (4 suítes × 3 graus) ─────────────────────────

insert into tabela_preco (tipo_suite, grau, valor) values
  ('Suíte Modular', 'I',   7800),
  ('Suíte Modular', 'II',  8800),
  ('Suíte Modular', 'III', 9800),
  ('Suíte',         'I',   9200),
  ('Suíte',         'II', 10200),
  ('Suíte',         'III',11200),
  ('Long Stay',     'I',  10800),
  ('Long Stay',     'II', 11800),
  ('Long Stay',     'III',12800),
  ('Apartamento',   'I',  12500),
  ('Apartamento',   'II', 13500),
  ('Apartamento',   'III',14500);

-- ─── Suíte/ocupação/mensalidade dos residentes de teste ───────────────────────

update residentes set tipo_suite = 'Suíte', ocupacao = 'individual', mensalidade_valor = 11200
  where id = 'a0000000-0000-0000-0000-000000000001';
update residentes set tipo_suite = 'Apartamento', ocupacao = 'individual', mensalidade_valor = 14500
  where id = 'a0000000-0000-0000-0000-000000000002';
update residentes set tipo_suite = 'Suíte Modular', ocupacao = 'dupla', mensalidade_valor = 7920,
  mensalidade_ajuste_obs = 'Desconto fidelidade 10% (residente desde 2024).'
  where id = 'a0000000-0000-0000-0000-000000000003';
update residentes set tipo_suite = 'Long Stay', ocupacao = 'individual', mensalidade_valor = 12800
  where id = 'a0000000-0000-0000-0000-000000000004';
update residentes set tipo_suite = 'Suíte Modular', ocupacao = 'dupla', mensalidade_valor = 7800
  where id = 'a0000000-0000-0000-0000-000000000005';
update residentes set tipo_suite = 'Suíte', ocupacao = 'individual', mensalidade_valor = 10200
  where id = 'a0000000-0000-0000-0000-000000000006';

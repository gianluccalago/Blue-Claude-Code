-- Administração — Custos de pessoal (BLOCO Adm4)
-- Valores de referência para pagamento da equipe (mensal fixo ou por
-- plantão). NÃO calcula folha CLT (impostos/encargos ficam fora) — é
-- referência de custo e produção para pagamento por fora / acerto com PJ.

alter table usuarios
  add column tipo_remuneracao text check (tipo_remuneracao in ('mensal_fixo','por_plantao')),
  add column valor_mensal numeric,
  add column valor_plantao_diurno numeric,
  add column valor_plantao_noturno numeric;

create table pagamento_pessoal (
  id                  uuid primary key default gen_random_uuid(),
  profissional_id     uuid not null references usuarios(id),
  mes_referencia      text not null,
  tipo_remuneracao    text not null check (tipo_remuneracao in ('mensal_fixo','por_plantao')),
  plantoes_previstos  int,
  plantoes_realizados int,
  valor_calculado     numeric not null,
  valor_final         numeric not null,
  status              text not null default 'pendente' check (status in ('pendente','pago')),
  observacao          text,
  registrado_por      text not null,
  criado_em           timestamptz not null default now()
);

alter table pagamento_pessoal disable row level security;

create index if not exists pagamento_pessoal_mes_idx on pagamento_pessoal (mes_referencia);
create unique index if not exists pagamento_pessoal_prof_mes_idx on pagamento_pessoal (profissional_id, mes_referencia);

-- ─── Remuneração de teste (editável em "Remuneração da equipe") ───────────────

-- Cuidadoras CLT
update usuarios set tipo_remuneracao = 'mensal_fixo', valor_mensal = 2200.00
  where id = 'b0000000-0000-0000-0000-000000000004'; -- Ana Paula
update usuarios set tipo_remuneracao = 'mensal_fixo', valor_mensal = 2200.00
  where id = 'b0000000-0000-0000-0000-000000000009'; -- Mariana Souza
update usuarios set tipo_remuneracao = 'mensal_fixo', valor_mensal = 2200.00
  where id = 'b0000000-0000-0000-0000-000000000010'; -- Joana Ribeiro

-- Cuidadora PJ de cobertura, paga por plantão
update usuarios set tipo_remuneracao = 'por_plantao', valor_plantao_diurno = 220.00, valor_plantao_noturno = 260.00
  where id = 'b0000000-0000-0000-0000-000000000011'; -- Beatriz Lima

-- Enfermagem CLT
update usuarios set tipo_remuneracao = 'mensal_fixo', valor_mensal = 5500.00
  where id = 'b0000000-0000-0000-0000-000000000012'; -- Enf. Carla Mendes
update usuarios set tipo_remuneracao = 'mensal_fixo', valor_mensal = 3200.00
  where id = 'b0000000-0000-0000-0000-000000000013'; -- Téc. Patrícia Gomes

-- Equipe multidisciplinar
update usuarios set tipo_remuneracao = 'mensal_fixo', valor_mensal = 4500.00
  where id = 'b0000000-0000-0000-0000-000000000005'; -- Dra. Renata Fisio

-- ─── Plantões de teste da cuidadora PJ (Beatriz) — junho/2026 ──────────────────
-- 4 diurnos (3 com ponto efetivo) e 3 noturnos (2 com ponto efetivo), para
-- demonstrar PREVISTO x REALIZADO no cálculo por plantão.

insert into turnos (profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
('b0000000-0000-0000-0000-000000000011','cuidadoras','2026-06-02','2026-06-02 07:00-03','2026-06-02 19:00-03','diurno','2026-06-02 07:05-03','2026-06-02 19:02-03'),
('b0000000-0000-0000-0000-000000000011','cuidadoras','2026-06-03','2026-06-03 07:00-03','2026-06-03 19:00-03','diurno','2026-06-03 06:58-03','2026-06-03 19:10-03'),
('b0000000-0000-0000-0000-000000000011','cuidadoras','2026-06-04','2026-06-04 07:00-03','2026-06-04 19:00-03','diurno','2026-06-04 07:00-03','2026-06-04 19:00-03'),
('b0000000-0000-0000-0000-000000000011','cuidadoras','2026-06-05','2026-06-05 07:00-03','2026-06-05 19:00-03','diurno',null,null),
('b0000000-0000-0000-0000-000000000011','cuidadoras','2026-06-02','2026-06-02 19:00-03','2026-06-03 07:00-03','noturno','2026-06-02 19:00-03','2026-06-03 07:05-03'),
('b0000000-0000-0000-0000-000000000011','cuidadoras','2026-06-05','2026-06-05 19:00-03','2026-06-06 07:00-03','noturno','2026-06-05 19:00-03','2026-06-06 07:00-03'),
('b0000000-0000-0000-0000-000000000011','cuidadoras','2026-06-08','2026-06-08 19:00-03','2026-06-09 07:00-03','noturno',null,null);

-- ─── Pagamento de teste já marcado como pago (junho/2026) ──────────────────────

insert into pagamento_pessoal (profissional_id, mes_referencia, tipo_remuneracao, valor_calculado, valor_final, status, registrado_por) values
('b0000000-0000-0000-0000-000000000004','2026-06','mensal_fixo', 2200.00, 2200.00, 'pago', 'Administração');

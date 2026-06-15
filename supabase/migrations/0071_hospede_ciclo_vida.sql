-- ===========================================================================
-- 0071 — Ciclo de vida do hóspede + Mapa das Suítes (PREP)
-- ---------------------------------------------------------------------------
-- Campos para o ciclo de vida (ativo/inativo por saída), sexo e número do
-- hóspede; e marcação de upselling RECORRENTE (fixo) vs avulso, para o Mapa
-- das Suítes somar só os fixos. Idempotente.
--
-- Regra: o filtro operacional (status_hospede='ativo') é aplicado nas QUERIES
-- da aplicação — a RLS continua liberando leitura à equipe (a gestão precisa
-- ver inativos no histórico; o histórico/financeiro é preservado).
-- ===========================================================================

alter table public.residentes add column if not exists sexo text
  check (sexo is null or sexo in ('masculino','feminino'));
alter table public.residentes add column if not exists status_hospede text not null default 'ativo'
  check (status_hospede in ('ativo','inativo'));
alter table public.residentes add column if not exists data_saida date;
alter table public.residentes add column if not exists motivo_saida text;
-- Número/identificador do hóspede (livre — ex.: "H-001").
alter table public.residentes add column if not exists numero_hospede text;

-- Garante 'ativo' nos existentes (o default cobre novos).
update public.residentes set status_hospede = 'ativo' where status_hospede is null;

-- Upselling: distingue recorrente (fixo mensal) de avulso.
alter table public.upselling add column if not exists recorrente boolean not null default false;

-- ─── Demo: sexo + número dos hóspedes de teste (não sobrescreve edições) ─────
update public.residentes set sexo = 'feminino' where id = 'a0000000-0000-0000-0000-000000000001' and sexo is null;
update public.residentes set sexo = 'masculino' where id = 'a0000000-0000-0000-0000-000000000002' and sexo is null;
update public.residentes set sexo = 'feminino' where id = 'a0000000-0000-0000-0000-000000000003' and sexo is null;
update public.residentes set sexo = 'masculino' where id = 'a0000000-0000-0000-0000-000000000004' and sexo is null;
update public.residentes set sexo = 'feminino' where id = 'a0000000-0000-0000-0000-000000000005' and sexo is null;
update public.residentes set sexo = 'masculino' where id = 'a0000000-0000-0000-0000-000000000006' and sexo is null;
update public.residentes set numero_hospede = 'H-001' where id = 'a0000000-0000-0000-0000-000000000001' and numero_hospede is null;
update public.residentes set numero_hospede = 'H-002' where id = 'a0000000-0000-0000-0000-000000000002' and numero_hospede is null;
update public.residentes set numero_hospede = 'H-003' where id = 'a0000000-0000-0000-0000-000000000003' and numero_hospede is null;
update public.residentes set numero_hospede = 'H-004' where id = 'a0000000-0000-0000-0000-000000000004' and numero_hospede is null;
update public.residentes set numero_hospede = 'H-005' where id = 'a0000000-0000-0000-0000-000000000005' and numero_hospede is null;
update public.residentes set numero_hospede = 'H-006' where id = 'a0000000-0000-0000-0000-000000000006' and numero_hospede is null;

-- ─── Demo: dois upsellings RECORRENTES (fixos) no mês corrente ───────────────
insert into public.upselling (id, residente_id, categoria, descricao, valor, mes_referencia, recorrente, lancado_por) values
  ('a5000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Lavanderia extra','Lavanderia extra mensal (fixo)',180, to_char(current_date,'YYYY-MM'), true,'Administração'),
  ('a5000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002','Medicamentos','Medicação contínua (fixo)',320, to_char(current_date,'YYYY-MM'), true,'Administração')
on conflict (id) do nothing;

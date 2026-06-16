-- ===========================================================================
-- 0075 — Modalidade de estadia (longa/curta permanência, day care)
-- ---------------------------------------------------------------------------
-- - longa_permanencia (padrão): como hoje (ocupa leito, mensalidade).
-- - curta_permanencia: OPERACIONALMENTE igual à longa (ocupa leito, cuidado
--   completo, aparece em todas as telas), mas TEMPORÁRIA (data_fim_prevista) e
--   sem mensalidade automática (cobrança por diária/pacote — Frente B futura).
-- - day_care: NÃO ocupa leito; frequenta só o período da tarde; cuidado leve.
--   Não entra na ocupação de leitos nem no mapa de suítes — só na lista própria.
--
-- O encerramento de estadia temporária reaproveita o ciclo de inativação
-- (status_hospede/data_saida/motivo_saida — já existentes). Idempotente.
-- ===========================================================================

alter table public.residentes add column if not exists modalidade text not null default 'longa_permanencia'
  check (modalidade in ('longa_permanencia','curta_permanencia','day_care'));
alter table public.residentes add column if not exists data_inicio_estadia date;
alter table public.residentes add column if not exists data_fim_prevista date;

-- Início da estadia = admissão, quando não informado.
update public.residentes set data_inicio_estadia = data_admissao where data_inicio_estadia is null;

-- ─── Demo: uma CURTA PERMANÊNCIA (ocupa leito, temporária) ──────────────────
update public.residentes
  set modalidade = 'curta_permanencia',
      data_fim_prevista = current_date + 18,
      data_inicio_estadia = coalesce(data_inicio_estadia, data_admissao)
  where id = 'a0000000-0000-0000-0000-000000000006';

-- ─── Demo: um DAY CARE (não ocupa leito; sem quarto) ────────────────────────
insert into public.residentes
  (id, nome, sexo, grau_dependencia, grau_contratual, data_admissao, data_inicio_estadia, status_hospede, modalidade, numero_hospede)
values
  ('a0000000-0000-0000-0000-000000000007','Vicente Fonseca','masculino','I','I', current_date, current_date, 'ativo','day_care','H-007')
on conflict (id) do update
  set modalidade = excluded.modalidade, status_hospede = excluded.status_hospede,
      data_inicio_estadia = excluded.data_inicio_estadia;

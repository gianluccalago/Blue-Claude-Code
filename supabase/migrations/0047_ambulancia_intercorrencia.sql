-- ===========================================================================
-- 0047 — Chamado de ambulância dentro da intercorrência
-- ---------------------------------------------------------------------------
-- Permite registrar, numa intercorrência, que a ambulância (SAMU/privada) foi
-- acionada, com:
--   • médico que atendeu;
--   • tempo de resposta (minutos até chegar);
--   • desfecho: removido p/ hospital  OU  medicado no local e permaneceu;
--   • hospital de destino (quando removido).
-- Idempotente.
-- ===========================================================================

alter table public.intercorrencia
  add column if not exists ambulancia_acionada            boolean not null default false,
  add column if not exists ambulancia_medico              text,
  add column if not exists ambulancia_tempo_resposta_min  integer,
  add column if not exists ambulancia_desfecho            text,
  add column if not exists ambulancia_hospital_destino    text;

alter table public.intercorrencia
  drop constraint if exists intercorrencia_ambulancia_desfecho_check;
alter table public.intercorrencia
  add constraint intercorrencia_ambulancia_desfecho_check
  check (ambulancia_desfecho is null or ambulancia_desfecho in ('removido_hospital','medicado_local'));

comment on column public.intercorrencia.ambulancia_tempo_resposta_min is
  'Minutos entre o chamado e a chegada da ambulância.';

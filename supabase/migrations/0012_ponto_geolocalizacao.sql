-- ============================================================================
-- Blue Senior Living — Migration 0012
-- Escalas (ETAPA 3): ponto por geolocalização (check-in/out com lat/lng).
--
-- NOTA: este ponto é CONTROLE INTERNO/GERENCIAL, NÃO ponto eletrônico legal.
-- Não substitui o ponto físico oficial das CLT (Portaria 671 MTE).
--
-- check_in / check_out já foram criados na migration 0011. Aqui adicionamos as
-- coordenadas e as marcações de ajuste manual (plano B quando o GPS falha).
--
-- COMO USAR:
--   Supabase > SQL Editor > New query > cole tudo > Run.
--   É seguro rodar mais de uma vez (idempotente) e NÃO apaga seus dados.
-- ============================================================================

alter table turnos add column if not exists check_in_lat numeric;
alter table turnos add column if not exists check_in_lng numeric;
alter table turnos add column if not exists check_out_lat numeric;
alter table turnos add column if not exists check_out_lng numeric;
alter table turnos add column if not exists check_in_manual boolean not null default false;
alter table turnos add column if not exists check_out_manual boolean not null default false;

-- Fim.

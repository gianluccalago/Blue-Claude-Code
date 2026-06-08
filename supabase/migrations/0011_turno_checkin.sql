-- ============================================================================
-- Blue Senior Living — Migration 0011
-- Controle de turno sobre o checklist: check-in / check-out do plantão.
-- Adiciona turnos.check_in e turnos.check_out (timestamptz, null).
-- É ADITIVO e não altera o módulo de Escalas (apenas campos novos na tabela).
--
-- COMO USAR:
--   Supabase > SQL Editor > New query > cole tudo > Run.
--   É seguro rodar mais de uma vez (idempotente) e NÃO apaga seus dados.
-- ============================================================================

alter table turnos add column if not exists check_in timestamptz;
alter table turnos add column if not exists check_out timestamptz;

-- Fim.

-- ============================================================================
-- Blue Senior Living — Migration 0007
-- Coordenação: tela "Medicação (enfermagem)". Permite registrar administrações
-- item a item (múltiplas por dia) referenciando a prescrição.
--
-- Adiciona administracao.prescricao_id (nullable). É ADITIVO: o módulo
-- Cuidadores continua inserindo sem este campo (fica null).
--
-- COMO USAR:
--   Supabase > SQL Editor > New query > cole tudo > Run.
--   É seguro rodar mais de uma vez (idempotente) e NÃO apaga seus dados.
-- ============================================================================

alter table administracao
  add column if not exists prescricao_id uuid references prescricao(id);

create index if not exists administracao_prescricao_idx on administracao (prescricao_id);

-- Fim.

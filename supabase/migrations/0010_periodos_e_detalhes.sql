-- ============================================================================
-- Blue Senior Living — Migration 0010
-- - Medicação: 6 períodos (jejum/manha/almoco/apos_almoco/tarde/noite).
-- - compromisso_externo: novo campo "detalhes".
--
-- COMO USAR:
--   Supabase > SQL Editor > New query > cole tudo > Run.
--   É seguro rodar mais de uma vez (idempotente) e NÃO apaga seus dados.
-- ============================================================================

-- 1. prescricao.periodo passa a aceitar 6 valores.
alter table prescricao drop constraint if exists prescricao_periodo_check;
alter table prescricao add constraint prescricao_periodo_check
  check (periodo in ('jejum','manha','almoco','apos_almoco','tarde','noite'));

-- 2. Migrar dados existentes: o antigo "noite" representava "noite/jejum".
--    Como não há como inferir com certeza, migra-se para "jejum" (06:00).
update prescricao set periodo = 'jejum' where periodo = 'noite';

-- 3. compromisso_externo ganha "detalhes" (instruções do compromisso).
alter table compromisso_externo add column if not exists detalhes text;

-- 4. Popular detalhes de teste (só para validar a exibição). A alimentação
--    real por Família/Administrativo será construída quando esses perfis
--    forem desenvolvidos.
update compromisso_externo set detalhes = 'Levar exames anteriores e cartão do convênio. Vestir roupa confortável.'
  where titulo = 'Consulta oftalmológica' and detalhes is null;
update compromisso_externo set detalhes = 'Jejum de 8h antes da sessão. Levar troca de roupa.'
  where titulo = 'Sessão de hemodiálise' and detalhes is null;
update compromisso_externo set detalhes = 'Levar lista de medicamentos em uso e receita anterior.'
  where titulo ilike '%urolog%' and detalhes is null;

-- Fim.

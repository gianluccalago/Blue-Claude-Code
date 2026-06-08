-- ============================================================================
-- Blue Senior Living — Migration 0002
-- Adiciona: prescricao.horario (sugestão de horário) e
--           administracao.baixa_farmacia (preparo p/ módulo Farmácia).
--
-- COMO USAR:
--   Supabase > SQL Editor > New query > cole tudo > Run.
--   É seguro rodar mais de uma vez (idempotente) e NÃO apaga dados.
-- ============================================================================

-- 1. Horário sugerido na prescrição (opcional, ex "07:00")
alter table prescricao
  add column if not exists horario text;

-- 2. Preparo para integração futura com a Farmácia (sem lógica/tela ainda):
--    indicará se a baixa de estoque já foi dada.
alter table administracao
  add column if not exists baixa_farmacia boolean not null default false;

-- 3. Popular horários de teste nas prescrições da Profª Alzira
update prescricao set horario = '07:00'
  where residente_id = 'a0000000-0000-0000-0000-000000000001'
    and medicamento in ('Losartana','Insulina NPH');
update prescricao set horario = '08:00'
  where residente_id = 'a0000000-0000-0000-0000-000000000001'
    and medicamento = 'Metformina';
update prescricao set horario = '21:00'
  where residente_id = 'a0000000-0000-0000-0000-000000000001'
    and medicamento = 'Sinvastatina';
update prescricao set horario = '12:00'
  where residente_id = 'a0000000-0000-0000-0000-000000000001'
    and medicamento = 'AAS';
update prescricao set horario = '16:00'
  where residente_id = 'a0000000-0000-0000-0000-000000000001'
    and medicamento = 'Enalapril';

-- Fim.

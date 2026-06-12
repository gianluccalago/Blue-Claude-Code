-- ===========================================================================
-- 0040 — Médico prescritor da prescrição (autoria da receita)
-- ---------------------------------------------------------------------------
-- RECEITA É DOCUMENTO MÉDICO: o PDF é SEMPRE assinado pelo médico que
-- prescreveu, nunca por quem clicou em exportar (Farmácia/Administração).
-- Esta migração grava a autoria na própria prescrição:
--   • prescricao.prescrito_por → usuarios.id (perfil médico, ou master que
--     também é médico);
--   • backfill das prescrições existentes para o médico do sistema;
--   • CRM dos médicos demo (registro_profissional) para a receita sair com
--     CRM válido.
-- Idempotente: pode rodar mais de uma vez.
-- ===========================================================================

-- 1) Coluna de autoria.
alter table prescricao
  add column if not exists prescrito_por uuid references usuarios(id) on delete set null;

comment on column prescricao.prescrito_por is
  'Médico que criou a prescrição (usuarios.id, perfil medico/master). A receita PDF assina SEMPRE com este médico.';

-- 2) CRM dos médicos demo (a receita exige CRM; estava vazio no seed).
update usuarios set registro_profissional = 'CRM-PR 45120'
  where id = 'b0000000-0000-0000-0000-000000000002' and (registro_profissional is null or registro_profissional = '');
-- Master também é médico (assina quando prescreve, inclusive via Camaleão).
update usuarios set registro_profissional = 'CRM-PR 8245'
  where id = 'b0000000-0000-0000-0000-000000000001' and (registro_profissional is null or registro_profissional = '');

-- 3) Backfill: prescrições da SIMULAÇÃO → médico da simulação; demais → médica
--    do sistema (Helena Marques). Nunca deixar receita sem médico identificado.
update prescricao set prescrito_por = '5eed0020-0000-4000-8000-000000000006'
  where prescrito_por is null and residente_id::text like '5eed0010%';

update prescricao set prescrito_por = 'b0000000-0000-0000-0000-000000000002'
  where prescrito_por is null;

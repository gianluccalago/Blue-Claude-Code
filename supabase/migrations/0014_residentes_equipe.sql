-- ============================================================================
-- Blue Senior Living — Migration 0014
-- Master: telas de gestão RESIDENTES e EQUIPE.
--
-- Estende `residentes` (ficha completa do hóspede) e `usuarios` (horário fixo
-- de trabalho dos mensalistas). Tudo ADITIVO; não quebra checklist, escalas,
-- custos de pessoal nem nada que referencie residentes/usuarios.
--
-- COMO USAR:
--   Supabase > SQL Editor > New query > cole tudo > Run.
--   É seguro rodar mais de uma vez (idempotente) e NÃO apaga seus dados.
-- ============================================================================

-- ---------- RESIDENTES ----------
-- Suíte e ocupação.
alter table residentes add column if not exists tipo_suite text;
alter table residentes add column if not exists ocupacao text
  check (ocupacao is null or ocupacao in ('individual','dupla'));

-- Financeiro: valor da mensalidade vigente (o STATUS em dia/inadimplente virá
-- do módulo de mensalidades quando existir).
alter table residentes add column if not exists mensalidade_valor numeric;

-- Saúde: plano de saúde e hospital de referência.
alter table residentes add column if not exists plano_saude_operadora text;
alter table residentes add column if not exists plano_saude_numero text;
alter table residentes add column if not exists hospital_referencia text;

-- Contato de emergência (além do responsável legal).
alter table residentes add column if not exists contato_emergencia_nome text;
alter table residentes add column if not exists contato_emergencia_telefone text;

-- Grau CONTRATUAL (definido no contrato), distinto do grau ATUAL
-- (grau_dependencia, que vem do IVCF). A divergência ≥ 1 nível é o gatilho de
-- renegociação exibido na ficha.
alter table residentes add column if not exists grau_contratual text
  check (grau_contratual is null or grau_contratual in ('I','II','III'));

-- ---------- USUARIOS ----------
-- Horário fixo de trabalho dos mensalistas administrativos/operacionais
-- (quem NÃO é escalado por turnos). Ex: "Seg–Sex 8h–17h".
alter table usuarios add column if not exists horario_trabalho text;

-- Fim.

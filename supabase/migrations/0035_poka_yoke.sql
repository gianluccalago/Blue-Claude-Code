-- 0035 — Poka-yoke de segurança (Bloco 1 da auditoria Lean/Disney). Idempotente.

-- 1) Motivo da medicação NÃO administrada (Recusou / Indisposto / Ausente / Outro).
--    Um toque do cuidador; visível à enfermagem/coordenação onde o registro aparece.
alter table public.administracao
  add column if not exists motivo text;

comment on column public.administracao.motivo is
  'Motivo quando status=nao (Recusou/Indisposto/Ausente/Outro). Nulo nos demais.';

-- 2) Registro de que o alerta de alergia foi exibido e CONFIRMADO pelo médico
--    ao prescrever (não bloqueia — decisão é médica; fica a trilha).
alter table public.prescricao
  add column if not exists alerta_alergia text;

comment on column public.prescricao.alerta_alergia is
  'Alergeno cadastrado que casou com o medicamento no momento da prescrição; preenchido quando o médico viu e confirmou o alerta.';

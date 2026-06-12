-- 0037 — Portal da família (Bloco 5). Idempotente.

-- 5.3 Status "Em análise": quando o setor de destino ABRE a solicitação,
--     a família passa a ver "Em análise por [setor]".
alter table public.solicitacao_familia
  add column if not exists em_analise_em timestamptz,
  add column if not exists em_analise_por text;

-- 5.5 Desfecho do compromisso externo ("como foi a consulta") — preenchido
--     por Coordenação/cuidador designado após a data; visível à família.
alter table public.compromisso_externo
  add column if not exists como_foi text,
  add column if not exists como_foi_por text,
  add column if not exists como_foi_em timestamptz;

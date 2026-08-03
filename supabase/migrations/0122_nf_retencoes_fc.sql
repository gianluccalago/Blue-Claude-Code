-- ===========================================================================
-- 0122 — NF com RETENÇÕES + contabilização automática no Fluxo de Caixa.
-- ---------------------------------------------------------------------------
-- O caixa real de uma NF paga sai em duas pernas: o LÍQUIDO para a TRÍADE
-- (na data do pagamento) e as RETENÇÕES (IRRF/CSRF/ISS retido) em guias.
-- a) obra_notas_fiscais.retencoes: total destacado na nota (ex.: NF 13 =
--    R$ 9.199,17). Líquido = valor − retencoes.
-- b) fc_lancamentos aceita origem 'nf' (líquido pago à TRÍADE) e
--    'nf_retencao' (guias) — a tela do Caixa sincroniza sozinha: NF paga
--    gera os dois lançamentos e os marcos/medições cobertos por NF deixam
--    de entrar individualmente (sem dupla contagem).
-- Idempotente. Rode após a 0121.
-- ===========================================================================

alter table public.obra_notas_fiscais
  add column if not exists retencoes numeric not null default 0 check (retencoes >= 0);
comment on column public.obra_notas_fiscais.retencoes is
  'Total de retenções destacadas na NF (IRRF, CSRF, ISS retido). Líquido a pagar = valor − retencoes.';

alter table public.fc_lancamentos drop constraint if exists fc_lancamentos_origem_check;
alter table public.fc_lancamentos add constraint fc_lancamentos_origem_check
  check (origem in ('planilha','manual','marco','medicao','oc','indireto','nf','nf_retencao'));

-- Fim.

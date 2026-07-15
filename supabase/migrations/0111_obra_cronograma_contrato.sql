-- ===========================================================================
-- 0111 — MÓDULO OBRA · Cronograma (Gantt) + correção do contrato (projetos
--        integram o total).
-- ---------------------------------------------------------------------------
-- A) CRONOGRAMA: obra_fases ganha data_inicio_prevista (o previsto de término
--    já existia: data_fim_prevista, 0100). Com início+fim previstos por fase,
--    o novo Gantt (aba Cronograma) traça as barras do plano contra o realizado.
--
-- B) CONTRATO: os R$ 500.000 de projetos complementares INTEGRAM o total do
--    contrato (desconto concedido pela contratada para incorporar exatamente
--    esse valor). O seed da 0103 somava MO (área × preço) + projetos (500k),
--    superestimando o total em 500k. Correção: o orçado de MO por fase passa a
--    ser área × preço menos o RATEIO do valor de projetos proporcional à área
--    da fase — TOTAL (MO + projetos) = área total × preço = contrato final.
--    As linhas de MO e Projetos ficam EDITÁVEIS na tela (master/direção), como
--    os demais grupos.
-- Idempotente (a correção recalcula a partir de obra_config; se você editar a
-- MO manualmente depois, NÃO rode este bloco de novo). Rode após a 0110.
-- ===========================================================================

-- ── A · Cronograma: início previsto por fase ────────────────────────────────
alter table public.obra_fases add column if not exists data_inicio_prevista date;
comment on column public.obra_fases.data_inicio_prevista is
  'Início PREVISTO da fase (plano/Gantt). data_inicio é o início real.';

-- ── B · Correção: MO líquida do rateio dos projetos ─────────────────────────
do $$
declare
  v_preco      numeric := coalesce((select valor::numeric from public.obra_config where chave = 'preco_m2_mo'), 914.66);
  v_proj       numeric := coalesce((select valor_orcado from public.obra_baseline where pacote = 'projetos'), 500000);
  v_total_area numeric;
  f record;
begin
  select sum(area_m2) into v_total_area from public.obra_fases;
  if coalesce(v_total_area, 0) = 0 then
    raise notice 'Sem fases — correção da baseline ignorada.';
    return;
  end if;
  for f in select numero, area_m2 from public.obra_fases order by numero loop
    update public.obra_baseline
      set valor_orcado = round(f.area_m2 * v_preco - (f.area_m2 / v_total_area) * v_proj, 2),
          observacao   = 'Contrato: área × R$ ' || v_preco || '/m² menos rateio dos projetos ('
                         || 'R$ ' || v_proj || ' integram o total — desconto incorporado).'
      where pacote = 'mo_fase_' || f.numero;
  end loop;
  update public.obra_baseline
    set observacao = 'Integra o TOTAL do contrato (desconto incorporado pela contratada).'
    where pacote = 'projetos';
  raise notice 'Baseline MO corrigida: total (MO+projetos) = área × preço = R$ %',
    round(v_total_area * v_preco, 2);
end $$;

-- Fim.

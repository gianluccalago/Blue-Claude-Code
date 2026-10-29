-- ===========================================================================
-- 0152 — CONCILIAÇÃO DO CUSTO DO EMPREENDIMENTO COM A CUSTOBLUE (out/2026).
-- ---------------------------------------------------------------------------
-- O app mostrava R$ 11.067.304,90 de investimento corrigido e a CustoBlue,
-- R$ 11.236.957,06. A maior parte da diferença é erro de fórmula na própria
-- planilha (corrige o acumulado de novo em cada linha do mesmo mês a partir
-- de jul/2026 — fica R$ 218 mil acima). Aqui entram só as correções do lado
-- do app que estão comprovadas:
--
--  a) Corretor (Humberto), dez/2025: lançado como R$ 20.000 no extrato. São 9
--     parcelas de R$ 10.000 ("10 de 90" a "90 de 90", nov/25 a jul/26); com
--     20.000 o total pago daria 100 mil. A CustoBlue tem 10.000. Corrige SÓ a
--     linha "Humberto 20 de 90" de dez/2025 que ainda estiver com −20.000.
--  b) IPCA de jul/2026 (+0,07%) e set/2026 (+0,82%), os da CustoBlue: grava
--     só se o mês ainda não tiver índice. Mês já cadastrado não é tocado
--     (a migration avisa se o valor for diferente do da planilha).
--  c) Novos centros "capex" e "opex" do Blue, que a CustoBlue já soma no
--     investimento: marcas e patentes (R$ 880, set/26), sensor mmWave
--     (R$ 418, out/26) e Claude (R$ 590,27, out/26). Reclassifica SÓ essas
--     três saídas (rótulo e valor exatos, set–out/2026) e atualiza a regra de
--     classificação automática (espelho de centroDoRotulo no app).
--
-- Fica para decisão (NÃO alterado aqui): parcela 37/44 do terreno 2 em
-- ago/2026 (extrato 78.439,12 × CustoBlue 82.202) e as despesas que estão no
-- caixa mas não na CustoBlue (taxas de cartório, alvará, IPTU de abr/2023…).
--
-- Idempotente. Rode após a 0151.
-- ===========================================================================

-- ── c · Regra de classificação: CAPEX e OPEX do Blue ───────────────────────
create or replace function public.fc_centro_do_rotulo(p_rotulo text, p_grupo text)
returns text language sql immutable as $$
  select case
    when p_grupo = 'entrada' and r like 'aluguel%'                         then 'receita_aluguel'
    when p_grupo = 'entrada' and r like 'rendimento%'                      then 'receita_financeira'
    when p_grupo = 'entrada'                                               then 'socios'
    when r like 'parcela%terreno%' or r ~ '^terreno' or r like '%terreno % entrada%'
      or r like 'entrada terreno%' or r like 'itbi%' or r like 'iptu%'
      or r like 'funrejus%' or r like '%cart_rio%' or r like 'taxas judiciais%'
      or r like 'taxas cart%' or r like 'edvaldo%' or r like 'advogado edvaldo%'
      or r like '%rvore%' or r like '%arvore%' or r like 'jardineiro%'
      or r like 'aluguel motoserra%' or r like 'gasolina corte%'
      or r like 'combustivel cortar grama%' or r like 'taxa corte%'
      or r in ('copel','sanepar','agua','água')
      or r like 'humberto%'   -- corretor do terreno (a CustoBlue chamava de "Corretor")
                                                                           then 'terreno'
    when r like 'arquitet%' or r like 'bacoccini%' or r like 'rrts%'
      or r like 'top_grafo%' or r like 'topografo%' or r like 'c_lculo%'
      or r like 'calculo%' or r like 'laudo%' or r like 'taxas alvar%'
      or r like 'taxa cvco%' or r like 'taxas processo habite%'            then 'projetos'
    when r like 'triade%' or r like 'tríade%'                              then 'complementares'
    when r like 'obras no seniors%' or r like 'sonar%' or r like '%mangona%'
      or r like 'motor%' or r like 'baterias%' or r like 'carregador%'
      or r like 'port_o%' or r like 'guarda corpo%' or r like 'coletes%'
      or r like 'despesas com haste%' or r like 'gustavo sag%'
      or r like 'taxas processo concrecenter%' or r like 'iss obra%'
      or r like 'servi_o motor%' or r like 'lincoln%'                      then 'seniors_club'
    when r like 'despesas obra pagas por%'                                 then 'indiretos'
    when r like 'emprestimo%' or r like 'empr_stimo%'                      then 'socios'
    when r ~ 'marcas? e patentes?' or r like 'patente%'
      or r like 'sensor%' or r like '%mmwave%'                             then 'capex'
    when r like 'claude%' or r like 'cloude%' or r like '%anthropic%'      then 'opex'
    when r like 'marlon%' or r like 'cabelo%'
      or r like 'uber%' or r like 'copiadora%' or r like 'combustivel%'
      or r like 'gasolina%'                                                then 'indiretos'
    when r in ('pis','cofins','irpj','csll') or r like 'ir retido%'
      or r like 'ir s.nf%' or r like 'tributos federais%'
      or r like 'imposto%'                                                 then 'impostos'
    when r like 'contabilidade%' or r like 'tarifas banc%'
      or r like 'certificado %' or r like 'certificado eletr%'
      or r like 'taxa%junta comercial%' or r like 'taxas junta%'
      or r like 'escrilex%' or r like 'advogado%' or r like '%giuliano%'
      or r like 'a__o trabalhista%' or r like 'acordo andrea%'
      or r like 'taxa de envio%' or r like '%inpi%'                        then 'administrativo'
    else 'indiretos'
  end
  from (select lower(btrim(p_rotulo)) as r) t
$$;

do $$
declare
  v int;
  v_ipca numeric;
  r record;
begin
  -- ── a · Humberto dez/2025: 20.000 → 10.000 ───────────────────────────────
  update public.fc_lancamentos
     set valor = -10000,
         observacao = concat_ws(' · ', nullif(observacao, ''),
           'Corrigido de 20.000 para 10.000 (0152): 9 parcelas de 10.000, conferido com a CustoBlue')
   where lower(btrim(fornecedor)) = 'humberto 20 de 90'
     and data between date '2025-12-01' and date '2025-12-31'
     and grupo = 'saida' and valor = -20000;
  get diagnostics v = row_count;
  raise notice 'a) Humberto dez/2025 corrigido para 10.000: % linha(s).', v;

  -- ── b · IPCA de jul/2026 e set/2026 ──────────────────────────────────────
  for r in select * from (values ('2026-07', 0.0007::numeric), ('2026-09', 0.0082::numeric)) x(mes, pct) loop
    select pct into v_ipca from public.fc_ipca where mes = r.mes;
    if v_ipca is null then
      insert into public.fc_ipca (mes, pct) values (r.mes, r.pct);
      raise notice 'b) IPCA de % cadastrado: %', r.mes, r.pct;
    elsif v_ipca <> r.pct then
      raise notice 'b) IPCA de % já cadastrado como % (CustoBlue: %). Não alterado — confira.', r.mes, v_ipca, r.pct;
    else
      raise notice 'b) IPCA de % já estava certo.', r.mes;
    end if;
  end loop;

  -- ── c · Marcas e patentes, sensor e Claude → CAPEX/OPEX do Blue ──────────
  update public.fc_lancamentos
     set centro_custo = 'capex', escopo = 'blue'
   where grupo = 'saida' and data between date '2026-09-01' and date '2026-10-31'
     and abs(valor) = 880
     and lower(concat_ws(' ', fornecedor, descricao)) ~ '(marca|patente|inpi)'
     and centro_custo <> 'capex';
  get diagnostics v = row_count;
  raise notice 'c) Marcas e patentes (880) → CAPEX: % linha(s).', v;
  update public.fc_lancamentos
     set centro_custo = 'capex', escopo = 'blue'
   where grupo = 'saida' and data between date '2026-09-01' and date '2026-10-31'
     and abs(valor) = 418
     and lower(concat_ws(' ', fornecedor, descricao)) ~ '(sensor|mmwave)'
     and centro_custo <> 'capex';
  get diagnostics v = row_count;
  raise notice 'c) Sensor mmWave (418) → CAPEX: % linha(s).', v;
  update public.fc_lancamentos
     set centro_custo = 'opex', escopo = 'blue'
   where grupo = 'saida' and data between date '2026-09-01' and date '2026-10-31'
     and abs(valor) = 590.27
     and lower(concat_ws(' ', fornecedor, descricao)) ~ '(claude|cloude|anthropic)'
     and centro_custo <> 'opex';
  get diagnostics v = row_count;
  raise notice 'c) Claude (590,27) → OPEX: % linha(s).', v;

  raise notice 'Custo do empreendimento (nominal, Blue): R$ %',
    (select round(-coalesce(sum(valor), 0), 2) from public.fc_lancamentos
      where grupo = 'saida' and escopo = 'blue'
        and centro_custo in ('terreno','projetos','complementares','construtora','materiais','indiretos','capex','opex'));
end $$;

-- Fim.

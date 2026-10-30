-- ===========================================================================
-- 0153 — DECISÕES DO SÓCIO-DIRETOR NA CONCILIAÇÃO COM A CUSTOBLUE (out/2026).
-- ---------------------------------------------------------------------------
--  a) Corretor (Humberto), dez/2025: foram R$ 20.000 mesmo. DESFAZ o item (a)
--     da 0152 (volta a −20.000 e tira a observação que ela pôs).
--  b) Arquiteto (Bacoccini): o Blue usa o valor BRUTO (2.500 até dez/2025 e
--     5.000 a partir de jan/2026). A diferença para o líquido pago é o IR
--     retido na fonte, que a empresa recolhe junto com os impostos. Para o
--     caixa não contar esse dinheiro duas vezes, o mesmo valor sai do imposto
--     do mês: da linha de IR retido ("IR S.NF TERCEIROS" / "IR retido na
--     fonte"); se o mês não tiver essa linha, da linha "Impostos" ou do
--     COFINS. Linha de IR que zera é removida (fica na auditoria). Saldo de
--     caixa de cada mês: inalterado.
--  c) R$ 450 de mai/2026 ("emprestimo Joaquim"): eram do corte de árvores
--     (450 + 46 = 496, como na CustoBlue). Vai para terreno.
--  d) Wispr Flow: assinatura mensal de R$ 21,50 a partir de out/2026. A
--     linha "software" de 10/11/2026 vira "Wispr Flow (assinatura)", OPEX do
--     Blue, e entra a de 10/10/2026. Os meses seguintes são lançados como as
--     demais contas mensais.
--
-- Cada item só age sobre a linha exata (rótulo, mês e valor). Idempotente.
-- Rode após a 0152.
-- ===========================================================================

-- Regra de classificação: Wispr Flow é OPEX do Blue (espelho de centroDoRotulo).
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
    when r like 'claude%' or r like 'cloude%' or r like '%anthropic%'
      or r like 'wispr%'                                                   then 'opex'
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
  a record;
  v_bruto numeric;
  v_ret numeric;
  v_imp record;
  n_arq int := 0;
  n_del int := 0;
  sem_imposto text := '';
begin
  -- ── a · Humberto dez/2025 volta para 20.000 ──────────────────────────────
  update public.fc_lancamentos
     set valor = -20000,
         observacao = nullif(btrim(replace(replace(coalesce(observacao, ''),
           ' · Corrigido de 20.000 para 10.000 (0152): 9 parcelas de 10.000, conferido com a CustoBlue', ''),
           'Corrigido de 20.000 para 10.000 (0152): 9 parcelas de 10.000, conferido com a CustoBlue', '')), '')
   where lower(btrim(fornecedor)) = 'humberto 20 de 90'
     and data between date '2025-12-01' and date '2025-12-31'
     and grupo = 'saida' and valor = -10000;
  get diagnostics v = row_count;
  raise notice 'a) Humberto dez/2025 de volta a 20.000: % linha(s).', v;

  -- ── b · Arquiteto pelo valor bruto; o IR retido sai do imposto do mês ────
  for a in
    select id, data, valor from public.fc_lancamentos
     where grupo = 'saida' and escopo = 'blue' and centro_custo = 'projetos'
       and lower(btrim(fornecedor)) ~ '^(arquiteto|bacoccini)'
       and data >= date '2023-12-01'
       and (abs(valor) between 2340 and 2349.99 or (abs(valor) between 4690 and 4699.99 and data >= date '2026-01-01'))
     order by data
  loop
    v_bruto := case when abs(a.valor) < 3000 then 2500 else 5000 end;
    v_ret := v_bruto - abs(a.valor);

    -- Linha de imposto do mês que leva a retenção: IR retido; senão "Impostos"; senão COFINS.
    select id, valor, fornecedor into v_imp from public.fc_lancamentos
     where grupo = 'saida' and centro_custo = 'impostos'
       and date_trunc('month', data) = date_trunc('month', a.data)
       and abs(valor) >= v_ret - 0.01
     order by case when lower(fornecedor) ~ '^ir (retido|s\.nf)' then 0
                   when lower(btrim(fornecedor)) = 'impostos' then 1
                   when lower(btrim(fornecedor)) = 'cofins' then 2 else 3 end,
              data
     limit 1;
    if v_imp.id is null then
      sem_imposto := sem_imposto || to_char(a.data, 'MM/YYYY') || ' ';
      continue;   -- sem imposto no mês para compensar: não mexe (o caixa ficaria errado)
    end if;

    update public.fc_lancamentos
       set valor = -v_bruto,
           observacao = concat_ws(' · ', nullif(observacao, ''),
             format('Valor bruto (0153): líquido pago %s + IR retido %s, que saiu de "%s"',
                    replace(to_char(abs(a.valor), 'FM999990.00'), '.', ','), replace(to_char(v_ret, 'FM990.00'), '.', ','), v_imp.fornecedor))
     where id = a.id;
    n_arq := n_arq + 1;

    if abs(abs(v_imp.valor) - v_ret) < 0.01 then
      delete from public.fc_lancamentos where id = v_imp.id;   -- era só a retenção do arquiteto
      n_del := n_del + 1;
    else
      update public.fc_lancamentos
         set valor = v_imp.valor + v_ret,
             observacao = concat_ws(' · ', nullif(observacao, ''),
               format('IR do arquiteto (%s) passou para o Blue (0153)', replace(to_char(v_ret, 'FM990.00'), '.', ',')))
       where id = v_imp.id;
    end if;
  end loop;
  raise notice 'b) Arquiteto pelo bruto: % mês(es); linhas de IR que eram só a retenção, removidas: %.', n_arq, n_del;
  if sem_imposto <> '' then
    raise notice 'b) Sem linha de imposto no mês para compensar (arquiteto mantido líquido): %', sem_imposto;
  end if;

  -- ── c · R$ 450 de mai/2026: corte de árvores (Joaquim) ───────────────────
  update public.fc_lancamentos
     set centro_custo = 'terreno', escopo = 'blue',
         fornecedor = 'Joaquim (corte de árvores)',
         observacao = concat_ws(' · ', nullif(observacao, ''),
           'Era "emprestimo Joaquim": pagamento do corte de árvores (0153)')
   where grupo = 'saida' and lower(btrim(fornecedor)) = 'emprestimo joaquim'
     and data between date '2026-05-01' and date '2026-05-31' and valor = -450;
  get diagnostics v = row_count;
  raise notice 'c) Joaquim (corte de árvores, mai/2026): % linha(s).', v;

  -- ── d · Wispr Flow: out/2026 e nov/2026 ──────────────────────────────────
  update public.fc_lancamentos
     set fornecedor = 'Wispr Flow (assinatura)', centro_custo = 'opex', escopo = 'blue'
   where grupo = 'saida' and lower(btrim(fornecedor)) = 'software'
     and data = date '2026-11-10' and valor = -21.5;
  get diagnostics v = row_count;
  raise notice 'd) Wispr Flow nov/2026: % linha(s).', v;
  if not exists (select 1 from public.fc_lancamentos
                  where grupo = 'saida' and lower(fornecedor) like 'wispr%'
                    and data between date '2026-10-01' and date '2026-10-31') then
    insert into public.fc_lancamentos (data, valor, grupo, centro_custo, fornecedor, descricao, escopo, origem, pagador)
    values (date '2026-10-10', -21.5, 'saida', 'opex', 'Wispr Flow (assinatura)',
            'Assinatura mensal a partir de out/2026', 'blue', 'manual', 'seniors');
    raise notice 'd) Wispr Flow out/2026 incluído.';
  end if;

  raise notice 'Custo do empreendimento (nominal, Blue): R$ %',
    (select round(-coalesce(sum(valor), 0), 2) from public.fc_lancamentos
      where grupo = 'saida' and escopo = 'blue'
        and centro_custo in ('terreno','projetos','complementares','construtora','materiais','indiretos','capex','opex'));
end $$;

-- Fim.

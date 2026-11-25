-- ===========================================================================
-- 0156 — AJUSTES DA TABELA NOV/2026 (revisão do sócio-diretor).
-- ---------------------------------------------------------------------------
-- a) "Suíte" passa a se chamar "Suíte Luxo" em todo o sistema (o nome da
--    tabela e do contrato): residentes, tabela de preços, interesse das
--    oportunidades e simulações salvas do pós-visita. Fechamentos de meses já
--    encerrados não mudam (são fotografia do mês).
-- b) Suíte Master sai: não existe no Blue (é do Seniors Club).
-- c) "Long Stay Cuidados Intensivos" é o Long Stay TRIPLO: o preço vai para
--    Long Stay / grau III / triplo, e o tipo separado deixa de existir.
--
-- Idempotente. Rode após a 0155.
-- ===========================================================================

-- ── a · Suíte → Suíte Luxo ───────────────────────────────────────────────────
update public.residentes      set tipo_suite = 'Suíte Luxo'           where tipo_suite = 'Suíte';
update public.tabela_preco    set tipo_suite = 'Suíte Luxo'           where tipo_suite = 'Suíte';
update public.crm_oportunidade set tipo_suite_interesse = 'Suíte Luxo' where tipo_suite_interesse = 'Suíte';

-- ── b · Sem Suíte Master ─────────────────────────────────────────────────────
delete from public.tabela_preco where tipo_suite = 'Suíte Master';
update public.crm_oportunidade set tipo_suite_interesse = null where tipo_suite_interesse = 'Suíte Master';

-- ── c · Long Stay Cuidados Intensivos = Long Stay triplo ─────────────────────
insert into public.tabela_preco (tipo_suite, grau, ocupacao, valor, vigente_a_partir_de)
select 'Long Stay', tp.grau, 'triplo', tp.valor, tp.vigente_a_partir_de
  from public.tabela_preco tp
 where tp.tipo_suite = 'Long Stay Cuidados Intensivos'
on conflict (tipo_suite, grau, ocupacao, vigente_a_partir_de) do update set valor = excluded.valor;
delete from public.tabela_preco where tipo_suite = 'Long Stay Cuidados Intensivos';
update public.residentes set tipo_suite = 'Long Stay', ocupacao = 'triplo'
 where tipo_suite = 'Long Stay Cuidados Intensivos';
update public.crm_oportunidade set tipo_suite_interesse = 'Long Stay'
 where tipo_suite_interesse = 'Long Stay Cuidados Intensivos';

-- ── Simulações salvas (pós-visita) ───────────────────────────────────────────
update public.crm_oportunidade o
   set simulacao = jsonb_set(o.simulacao, '{opcoes}', (
         select coalesce(jsonb_agg(
                  case x ->> 'tipo_suite'
                    when 'Suíte' then jsonb_set(x, '{tipo_suite}', to_jsonb('Suíte Luxo'::text))
                    when 'Long Stay Cuidados Intensivos' then x || jsonb_build_object('tipo_suite', 'Long Stay', 'ocupacao', 'triplo')
                    else x end
                  order by e.ord), '[]'::jsonb)
           from jsonb_array_elements(o.simulacao -> 'opcoes') with ordinality as e(x, ord)))
 where jsonb_typeof(o.simulacao -> 'opcoes') = 'array'
   and exists (select 1 from jsonb_array_elements(o.simulacao -> 'opcoes') x
                where x ->> 'tipo_suite' in ('Suíte', 'Long Stay Cuidados Intensivos'));

-- Fim.

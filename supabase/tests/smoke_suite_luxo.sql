-- Smoke da 0156: Suíte → Suíte Luxo, sem Suíte Master, Cuidados Intensivos = Long Stay triplo.
-- Roda depois de todas as migrations (scripts/db-check.sh).
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned

select case when not exists (select 1 from public.tabela_preco where tipo_suite in ('Suíte', 'Suíte Master', 'Long Stay Cuidados Intensivos'))
  then 'PASS tabela de preços sem "Suíte", Suíte Master e Long Stay Cuidados Intensivos'
  else 'FAIL tabela de preços ainda tem nomes antigos' end;

select case when exists (select 1 from public.tabela_preco
                          where tipo_suite = 'Suíte Luxo' and grau = 'III' and ocupacao = 'simples'
                            and vigente_a_partir_de = date '2026-11-01' and valor = 18117.65)
  then 'PASS Suíte Luxo grau III individual nov/2026 = 18.117,65'
  else 'FAIL Suíte Luxo sem o preço de nov/2026' end;

select case when exists (select 1 from public.tabela_preco
                          where tipo_suite = 'Long Stay' and grau = 'III' and ocupacao = 'triplo'
                            and vigente_a_partir_de = date '2026-11-01' and valor = 14823.53)
  then 'PASS Cuidados Intensivos virou Long Stay grau III triplo (14.823,53)'
  else 'FAIL Long Stay triplo sem o preço de Cuidados Intensivos' end;

select case when not exists (select 1 from public.residentes where tipo_suite in ('Suíte', 'Suíte Master', 'Long Stay Cuidados Intensivos'))
             and not exists (select 1 from public.crm_oportunidade where tipo_suite_interesse in ('Suíte', 'Suíte Master', 'Long Stay Cuidados Intensivos'))
  then 'PASS residentes e oportunidades com os nomes novos'
  else 'FAIL residentes ou oportunidades com nome antigo' end;

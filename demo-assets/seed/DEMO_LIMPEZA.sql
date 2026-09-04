-- ===========================================================================
-- LIMPEZA DO CENÁRIO "DEMO" — Blue Senior Living  ·  GERADO AUTOMATICAMENTE
-- ---------------------------------------------------------------------------
-- Remove TUDO que o DEMO_SEED.sql criou e NADA além disso: apaga apenas os
-- registros no bloco de UUID de3000xx-… e os logins @demo.local.
-- Pode rodar quantas vezes quiser. Supabase → SQL Editor → cole → Run.
-- ===========================================================================

-- 1) Registros criados DURANTE a demo que apontam para os moradores fictícios
--    (administração de medicação, checklist, solicitações, etc.).
delete from public.administracao        where residente_id::text like 'de300010%';
delete from public.tarefa_registro      where residente_id::text like 'de300010%';
delete from public.eliminacao           where residente_id::text like 'de300010%';
delete from public.solicitacao_familia  where residente_id::text like 'de300010%';
delete from public.dispensacao          where residente_id::text like 'de300010%';
delete from public.estoque_hospede      where residente_id::text like 'de300010%';
delete from public.dieta                where residente_id::text like 'de300010%';
delete from public.pagamento_mensalidade where residente_id::text like 'de300010%';
delete from public.upselling            where residente_id::text like 'de300010%';

-- 2) Tudo o que o seed criou, na ordem de dependência.
delete from public.nps_resposta where id::text like 'de300053%';
delete from public.nps_pesquisa where id::text like 'de300052%';
delete from public.atividade_participacao where id::text like 'de300055%';
delete from public.atividade where id::text like 'de300054%';
delete from public.cardapio where id::text like 'de300058%';
delete from public.enxoval where id::text like 'de300056%';
delete from public.chamado_manutencao where id::text like 'de300057%';
delete from public.documento_institucional where id::text like 'de300051%';
delete from public.turnos where id::text like 'de300050%';
delete from public.compromisso_externo where id::text like 'de300048%';
delete from public.recado_familia where id::text like 'de300047%';
delete from public.evento_sentinela where id::text like 'de300046%';
delete from public.intercorrencia where id::text like 'de300045%';
delete from public.evolucao where id::text like 'de300044%';
delete from public.prescricao where id::text like 'de300043%';
delete from public.plano_cuidado_item where id::text like 'de300042%';
delete from public.teste_cognitivo where id::text like 'de300041%';
delete from public.avaliacao_ivcf where id::text like 'de300040%';
delete from public.crm_evento where id::text like 'de300032%';
delete from public.crm_oportunidade where id::text like 'de300031%';
delete from public.crm_contato where id::text like 'de300030%';
delete from public.chamado_manutencao   where residente_id::text like 'de300010%';
delete from public.evolucao             where residente_id::text like 'de300010%';

-- 3) Devolve o funil comercial e os moradores ao estado anterior.
update public.crm_oportunidade o set status = b.status
  from public.demo_backup_crm b where o.id = b.id;
drop table if exists public.demo_backup_crm;

update public.residentes r
   set status_hospede = 'ativo', data_saida = b.data_saida
  from public.demo_backup_residentes b where r.id = b.id;
drop table if exists public.demo_backup_residentes;

-- 4) Equipe e moradores — nesta ordem: usuarios.residente_vinculado
--    referencia residentes, então a equipe precisa sair primeiro.
delete from public.usuarios   where id::text like 'de300020%';
delete from public.residentes where id::text like 'de300010%';

-- 5) Logins da demo.
delete from auth.identities i using auth.users au
  where au.id = i.user_id and lower(au.email) like 'demo.%@demo.local';
delete from auth.users where lower(email) like 'demo.%@demo.local';

-- 6) A função de data de referência.
drop function if exists public.demo_ref();

do $$
declare n int;
begin
  select count(*) into n from public.residentes where id::text like 'de300010%';
  raise notice 'Limpeza concluída. Moradores da demo restantes: % (esperado: 0).', n;
end $$;

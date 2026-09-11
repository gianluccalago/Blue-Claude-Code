-- ===========================================================================
-- 0132 — DESFAZ a 0131 (unificação do Fluxo de Caixa).
-- ---------------------------------------------------------------------------
-- Só rode se quiser voltar ao estado anterior à unificação. Restaura
-- fc_lancamentos a partir de fc_lancamentos_bkp_0131, criado pela 0131 antes
-- de qualquer remoção. O extrato (fc_extrato) nunca foi apagado.
--
-- ATENÇÃO: lançamentos feitos DEPOIS da 0131 se perdem — o backup é do
-- momento da unificação. A migration avisa quantos são antes de apagar.
-- ===========================================================================

do $$
declare v_bkp int; v_atual int; v_novos int;
begin
  if to_regclass('public.fc_lancamentos_bkp_0131') is null then
    raise exception 'Backup fc_lancamentos_bkp_0131 não existe — a 0131 não rodou aqui. Nada a desfazer.';
  end if;

  select count(*) into v_bkp from public.fc_lancamentos_bkp_0131;
  select count(*) into v_atual from public.fc_lancamentos;
  select count(*) into v_novos from public.fc_lancamentos
   where criado_em > (select max(criado_em) from public.fc_lancamentos_bkp_0131);
  if v_novos > 0 then
    raise warning 'ATENÇÃO: % lançamento(s) criados após a unificação serão perdidos.', v_novos;
  end if;

  delete from public.fc_lancamentos;
  insert into public.fc_lancamentos select * from public.fc_lancamentos_bkp_0131;
  raise notice 'Revertido: % linha(s) restauradas (estavam %).', v_bkp, v_atual;
  raise notice 'Para limpar o backup depois de conferir: drop table public.fc_lancamentos_bkp_0131;';
end $$;

-- Fim.

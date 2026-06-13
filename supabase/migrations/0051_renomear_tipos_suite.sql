-- ===========================================================================
-- 0051 — Renomeia tipos de suíte (em todo o sistema)
-- ---------------------------------------------------------------------------
--   "Suíte"          → "Suíte Premium"
--   "Suíte Modular"  → "Suíte"
--   "Long Stay" e "Apartamento" → mantêm.
--
-- ORDEM CRÍTICA: renomear PRIMEIRO "Suíte"→"Suíte Premium" e SÓ DEPOIS
-- "Suíte Modular"→"Suíte", senão o "Suíte" novo (ex-Modular) seria
-- sobrescrito. O bloco só roda se ainda houver "Suíte Modular" (idempotente:
-- após migrar, não há mais o termo antigo e ele é pulado).
-- ===========================================================================

do $$
begin
  if exists (select 1 from public.residentes  where tipo_suite = 'Suíte Modular')
  or exists (select 1 from public.tabela_preco where tipo_suite = 'Suíte Modular')
  or exists (select 1 from public.crm_oportunidade where tipo_suite_interesse = 'Suíte Modular') then

    update public.residentes      set tipo_suite = 'Suíte Premium' where tipo_suite = 'Suíte';
    update public.residentes      set tipo_suite = 'Suíte'         where tipo_suite = 'Suíte Modular';

    update public.tabela_preco    set tipo_suite = 'Suíte Premium' where tipo_suite = 'Suíte';
    update public.tabela_preco    set tipo_suite = 'Suíte'         where tipo_suite = 'Suíte Modular';

    update public.crm_oportunidade set tipo_suite_interesse = 'Suíte Premium' where tipo_suite_interesse = 'Suíte';
    update public.crm_oportunidade set tipo_suite_interesse = 'Suíte'         where tipo_suite_interesse = 'Suíte Modular';
  end if;
end $$;

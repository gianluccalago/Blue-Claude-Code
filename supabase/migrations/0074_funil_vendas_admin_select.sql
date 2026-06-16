-- ===========================================================================
-- 0074 — Funil de Vendas histórico: Administração lê crm_oportunidade
-- ---------------------------------------------------------------------------
-- O CRM operacional é da Direção + Master (a Administração perdeu na 0043). Mas
-- o FUNIL DE VENDAS histórico/analítico precisa ser visível também à
-- Administração. Damos SELECT (somente leitura) em crm_oportunidade — não no CRM
-- inteiro. Política aditiva (RLS = OR): não afeta o acesso total de Master/
-- Direção (crm_admin_all). Idempotente.
-- ===========================================================================

do $$
begin
  if to_regclass('public.crm_oportunidade') is not null then
    drop policy if exists crm_oportunidade_select_adm on public.crm_oportunidade;
    create policy crm_oportunidade_select_adm on public.crm_oportunidade
      for select to authenticated
      using (public.app_perfil() = 'administracao');
  end if;
end $$;

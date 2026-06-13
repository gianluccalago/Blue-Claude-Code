-- ===========================================================================
-- 0055 — Direção também EDITA a tabela de preços (além do Master)
-- ---------------------------------------------------------------------------
-- A Administração permanece em leitura. Mantém a policy de SELECT da 0053
-- (master/administracao/direcao) e amplia a de ESCRITA para master + direcao.
-- Idempotente.
-- ===========================================================================

do $$
begin
  if to_regclass('public.tabela_preco') is not null then
    drop policy if exists tabela_preco_write on public.tabela_preco;
    create policy tabela_preco_write on public.tabela_preco for all to authenticated
      using (public.app_perfil() in ('master','direcao'))
      with check (public.app_perfil() in ('master','direcao'));
  end if;
end $$;

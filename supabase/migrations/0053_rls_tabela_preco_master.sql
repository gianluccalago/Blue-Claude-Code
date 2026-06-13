-- ===========================================================================
-- 0053 — Tabela de preços: ESCRITA só do Master; Administração/Direção leem
-- ---------------------------------------------------------------------------
-- A Administração continua USANDO os valores nas mensalidades, mas não edita.
-- Substitui a policy 'admin_only' (0043) por select (master/admin/direção) +
-- write (master). Idempotente.
-- ===========================================================================

do $$
begin
  if to_regclass('public.tabela_preco') is not null then
    alter table public.tabela_preco enable row level security;
    drop policy if exists demo_all          on public.tabela_preco;
    drop policy if exists auth_all          on public.tabela_preco;
    drop policy if exists admin_only        on public.tabela_preco;
    drop policy if exists tabela_preco_select on public.tabela_preco;
    drop policy if exists tabela_preco_write  on public.tabela_preco;

    -- LEITURA: Master, Administração e Direção.
    create policy tabela_preco_select on public.tabela_preco for select to authenticated
      using (public.app_perfil() in ('master','administracao','direcao'));

    -- ESCRITA (insert/update/delete): apenas o Master.
    create policy tabela_preco_write on public.tabela_preco for all to authenticated
      using (public.app_perfil() = 'master')
      with check (public.app_perfil() = 'master');
  end if;
end $$;

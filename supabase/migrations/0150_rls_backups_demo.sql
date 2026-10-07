-- ===========================================================================
-- 0150 — Fecha as tabelas de backup da demonstração para a API.
-- ---------------------------------------------------------------------------
-- O roteiro de demonstração (demo-assets/seed/DEMO_SEED.sql) cria
-- demo_backup_residentes (quem estava ativo antes da demo) e demo_backup_crm
-- (status das oportunidades). Elas nasceram sem RLS: qualquer pessoa com a
-- chave pública do app conseguia ler, alterar ou apagar essas linhas pela API
-- — e apagar quebraria a limpeza da demo (hóspedes reais não voltariam a
-- ficar ativos). Aqui: RLS ligado, SEM policy, e sem permissão para anon e
-- authenticated. O SQL Editor (postgres) continua lendo, e a limpeza
-- (DEMO_LIMPEZA.sql) funciona igual. Se as tabelas não existirem, não faz nada.
-- ===========================================================================
do $$
declare t text;
begin
  foreach t in array array['demo_backup_residentes', 'demo_backup_crm'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

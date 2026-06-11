-- ============================================================================
-- Blue Senior Living — Migration 0032
-- RLS FINA: escopo por residente para a FAMÍLIA e restrição do FINANCEIRO à
-- Administração. Complementa a 0031 (que só exigia login).
--
-- Princípios:
--  • FAMÍLIA enxerga/grava SOMENTE o seu residente_vinculado (no banco, não só
--    na interface) — nas tabelas que o portal usa.
--  • Dados clínicos/operacionais que a família NÃO usa ficam invisíveis a ela.
--  • FINANCEIRO (preços, mensalidades, pagamento de pessoal) só Administração/
--    Master; a família vê apenas o seu próprio upselling.
--
-- CAMALEÃO continua funcionando: ao "ver como", a SESSÃO segue sendo a do
-- Master (app_perfil() = 'master' → acesso total); o filtro por residente é
-- feito na interface pela identidade efetiva.
--
-- Depende de app_perfil()/app_usuario_id() (0030). Idempotente. Rode após 0031.
-- ============================================================================

-- Residente vinculado ao usuário-família logado (null nos demais perfis).
create or replace function public.app_residente_familia()
returns uuid language sql stable security definer set search_path = public as $$
  select u.residente_vinculado from public.usuarios u
  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and u.ativo
  order by u.id limit 1
$$;
grant execute on function public.app_residente_familia() to authenticated, anon;

-- Helper p/ aplicar uma policy "staff total; família só o seu residente".
-- (feito inline por tabela porque a coluna de residente é sempre residente_id)

-- ---------- FAMÍLIA escopada ao seu residente (staff = total) ----------
do $$ declare t text;
begin
  foreach t in array array['compromisso_externo','solicitacao_familia'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security;', t);
      execute format('drop policy if exists demo_all on public.%I;', t);
      execute format('drop policy if exists auth_all on public.%I;', t);
      execute format('drop policy if exists fam_scope on public.%I;', t);
      execute format(
        'create policy fam_scope on public.%I for all to authenticated '
        || 'using (public.app_perfil() <> ''familia'' or residente_id = public.app_residente_familia()) '
        || 'with check (public.app_perfil() <> ''familia'' or residente_id = public.app_residente_familia());', t);
    end if;
  end loop;
end $$;

-- atividade_participacao: família só LÊ a participação do seu residente; quem
-- registra é a equipe (não família).
do $$
begin
  if to_regclass('public.atividade_participacao') is not null then
    alter table public.atividade_participacao enable row level security;
    drop policy if exists demo_all on public.atividade_participacao;
    drop policy if exists auth_all on public.atividade_participacao;
    drop policy if exists ap_scope on public.atividade_participacao;
    create policy ap_scope on public.atividade_participacao for all to authenticated
      using (public.app_perfil() <> 'familia' or residente_id = public.app_residente_familia())
      with check (public.app_perfil() <> 'familia');
  end if;
end $$;

-- ---------- FINANCEIRO ----------
-- upselling: Administração/Master total; família vê só o seu residente.
do $$
begin
  if to_regclass('public.upselling') is not null then
    alter table public.upselling enable row level security;
    drop policy if exists demo_all on public.upselling;
    drop policy if exists auth_all on public.upselling;
    drop policy if exists upselling_select on public.upselling;
    drop policy if exists upselling_write on public.upselling;
    create policy upselling_select on public.upselling for select to authenticated using (
      public.app_perfil() in ('administracao','master')
      or (public.app_perfil() = 'familia' and residente_id = public.app_residente_familia())
    );
    create policy upselling_write on public.upselling for all to authenticated
      using (public.app_perfil() in ('administracao','master'))
      with check (public.app_perfil() in ('administracao','master'));
  end if;
end $$;

-- Preços, mensalidades e pagamento de pessoal: só Administração/Master.
do $$ declare t text;
begin
  foreach t in array array['tabela_preco','pagamento_mensalidade','pagamento_pessoal'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security;', t);
      execute format('drop policy if exists demo_all on public.%I;', t);
      execute format('drop policy if exists auth_all on public.%I;', t);
      execute format('drop policy if exists admin_only on public.%I;', t);
      execute format(
        'create policy admin_only on public.%I for all to authenticated '
        || 'using (public.app_perfil() in (''administracao'',''master'')) '
        || 'with check (public.app_perfil() in (''administracao'',''master''));', t);
    end if;
  end loop;
end $$;

-- ---------- CLÍNICO/OPERACIONAL invisível à família ----------
-- (a equipe acessa; a família não usa estas telas)
do $$ declare t text;
begin
  foreach t in array array[
    'avaliacao_ivcf','evolucao','evolucao_nutricional','resolucao_medica',
    'estoque_hospede','dispensacao','dieta','inspecao_suite','inspecao_item',
    'rouparia_transito','chamado_manutencao'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security;', t);
      execute format('drop policy if exists demo_all on public.%I;', t);
      execute format('drop policy if exists auth_all on public.%I;', t);
      execute format('drop policy if exists staff_only on public.%I;', t);
      execute format(
        'create policy staff_only on public.%I for all to authenticated '
        || 'using (public.app_perfil() <> ''familia'') '
        || 'with check (public.app_perfil() <> ''familia'');', t);
    end if;
  end loop;
end $$;

-- Fim.

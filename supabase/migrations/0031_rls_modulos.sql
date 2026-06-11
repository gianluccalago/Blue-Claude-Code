-- ============================================================================
-- Blue Senior Living — Migration 0031
-- RLS das tabelas dos módulos novos (Médico, Nutrição, Multi, Farmácia,
-- Hotelaria, Administração, Família). Antes ficavam com RLS DESABILITADA
-- (abertas até para anônimo). Agora exigem LOGIN; o Estoque de Resgate ganha a
-- trava por perfil pedida (cuidador sem acesso; reposição só Farmácia; baixa
-- por Farmácia/Coordenação/Médico).
--
-- Depende das funções app_perfil()/app_usuario_id() (migration 0030).
-- Idempotente. Rode DEPOIS da 0030.
--
-- NOTA: o escopo fino por residente (família ver só o seu) e por perfil nos
-- dados financeiros é um próximo refinamento; aqui o ganho é exigir login
-- (bloquear acesso anônimo) sem quebrar os módulos.
-- ============================================================================

-- ---------- Baseline: exige login (authenticated) ----------
do $$ declare t text;
begin
  foreach t in array array[
    'avaliacao_ivcf','evolucao','evolucao_nutricional','resolucao_medica',
    'estoque_hospede','dispensacao','inspecao_suite','inspecao_item',
    'chamado_manutencao','rouparia_transito','atividade','atividade_execucao',
    'atividade_participacao','dieta','tabela_preco','pagamento_mensalidade',
    'pagamento_pessoal','upselling','solicitacao_familia'
  ] loop
    -- só age se a tabela existir (tolera projetos sem alguma migration)
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security;', t);
      execute format('drop policy if exists demo_all on public.%I;', t);
      execute format('drop policy if exists auth_all on public.%I;', t);
      execute format(
        'create policy auth_all on public.%I for all to authenticated using (true) with check (true);', t);
    end if;
  end loop;
end $$;

-- ---------- Estoque de Resgate: trava por perfil ----------
-- estoque_resgate: visível à equipe (menos cuidador/família); reposição
-- (insert/update/delete) só Farmácia/Master.
do $$
begin
  if to_regclass('public.estoque_resgate') is not null then
    alter table public.estoque_resgate enable row level security;
    drop policy if exists demo_all on public.estoque_resgate;
    drop policy if exists auth_all on public.estoque_resgate;
    drop policy if exists estoque_resgate_select on public.estoque_resgate;
    drop policy if exists estoque_resgate_write on public.estoque_resgate;
    create policy estoque_resgate_select on public.estoque_resgate for select to authenticated
      using (public.app_perfil() not in ('cuidador','familia'));
    create policy estoque_resgate_write on public.estoque_resgate for all to authenticated
      using (public.app_perfil() in ('farmacia','master'))
      with check (public.app_perfil() in ('farmacia','master'));
  end if;

  -- baixa_resgate: visível à equipe (menos cuidador/família); registrar a baixa
  -- por Farmácia/Coordenação/Médico/Master.
  if to_regclass('public.baixa_resgate') is not null then
    alter table public.baixa_resgate enable row level security;
    drop policy if exists demo_all on public.baixa_resgate;
    drop policy if exists auth_all on public.baixa_resgate;
    drop policy if exists baixa_resgate_select on public.baixa_resgate;
    drop policy if exists baixa_resgate_write on public.baixa_resgate;
    create policy baixa_resgate_select on public.baixa_resgate for select to authenticated
      using (public.app_perfil() not in ('cuidador','familia'));
    create policy baixa_resgate_write on public.baixa_resgate for all to authenticated
      using (public.app_perfil() in ('farmacia','coordenacao','medico','master'))
      with check (public.app_perfil() in ('farmacia','coordenacao','medico','master'));
  end if;
end $$;

-- Fim.

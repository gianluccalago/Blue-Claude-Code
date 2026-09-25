-- ===========================================================================
-- 0134 — AUTORIA NO SERVIDOR + INTEGRIDADE DO PRONTUÁRIO + ÍNDICES.
-- ---------------------------------------------------------------------------
-- a) AUTORIA: 80+ colunas "*_por" (texto) eram preenchidas pelo cliente com
--    o nome que ele quisesse — e, no Modo Camaleão, com o nome da pessoa
--    encarnada. Agora um trigger genérico grava o NOME DO USUÁRIO AUTENTICADO
--    (pela tabela usuarios, via app_usuario_id()):
--      · INSERT: toda coluna *_por (texto) que vier preenchida recebe o nome
--        real; registrado_por/administrado_por/feito_por/realizado_por/
--        criado_por etc. são preenchidas mesmo se vierem vazias.
--      · UPDATE: toda coluna *_por (texto) cujo valor MUDOU nesta gravação
--        recebe o nome de quem gravou (resolvido_por, pago_por, ciente_por…).
--    Sem JWT (SQL Editor, migrations, seeds) nada é alterado.
--    Fora: fc_* (marcadores "sincronização"/"planilha" são informação) e
--    livro_controlados (o hash encadeado inclui o autor; trocar o campo aqui
--    quebraria a verificação — ver pendência para mover o autor à RPC).
-- b) PRONTUÁRIO: residentes tem 28 chaves estrangeiras ON DELETE CASCADE.
--    Apagar um hóspede apagaria prescrições, evoluções, administrações,
--    intercorrências… A gestão pode DELETE pela RLS. Trigger recusa a
--    exclusão quando existe histórico assistencial (use "Registrar saída").
-- c) ÍNDICES em residente_id nas tabelas clínicas mais consultadas.
-- Idempotente. Rode após a 0133.
-- ===========================================================================

-- ── a · Autoria pelo servidor ───────────────────────────────────────────────
create or replace function public.fn_autoria_servidor()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
  v_col  record;
  v_new  jsonb := to_jsonb(new);
  v_old  jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_mudou boolean := false;
begin
  if coalesce(auth.jwt() ->> 'email', '') = '' then return new; end if;
  select nome into v_nome from public.usuarios where id = public.app_usuario_id();
  if v_nome is null then return new; end if;

  for v_col in
    select column_name from information_schema.columns
     where table_schema = tg_table_schema and table_name = tg_table_name
       and data_type = 'text' and column_name like '%\_por'
  loop
    if tg_op = 'INSERT' then
      if (v_new ->> v_col.column_name) is not null
         or v_col.column_name in ('registrado_por','administrado_por','feito_por','realizado_por','realizada_por',
                                  'criado_por','criada_por','aberto_por','definida_por','dispensado_por',
                                  'inspecionado_por','lancado_por','aplicada_por','aplicado_por','enviada_por',
                                  'extraido_por','alterado_por','tratado_por','atualizado_por') then
        v_new := jsonb_set(v_new, array[v_col.column_name], to_jsonb(v_nome));
        v_mudou := true;
      end if;
    else
      if (v_new ->> v_col.column_name) is distinct from (v_old ->> v_col.column_name) then
        v_new := jsonb_set(v_new, array[v_col.column_name], to_jsonb(v_nome));
        v_mudou := true;
      end if;
    end if;
  end loop;

  if v_mudou then new := jsonb_populate_record(new, v_new); end if;
  return new;
end $$;
comment on function public.fn_autoria_servidor is
  'Grava o nome do usuário autenticado nas colunas *_por (texto) — o cliente não escolhe a autoria.';

do $$
declare t record;
begin
  for t in
    select distinct table_name from information_schema.columns
     where table_schema = 'public' and data_type = 'text' and column_name like '%\_por'
       and table_name not like 'fc\_%' and table_name not like '%\_bkp\_%'
       and table_name <> 'livro_controlados'
  loop
    execute format('drop trigger if exists trg_autoria_servidor on public.%I;', t.table_name);
    execute format('create trigger trg_autoria_servidor before insert or update on public.%I for each row execute function public.fn_autoria_servidor();', t.table_name);
  end loop;
end $$;

-- ── b · Prontuário não se apaga ─────────────────────────────────────────────
create or replace function public.fn_residentes_guarda_exclusao()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_qtd int := 0; v_tab text;
begin
  foreach v_tab in array array['prescricao','administracao','evolucao','intercorrencia','avaliacao_ivcf',
                               'tarefa_registro','eliminacao','dispensacao','plano_cuidado_item','evolucao_admissao'] loop
    if to_regclass('public.' || v_tab) is not null then
      execute format('select count(*) from public.%I where residente_id = $1', v_tab) into v_qtd using old.id;
      if v_qtd > 0 then
        raise exception 'O hóspede tem histórico assistencial (% em %). Não se apaga prontuário: use "Registrar saída".', v_qtd, v_tab;
      end if;
    end if;
  end loop;
  return old;
end $$;
drop trigger if exists trg_residentes_guarda_exclusao on public.residentes;
create trigger trg_residentes_guarda_exclusao before delete on public.residentes
  for each row execute function public.fn_residentes_guarda_exclusao();

-- ── c · Índices ─────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['administracao','evolucao','intercorrencia','avaliacao_ivcf','baixa_resgate',
                           'evento_sentinela','agravo_epidemiologico','chamado_manutencao','crm_oportunidade','cuidador_residente'] loop
    if to_regclass('public.' || t) is not null then
      execute format('create index if not exists %I on public.%I (residente_id);', 'idx_' || t || '_residente', t);
    end if;
  end loop;
  if to_regclass('public.administracao') is not null then
    create index if not exists idx_administracao_residente_data on public.administracao (residente_id, administrado_em desc);
  end if;
  if to_regclass('public.tarefa_registro') is not null then
    create index if not exists idx_tarefa_registro_residente_data on public.tarefa_registro (residente_id, data);
  end if;
end $$;

-- ── Conferência ─────────────────────────────────────────────────────────────
do $$
declare v int;
begin
  select count(distinct event_object_table) into v from information_schema.triggers where trigger_name = 'trg_autoria_servidor';
  raise notice 'Autoria pelo servidor ativa em % tabelas.', v;
end $$;

-- Fim.

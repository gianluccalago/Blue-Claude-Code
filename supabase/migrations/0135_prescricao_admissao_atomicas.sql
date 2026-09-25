-- ===========================================================================
-- 0135 — PRESCRIÇÃO E ADMISSÃO ATÔMICAS + IDEMPOTÊNCIA (CLI-01, CLI-13, BD-04).
-- ---------------------------------------------------------------------------
-- Problema: o cliente gravava em vários comandos. Editar uma prescrição
-- suspendia as linhas antigas (ativa=false) e SÓ DEPOIS inseria as novas: se
-- o insert falhasse, o hóspede ficava sem a medicação nas telas. A admissão
-- inseria patologias, peso, prescrições e por último o documento; uma falha
-- ou um "tentar de novo" no meio duplicava prescrições.
-- Agora: RPCs SECURITY DEFINER, cada uma numa única transação, com advisory
-- lock por residente e chave de idempotência gerada no cliente:
--   · criar_prescricao(p jsonb, p_idempotencia uuid)
--   · editar_prescricao(p_grupo uuid, p jsonb, p_idempotencia uuid)
--   · suspender_prescricao(p_grupo uuid, p_motivo text, p_idempotencia uuid)
--   · registrar_admissao(p jsonb, p_idempotencia uuid)
-- Regras: perfil validado (medico/master, o mesmo das policies de escrita);
-- a prescrição antiga NUNCA é suspensa se a nova falhar (mesma transação, e
-- as novas linhas entram antes da suspensão); histórico preservado — linhas
-- antigas ficam com ativa=false, nunca DELETE. Quantidade por período é
-- obrigatória também no servidor (CLI-13). A tabela operacao_idempotente
-- guarda o resultado por chave: repetir a mesma chave devolve o mesmo
-- resultado sem gravar de novo. Admissão repetida do mesmo hóspede no mesmo
-- dia cai no caminho de EDIÇÃO do documento (não regera prescrições/peso).
-- Autoria (*_por) continua a cargo do trigger da 0134 — nada é preenchido aqui.
-- Idempotente. Rode após a 0134.
-- ===========================================================================

-- ── Tabela de idempotência ──────────────────────────────────────────────────
create table if not exists public.operacao_idempotente (
  chave     uuid primary key,
  resultado jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
comment on table public.operacao_idempotente is
  'Resultado de operações (RPCs) por chave gerada no cliente: repetir a chave devolve o mesmo resultado sem gravar de novo.';
alter table public.operacao_idempotente enable row level security;
-- Só as RPCs (security definer) leem/escrevem; nenhum papel do app acessa direto.
revoke all on table public.operacao_idempotente from public, anon, authenticated;

-- ── Rastro da suspensão (histórico; nunca apagamos linhas) ──────────────────
alter table public.prescricao add column if not exists suspensa_em timestamptz;
alter table public.prescricao add column if not exists suspensa_motivo text;

-- ── Helpers internos (sem grant: só as RPCs chamam) ─────────────────────────

-- Recusa qualquer perfil que não seja o mesmo das policies prescricao_write /
-- admissao_write. coalesce garante que "sem perfil" (null) também é recusado.
create or replace function public.fn_presc_exige_medico()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.app_perfil(), '') not in ('medico', 'master') then
    raise exception 'Somente médico ou master podem prescrever ou registrar admissão.'
      using errcode = 'insufficient_privilege';
  end if;
end $$;

-- Resultado já gravado para a chave (null se nunca concluiu).
create or replace function public.fn_idempotente_resultado(p_chave uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select resultado from public.operacao_idempotente where chave = p_chave
$$;

-- Guarda o resultado da chave (na mesma transação da operação: se a operação
-- falhar, nada fica gravado e a repetição pode tentar de novo).
create or replace function public.fn_idempotente_guardar(p_chave uuid, p_resultado jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_chave is null then return; end if;
  insert into public.operacao_idempotente (chave, resultado) values (p_chave, p_resultado);
end $$;

-- Valida e insere as linhas (uma por período) de um grupo de prescrição.
-- p: {residente_id, medicamento, dose, via, posologia, controlado, alerta_alergia,
--     periodos: [{periodo, quantidade}, ...]}
-- Devolve os ids inseridos. Nenhuma regra clínica aqui: só estrutura.
create or replace function public.fn_presc_inserir_linhas(p_residente uuid, p_grupo uuid, p jsonb)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare
  v_medicamento text := upper(regexp_replace(btrim(coalesce(p ->> 'medicamento', '')), '\s+', ' ', 'g'));
  v_via         text := coalesce(p ->> 'via', '');
  v_dose        text := nullif(btrim(coalesce(p ->> 'dose', '')), '');
  v_posologia   text := nullif(btrim(coalesce(p ->> 'posologia', '')), '');
  v_alerta      text := nullif(btrim(coalesce(p ->> 'alerta_alergia', '')), '');
  v_controlado  boolean := coalesce((p ->> 'controlado')::boolean, false);
  v_prescritor  uuid := public.app_usuario_id();
  v_periodos    jsonb := p -> 'periodos';
  v_item        jsonb;
  v_periodo     text;
  v_quantidade  text;
  v_vistos      text[] := '{}';
  v_ids         uuid[] := '{}';
  v_id          uuid;
begin
  if v_medicamento = '' then
    raise exception 'Informe o medicamento.';
  end if;
  if v_via not in ('oral', 'injetavel', 'insulina', 'sonda') then
    raise exception 'Via de administração inválida: %.', v_via;
  end if;
  if v_periodos is null or jsonb_typeof(v_periodos) <> 'array' or jsonb_array_length(v_periodos) = 0 then
    raise exception 'Selecione ao menos um período para %.', v_medicamento;
  end if;

  for v_item in select * from jsonb_array_elements(v_periodos) loop
    v_periodo    := v_item ->> 'periodo';
    v_quantidade := nullif(btrim(coalesce(v_item ->> 'quantidade', '')), '');
    if v_periodo is null or v_periodo not in ('jejum', 'manha', 'almoco', 'apos_almoco', 'tarde', 'noite') then
      raise exception 'Período inválido em %: %.', v_medicamento, coalesce(v_periodo, '(vazio)');
    end if;
    if v_periodo = any (v_vistos) then
      raise exception 'Período repetido em %: %.', v_medicamento, v_periodo;
    end if;
    if v_quantidade is null then
      raise exception 'Informe a quantidade de % no período %.', v_medicamento, v_periodo;
    end if;
    v_vistos := v_vistos || v_periodo;

    insert into public.prescricao (
      residente_id, medicamento, dose, via, posologia, periodo, quantidade,
      grupo_prescricao, ativa, alerta_alergia, prescrito_por, controlado
    ) values (
      p_residente, v_medicamento, v_dose, v_via, v_posologia, v_periodo, v_quantidade,
      p_grupo, true, v_alerta, v_prescritor, v_controlado
    ) returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;
  return v_ids;
end $$;

-- ── criar_prescricao ────────────────────────────────────────────────────────
create or replace function public.criar_prescricao(p jsonb, p_idempotencia uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_residente uuid := (p ->> 'residente_id')::uuid;
  v_grupo     uuid := coalesce((p ->> 'grupo_prescricao')::uuid, gen_random_uuid());
  v_ids       uuid[];
  v_res       jsonb;
begin
  perform public.fn_presc_exige_medico();
  if v_residente is null then raise exception 'Informe o hóspede.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('prescricao:' || v_residente::text, 0));

  v_res := public.fn_idempotente_resultado(p_idempotencia);
  if v_res is not null then return v_res; end if;

  v_ids := public.fn_presc_inserir_linhas(v_residente, v_grupo, p);
  v_res := jsonb_build_object('grupo_prescricao', v_grupo, 'linhas', coalesce(array_length(v_ids, 1), 0));
  perform public.fn_idempotente_guardar(p_idempotencia, v_res);
  return v_res;
end $$;
comment on function public.criar_prescricao(jsonb, uuid) is
  'Cria um grupo de prescrição (uma linha por período) numa transação; idempotente pela chave.';

-- ── editar_prescricao ───────────────────────────────────────────────────────
-- Insere as novas linhas ANTES de suspender as antigas: qualquer falha
-- desfaz tudo e a prescrição anterior segue ativa e intacta.
create or replace function public.editar_prescricao(p_grupo uuid, p jsonb, p_idempotencia uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_residente  uuid;
  v_antigas    uuid[];
  v_ids        uuid[];
  v_res        jsonb;
begin
  perform public.fn_presc_exige_medico();
  if p_grupo is null then raise exception 'Informe a prescrição a editar.'; end if;

  select residente_id into v_residente
    from public.prescricao where grupo_prescricao = p_grupo limit 1;
  if v_residente is null then
    raise exception 'Prescrição não encontrada.';
  end if;
  if (p ->> 'residente_id') is not null and (p ->> 'residente_id')::uuid <> v_residente then
    raise exception 'A prescrição não pertence a este hóspede.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('prescricao:' || v_residente::text, 0));

  v_res := public.fn_idempotente_resultado(p_idempotencia);
  if v_res is not null then return v_res; end if;

  select coalesce(array_agg(id), '{}') into v_antigas
    from public.prescricao where grupo_prescricao = p_grupo and ativa;
  if coalesce(array_length(v_antigas, 1), 0) = 0 then
    raise exception 'Prescrição já suspensa; crie uma nova em vez de editar.';
  end if;

  -- 1) novas linhas (se falhar, nada abaixo acontece)
  v_ids := public.fn_presc_inserir_linhas(v_residente, p_grupo, p);
  -- 2) só então as antigas saem de cena (histórico preservado: ativa=false)
  update public.prescricao
     set ativa = false, suspensa_em = now()
   where id = any (v_antigas);

  v_res := jsonb_build_object(
    'grupo_prescricao', p_grupo,
    'linhas', coalesce(array_length(v_ids, 1), 0),
    'suspensas', coalesce(array_length(v_antigas, 1), 0));
  perform public.fn_idempotente_guardar(p_idempotencia, v_res);
  return v_res;
end $$;
comment on function public.editar_prescricao(uuid, jsonb, uuid) is
  'Substitui as linhas ativas do grupo numa transação: novas entram antes das antigas saírem (ativa=false).';

-- ── suspender_prescricao ────────────────────────────────────────────────────
create or replace function public.suspender_prescricao(p_grupo uuid, p_motivo text default null, p_idempotencia uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_residente uuid;
  v_qtd       int;
  v_res       jsonb;
begin
  perform public.fn_presc_exige_medico();
  if p_grupo is null then raise exception 'Informe a prescrição a suspender.'; end if;

  select residente_id into v_residente
    from public.prescricao where grupo_prescricao = p_grupo limit 1;
  if v_residente is null then
    raise exception 'Prescrição não encontrada.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('prescricao:' || v_residente::text, 0));

  v_res := public.fn_idempotente_resultado(p_idempotencia);
  if v_res is not null then return v_res; end if;

  update public.prescricao
     set ativa = false, suspensa_em = now(),
         suspensa_motivo = nullif(btrim(coalesce(p_motivo, '')), '')
   where grupo_prescricao = p_grupo and ativa;
  get diagnostics v_qtd = row_count;

  v_res := jsonb_build_object('grupo_prescricao', p_grupo, 'suspensas', v_qtd);
  perform public.fn_idempotente_guardar(p_idempotencia, v_res);
  return v_res;
end $$;
comment on function public.suspender_prescricao(uuid, text, uuid) is
  'Suspende todas as linhas ativas do grupo (ativa=false, nunca DELETE); idempotente pela chave.';

-- ── registrar_admissao ──────────────────────────────────────────────────────
-- p: {residente_id, existente_id?, texto_evolucao?, dados: {...DadosAdmissao}}
-- dados usa as chaves do formulário: comorbidades[], alergias, peso, altura,
-- dataAdmissao, medicacoes[{medicamento, dose, via, posologia, periodos[], quantidade}].
-- Edição (existente_id informado, ou já há admissão do hóspede HOJE): só
-- comorbidades/alergias (idempotentes) e o documento. Criação: também peso,
-- altura, prescrições, documento e a evolução resumida — tudo ou nada.
create or replace function public.registrar_admissao(p jsonb, p_idempotencia uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_residente   uuid := (p ->> 'residente_id')::uuid;
  v_dados       jsonb := p -> 'dados';
  v_existente   uuid := (p ->> 'existente_id')::uuid;
  v_texto       text := nullif(btrim(coalesce(p ->> 'texto_evolucao', '')), '');
  v_medico_id   uuid := public.app_usuario_id();
  v_medico_nome text;
  v_medico_crm  text;
  v_item        jsonb;
  v_desc        text;
  v_alergias    text;
  v_peso        numeric;
  v_altura      numeric;
  v_ultimo_peso numeric;
  v_data_adm    date;
  v_presc       boolean := false;
  v_grupo       uuid;
  v_id          uuid;
  v_res         jsonb;
begin
  perform public.fn_presc_exige_medico();
  if v_residente is null then raise exception 'Informe o hóspede.'; end if;
  if v_dados is null or jsonb_typeof(v_dados) <> 'object' then
    raise exception 'Dados da admissão ausentes.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('prescricao:' || v_residente::text, 0));

  v_res := public.fn_idempotente_resultado(p_idempotencia);
  if v_res is not null then return v_res; end if;

  select nome, registro_profissional into v_medico_nome, v_medico_crm
    from public.usuarios where id = v_medico_id;

  -- Já existe admissão deste hóspede hoje? Então é edição (não regera nada).
  if v_existente is null then
    select id into v_existente from public.evolucao_admissao
     where residente_id = v_residente
       and (criado_em at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
     order by criado_em desc limit 1;
  elsif not exists (select 1 from public.evolucao_admissao where id = v_existente and residente_id = v_residente) then
    raise exception 'Admissão a editar não encontrada para este hóspede.';
  end if;

  -- Comorbidades → patologia_residente (dedup por texto normalizado; sempre).
  if jsonb_typeof(v_dados -> 'comorbidades') = 'array' then
    for v_item in select * from jsonb_array_elements(v_dados -> 'comorbidades') loop
      v_desc := btrim(coalesce(v_item #>> '{}', ''));
      if v_desc = '' then continue; end if;
      if not exists (
        select 1 from public.patologia_residente
         where residente_id = v_residente and ativa
           and lower(regexp_replace(btrim(descricao), '\s+', ' ', 'g'))
             = lower(regexp_replace(v_desc, '\s+', ' ', 'g'))
      ) then
        insert into public.patologia_residente (residente_id, descricao) values (v_residente, v_desc);
      end if;
    end loop;
  end if;

  -- Alergias → cadastro (idempotente).
  v_alergias := nullif(btrim(coalesce(v_dados ->> 'alergias', '')), '');
  if v_alergias is not null then
    update public.residentes set alergias = v_alergias where id = v_residente;
  end if;

  if v_existente is not null then
    update public.evolucao_admissao
       set dados = v_dados, atualizado_em = now()
     where id = v_existente;
    v_res := jsonb_build_object('id', v_existente, 'criada', false, 'prescricoes_geradas', false);
    perform public.fn_idempotente_guardar(p_idempotencia, v_res);
    return v_res;
  end if;

  -- ── Criação ────────────────────────────────────────────────────────────
  v_data_adm := nullif(btrim(coalesce(v_dados ->> 'dataAdmissao', '')), '')::date;
  begin
    v_peso   := nullif(replace(btrim(coalesce(v_dados ->> 'peso', '')), ',', '.'), '')::numeric;
    v_altura := nullif(replace(btrim(coalesce(v_dados ->> 'altura', '')), ',', '.'), '')::numeric;
  exception when others then
    raise exception 'Peso/altura inválidos: use números (ex.: 62,5 e 1,60).';
  end;
  if v_peso is not null and v_peso > 0 then
    select peso_kg into v_ultimo_peso from public.registro_peso
     where residente_id = v_residente order by data desc, registrado_em desc limit 1;
    -- Não re-registra se o peso for IDÊNTICO ao último (botão "Usar este peso").
    if v_ultimo_peso is null or abs(v_ultimo_peso - v_peso) >= 0.001 then
      insert into public.registro_peso (residente_id, peso_kg, altura_m, imc, data, observacao)
      values (
        v_residente, v_peso,
        case when v_altura > 0 then v_altura end,
        case when v_altura > 0 then round(v_peso / (v_altura * v_altura), 1) end,
        coalesce(v_data_adm, current_date), 'Peso de admissão');
    end if;
    if v_altura is not null and v_altura > 0 then
      update public.residentes set altura_m = v_altura where id = v_residente;
    end if;
  end if;

  -- Medicações contínuas → prescrição real (um grupo por medicação).
  if jsonb_typeof(v_dados -> 'medicacoes') = 'array' then
    for v_item in select * from jsonb_array_elements(v_dados -> 'medicacoes') loop
      if btrim(coalesce(v_item ->> 'medicamento', '')) = '' then continue; end if;
      if jsonb_typeof(v_item -> 'periodos') <> 'array' or jsonb_array_length(v_item -> 'periodos') = 0 then continue; end if;
      v_grupo := gen_random_uuid();
      perform public.fn_presc_inserir_linhas(v_residente, v_grupo, jsonb_build_object(
        'medicamento', v_item ->> 'medicamento',
        'dose', v_item ->> 'dose',
        'via', v_item ->> 'via',
        'posologia', coalesce(nullif(btrim(coalesce(v_item ->> 'posologia', '')), ''), '1x/dia'),
        'controlado', false,
        'periodos', (
          select jsonb_agg(jsonb_build_object('periodo', per #>> '{}', 'quantidade', v_item ->> 'quantidade'))
            from jsonb_array_elements(v_item -> 'periodos') per)));
      v_presc := true;
    end loop;
  end if;

  insert into public.evolucao_admissao (
    residente_id, dados, medico_id, medico_nome, medico_crm, data_admissao_avaliacao, prescricoes_geradas
  ) values (
    v_residente, v_dados, v_medico_id, v_medico_nome, v_medico_crm, v_data_adm, v_presc
  ) returning id into v_id;

  if v_texto is not null then
    insert into public.evolucao (residente_id, texto) values (v_residente, v_texto);
  end if;

  v_res := jsonb_build_object('id', v_id, 'criada', true, 'prescricoes_geradas', v_presc);
  perform public.fn_idempotente_guardar(p_idempotencia, v_res);
  return v_res;
end $$;
comment on function public.registrar_admissao(jsonb, uuid) is
  'Evolução de admissão numa transação: patologias, alergias, peso, altura, prescrições, documento e evolução; idempotente pela chave e por hóspede/dia.';

-- ── Permissões ──────────────────────────────────────────────────────────────
revoke execute on function public.fn_presc_exige_medico() from public, anon, authenticated;
revoke execute on function public.fn_idempotente_resultado(uuid) from public, anon, authenticated;
revoke execute on function public.fn_idempotente_guardar(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.fn_presc_inserir_linhas(uuid, uuid, jsonb) from public, anon, authenticated;

revoke execute on function public.criar_prescricao(jsonb, uuid) from public, anon;
revoke execute on function public.editar_prescricao(uuid, jsonb, uuid) from public, anon;
revoke execute on function public.suspender_prescricao(uuid, text, uuid) from public, anon;
revoke execute on function public.registrar_admissao(jsonb, uuid) from public, anon;
grant execute on function public.criar_prescricao(jsonb, uuid) to authenticated;
grant execute on function public.editar_prescricao(uuid, jsonb, uuid) to authenticated;
grant execute on function public.suspender_prescricao(uuid, text, uuid) to authenticated;
grant execute on function public.registrar_admissao(jsonb, uuid) to authenticated;

-- Fim.

-- ===========================================================================
-- 0139 — FARMÁCIA: integridade de dispensação, livro de controlados,
--        provisionamento e baixa de viagem (achados BD-03, CLI-15, CLI-16).
-- ---------------------------------------------------------------------------
-- 1) dispensar_medicamentos passa a devolver (id, ja_existia): a UI sabia só
--    "deu certo" e mostrava sucesso falso na 2ª confirmação. Índice único em
--    (hóspede, período, dia) fecha a porta para dispensação em dobro fora da
--    RPC. Quantidades numeric(10,2) (0133) — 0,5 baixa 0,5 e estorna 0,5.
-- 2) estornar_dispensacao: mesmo advisory lock da dispensação (não corre em
--    paralelo com uma confirmação do mesmo período/dia).
-- 3) registrar_assento_controlado: AUTORIA NO SERVIDOR (nome de `usuarios`
--    via app_usuario_id(); p_registrado_por vira fallback sem JWT) e RECUSA
--    de estorno duplo (verificação dentro do advisory lock + índice único
--    parcial). O hash continua coerente: o payload usa o nome gravado, e
--    verificar_livro_controlados() reprocessa a partir da linha — sem mudança.
-- 4) Ajuste de provisionamento soma o DELTA ao saldo (30 provisionado/20 saldo
--    → ajusta para 60 → saldo 50). Trigger na tabela (vale para qualquer
--    cliente) + RPC provisionar_estoque_hospede (lote atômico).
-- 5) Baixa de viagem e estorno em RPC atômica: `q = q - x` com trava de linha,
--    recusa de saldo negativo (salvo confirmação explícita) e recusa de
--    estorno duplo. Antes o app lia e gravava no cliente (lost update).
-- Idempotente. Rode DEPOIS da 0134.
-- ===========================================================================

-- ── 1 · Dispensação: devolve ja_existia + índice único ─────────────────────
-- Mudar o tipo de retorno exige DROP (CREATE OR REPLACE não troca o retorno).
drop function if exists public.dispensar_medicamentos(uuid, text, date, jsonb, text);
create function public.dispensar_medicamentos(
  p_residente_id   uuid,
  p_periodo        text,
  p_data           date,
  p_itens          jsonb,
  p_dispensado_por text default null
) returns table (id uuid, ja_existia boolean)
language plpgsql
as $$
#variable_conflict use_column
declare
  v_id   uuid;
  v_item jsonb;
  v_mes  text := to_char(p_data, 'YYYY-MM');
begin
  if jsonb_typeof(p_itens) <> 'array' then
    raise exception 'Itens da dispensação inválidos.';
  end if;

  -- Serializa concorrentes do mesmo (hóspede, período, dia) até o fim da transação.
  perform pg_advisory_xact_lock(
    hashtextextended(p_residente_id::text || '|' || p_periodo || '|' || p_data::text, 0));

  -- Idempotência: já existe dispensação desse período/dia? Não duplica e AVISA.
  select id into v_id
  from public.dispensacao
  where residente_id = p_residente_id and periodo = p_periodo and data = p_data
  limit 1;
  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  -- dispensado_por: a trigger trg_autoria_servidor (0134) grava o nome do
  -- usuário autenticado; o parâmetro só sobrevive sem JWT (seed/SQL Editor).
  insert into public.dispensacao (residente_id, periodo, data, itens, dispensado_por)
  values (p_residente_id, p_periodo, p_data, p_itens, coalesce(nullif(btrim(p_dispensado_por), ''), 'Farmácia'))
  returning id into v_id;

  -- Baixa de estoque de cada item (mesma transação; numeric aceita 0,5).
  for v_item in select * from jsonb_array_elements(p_itens) loop
    update public.estoque_hospede
       set quantidade_atual = quantidade_atual - coalesce((v_item->>'quantidade')::numeric, 0)
     where residente_id = p_residente_id
       and medicamento  = (v_item->>'medicamento')
       and mes_referencia = v_mes;
  end loop;

  return query select v_id, false;
end $$;
comment on function public.dispensar_medicamentos is
  'Dispensação atômica e idempotente por (hóspede, período, dia). Devolve o id e ja_existia=true quando já havia dispensação (nada foi gravado nem baixado).';
grant execute on function public.dispensar_medicamentos(uuid, text, date, jsonb, text) to authenticated;

-- Dispensação em dobro fica proibida também fora da RPC. Se um banco antigo
-- tiver duplicatas, o índice NÃO é criado (avisa) — resolva com
-- estornar_dispensacao(id) das repetidas e rode este bloco de novo.
do $$
begin
  if exists (select 1 from public.dispensacao group by residente_id, periodo, data having count(*) > 1) then
    raise warning '0139: dispensacao tem duplicatas por (residente, período, dia); índice único NÃO criado. Estorne as repetidas e reaplique.';
  else
    create unique index if not exists dispensacao_unica_periodo_dia
      on public.dispensacao (residente_id, periodo, data);
  end if;
end $$;

-- ── 2 · Estorno de dispensação com a mesma trava ───────────────────────────
create or replace function public.estornar_dispensacao(p_id uuid)
returns void
language plpgsql
as $$
declare
  v_rec  public.dispensacao%rowtype;
  v_item jsonb;
  v_mes  text;
begin
  select * into v_rec from public.dispensacao where id = p_id;
  if not found then
    return; -- já removida (idempotente)
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(v_rec.residente_id::text || '|' || v_rec.periodo || '|' || v_rec.data::text, 0));
  -- Relê sob a trava: outra sessão pode ter estornado enquanto esperávamos.
  delete from public.dispensacao where id = p_id;
  if not found then
    return;
  end if;
  v_mes := to_char(v_rec.data, 'YYYY-MM');

  for v_item in select * from jsonb_array_elements(v_rec.itens) loop
    update public.estoque_hospede
       set quantidade_atual = quantidade_atual + coalesce((v_item->>'quantidade')::numeric, 0)
     where residente_id = v_rec.residente_id
       and medicamento  = (v_item->>'medicamento')
       and mes_referencia = v_mes;
  end loop;
end $$;
grant execute on function public.estornar_dispensacao(uuid) to authenticated;

-- ── 3 · Livro de controlados: autoria no servidor + estorno único ──────────
create or replace function public.registrar_assento_controlado(
  p_residente_id   uuid,
  p_medicamento    text,
  p_tipo           text,
  p_quantidade     numeric,
  p_unidade        text,
  p_justificativa  text,
  p_referencia     bigint,
  p_registrado_por text default null
) returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_perfil         text := public.app_perfil();
  v_registrado_por text;
  v_numero         bigint;
  v_estorno_ant    bigint;
  v_hash_ant       text;
  v_payload        text;
  v_hash           text;
  v_medicamento    text := upper(regexp_replace(btrim(p_medicamento), '\s+', ' ', 'g'));
begin
  -- Autorização: só os acessos competentes lançam.
  if v_perfil is null or v_perfil not in ('farmacia','master','coordenacao','enfermeira') then
    raise exception 'Perfil não autorizado a lançar no livro de controlados.';
  end if;
  if v_medicamento = '' then
    raise exception 'Informe o medicamento.';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Quantidade deve ser maior que zero.';
  end if;
  if p_tipo not in ('entrada','dispensacao','administracao','perda','vencimento','estorno') then
    raise exception 'Tipo de assento inválido.';
  end if;
  -- Justificativa obrigatória nos assentos sensíveis.
  if p_tipo in ('perda','vencimento','estorno') and coalesce(btrim(p_justificativa), '') = '' then
    raise exception 'Justificativa é obrigatória para %.', p_tipo;
  end if;

  -- AUTORIA NO SERVIDOR: o nome vem de `usuarios` (quem está autenticado).
  -- p_registrado_por só vale como fallback sem JWT (e, sem JWT, o perfil já
  -- barrou acima — na prática o cliente não escolhe o autor).
  select u.nome into v_registrado_por from public.usuarios u where u.id = public.app_usuario_id();
  if coalesce(btrim(v_registrado_por), '') = '' then
    v_registrado_por := nullif(btrim(p_registrado_por), '');
  end if;
  if v_registrado_por is null then
    raise exception 'Não foi possível identificar quem registra o assento.';
  end if;

  -- Serializa o livro (cadeia de hash é global). As verificações de estorno
  -- ficam DENTRO da trava: dois estornos simultâneos do mesmo assento não passam.
  perform pg_advisory_xact_lock(hashtextextended('livro_controlados', 0));

  if p_tipo = 'estorno' then
    if p_referencia is null
       or not exists (select 1 from public.livro_controlados
                      where numero = p_referencia and tipo_assento <> 'estorno') then
      raise exception 'Estorno precisa referenciar o nº de um assento existente.';
    end if;
    select numero into v_estorno_ant from public.livro_controlados
     where tipo_assento = 'estorno' and referencia_numero = p_referencia limit 1;
    if v_estorno_ant is not null then
      raise exception 'O assento nº % já foi estornado (assento nº %).', p_referencia, v_estorno_ant;
    end if;
  end if;

  select hash into v_hash_ant from public.livro_controlados order by numero desc limit 1;

  v_numero := nextval('public.livro_controlados_numero_seq');
  v_payload := concat_ws('|',
    v_numero, coalesce(p_residente_id::text, ''), v_medicamento, p_tipo,
    p_quantidade, coalesce(p_unidade, 'unidade'), coalesce(btrim(p_justificativa), ''),
    coalesce(p_referencia::text, ''), v_registrado_por, v_perfil,
    coalesce(v_hash_ant, 'GENESIS'));
  v_hash := encode(digest(v_payload, 'sha256'), 'hex');

  insert into public.livro_controlados
    (numero, residente_id, medicamento, tipo_assento, quantidade, unidade,
     justificativa, referencia_numero, registrado_por, perfil_registrador,
     hash_anterior, hash)
  values
    (v_numero, p_residente_id, v_medicamento, p_tipo, p_quantidade,
     coalesce(p_unidade, 'unidade'), nullif(btrim(p_justificativa), ''),
     p_referencia, v_registrado_por, v_perfil, v_hash_ant, v_hash);

  return v_numero;
end;
$$;
comment on function public.registrar_assento_controlado is
  'Lança assento no livro de controlados (append-only, hash encadeado). Autor = usuário autenticado (usuarios.nome); recusa estorno de assento já estornado.';
grant execute on function public.registrar_assento_controlado(uuid, text, text, numeric, text, text, bigint, text) to authenticated;

-- Um assento só pode ser estornado uma vez — também fora da RPC.
do $$
begin
  if exists (select 1 from public.livro_controlados where tipo_assento = 'estorno' and referencia_numero is not null
             group by referencia_numero having count(*) > 1) then
    raise warning '0139: livro_controlados já tem estornos duplicados; índice único NÃO criado (o livro é imutável — registre a ocorrência).';
  else
    create unique index if not exists livro_controlados_estorno_unico
      on public.livro_controlados (referencia_numero) where tipo_assento = 'estorno';
  end if;
end $$;

-- ── 4 · Ajuste de provisionamento soma o delta ao saldo ────────────────────
-- Vale para QUALQUER cliente: se só o provisionado mudou (o saldo veio igual
-- ao anterior), o saldo recebe o mesmo delta. Quem grava o saldo de propósito
-- (dispensação, viagem, correção manual) não é afetado.
create or replace function public.fn_estoque_hospede_ajuste_saldo()
returns trigger language plpgsql as $$
begin
  if new.quantidade_provisionada is distinct from old.quantidade_provisionada
     and new.quantidade_atual is not distinct from old.quantidade_atual then
    new.quantidade_atual := old.quantidade_atual + (new.quantidade_provisionada - old.quantidade_provisionada);
  end if;
  return new;
end $$;
comment on function public.fn_estoque_hospede_ajuste_saldo is
  'Ajustar o provisionado do mês soma o delta ao saldo atual (30/20 → 60 ⇒ 50).';
drop trigger if exists trg_estoque_hospede_ajuste_saldo on public.estoque_hospede;
create trigger trg_estoque_hospede_ajuste_saldo
  before update on public.estoque_hospede
  for each row execute function public.fn_estoque_hospede_ajuste_saldo();

-- Provisionamento em lote numa única transação (RLS de estoque_hospede vale).
-- p_itens: [{ medicamento, quantidade_provisionada, unidade }]
create or replace function public.provisionar_estoque_hospede(
  p_residente_id   uuid,
  p_mes_referencia text,
  p_itens          jsonb
) returns void
language plpgsql
as $$
declare
  v_item jsonb;
  v_med  text;
  v_qtd  numeric;
begin
  if p_mes_referencia !~ '^\d{4}-\d{2}$' then
    raise exception 'Mês de referência inválido (use AAAA-MM).';
  end if;
  if jsonb_typeof(p_itens) <> 'array' then
    raise exception 'Itens do provisionamento inválidos.';
  end if;
  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_med := btrim(coalesce(v_item->>'medicamento', ''));
    v_qtd := coalesce((v_item->>'quantidade_provisionada')::numeric, 0);
    if v_med = '' then
      raise exception 'Item sem medicamento.';
    end if;
    if v_qtd < 0 then
      raise exception 'Quantidade provisionada de % não pode ser negativa.', v_med;
    end if;
    insert into public.estoque_hospede
      (residente_id, medicamento, mes_referencia, quantidade_provisionada, quantidade_atual, unidade)
    values
      (p_residente_id, v_med, p_mes_referencia, v_qtd, v_qtd, coalesce(nullif(btrim(v_item->>'unidade'), ''), 'unidade'))
    on conflict (residente_id, medicamento, mes_referencia) do update
      set quantidade_provisionada = excluded.quantidade_provisionada,
          unidade                 = excluded.unidade;
    -- O saldo do item já existente é ajustado pelo trigger (delta do provisionado).
  end loop;
end $$;
comment on function public.provisionar_estoque_hospede is
  'Provisiona/ajusta o estoque do mês em lote. Item novo: saldo = provisionado; item existente: saldo += delta do provisionado.';
grant execute on function public.provisionar_estoque_hospede(uuid, text, jsonb) to authenticated;

-- ── 5 · Baixa de viagem atômica + estorno único ────────────────────────────
-- p_itens: [{ medicamento, quantidade, unidade }]. Sem p_permitir_negativo a
-- RPC recusa deixar saldo negativo (ou baixar item sem provisionamento);
-- a UI pede confirmação explícita e repete com true (como na dispensação).
create or replace function public.registrar_baixa_viagem(
  p_residente_id       uuid,
  p_mes_referencia     text,
  p_dias               int,
  p_data               date,
  p_itens              jsonb,
  p_observacao         text default null,
  p_permitir_negativo  boolean default false
) returns uuid
language plpgsql
as $$
declare
  v_id    uuid;
  v_item  jsonb;
  v_med   text;
  v_qtd   numeric;
  v_saldo numeric;
begin
  if p_dias is null or p_dias <= 0 then
    raise exception 'Dias da viagem deve ser maior que zero.';
  end if;
  if p_mes_referencia !~ '^\d{4}-\d{2}$' then
    raise exception 'Mês de referência inválido (use AAAA-MM).';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Nenhum item com quantidade para baixar.';
  end if;

  -- registrado_por: preenchido pela trigger trg_autoria_servidor (0134).
  insert into public.baixa_viagem (residente_id, mes_referencia, dias, data, itens, observacao)
  values (p_residente_id, p_mes_referencia, p_dias, coalesce(p_data, current_date), p_itens, nullif(btrim(p_observacao), ''))
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    v_med := v_item->>'medicamento';
    v_qtd := coalesce((v_item->>'quantidade')::numeric, 0);
    if v_qtd <= 0 then
      continue;
    end if;
    -- `q = q - x` no servidor: o UPDATE trava a linha; uma sessão concorrente
    -- espera e aplica a baixa sobre o saldo já debitado (sem lost update).
    update public.estoque_hospede
       set quantidade_atual = quantidade_atual - v_qtd
     where residente_id = p_residente_id
       and medicamento = v_med
       and mes_referencia = p_mes_referencia
     returning quantidade_atual into v_saldo;
    if not found then
      if not p_permitir_negativo then
        raise exception 'Sem provisionamento de % em % — confirme a baixa sem saldo.', v_med, p_mes_referencia;
      end if;
    elsif v_saldo < 0 and not p_permitir_negativo then
      raise exception 'Saldo insuficiente de %: ficaria em % após a baixa. Confirme a baixa com saldo negativo.', v_med, v_saldo;
    end if;
  end loop;

  return v_id;
end $$;
comment on function public.registrar_baixa_viagem is
  'Registra a baixa de viagem e debita o estoque do mês na mesma transação, com trava de linha. Recusa saldo negativo salvo p_permitir_negativo.';
grant execute on function public.registrar_baixa_viagem(uuid, text, int, date, jsonb, text, boolean) to authenticated;

create or replace function public.estornar_baixa_viagem(p_id uuid)
returns void
language plpgsql
as $$
declare
  v_rec  public.baixa_viagem%rowtype;
  v_item jsonb;
  v_nome text;
begin
  -- Trava a linha: dois estornos simultâneos não devolvem o saldo duas vezes.
  select * into v_rec from public.baixa_viagem where id = p_id for update;
  if not found then
    raise exception 'Baixa de viagem não encontrada.';
  end if;
  if v_rec.estornado then
    raise exception 'Esta baixa de viagem já foi estornada.';
  end if;

  select u.nome into v_nome from public.usuarios u where u.id = public.app_usuario_id();
  update public.baixa_viagem
     set estornado = true,
         estornado_por = coalesce(v_nome, 'Farmácia'),  -- trg_autoria_servidor confirma o nome
         estornado_em = now()
   where id = p_id;

  for v_item in select * from jsonb_array_elements(v_rec.itens) loop
    update public.estoque_hospede
       set quantidade_atual = quantidade_atual + coalesce((v_item->>'quantidade')::numeric, 0)
     where residente_id = v_rec.residente_id
       and medicamento = (v_item->>'medicamento')
       and mes_referencia = v_rec.mes_referencia;
  end loop;
end $$;
comment on function public.estornar_baixa_viagem is
  'Estorna a baixa de viagem (devolve o saldo ao estoque do mês) uma única vez; recusa estorno duplo.';
grant execute on function public.estornar_baixa_viagem(uuid) to authenticated;

-- ── Conferência ─────────────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.dispensar_medicamentos(uuid,text,date,jsonb,text)') is null
     or to_regprocedure('public.provisionar_estoque_hospede(uuid,text,jsonb)') is null
     or to_regprocedure('public.registrar_baixa_viagem(uuid,text,int,date,jsonb,text,boolean)') is null
     or to_regprocedure('public.estornar_baixa_viagem(uuid)') is null then
    raise exception '0139: RPCs da farmácia não foram criadas.';
  end if;
end $$;

-- Fim.

-- ===========================================================================
-- 0141 — MÓDULO OBRA · Integridade do caixa, pagamentos e prazos.
-- ---------------------------------------------------------------------------
-- Fecha os achados OBR-02, OBR-03 e OBR-04 (docs/production-readiness):
--  a) NF pelo BRUTO com retenções destacadas: obra_notas_fiscais ganha
--     retencao_contratual (os 5% das medições cobertas — calculado no
--     servidor, nunca pelo cliente). Líquido pago = valor − retencoes (guias)
--     − retencao_contratual. As liberações de retenção (TRP/TRD) passam a
--     poder entrar no caixa (origem 'retencao', origem_id = linha do ledger).
--     Notas JÁ PAGAS não são recalculadas (o histórico do caixa fica como está).
--  b) obra_pagar_nota: paga TODOS os itens da NF ou nenhum (uma transação),
--     recusa item já pago, é idempotente (p_idempotencia) e grava a data
--     informada (dia de São Paulo, nunca futura).
--  c) obra_pagar_medicao / obra_pagar_marco recebem p_data_pagamento (padrão:
--     hoje em America/Sao_Paulo) — antes gravavam current_date em UTC.
--  d) Desfazer pagamento de medição recusa se a fase já liberou retenção
--     (TRP/TRD) e nunca deixa o ledger negativo.
--  e) Status da fase não regride de trp_emitido/trd_emitido por edição livre:
--     só pela RPC obra_reabrir_fase (motivo obrigatório, ledger realinhado,
--     rastro na auditoria).
--  f) Prazo contratual × operacional: avanço 100% lançado pela construtora
--     fica "aceite_pendente" até master/direção aceitar (obra_aceitar_conclusao).
--     A multa passa a ser calculada no app contra a linha de base.
-- Idempotente. Rode após a 0140.
-- ===========================================================================

-- Dia corrente no fuso da casa (as RPCs de pagamento usam como padrão).
create or replace function public.obra_hoje_sp()
returns date language sql stable as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;

-- ── a · NF pelo bruto: retenção contratual calculada no servidor ────────────
alter table public.obra_notas_fiscais
  add column if not exists retencao_contratual numeric not null default 0 check (retencao_contratual >= 0),
  add column if not exists idempotencia uuid;
create unique index if not exists uq_obra_nf_idempotencia on public.obra_notas_fiscais (idempotencia)
  where idempotencia is not null;
comment on column public.obra_notas_fiscais.retencao_contratual is
  'Retenção contratual (5%) das medições cobertas — calculada por trigger. Líquido a pagar = valor − retencoes − retencao_contratual.';
comment on column public.obra_notas_fiscais.idempotencia is
  'Chave do pagamento (obra_pagar_nota): repetir a mesma chave numa NF já paga é no-op; chave diferente é recusada.';

create or replace function public.fn_obra_nf_retencao_contratual()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select coalesce(sum(m.retencao_valor), 0) into new.retencao_contratual
    from jsonb_array_elements(coalesce(new.itens, '[]'::jsonb)) i
    join public.obra_medicoes m on m.id::text = i->>'id'
   where i->>'tipo' = 'medicao';
  return new;
end $$;
drop trigger if exists trg_obra_nf_retencao_contratual on public.obra_notas_fiscais;
create trigger trg_obra_nf_retencao_contratual before insert or update of itens on public.obra_notas_fiscais
  for each row execute function public.fn_obra_nf_retencao_contratual();

-- Só as notas ainda NÃO pagas recebem o valor agora (as pagas ficam como estão).
update public.obra_notas_fiscais n
   set retencao_contratual = coalesce((
     select sum(m.retencao_valor)
       from jsonb_array_elements(coalesce(n.itens, '[]'::jsonb)) i
       join public.obra_medicoes m on m.id::text = i->>'id'
      where i->>'tipo' = 'medicao'), 0)
 where n.status = 'emitida';

-- Caixa: liberação de retenção (TRP/TRD) é saída para a construtora.
alter table public.fc_lancamentos drop constraint if exists fc_lancamentos_origem_check;
alter table public.fc_lancamentos add constraint fc_lancamentos_origem_check
  check (origem in ('planilha','manual','marco','medicao','oc','indireto','nf','nf_retencao','retencao'));

-- ── f (parte 1) · aceite pendente (obra_pagar_marco abaixo já zera a flag) ──
alter table public.obra_disciplinas
  add column if not exists aceite_pendente boolean not null default false;
comment on column public.obra_disciplinas.aceite_pendente is
  'Construtora apontou 100% de avanço; vira Concluído só quando master/direção aceitar (obra_aceitar_conclusao).';

-- ── c · Pagar medição / marco com data informada (São Paulo, não futura) ────
drop function if exists public.obra_pagar_medicao(uuid);
create or replace function public.obra_pagar_medicao(
  p_medicao_id      uuid,
  p_data_pagamento  date default (now() at time zone 'America/Sao_Paulo')::date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m       public.obra_medicoes%rowtype;
  n_docs  int;
begin
  if public.app_perfil() not in ('master','direcao') then
    raise exception 'Perfil não autorizado a aprovar pagamentos.';
  end if;
  if p_data_pagamento is null then
    raise exception 'Informe a data do pagamento.';
  end if;
  if p_data_pagamento > public.obra_hoje_sp() then
    raise exception 'A data do pagamento não pode ser futura (%).', to_char(p_data_pagamento, 'DD/MM/YYYY');
  end if;

  select * into m from public.obra_medicoes where id = p_medicao_id for update;
  if not found then raise exception 'Medição não encontrada.'; end if;
  if m.status = 'Pago' then
    raise exception 'A medição de % já está paga (em %).', m.mes, to_char(m.data_pagamento, 'DD/MM/YYYY');
  end if;
  if m.status <> 'Aprovado' then
    raise exception 'A medição precisa estar Aprovada antes do pagamento (status atual: %).', m.status;
  end if;
  if coalesce(m.nf_url, '') = '' then
    raise exception 'Anexe a NF da medição antes de aprovar o pagamento.';
  end if;

  -- GATE: os 4 documentos mensais do mês da medição.
  select count(distinct tipo) into n_docs
  from public.obra_documentos_mensais where mes = m.mes;
  if n_docs < 4 then
    raise exception 'Faltam documentos do mês % (INSS, FGTS, ISS e folha) — % de 4 anexados.', m.mes, n_docs;
  end if;

  -- GATE (hardening): NC aberta em etapa desta medição bloqueia o pagamento.
  if exists (
    select 1
    from public.obra_medicao_etapas me
    join public.obra_nao_conformidades nc on nc.etapa_id = me.etapa_id
    where me.medicao_id = p_medicao_id and nc.status <> 'encerrada'
  ) then
    raise exception 'Há não-conformidade aberta em etapa desta medição — encerre a NC antes de pagar.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('obra_ledger:' || m.fase_id::text, 0));
  update public.obra_medicoes
     set status = 'Pago', data_pagamento = p_data_pagamento
   where id = p_medicao_id;
  insert into public.obra_retencoes_ledger (fase_id, medicao_id, tipo, valor, observacao, registrado_por)
  values (m.fase_id, m.id, 'retido', m.retencao_valor,
          'Retenção 5% da medição ' || m.mes, public.app_perfil());
end;
$$;
grant execute on function public.obra_pagar_medicao(uuid, date) to authenticated;

drop function if exists public.obra_pagar_marco(uuid);
create or replace function public.obra_pagar_marco(
  p_marco_id        uuid,
  p_data_pagamento  date default (now() at time zone 'America/Sao_Paulo')::date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mk record;
  d  record;
  n_marcos int;
  n_pagos  int;
begin
  if public.app_perfil() not in ('master','direcao') then
    raise exception 'Perfil não autorizado a pagar marcos de projeto.';
  end if;
  if p_data_pagamento is null then
    raise exception 'Informe a data do pagamento.';
  end if;
  if p_data_pagamento > public.obra_hoje_sp() then
    raise exception 'A data do pagamento não pode ser futura (%).', to_char(p_data_pagamento, 'DD/MM/YYYY');
  end if;
  select * into mk from public.obra_disciplina_marcos where id = p_marco_id for update;
  if not found then raise exception 'Marco não encontrado.'; end if;
  select * into d from public.obra_disciplinas where id = mk.disciplina_id;

  if mk.status = 'Pago' then
    raise exception 'O marco "%" já está pago (em %).', mk.rotulo, to_char(mk.data_pagamento, 'DD/MM/YYYY');
  end if;
  if mk.status <> 'Aprovado' then
    raise exception 'O marco precisa estar Aprovado antes do pagamento (status: %).', mk.status;
  end if;
  if mk.exige_entrega and coalesce(d.art_url, '') = '' then
    raise exception 'Anexe a ART da disciplina "%" antes de pagar este marco de entrega.', d.nome;
  end if;
  if mk.chave = 'retido' and not exists (
    select 1 from public.obra_bim_rodadas where final and coalesce(ifc_url,'') <> ''
  ) then
    raise exception 'O valor retido só é liberado após a compatibilização final do BIM (rodada final com IFC).';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('obra_marco:' || d.id::text, 0));
  update public.obra_disciplina_marcos
     set status = 'Pago', data_pagamento = p_data_pagamento
   where id = p_marco_id;

  select count(*), count(*) filter (where status = 'Pago')
    into n_marcos, n_pagos
  from public.obra_disciplina_marcos where disciplina_id = d.id;
  if n_marcos = n_pagos then
    update public.obra_disciplinas
       set status = 'Concluído', data_conclusao = coalesce(data_conclusao, p_data_pagamento),
           aceite_pendente = false
     where id = d.id;
  end if;
end;
$$;
grant execute on function public.obra_pagar_marco(uuid, date) to authenticated;

-- ── b · Pagar NF: tudo ou nada, idempotente, item já pago recusado ──────────
create or replace function public.obra_pagar_nota(
  p_nota          uuid,
  p_data          date,
  p_idempotencia  uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n       public.obra_notas_fiscais%rowtype;
  i       jsonb;
  v_id    uuid;
  v_tipo  text;
  v_rot   text;
  v_st    text;
  v_nome  text;
begin
  if public.app_perfil() not in ('master','direcao') then
    raise exception 'Perfil não autorizado a pagar notas fiscais.';
  end if;
  if p_idempotencia is null then
    raise exception 'Chave de idempotência obrigatória.';
  end if;
  if p_data is null then
    raise exception 'Informe a data do pagamento.';
  end if;
  if p_data > public.obra_hoje_sp() then
    raise exception 'A data do pagamento não pode ser futura (%).', to_char(p_data, 'DD/MM/YYYY');
  end if;

  select * into n from public.obra_notas_fiscais where id = p_nota for update;
  if not found then raise exception 'Nota fiscal não encontrada.'; end if;

  -- Idempotência: a MESMA chave numa nota já paga é repetição (no-op);
  -- chave diferente é uma segunda tentativa de pagar — recusada.
  if n.status = 'paga' then
    if n.idempotencia = p_idempotencia then return; end if;
    raise exception 'A NF % já está paga (em %).', n.numero, to_char(n.data_pagamento, 'DD/MM/YYYY');
  end if;
  if exists (select 1 from public.obra_notas_fiscais where idempotencia = p_idempotencia and id <> p_nota) then
    raise exception 'Chave de pagamento já usada em outra nota.';
  end if;
  if jsonb_array_length(coalesce(n.itens, '[]'::jsonb)) = 0 then
    raise exception 'A NF % não cobre nenhum item.', n.numero;
  end if;

  -- 1ª passada: nenhum item pode já estar pago (em outra NF ou direto).
  for i in select * from jsonb_array_elements(n.itens) loop
    v_id := (i->>'id')::uuid; v_tipo := i->>'tipo'; v_rot := coalesce(i->>'rotulo', v_id::text);
    if v_tipo = 'marco' then
      select status into v_st from public.obra_disciplina_marcos where id = v_id;
    elsif v_tipo = 'medicao' then
      select status into v_st from public.obra_medicoes where id = v_id;
    else
      raise exception 'Item de tipo desconhecido na NF: %.', v_tipo;
    end if;
    if v_st is null then
      raise exception 'Item "%" não existe mais — corrija a nota antes de pagar.', v_rot;
    end if;
    if v_st = 'Pago' then
      raise exception 'Item "%" já está pago (em outra nota ou diretamente) — a NF % não pode ser paga.', v_rot, n.numero;
    end if;
  end loop;

  -- 2ª passada: paga cada item pelas RPCs com gate. Qualquer erro desfaz tudo.
  for i in select * from jsonb_array_elements(n.itens) loop
    v_id := (i->>'id')::uuid; v_tipo := i->>'tipo'; v_rot := coalesce(i->>'rotulo', v_id::text);
    begin
      if v_tipo = 'marco' then
        perform public.obra_pagar_marco(v_id, p_data);
      else
        -- O gate da medição exige a NF nela — espelha a nota.
        update public.obra_medicoes
           set nf_numero = n.numero, nf_url = coalesce(n.arquivo_url, nf_url)
         where id = v_id;
        perform public.obra_pagar_medicao(v_id, p_data);
      end if;
    exception when others then
      raise exception '%: %', v_rot, sqlerrm;
    end;
  end loop;

  select nome into v_nome from public.usuarios where id = public.app_usuario_id();
  update public.obra_notas_fiscais
     set status = 'paga', data_pagamento = p_data,
         pago_por = coalesce(v_nome, public.app_perfil()),
         idempotencia = p_idempotencia
   where id = p_nota;
end;
$$;
grant execute on function public.obra_pagar_nota(uuid, date, uuid) to authenticated;
comment on function public.obra_pagar_nota is
  'Paga a NF da construtora: todos os itens (marcos/medições) ou nenhum; recusa item já pago; idempotente por chave; data em São Paulo, não futura.';

-- ── d · Desfazer pagamento de medição realinha o ledger ─────────────────────
create or replace function public.obra_desfazer_pagamento_medicao(p_medicao_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m      public.obra_medicoes%rowtype;
  saldo  numeric;
begin
  if public.app_perfil() not in ('master','direcao') then
    raise exception 'Sem permissão para desfazer pagamento.';
  end if;
  select * into m from public.obra_medicoes where id = p_medicao_id for update;
  if not found or m.status <> 'Pago' then
    raise exception 'Medição não está paga (nada a desfazer).';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('obra_ledger:' || m.fase_id::text, 0));
  -- A retenção desta medição já entrou na base do TRP/TRD: desfazer agora
  -- deixaria o ledger inconsistente (liberou-se dinheiro que deixa de existir).
  if exists (select 1 from public.obra_retencoes_ledger
             where fase_id = m.fase_id and tipo in ('liberado_trp','liberado_trd')) then
    raise exception 'A fase já liberou retenção (TRP/TRD) — reabra a fase antes de desfazer este pagamento.';
  end if;
  update public.obra_medicoes
     set status = 'Aprovado', data_pagamento = null
   where id = p_medicao_id;
  delete from public.obra_retencoes_ledger
   where medicao_id = p_medicao_id and tipo = 'retido';
  select coalesce(sum(case when tipo = 'retido' then valor else -valor end), 0) into saldo
    from public.obra_retencoes_ledger where fase_id = m.fase_id;
  if saldo < 0 then
    raise exception 'Desfazer deixaria a retenção da fase negativa (%). Operação recusada.', saldo;
  end if;
end;
$$;

-- ── e · Status da fase não regride por edição livre ─────────────────────────
create or replace function public.fn_obra_fases_guarda_status()
returns trigger language plpgsql set search_path = public as $$
declare
  v_ordem constant text[] := array['nao_iniciada','em_andamento','trp_emitido','trd_emitido'];
begin
  if array_position(v_ordem, old.status) >= 3
     and array_position(v_ordem, new.status) < array_position(v_ordem, old.status)
     and coalesce(current_setting('obra.transicao_rastreada', true), '') <> 'on' then
    raise exception 'A % já tem % — o status só volta pela ação "Reabrir fase" (com motivo).',
      old.nome, case when old.status = 'trd_emitido' then 'TRD emitido' else 'TRP emitido' end;
  end if;
  return new;
end $$;
drop trigger if exists trg_obra_fases_guarda_status on public.obra_fases;
create trigger trg_obra_fases_guarda_status before update of status on public.obra_fases
  for each row execute function public.fn_obra_fases_guarda_status();

create or replace function public.obra_reabrir_fase(p_fase_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  f        public.obra_fases%rowtype;
  v_tipo   text;
  v_ids    uuid[];
  v_novo   text;
begin
  if public.app_perfil() not in ('master','direcao') then
    raise exception 'Perfil não autorizado a reabrir fase.';
  end if;
  if length(coalesce(btrim(p_motivo), '')) < 5 then
    raise exception 'Informe o motivo da reabertura (mínimo 5 caracteres).';
  end if;
  select * into f from public.obra_fases where id = p_fase_id for update;
  if not found then raise exception 'Fase não encontrada.'; end if;
  if f.status not in ('trp_emitido','trd_emitido') then
    raise exception 'A fase não tem TRP/TRD emitido (status: %).', f.status;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('obra_ledger:' || p_fase_id::text, 0));
  if f.status = 'trd_emitido' then v_tipo := 'liberado_trd'; v_novo := 'trp_emitido';
  else v_tipo := 'liberado_trp'; v_novo := 'em_andamento'; end if;

  -- Estorna a liberação (o ledger volta ao estado anterior) e tira do caixa.
  select array_agg(id) into v_ids from public.obra_retencoes_ledger
   where fase_id = p_fase_id and tipo = v_tipo;
  if v_ids is not null then
    delete from public.fc_lancamentos where origem = 'retencao' and origem_id = any(v_ids);
    delete from public.obra_retencoes_ledger where id = any(v_ids);
  end if;

  perform set_config('obra.transicao_rastreada', 'on', true);
  update public.obra_fases
     set status = v_novo,
         data_trd = case when f.status = 'trd_emitido' then null else data_trd end,
         data_trp = case when f.status = 'trp_emitido' then null else data_trp end
   where id = p_fase_id;
  perform set_config('obra.transicao_rastreada', '', true);

  -- Rastro explícito (além dos triggers de auditoria): quem, quando, por quê.
  insert into public.obra_audit_log (tabela, registro_id, acao, antes, depois, usuario, perfil)
  values ('obra_fases', p_fase_id::text, 'REABRIR',
          jsonb_build_object('status', f.status, 'data_trp', f.data_trp, 'data_trd', f.data_trd,
                             'liberacoes_estornadas', coalesce(array_length(v_ids, 1), 0)),
          jsonb_build_object('status', v_novo, 'motivo', btrim(p_motivo)),
          auth.jwt() ->> 'email', public.app_perfil());
end;
$$;
grant execute on function public.obra_reabrir_fase(uuid, text) to authenticated;

-- ── f (parte 2) · Avanço 100% da construtora aguarda aceite ─────────────────
create or replace function public.obra_planejar_atividade(
  p_id             uuid,
  p_data_base      date    default null,
  p_prazo_dias     int     default null,
  p_predecessora   uuid    default null,
  p_recursos       text    default null,
  p_progresso      int     default null,
  p_limpar_pred    boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil  text := public.app_perfil();
  v_atual   record;
  v_cursor  uuid;
  v_saltos  int := 0;
  v_prest   boolean;
  v_hoje    date := public.obra_hoje_sp();
begin
  if v_perfil not in ('master','direcao','obra_prestador') then
    raise exception 'Perfil sem permissão para planejar atividades.';
  end if;
  v_prest := (v_perfil = 'obra_prestador');

  select * into v_atual from public.obra_disciplinas where id = p_id;
  if not found then raise exception 'Atividade não encontrada.'; end if;

  if p_predecessora is not null then
    if p_predecessora = p_id then
      raise exception 'Uma atividade não pode ser predecessora de si mesma.';
    end if;
    v_cursor := p_predecessora;
    while v_cursor is not null and v_saltos < 100 loop
      if v_cursor = p_id then
        raise exception 'Amarração circular: esta atividade já depende da escolhida.';
      end if;
      select predecessora_id into v_cursor from public.obra_disciplinas where id = v_cursor;
      v_saltos := v_saltos + 1;
    end loop;
  end if;

  -- Prazo OPERACIONAL (data_base/prazo_dias) é dos dois lados; a LINHA DE BASE
  -- (contratual, base da multa) não é tocada aqui — só master/direção redefine.
  update public.obra_disciplinas
     set data_base       = coalesce(p_data_base, data_base),
         prazo_dias      = coalesce(p_prazo_dias, prazo_dias),
         predecessora_id = case when p_limpar_pred then null
                                else coalesce(p_predecessora, predecessora_id) end,
         recursos        = coalesce(nullif(btrim(p_recursos), ''), recursos),
         progresso_pct   = coalesce(least(100, greatest(0, p_progresso)), progresso_pct),
         -- 100% do Contratante conclui; 100% da construtora só pede o aceite.
         status          = case
                             when p_progresso is null then status
                             when p_progresso >= 100 and status = 'Pago' then status
                             when p_progresso >= 100 and v_prest then status
                             when p_progresso >= 100 then 'Concluído'
                             when status = 'Concluído' then 'Aprovado'
                             else status
                           end,
         aceite_pendente = case
                             when p_progresso is null then aceite_pendente
                             when p_progresso >= 100 and v_prest and status not in ('Concluído','Pago') then true
                             else false
                           end,
         data_conclusao  = case
                             when p_progresso is null then data_conclusao
                             when p_progresso >= 100 and v_prest then data_conclusao
                             when p_progresso >= 100 then coalesce(data_conclusao, v_hoje)
                             else null
                           end
   where id = p_id;

  if p_progresso is not null and p_progresso is distinct from v_atual.progresso_pct then
    insert into public.obra_disciplina_progresso (disciplina_id, progresso_pct, observacao, registrado_por)
    values (p_id, least(100, greatest(0, p_progresso)),
            case
              when v_prest and p_progresso >= 100 then 'Apontado pela construtora — aguardando aceite do Contratante'
              when v_prest then 'Apontado pela construtora'
              else null
            end,
            null);
  end if;
end;
$$;

create or replace function public.obra_aceitar_conclusao(
  p_id      uuid,
  p_aceitar boolean,
  p_motivo  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d        record;
  v_volta  numeric;
begin
  if public.app_perfil() not in ('master','direcao') then
    raise exception 'Só master/direção aceitam a conclusão de uma atividade.';
  end if;
  select * into d from public.obra_disciplinas where id = p_id for update;
  if not found then raise exception 'Atividade não encontrada.'; end if;
  if not d.aceite_pendente then
    raise exception 'A atividade "%" não tem aceite pendente.', d.nome;
  end if;

  if p_aceitar then
    update public.obra_disciplinas
       set status = case when status = 'Pago' then status else 'Concluído' end,
           data_conclusao = coalesce(data_conclusao, public.obra_hoje_sp()),
           progresso_pct = 100,
           aceite_pendente = false
     where id = p_id;
    insert into public.obra_disciplina_progresso (disciplina_id, progresso_pct, observacao)
    values (p_id, 100, 'Conclusão aceita pelo Contratante' ||
                       case when nullif(btrim(p_motivo), '') is not null then ': ' || btrim(p_motivo) else '' end);
  else
    if length(coalesce(btrim(p_motivo), '')) < 5 then
      raise exception 'Informe o motivo da recusa (mínimo 5 caracteres).';
    end if;
    -- Volta ao último avanço abaixo de 100% apontado (ou 90%, se não houver).
    select progresso_pct into v_volta from public.obra_disciplina_progresso
     where disciplina_id = p_id and progresso_pct < 100
     order by registrado_em desc limit 1;
    v_volta := coalesce(v_volta, 90);
    update public.obra_disciplinas
       set progresso_pct = v_volta, aceite_pendente = false,
           status = case when status = 'Concluído' then 'Aprovado' else status end,
           data_conclusao = null
     where id = p_id;
    insert into public.obra_disciplina_progresso (disciplina_id, progresso_pct, observacao)
    values (p_id, v_volta, 'Conclusão recusada pelo Contratante: ' || btrim(p_motivo));
  end if;
end;
$$;
grant execute on function public.obra_aceitar_conclusao(uuid, boolean, text) to authenticated;

-- Fim.

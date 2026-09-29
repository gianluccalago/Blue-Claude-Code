-- ===========================================================================
-- 0146 — TAREFAS PERIÓDICAS (a cada N dias).
-- ---------------------------------------------------------------------------
-- Algumas tarefas não são diárias: aferir pressão a cada 15 dias, por
-- exemplo. Nova coluna em plano_cuidado_item e modelo_rotina_item:
--   intervalo_dias  NULL → todo dia (como sempre foi);
--                   N    → a cada N dias (2 a 365).
-- E em plano_cuidado_item:
--   inicio_em       data a partir da qual a tarefa vale (padrão: hoje).
--
-- A tarefa entra SOZINHA no checklist do plantão no dia em que vence e fica
-- lá até ser feita. A próxima vez conta a partir do dia em que foi feita de
-- fato: pressão aferida no dia 03 com intervalo de 15 → volta no dia 18; se
-- atrasar e for aferida no dia 05, volta no dia 20. Nada é gerado em lote no
-- banco — o vencimento sai do último registro (tarefa_registro).
--
-- A RPC aplicar_modelo_rotina passa a copiar intervalo_dias e a considerá-lo
-- na deduplicação. Idempotente. Rode após a 0145.
-- ===========================================================================

alter table public.plano_cuidado_item
  add column if not exists intervalo_dias integer
  check (intervalo_dias is null or intervalo_dias between 2 and 365);
alter table public.plano_cuidado_item
  add column if not exists inicio_em date not null default current_date;
alter table public.modelo_rotina_item
  add column if not exists intervalo_dias integer
  check (intervalo_dias is null or intervalo_dias between 2 and 365);

comment on column public.plano_cuidado_item.intervalo_dias is
  'NULL = todo dia. N = a cada N dias, contados a partir da última execução (ou de inicio_em, se nunca feita).';
comment on column public.plano_cuidado_item.inicio_em is
  'Data a partir da qual a tarefa vale (base do 1º vencimento de tarefa periódica).';
comment on column public.modelo_rotina_item.intervalo_dias is
  'NULL = todo dia. N = a cada N dias (copiado ao plano ao aplicar o modelo).';

-- Última execução de um item: busca por (tarefa, data).
create index if not exists idx_tarefa_registro_tarefa_data on public.tarefa_registro (tarefa, data desc);

-- ── RPC: aplicar modelo copiando turno_livre e intervalo_dias ───────────────
create or replace function public.aplicar_modelo_rotina(
  p_modelo uuid, p_residentes uuid[], p_idempotencia uuid
) returns table (inseridas integer, existentes integer)
language plpgsql security definer set search_path = public as $$
declare
  v_res uuid;
  v_ids uuid[];
  v_ins integer := 0;
  v_exi integer := 0;
  v_n integer;
  v_total integer;
  v_prev record;
begin
  if coalesce(public.app_perfil(), '') not in ('master','coordenacao') then
    raise exception 'Somente a Coordenação (ou Master) aplica modelo de rotina.' using errcode = '42501';
  end if;
  if p_idempotencia is null then
    raise exception 'Chave de idempotência obrigatória.';
  end if;

  -- Retentativa: a mesma chave devolve o resultado gravado, sem tocar no plano.
  select a.inseridas, a.existentes into v_prev
    from public.plano_aplicacao_modelo a where a.idempotencia = p_idempotencia;
  if found then
    inseridas := v_prev.inseridas; existentes := v_prev.existentes; return next; return;
  end if;

  if not exists (select 1 from public.modelo_rotina m where m.id = p_modelo and m.ativo) then
    raise exception 'Modelo de rotina inexistente ou inativo.';
  end if;

  select array_agg(distinct r) into v_ids from unnest(p_residentes) r where r is not null;
  if v_ids is null or array_length(v_ids, 1) = 0 then
    raise exception 'Informe ao menos um hóspede.';
  end if;
  if (select count(*) from public.residentes r where r.id = any(v_ids)) <> array_length(v_ids, 1) then
    raise exception 'Hóspede inexistente na lista.';
  end if;

  select count(*) into v_total from (
    select distinct mi.tarefa, mi.horario, mi.turno_livre, mi.intervalo_dias, mi.responsavel
      from public.modelo_rotina_item mi where mi.modelo_id = p_modelo) d;

  foreach v_res in array v_ids loop
    perform pg_advisory_xact_lock(hashtext('plano_cuidado_item:' || v_res::text));

    with modelo as (
      select distinct on (mi.tarefa, mi.horario, mi.turno_livre, mi.intervalo_dias, mi.responsavel)
             mi.tarefa, mi.horario, mi.turno_livre, mi.intervalo_dias, mi.responsavel, mi.tolerancia_minutos
        from public.modelo_rotina_item mi where mi.modelo_id = p_modelo
       order by mi.tarefa, mi.horario, mi.turno_livre, mi.intervalo_dias, mi.responsavel, mi.tolerancia_minutos
    ),
    novas as (
      select m.* from modelo m
       where not exists (
         select 1 from public.plano_cuidado_item p
          where p.residente_id = v_res and p.ativa
            and p.tarefa = m.tarefa
            and p.horario is not distinct from m.horario
            and p.turno_livre is not distinct from m.turno_livre
            and p.intervalo_dias is not distinct from m.intervalo_dias
            and p.responsavel is not distinct from m.responsavel)
    ),
    ins as (
      insert into public.plano_cuidado_item (residente_id, tarefa, horario, turno_livre, intervalo_dias, responsavel, tolerancia_minutos, ativa)
      select v_res, n.tarefa, n.horario, n.turno_livre, n.intervalo_dias, n.responsavel, n.tolerancia_minutos, true from novas n
      returning 1
    )
    select count(*) into v_n from ins;
    v_ins := v_ins + v_n;
    v_exi := v_exi + (v_total - v_n);
  end loop;

  insert into public.plano_aplicacao_modelo (idempotencia, modelo_id, residentes, inseridas, existentes, aplicado_por)
  values (p_idempotencia, p_modelo, v_ids, v_ins, v_exi, public.app_usuario_id());

  inseridas := v_ins; existentes := v_exi; return next;
end $$;
comment on function public.aplicar_modelo_rotina(uuid, uuid[], uuid) is
  'Copia ao plano dos hóspedes só as tarefas do modelo que ainda não existem ativas (tarefa+horário+turno_livre+intervalo+responsável). Idempotente pela chave.';
revoke all on function public.aplicar_modelo_rotina(uuid, uuid[], uuid) from public, anon;
grant execute on function public.aplicar_modelo_rotina(uuid, uuid[], uuid) to authenticated;

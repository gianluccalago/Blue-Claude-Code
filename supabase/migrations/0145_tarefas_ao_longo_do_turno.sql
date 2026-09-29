-- ===========================================================================
-- 0145 — TAREFAS "AO LONGO DO TURNO" (sem horário fixo).
-- ---------------------------------------------------------------------------
-- Tarefas como o banho não têm hora marcada: devem ser feitas em QUALQUER
-- momento do plantão de 12h. Até aqui todo item do plano exigia um horário
-- (e ficava "em atraso" depois dele + tolerância).
--
-- Nova coluna em plano_cuidado_item e modelo_rotina_item:
--   turno_livre  NULL      → tarefa com horário fixo (como sempre foi);
--                'diurno'  → a qualquer momento do plantão diurno (07h–19h);
--                'noturno' → a qualquer momento do plantão noturno (19h–07h);
--                'ambos'   → em todo plantão, diurno e noturno.
-- Regra: item com turno_livre não tem horário (check). A cuidadora marca
-- como feito a qualquer momento do turno; o registro (tarefa_registro) guarda
-- quem fez e quando (feito_por/feito_em, autoria gravada pelo servidor desde a
-- 0134). A tarefa nunca fica "em atraso" dentro do turno; na última hora do
-- plantão, se ainda não foi feita, o checklist avisa "turno terminando".
--
-- A RPC aplicar_modelo_rotina passa a copiar turno_livre e a considerá-lo na
-- deduplicação (tarefa + horário + turno_livre + responsável).
-- Idempotente. Rode após a 0144.
-- ===========================================================================

alter table public.plano_cuidado_item
  add column if not exists turno_livre text
  check (turno_livre in ('diurno','noturno','ambos'));
alter table public.modelo_rotina_item
  add column if not exists turno_livre text
  check (turno_livre in ('diurno','noturno','ambos'));

comment on column public.plano_cuidado_item.turno_livre is
  'Sem horário fixo: pode ser feita a qualquer momento do plantão indicado (diurno|noturno|ambos). NULL = tarefa com horário.';
comment on column public.modelo_rotina_item.turno_livre is
  'Sem horário fixo: pode ser feita a qualquer momento do plantão indicado (diurno|noturno|ambos). NULL = tarefa com horário.';

-- Tarefa ao longo do turno não carrega horário (evita ficar "em atraso").
alter table public.plano_cuidado_item drop constraint if exists plano_cuidado_item_turno_livre_sem_horario;
alter table public.plano_cuidado_item add constraint plano_cuidado_item_turno_livre_sem_horario
  check (turno_livre is null or horario is null);
alter table public.modelo_rotina_item drop constraint if exists modelo_rotina_item_turno_livre_sem_horario;
alter table public.modelo_rotina_item add constraint modelo_rotina_item_turno_livre_sem_horario
  check (turno_livre is null or horario is null);

-- ── RPC: aplicar modelo copiando turno_livre ────────────────────────────────
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
    select distinct mi.tarefa, mi.horario, mi.turno_livre, mi.responsavel
      from public.modelo_rotina_item mi where mi.modelo_id = p_modelo) d;

  foreach v_res in array v_ids loop
    perform pg_advisory_xact_lock(hashtext('plano_cuidado_item:' || v_res::text));

    with modelo as (
      select distinct on (mi.tarefa, mi.horario, mi.turno_livre, mi.responsavel)
             mi.tarefa, mi.horario, mi.turno_livre, mi.responsavel, mi.tolerancia_minutos
        from public.modelo_rotina_item mi where mi.modelo_id = p_modelo
       order by mi.tarefa, mi.horario, mi.turno_livre, mi.responsavel, mi.tolerancia_minutos
    ),
    novas as (
      select m.* from modelo m
       where not exists (
         select 1 from public.plano_cuidado_item p
          where p.residente_id = v_res and p.ativa
            and p.tarefa = m.tarefa
            and p.horario is not distinct from m.horario
            and p.turno_livre is not distinct from m.turno_livre
            and p.responsavel is not distinct from m.responsavel)
    ),
    ins as (
      insert into public.plano_cuidado_item (residente_id, tarefa, horario, turno_livre, responsavel, tolerancia_minutos, ativa)
      select v_res, n.tarefa, n.horario, n.turno_livre, n.responsavel, n.tolerancia_minutos, true from novas n
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
  'Copia ao plano dos hóspedes só as tarefas do modelo que ainda não existem ativas (tarefa+horário+turno_livre+responsável). Idempotente pela chave.';
revoke all on function public.aplicar_modelo_rotina(uuid, uuid[], uuid) from public, anon;
grant execute on function public.aplicar_modelo_rotina(uuid, uuid[], uuid) to authenticated;

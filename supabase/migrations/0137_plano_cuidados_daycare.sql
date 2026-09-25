-- ===========================================================================
-- 0137 — PLANO DE CUIDADO: APLICAR MODELO SEM DUPLICAR + HISTÓRICO INTACTO.
-- ---------------------------------------------------------------------------
-- a) CLI-06 · Aplicar um modelo de rotina duas vezes duplicava TODAS as
--    tarefas do plano (o cliente copiava os itens com INSERT cego). Agora a
--    RPC aplicar_modelo_rotina(p_modelo, p_residentes[], p_idempotencia):
--      · roda numa única transação, com trava por hóspede (sem corrida entre
--        duas coordenadoras clicando ao mesmo tempo);
--      · insere SÓ as tarefas do modelo que ainda não existem ATIVAS no plano
--        do hóspede — a tarefa é a mesma quando tarefa + horário + responsável
--        coincidem (NULLs iguais entre si);
--      · devolve quantas entraram e quantas já existiam;
--      · p_idempotencia: o mesmo uuid, reenviado (retentativa de rede, duplo
--        clique), devolve o resultado da 1ª chamada sem tocar no plano. A
--        chave fica em plano_aplicacao_modelo, que também serve de rastro
--        ("quem aplicou qual modelo a quem, quando").
--    Só Master/Coordenação executam (mesmo alcance da policy de escrita em
--    plano_cuidado_item). Modelo inativo/inexistente e hóspede inexistente
--    são recusados.
-- b) HISTÓRICO · tarefa_registro guarda em `tarefa` o ID do item do plano (ou
--    texto livre, para "Aceitação …" e sob demanda) e em `horario` o horário
--    DA ÉPOCA. O texto da tarefa é lido pelo id. Para que registros antigos
--    continuem apontando para o texto certo:
--      · o texto (tarefa), o responsável e o hóspede de um item NUNCA mudam
--        in-place (o app só edita horário/tolerância; para trocar o texto,
--        desativa-se o item e cria-se outro);
--      · um item com registro de execução não pode ser apagado fisicamente
--        (a remoção pelo app já era lógica: ativa=false).
--    Editar horário/tolerância continua in-place: o registro já leva o seu
--    próprio `horario`, e a tolerância só é regra de cálculo de atraso.
-- Idempotente. Rode após a 0134.
-- ===========================================================================

-- ── a · Rastro/idempotência das aplicações de modelo ────────────────────────
create table if not exists public.plano_aplicacao_modelo (
  idempotencia  uuid primary key,
  modelo_id     uuid not null references public.modelo_rotina(id) on delete cascade,
  residentes    uuid[] not null,
  inseridas     integer not null default 0,
  existentes    integer not null default 0,
  aplicado_por  uuid,
  aplicado_em   timestamptz not null default now()
);
comment on table public.plano_aplicacao_modelo is
  'Cada chamada de aplicar_modelo_rotina: chave de idempotência + resultado. Só a RPC escreve.';
alter table public.plano_aplicacao_modelo enable row level security;
drop policy if exists plano_aplicacao_modelo_sel on public.plano_aplicacao_modelo;
create policy plano_aplicacao_modelo_sel on public.plano_aplicacao_modelo
  for select to authenticated
  using (public.app_perfil() in ('master','coordenacao'));
-- Sem policy de escrita: INSERT só pela função (security definer).

-- ── a · RPC ─────────────────────────────────────────────────────────────────
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
  if public.app_perfil() not in ('master','coordenacao') then
    raise exception 'Somente a Coordenação (ou Master) aplica modelo de rotina.' using errcode = '42501';
  end if;
  if p_idempotencia is null then
    raise exception 'Chave de idempotência obrigatória.';
  end if;

  -- Retentativa da mesma operação: devolve o que já foi feito, sem repetir.
  select a.inseridas, a.existentes into v_prev
    from public.plano_aplicacao_modelo a where a.idempotencia = p_idempotencia;
  if found then
    inseridas := v_prev.inseridas; existentes := v_prev.existentes; return next; return;
  end if;

  if not exists (select 1 from public.modelo_rotina m where m.id = p_modelo and m.ativo) then
    raise exception 'Modelo de rotina inexistente ou inativo.';
  end if;

  -- Hóspedes distintos, sem NULL, todos existentes.
  select array_agg(distinct r) into v_ids from unnest(p_residentes) r where r is not null;
  if v_ids is null or array_length(v_ids, 1) = 0 then
    raise exception 'Informe ao menos um hóspede.';
  end if;
  if (select count(*) from public.residentes r where r.id = any(v_ids)) <> array_length(v_ids, 1) then
    raise exception 'Hóspede inexistente na lista.';
  end if;

  -- Tarefas distintas do modelo (um modelo com item repetido conta uma vez).
  select count(*) into v_total from (
    select distinct mi.tarefa, mi.horario, mi.responsavel
      from public.modelo_rotina_item mi where mi.modelo_id = p_modelo) d;

  foreach v_res in array v_ids loop
    -- Trava por hóspede até o fim da transação: duas aplicações simultâneas
    -- ao mesmo plano ficam em fila e a segunda enxerga o que a primeira inseriu.
    perform pg_advisory_xact_lock(hashtext('plano_cuidado_item:' || v_res::text));

    with modelo as (
      select distinct on (mi.tarefa, mi.horario, mi.responsavel)
             mi.tarefa, mi.horario, mi.responsavel, mi.tolerancia_minutos
        from public.modelo_rotina_item mi where mi.modelo_id = p_modelo
       order by mi.tarefa, mi.horario, mi.responsavel, mi.tolerancia_minutos
    ),
    novas as (
      select m.* from modelo m
       where not exists (
         select 1 from public.plano_cuidado_item p
          where p.residente_id = v_res and p.ativa
            and p.tarefa = m.tarefa
            and p.horario is not distinct from m.horario
            and p.responsavel is not distinct from m.responsavel)
    ),
    ins as (
      insert into public.plano_cuidado_item (residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa)
      select v_res, n.tarefa, n.horario, n.responsavel, n.tolerancia_minutos, true from novas n
      returning 1
    )
    select count(*) into v_n from ins;
    v_ins := v_ins + v_n;
    v_exi := v_exi + (v_total - v_n);  -- as demais já estavam ativas no plano
  end loop;

  insert into public.plano_aplicacao_modelo (idempotencia, modelo_id, residentes, inseridas, existentes, aplicado_por)
  values (p_idempotencia, p_modelo, v_ids, v_ins, v_exi, public.app_usuario_id());

  inseridas := v_ins; existentes := v_exi; return next;
end $$;
comment on function public.aplicar_modelo_rotina(uuid, uuid[], uuid) is
  'Copia ao plano dos hóspedes só as tarefas do modelo que ainda não existem ativas (tarefa+horário+responsável). Idempotente pela chave.';
revoke all on function public.aplicar_modelo_rotina(uuid, uuid[], uuid) from public, anon;
grant execute on function public.aplicar_modelo_rotina(uuid, uuid[], uuid) to authenticated;

-- ── b · Histórico do plano intacto ──────────────────────────────────────────
create or replace function public.fn_plano_item_guarda_historico()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.residente_id <> old.residente_id
       or new.tarefa <> old.tarefa
       or new.responsavel is distinct from old.responsavel then
      raise exception 'Tarefa, responsável e hóspede de um item do plano não mudam: desative o item e crie outro (os registros antigos apontam para ele).';
    end if;
    return new;
  end if;
  -- DELETE: item já executado alguma vez fica (a remoção do app é ativa=false).
  if exists (select 1 from public.tarefa_registro r where r.tarefa = old.id::text) then
    raise exception 'Este item do plano tem registros de execução; não se apaga. Use a remoção lógica (ativa=false).';
  end if;
  return old;
end $$;
drop trigger if exists trg_plano_item_guarda_historico on public.plano_cuidado_item;
create trigger trg_plano_item_guarda_historico
  before update or delete on public.plano_cuidado_item
  for each row execute function public.fn_plano_item_guarda_historico();

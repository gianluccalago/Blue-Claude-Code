-- ===========================================================================
-- 0143 — ROTAÇÃO SEMANAL DE CUIDADORAS (Cobertura Assistencial).
-- ---------------------------------------------------------------------------
-- O app calcula, por semana, um grupo de hóspedes por cuidadora (mesmo andar,
-- girando toda semana — regra em src/lib/rotacaoCuidado.ts) e grava a
-- designação do turno por esta RPC. O que a Coordenação designa À MÃO
-- prevalece: a rotação só substitui as próprias linhas (origem = 'rotacao')
-- e nunca toca num hóspede que já tem designação manual no turno.
-- Idempotente. Rode após a 0142.
-- ===========================================================================

alter table public.designacao_cuidado
  add column if not exists origem text not null default 'manual';
alter table public.designacao_cuidado drop constraint if exists designacao_cuidado_origem_check;
alter table public.designacao_cuidado add constraint designacao_cuidado_origem_check
  check (origem in ('manual','rotacao'));
comment on column public.designacao_cuidado.origem is
  'manual = designada pela Coordenação/enfermagem; rotacao = gerada pela rotação semanal (pode ser substituída pela rotação; a manual não).';

create or replace function public.aplicar_rotacao_cuidado(
  p_data  date,
  p_turno text,
  p_itens jsonb            -- [{"residente_id": uuid, "cuidador_id": uuid}, ...]
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_removidas int; v_inseridas int; v_manuais int;
begin
  if coalesce(public.app_perfil(), '') not in ('master','direcao','coordenacao','enfermagem') then
    raise exception 'Perfil sem permissão para aplicar a rotação de cuidadoras.';
  end if;
  if p_turno not in ('diurno','noturno') then raise exception 'Turno inválido.'; end if;
  perform pg_advisory_xact_lock(hashtext('rotacao:' || p_data::text || ':' || p_turno));

  -- Sai só o que a rotação gerou antes para este turno.
  delete from public.designacao_cuidado
   where data = p_data and turno = p_turno and origem = 'rotacao';
  get diagnostics v_removidas = row_count;

  -- Entra o plano, exceto hóspedes que já têm designação manual no turno.
  with itens as (
    select (i->>'residente_id')::uuid as residente_id, (i->>'cuidador_id')::uuid as cuidador_id
      from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) i
  ), manuais as (
    select distinct residente_id from public.designacao_cuidado
     where data = p_data and turno = p_turno and origem = 'manual'
  ), ins as (
    insert into public.designacao_cuidado (residente_id, cuidador_id, data, turno, origem)
    select i.residente_id, i.cuidador_id, p_data, p_turno, 'rotacao'
      from itens i
     where i.residente_id not in (select residente_id from manuais)
       and exists (select 1 from public.residentes r where r.id = i.residente_id and r.status_hospede = 'ativo')
       and exists (select 1 from public.usuarios u where u.id = i.cuidador_id and u.ativo)
    on conflict (residente_id, cuidador_id, data, turno) do nothing
    returning 1
  )
  select count(*) into v_inseridas from ins;
  select count(distinct residente_id) into v_manuais from public.designacao_cuidado
   where data = p_data and turno = p_turno and origem = 'manual';

  return jsonb_build_object('removidas', v_removidas, 'inseridas', v_inseridas, 'manuais_mantidas', v_manuais);
end $$;
revoke execute on function public.aplicar_rotacao_cuidado(date, text, jsonb) from public, anon;
grant execute on function public.aplicar_rotacao_cuidado(date, text, jsonb) to authenticated;

-- Fim.

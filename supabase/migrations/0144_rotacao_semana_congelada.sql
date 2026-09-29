-- ===========================================================================
-- 0144 — ROTAÇÃO SEMANAL CONGELADA (trocas, faltas e substitutas).
-- ---------------------------------------------------------------------------
-- O plano da semana (quem cuida de quem) fica GRAVADO no primeiro uso, por
-- turno. Assim uma troca na escala no meio da semana não reembaralha os
-- grupos de quem não faltou: a titular presente mantém o grupo; quem entra
-- na escala sem estar no plano é SUBSTITUTA e herda o grupo de uma titular
-- ausente naquele dia. "Recalcular semana" substitui o plano gravado.
-- Idempotente. Rode após a 0143.
-- ===========================================================================

create table if not exists public.rotacao_semana (
  semana      date not null,                       -- segunda-feira
  turno       text not null check (turno in ('diurno','noturno')),
  plano       jsonb not null,                      -- [{cuidador_id, modulo, andar, residente_ids[]}]
  gerado_por  text,
  gerado_em   timestamptz not null default now(),
  primary key (semana, turno)
);
comment on table public.rotacao_semana is
  'Plano semanal de rotação de cuidadoras congelado no primeiro uso (por turno). Titulares mantêm o grupo; substitutas herdam o grupo de quem faltou.';
alter table public.rotacao_semana enable row level security;
drop policy if exists rotacao_semana_sel on public.rotacao_semana;
create policy rotacao_semana_sel on public.rotacao_semana for select to authenticated
  using (public.app_equipe_interna());
-- Escrita só pela RPC.

create or replace function public.congelar_rotacao_semana(
  p_semana date, p_turno text, p_plano jsonb, p_substituir boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_existente jsonb; v_nome text;
begin
  if coalesce(public.app_perfil(), '') not in ('master','direcao','coordenacao','enfermagem') then
    raise exception 'Perfil sem permissão para definir a rotação da semana.';
  end if;
  if p_turno not in ('diurno','noturno') then raise exception 'Turno inválido.'; end if;
  perform pg_advisory_xact_lock(hashtext('rotacao_semana:' || p_semana::text || ':' || p_turno));
  select plano into v_existente from public.rotacao_semana where semana = p_semana and turno = p_turno;
  if v_existente is not null and not p_substituir then
    return jsonb_build_object('plano', v_existente, 'novo', false);
  end if;
  select nome into v_nome from public.usuarios where id = public.app_usuario_id();
  insert into public.rotacao_semana (semana, turno, plano, gerado_por)
  values (p_semana, p_turno, coalesce(p_plano, '[]'::jsonb), v_nome)
  on conflict (semana, turno) do update set plano = excluded.plano, gerado_por = excluded.gerado_por, gerado_em = now();
  return jsonb_build_object('plano', coalesce(p_plano, '[]'::jsonb), 'novo', true);
end $$;
revoke execute on function public.congelar_rotacao_semana(date, text, jsonb, boolean) from public, anon;
grant execute on function public.congelar_rotacao_semana(date, text, jsonb, boolean) to authenticated;

-- Fim.

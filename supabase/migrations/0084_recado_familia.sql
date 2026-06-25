-- ===========================================================================
-- 0084 — Recado da equipe para a família (toque humano no Portal da Família).
-- ---------------------------------------------------------------------------
-- A Coordenação (e o Master) escrevem um recado/atualização carinhosa para a
-- família de um hóspede. A família vê em destaque no portal (mais recente +
-- histórico). NÃO é dado clínico cru — é comunicação humana e curada.
-- Idempotente. Rode DEPOIS da 0032 (app_residente_familia) e 0030 (app_perfil).
-- ===========================================================================

create table if not exists public.recado_familia (
  id            uuid primary key default gen_random_uuid(),
  residente_id  uuid not null references public.residentes(id) on delete cascade,
  mensagem      text not null,
  autor         text,
  criado_em     timestamptz not null default now()
);
comment on table public.recado_familia is
  'Recado/atualização da equipe (Coordenação/Master) para a família de um hóspede. Comunicação humana — sem dado clínico cru.';

create index if not exists idx_recado_residente on public.recado_familia (residente_id, criado_em desc);

-- RLS: a família lê só o do SEU residente vinculado; Coordenação/Master gerem.
alter table public.recado_familia enable row level security;

drop policy if exists recado_select on public.recado_familia;
create policy recado_select on public.recado_familia for select to authenticated using (
  public.app_perfil() in ('coordenacao','master')
  or (public.app_perfil() = 'familia' and residente_id = public.app_residente_familia())
);

drop policy if exists recado_write on public.recado_familia;
create policy recado_write on public.recado_familia for all to authenticated
  using (public.app_perfil() in ('coordenacao','master'))
  with check (public.app_perfil() in ('coordenacao','master'));

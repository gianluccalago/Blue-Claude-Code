-- ===========================================================================
-- 0057 — Pesquisa de NPS (satisfação), por hóspede
-- ---------------------------------------------------------------------------
-- Aplicada PELA EQUIPE (Coordenação, Multidisciplinar, Nutricionista) numa
-- conversa com o familiar ou o idoso; analisada SÓ por Master e Administração.
--
-- nps_pesquisa: a aplicação (quem conduziu, quando, sobre qual residente).
-- nps_resposta: as 8 dimensões, cada uma com nota 0-10 e comentário opcional.
--
-- RLS: aplicadores INSEREM mas NÃO LEEM o consolidado; só Master/Administração
-- fazem SELECT. O insert não usa RETURNING (id gerado no cliente), então os
-- aplicadores não precisam de SELECT; o FK de nps_resposta é validado pelo
-- sistema (não passa pela RLS). Idempotente.
-- ===========================================================================

create table if not exists public.nps_pesquisa (
  id               uuid primary key default gen_random_uuid(),
  residente_id     uuid not null references residentes(id) on delete cascade,
  respondente      text not null check (respondente in ('familiar','idoso')),
  aplicada_por     text,
  perfil_aplicador text,
  data             timestamptz not null default now(),
  observacao_geral text
);

create table if not exists public.nps_resposta (
  id          uuid primary key default gen_random_uuid(),
  pesquisa_id uuid not null references public.nps_pesquisa(id) on delete cascade,
  dimensao    text not null,
  nota        int  not null check (nota between 0 and 10),
  comentario  text
);

create index if not exists nps_pesquisa_residente_idx on public.nps_pesquisa (residente_id);
create index if not exists nps_pesquisa_data_idx      on public.nps_pesquisa (data);
create index if not exists nps_resposta_pesquisa_idx  on public.nps_resposta (pesquisa_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table public.nps_pesquisa enable row level security;
alter table public.nps_resposta enable row level security;

drop policy if exists nps_pesquisa_insert on public.nps_pesquisa;
drop policy if exists nps_pesquisa_select on public.nps_pesquisa;
drop policy if exists nps_resposta_insert on public.nps_resposta;
drop policy if exists nps_resposta_select on public.nps_resposta;

-- APLICAM (insert): Coordenação, Multidisciplinar, Nutricionista (+ gestão).
create policy nps_pesquisa_insert on public.nps_pesquisa for insert to authenticated
  with check (public.app_perfil() in ('coordenacao','multidisciplinar','nutricionista','master','administracao'));
create policy nps_resposta_insert on public.nps_resposta for insert to authenticated
  with check (public.app_perfil() in ('coordenacao','multidisciplinar','nutricionista','master','administracao'));

-- ANALISAM (select): apenas Master e Administração. Os aplicadores NÃO veem o
-- consolidado.
create policy nps_pesquisa_select on public.nps_pesquisa for select to authenticated
  using (public.app_perfil() in ('master','administracao'));
create policy nps_resposta_select on public.nps_resposta for select to authenticated
  using (public.app_perfil() in ('master','administracao'));

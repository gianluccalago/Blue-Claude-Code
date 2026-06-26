-- ===========================================================================
-- 0087 — VIGILÂNCIA SANITÁRIA · Controle de vacinação dos residentes
-- ---------------------------------------------------------------------------
-- RDC 502/2021 Art. 39: comprovar a vacinação obrigatória dos residentes (PNI).
-- Carteira vacinal digitalizada (foto/PDF) por hóspede, com histórico de
-- versões; o RT acompanha a cobertura e as pendências.
--
-- DADO DE SAÚDE → bucket PRIVADO (carteiras-vacinais) + URL assinada; acesso
-- restrito a Coordenação/Médico/Master. NUNCA exposto à família.
-- Idempotente. Rode DEPOIS da 0030 (app_perfil) e da 0001 (residentes).
-- ===========================================================================

-- 1) Carteira vacinal (anexo) — múltiplas versões por residente (histórico).
create table if not exists public.carteira_vacinal (
  id              uuid primary key default gen_random_uuid(),
  residente_id    uuid not null references public.residentes(id) on delete cascade,
  arquivo_url     text not null,                 -- CAMINHO no bucket privado (não URL pública)
  data_upload     date not null default current_date,
  atualizada_em   date,                          -- data da última atualização da carteira
  observacao      text,
  registrado_por  text,
  criado_em       timestamptz not null default now()
);
comment on table public.carteira_vacinal is
  'RDC 502/2021 Art. 39: carteira vacinal digitalizada do residente (histórico de versões; o mais recente é o vigente). arquivo_url = caminho no bucket privado carteiras-vacinais.';
create index if not exists idx_carteira_residente on public.carteira_vacinal (residente_id, data_upload desc);

-- 2) Registro vacina a vacina (complemento opcional ao anexo).
create table if not exists public.vacina_registro (
  id              uuid primary key default gen_random_uuid(),
  residente_id    uuid not null references public.residentes(id) on delete cascade,
  vacina          text not null,
  data_aplicacao  date,
  dose            text,
  observacao      text,
  registrado_por  text,
  criado_em       timestamptz not null default now()
);
create index if not exists idx_vacina_residente on public.vacina_registro (residente_id);

-- 3) RLS das tabelas: Coordenação/Médico/Master leem e registram. Sem família.
alter table public.carteira_vacinal enable row level security;
drop policy if exists carteira_select on public.carteira_vacinal;
create policy carteira_select on public.carteira_vacinal for select to authenticated
  using (public.app_perfil() in ('coordenacao','medico','master'));
drop policy if exists carteira_write on public.carteira_vacinal;
create policy carteira_write on public.carteira_vacinal for all to authenticated
  using (public.app_perfil() in ('coordenacao','medico','master'))
  with check (public.app_perfil() in ('coordenacao','medico','master'));

alter table public.vacina_registro enable row level security;
drop policy if exists vacina_select on public.vacina_registro;
create policy vacina_select on public.vacina_registro for select to authenticated
  using (public.app_perfil() in ('coordenacao','medico','master'));
drop policy if exists vacina_write on public.vacina_registro;
create policy vacina_write on public.vacina_registro for all to authenticated
  using (public.app_perfil() in ('coordenacao','medico','master'))
  with check (public.app_perfil() in ('coordenacao','medico','master'));

-- 4) Bucket PRIVADO + policies de storage (acesso só p/ esses perfis) ---------
insert into storage.buckets (id, name, public)
values ('carteiras-vacinais', 'carteiras-vacinais', false)
on conflict (id) do nothing;

drop policy if exists carteira_storage_select on storage.objects;
create policy carteira_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'carteiras-vacinais' and public.app_perfil() in ('coordenacao','medico','master'));

drop policy if exists carteira_storage_insert on storage.objects;
create policy carteira_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'carteiras-vacinais' and public.app_perfil() in ('coordenacao','medico','master'));

drop policy if exists carteira_storage_update on storage.objects;
create policy carteira_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'carteiras-vacinais' and public.app_perfil() in ('coordenacao','medico','master'));

drop policy if exists carteira_storage_delete on storage.objects;
create policy carteira_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'carteiras-vacinais' and public.app_perfil() in ('coordenacao','medico','master'));

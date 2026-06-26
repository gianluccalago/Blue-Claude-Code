-- ===========================================================================
-- 0088 — VIGILÂNCIA SANITÁRIA · Patologias/comorbidades + apoio ao Plano de
-- Atenção Integral à Saúde (RDC 502/2021, Art. 36-38).
-- ---------------------------------------------------------------------------
-- O app fornece os INSUMOS do plano (patologias por hóspede, prevalência,
-- recursos de saúde por residente) e guarda o DOCUMENTO do plano (do RT,
-- articulado com o gestor de saúde), com lembrete de revisão bienal (Art. 36) e
-- avaliação anual (Art. 38). Dado clínico — restrito a Coordenação/Médico/
-- Master; NÃO vai para a família. Idempotente. Rode DEPOIS da 0030/0001.
-- ===========================================================================

-- PARTE 1 — Patologias/comorbidades por hóspede.
create table if not exists public.patologia_residente (
  id              uuid primary key default gen_random_uuid(),
  residente_id    uuid not null references public.residentes(id) on delete cascade,
  descricao       text not null,
  cid_codigo      text,
  ativa           boolean not null default true,
  data_registro   date not null default current_date,
  registrado_por  text,
  observacao      text,
  criado_em       timestamptz not null default now()
);
comment on table public.patologia_residente is
  'RDC 502/2021 Art. 37: condições de saúde / comorbidades do residente. Insumo das patologias prevalentes. Dado clínico restrito (sem família).';
create index if not exists idx_patologia_residente on public.patologia_residente (residente_id);
create index if not exists idx_patologia_ativa on public.patologia_residente (ativa);

alter table public.patologia_residente enable row level security;
drop policy if exists patologia_select on public.patologia_residente;
create policy patologia_select on public.patologia_residente for select to authenticated
  using (public.app_perfil() in ('coordenacao','medico','master'));
drop policy if exists patologia_write on public.patologia_residente;
create policy patologia_write on public.patologia_residente for all to authenticated
  using (public.app_perfil() in ('coordenacao','medico','master'))
  with check (public.app_perfil() in ('coordenacao','medico','master'));

-- PARTE 2 — Documento do Plano de Atenção à Saúde (histórico de versões).
create table if not exists public.plano_atencao_saude (
  id                 uuid primary key default gen_random_uuid(),
  versao             text not null,
  elaborado_em       date not null default current_date,
  proxima_revisao    date,                 -- a cada 2 anos (Art. 36)
  avaliacao_anual_em date,                 -- avaliação anual (Art. 38)
  documento_url      text,                 -- caminho no bucket privado planos-saude
  observacao         text,
  registrado_por     text,
  criado_em          timestamptz not null default now()
);
comment on table public.plano_atencao_saude is
  'RDC 502/2021 Art. 36-38: documento do Plano de Atenção Integral à Saúde (versões). O app guarda/lembra; o plano é responsabilidade do RT.';
create index if not exists idx_plano_elaborado on public.plano_atencao_saude (elaborado_em desc);

alter table public.plano_atencao_saude enable row level security;
-- Leitura p/ a gestão clínica; gestão do documento é do RT/Master.
drop policy if exists plano_select on public.plano_atencao_saude;
create policy plano_select on public.plano_atencao_saude for select to authenticated
  using (public.app_perfil() in ('coordenacao','medico','master'));
drop policy if exists plano_write on public.plano_atencao_saude;
create policy plano_write on public.plano_atencao_saude for all to authenticated
  using (public.app_perfil() = 'master')
  with check (public.app_perfil() = 'master');

-- Bucket PRIVADO do anexo do plano + policies de storage.
insert into storage.buckets (id, name, public)
values ('planos-saude', 'planos-saude', false)
on conflict (id) do nothing;

drop policy if exists plano_storage_select on storage.objects;
create policy plano_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'planos-saude' and public.app_perfil() in ('coordenacao','medico','master'));
drop policy if exists plano_storage_insert on storage.objects;
create policy plano_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'planos-saude' and public.app_perfil() = 'master');
drop policy if exists plano_storage_update on storage.objects;
create policy plano_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'planos-saude' and public.app_perfil() = 'master');
drop policy if exists plano_storage_delete on storage.objects;
create policy plano_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'planos-saude' and public.app_perfil() = 'master');

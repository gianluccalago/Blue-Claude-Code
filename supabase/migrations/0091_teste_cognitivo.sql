-- ===========================================================================
-- 0091 — TESTES COGNITIVOS (MEEM e MoCA) — AVALIATIVOS. NÃO alteram o grau de
-- dependência (grau_dependencia segue só pelo IVCF). Aplicados pelo médico.
-- ---------------------------------------------------------------------------
-- DIREITOS AUTORAIS: o app NÃO reproduz estímulos protegidos (figuras, trail
-- making, etc.) nem versões "parecidas". O médico aplica no MATERIAL OFICIAL
-- (papel) e REGISTRA a pontuação aqui — o app é o prontuário do resultado.
-- Foto opcional (desenhos no papel) em bucket PRIVADO. Dado clínico — sem
-- família. Idempotente. Rode DEPOIS da 0030/0001.
-- ===========================================================================

create table if not exists public.teste_cognitivo (
  id                uuid primary key default gen_random_uuid(),
  residente_id      uuid not null references public.residentes(id) on delete cascade,
  tipo              text not null check (tipo in ('MEEM','MoCA')),
  respostas         jsonb not null,        -- pontos por item/seção (+ tentativas não pontuadas)
  pontuacao_total   int not null,
  escolaridade_anos int,
  interpretacao     text,
  foto_url          text,                  -- caminho no bucket privado testes-cognitivos
  aplicado_por      text,
  aplicado_em       timestamptz not null default now()
);
comment on table public.teste_cognitivo is
  'MEEM/MoCA — testes cognitivos AVALIATIVOS (não alteram grau_dependencia). Registro do resultado aplicado no material oficial. Restrito (sem família).';
create index if not exists idx_teste_cognitivo on public.teste_cognitivo (residente_id, aplicado_em desc);

alter table public.teste_cognitivo enable row level security;
drop policy if exists teste_cog_select on public.teste_cognitivo;
create policy teste_cog_select on public.teste_cognitivo for select to authenticated
  using (public.app_perfil() in ('medico','coordenacao','master'));
drop policy if exists teste_cog_write on public.teste_cognitivo;
create policy teste_cog_write on public.teste_cognitivo for all to authenticated
  using (public.app_perfil() in ('medico','master'))
  with check (public.app_perfil() in ('medico','master'));

-- Bucket PRIVADO das fotos + policies de storage.
insert into storage.buckets (id, name, public)
values ('testes-cognitivos', 'testes-cognitivos', false)
on conflict (id) do nothing;

drop policy if exists testecog_storage_select on storage.objects;
create policy testecog_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'testes-cognitivos' and public.app_perfil() in ('medico','coordenacao','master'));
drop policy if exists testecog_storage_insert on storage.objects;
create policy testecog_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'testes-cognitivos' and public.app_perfil() in ('medico','master'));
drop policy if exists testecog_storage_update on storage.objects;
create policy testecog_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'testes-cognitivos' and public.app_perfil() in ('medico','master'));
drop policy if exists testecog_storage_delete on storage.objects;
create policy testecog_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'testes-cognitivos' and public.app_perfil() in ('medico','master'));

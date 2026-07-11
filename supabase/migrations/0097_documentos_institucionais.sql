-- ===========================================================================
-- 0097 — DOCUMENTOS INSTITUCIONAIS DA ILPI ("Documentos da casa")
-- ---------------------------------------------------------------------------
-- Base legal: Lei Municipal 13.725/04, RDC 283/05 (hoje RDC 502/21) e
-- Portaria ANVISA 344/98. Compila os documentos indispensáveis da casa
-- (contrato social, CMVS, CRT, ASO/contratos, CEVS, limpeza de caixa d'água,
-- AVCB, contrato RSS, livro de admissão, regulamento interno, contrato de
-- prestação de serviços, alvará etc.) com upload do arquivo e validade.
--
-- Várias linhas por tipo = HISTÓRICO de versões (a vigente é a mais recente).
-- Bucket PRIVADO + URL assinada (padrão LGPD do app, como a 0087).
-- Acesso: Master, Administração e Direção.
-- Idempotente. Rode DEPOIS da 0030 (app_perfil).
-- ===========================================================================

create table if not exists public.documento_institucional (
  id              uuid primary key default gen_random_uuid(),
  -- Slug do checklist canônico (contrato_social, alvara, avcb, ...) — o front
  -- valida contra a lista; 'outro' cobre exigências extras da autoridade.
  tipo            text not null,
  nome            text not null,                 -- rótulo legível do documento
  identificador   text,                          -- nº do documento/protocolo
  orgao_emissor   text,
  data_emissao    date,
  data_validade   date,                          -- null = documento sem vencimento
  arquivo_url     text not null,                 -- CAMINHO no bucket privado (não URL pública)
  observacao      text,
  registrado_por  text,
  criado_em       timestamptz not null default now()
);
comment on table public.documento_institucional is
  'Documentos indispensáveis da ILPI (Lei 13.725/04, RDC 283/05→502/21). Histórico de versões por tipo; o vigente é o mais recente. arquivo_url = caminho no bucket privado documentos-institucionais.';
create index if not exists idx_docinst_tipo on public.documento_institucional (tipo, criado_em desc);

-- RLS: Master, Administração e Direção leem e registram.
alter table public.documento_institucional enable row level security;
drop policy if exists docinst_select on public.documento_institucional;
create policy docinst_select on public.documento_institucional for select to authenticated
  using (public.app_perfil() in ('master','administracao','direcao'));
drop policy if exists docinst_write on public.documento_institucional;
create policy docinst_write on public.documento_institucional for all to authenticated
  using (public.app_perfil() in ('master','administracao','direcao'))
  with check (public.app_perfil() in ('master','administracao','direcao'));

-- Bucket PRIVADO + policies de storage (mesmos perfis).
insert into storage.buckets (id, name, public)
values ('documentos-institucionais', 'documentos-institucionais', false)
on conflict (id) do nothing;

drop policy if exists docinst_storage_select on storage.objects;
create policy docinst_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'documentos-institucionais' and public.app_perfil() in ('master','administracao','direcao'));

drop policy if exists docinst_storage_insert on storage.objects;
create policy docinst_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos-institucionais' and public.app_perfil() in ('master','administracao','direcao'));

drop policy if exists docinst_storage_update on storage.objects;
create policy docinst_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'documentos-institucionais' and public.app_perfil() in ('master','administracao','direcao'));

drop policy if exists docinst_storage_delete on storage.objects;
create policy docinst_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'documentos-institucionais' and public.app_perfil() in ('master','administracao','direcao'));

-- Fim.

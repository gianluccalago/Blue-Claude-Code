-- ===========================================================================
-- 0118 — MÓDULO OBRA · DIÁRIO DE OBRA (RDO) compartilhado com a construtora.
-- ---------------------------------------------------------------------------
-- Pedido do engenheiro da TRÍADE — e peça CONTRATUAL: a prorrogação por chuva
-- impeditiva (cláusula 13.2) e a indenização por paralisação (6.4) dependem
-- de registro no Diário Eletrônico de Obras (10.1.2).
-- a) obra_diario vira um RDO de verdade: clima manhã/tarde, chuva impeditiva,
--    paralisação, efetivo em campo, atividades executadas e ocorrências —
--    além de VÁRIAS fotos por registro (tabela filha).
-- b) A construtora LÊ e REGISTRA (autor + perfil ficam gravados); edição/
--    exclusão continuam só master/direção. Auditoria em tudo.
-- c) Storage: pasta diario/ liberada para o prestador (ler + subir fotos).
-- Idempotente. Rode após a 0117.
-- ===========================================================================

-- ── a · RDO: novos campos ───────────────────────────────────────────────────
alter table public.obra_diario
  add column if not exists clima_manha text check (clima_manha in ('bom','nublado','chuva')),
  add column if not exists clima_tarde text check (clima_tarde in ('bom','nublado','chuva')),
  add column if not exists chuva_impeditiva boolean not null default false,
  add column if not exists paralisacao boolean not null default false,
  add column if not exists efetivo int check (efetivo >= 0),
  add column if not exists atividades text,
  add column if not exists perfil_registrador text;

comment on column public.obra_diario.chuva_impeditiva is
  'Cláusula 13.2: dia de chuva que IMPEDIU etapas sensíveis (estrutura, imperm., cobertura, externas) — base da prorrogação de prazo.';
comment on column public.obra_diario.paralisacao is
  'Cláusula 6.4: frente paralisada (ex.: falta de material do Contratante) — condição da indenização é o registro diário aqui.';

-- Fotos do registro (várias por dia).
create table if not exists public.obra_diario_foto (
  id          uuid primary key default gen_random_uuid(),
  registro_id uuid not null references public.obra_diario(id) on delete cascade,
  foto_url    text not null,                 -- bucket obra, pasta diario/
  criado_em   timestamptz not null default now()
);
create index if not exists idx_obra_diario_foto on public.obra_diario_foto (registro_id);

drop trigger if exists trg_audit_obra_diario_foto on public.obra_diario_foto;
create trigger trg_audit_obra_diario_foto
  after insert or update or delete on public.obra_diario_foto
  for each row execute function public.fn_obra_audit();

-- ── b · RLS: os dois lados leem e registram; só master/direção apaga ────────
drop policy if exists obra_diario_prestador_sel on public.obra_diario;
create policy obra_diario_prestador_sel on public.obra_diario for select to authenticated
  using (public.app_perfil() = 'obra_prestador');
drop policy if exists obra_diario_prestador_ins on public.obra_diario;
create policy obra_diario_prestador_ins on public.obra_diario for insert to authenticated
  with check (public.app_perfil() = 'obra_prestador');

alter table public.obra_diario_foto enable row level security;
drop policy if exists obra_diario_foto_sel on public.obra_diario_foto;
create policy obra_diario_foto_sel on public.obra_diario_foto for select to authenticated
  using (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_diario_foto_ins on public.obra_diario_foto;
create policy obra_diario_foto_ins on public.obra_diario_foto for insert to authenticated
  with check (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_diario_foto_del on public.obra_diario_foto;
create policy obra_diario_foto_del on public.obra_diario_foto for delete to authenticated
  using (public.app_perfil() in ('master','direcao'));

-- ── c · Storage: pasta diario/ para o prestador ─────────────────────────────
drop policy if exists obra_storage_select on storage.objects;
create policy obra_storage_select on storage.objects for select to authenticated
  using (
    bucket_id = 'obra' and (
      public.app_perfil() in ('master','direcao')
      or (
        public.app_perfil() = 'obra_prestador'
        and (storage.foldername(name))[1] in ('checklist','documentos','entregas','bim','nf','andamento','diario')
      )
    )
  );
drop policy if exists obra_storage_insert on storage.objects;
create policy obra_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'obra' and (
      public.app_perfil() in ('master','direcao')
      or (
        public.app_perfil() = 'obra_prestador'
        and (storage.foldername(name))[1] in ('documentos','entregas','bim','andamento','diario')
      )
    )
  );

-- Fim.

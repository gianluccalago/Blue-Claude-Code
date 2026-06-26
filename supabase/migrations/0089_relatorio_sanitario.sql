-- ===========================================================================
-- 0089 — VIGILÂNCIA SANITÁRIA · Relatório Sanitário extraído (trilha interna).
-- ---------------------------------------------------------------------------
-- Ao extrair o PDF, o sistema guarda os valores ORIGINAIS (calculados) e os
-- EXTRAÍDOS (auditados/editados pelo RT). É a trilha de auditoria INTERNA —
-- protege o RT (edição = revisão de boa-fé) e fica acessível só ao Master/RT.
-- NADA disso aparece no PDF. Idempotente.
-- ===========================================================================

create table if not exists public.relatorio_sanitario_extraido (
  id                uuid primary key default gen_random_uuid(),
  periodo_tipo      text not null,
  periodo_inicio    date not null,
  periodo_fim       date not null,
  valores_originais jsonb not null,
  valores_extraidos jsonb not null,
  houve_edicao      boolean not null default false,
  extraido_por      text,
  extraido_em       timestamptz not null default now(),
  hash              text
);
comment on table public.relatorio_sanitario_extraido is
  'Trilha INTERNA dos relatórios sanitários extraídos (original × editado pelo RT). Só Master/RT. Não aparece no PDF.';
create index if not exists idx_relsan_extraido on public.relatorio_sanitario_extraido (extraido_em desc);

alter table public.relatorio_sanitario_extraido enable row level security;
drop policy if exists relsan_select on public.relatorio_sanitario_extraido;
create policy relsan_select on public.relatorio_sanitario_extraido for select to authenticated
  using (public.app_perfil() = 'master');
drop policy if exists relsan_write on public.relatorio_sanitario_extraido;
create policy relsan_write on public.relatorio_sanitario_extraido for all to authenticated
  using (public.app_perfil() = 'master')
  with check (public.app_perfil() = 'master');

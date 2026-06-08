-- ============================================================================
-- Blue Senior Living — Migration 0006
-- Coordenação: tornar os ALERTAS DE ELIMINAÇÃO tratáveis (silenciar/escalar).
-- O alerta é uma condição contínua recalculada; "silenciar" oculta por 24h e
-- ele reaparece como reincidente se persistir. Não altera tabelas de origem.
--
-- COMO USAR:
--   Supabase > SQL Editor > New query > cole tudo > Run.
--   É seguro rodar mais de uma vez (idempotente) e NÃO apaga seus dados.
-- ============================================================================

create table if not exists eliminacao_tratamento (
  id uuid primary key default gen_random_uuid(),
  residente_id uuid not null references residentes(id) on delete cascade,
  tipo_alerta text not null check (tipo_alerta in ('urina','evacuacao')),
  acao text not null check (acao in ('silenciado','escalado_medico')),
  observacao text,
  tratado_por text,
  tratado_em timestamptz not null default now()
);

create index if not exists eliminacao_tratamento_ref_idx
  on eliminacao_tratamento (residente_id, tipo_alerta, tratado_em);

-- RLS (demo sem login) — mesma política liberada das demais tabelas.
alter table eliminacao_tratamento enable row level security;
drop policy if exists demo_all on eliminacao_tratamento;
create policy demo_all on eliminacao_tratamento
  for all to anon, authenticated using (true) with check (true);

-- Fim.

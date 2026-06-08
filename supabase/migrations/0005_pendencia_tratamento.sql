-- ============================================================================
-- Blue Senior Living — Migration 0005
-- Perfil Coordenação Assistencial (BLOCO 2): Painel da coordenação.
-- Cria pendencia_tratamento para marcar pendências como tratadas SEM alterar
-- as tabelas de origem (administracao, intercorrencia, etc).
--
-- COMO USAR:
--   Supabase > SQL Editor > New query > cole tudo > Run.
--   É seguro rodar mais de uma vez (idempotente) e NÃO apaga seus dados.
-- ============================================================================

create table if not exists pendencia_tratamento (
  id uuid primary key default gen_random_uuid(),
  tipo_origem text not null check (tipo_origem in ('medicacao','intercorrencia','eliminacao','tarefa')),
  referencia_id uuid not null,
  acao text not null check (acao in ('resolvido','escalado_medico')),
  tratado_por text,
  tratado_em timestamptz not null default now(),
  observacao text
);

create index if not exists pendencia_tratamento_ref_idx
  on pendencia_tratamento (tipo_origem, referencia_id);

-- RLS (demo sem login) — mesma política liberada das demais tabelas.
alter table pendencia_tratamento enable row level security;
drop policy if exists demo_all on pendencia_tratamento;
create policy demo_all on pendencia_tratamento
  for all to anon, authenticated using (true) with check (true);

-- Fim.

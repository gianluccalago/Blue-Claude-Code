-- 0036 — Trilha de auditoria de alterações financeiras (Bloco 4). Idempotente.
-- Registra QUEM mudou O QUÊ, DE→PARA e POR QUÊ em: mensalidade do residente,
-- tabela de preços, remuneração da equipe e valor final do pagamento pessoal
-- (e movimentações de rouparia). Sem policies de UPDATE/DELETE → imutável.

create table if not exists public.log_alteracao (
  id uuid primary key default gen_random_uuid(),
  tabela_origem text not null,
  registro_id text not null,
  campo text not null,
  valor_anterior text,
  valor_novo text,
  motivo text,
  alterado_por text not null,
  alterado_em timestamptz not null default now()
);

create index if not exists idx_log_alteracao_origem
  on public.log_alteracao (tabela_origem, registro_id, alterado_em desc);

alter table public.log_alteracao enable row level security;

drop policy if exists "log_alteracao_leitura" on public.log_alteracao;
create policy "log_alteracao_leitura"
  on public.log_alteracao for select to authenticated using (true);

drop policy if exists "log_alteracao_insercao" on public.log_alteracao;
create policy "log_alteracao_insercao"
  on public.log_alteracao for insert to authenticated with check (true);
-- (sem UPDATE/DELETE: a trilha é imutável por RLS)

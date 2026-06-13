-- ===========================================================================
-- 0054 — Configuração da casa: telefone do PLANTÃO (para a família)
-- ---------------------------------------------------------------------------
-- Tabela simples chave/valor. telefone_plantao = número FIXO do aparelho da
-- casa que fica com a enfermagem de plantão (passa de mão entre os plantões).
-- NÃO é celular pessoal de ninguém e não vem da escala. Placeholder editável
-- pelo Master/Administração. Família lê para exibir no portal. Idempotente.
-- ===========================================================================

create table if not exists public.configuracao (
  chave          text primary key,
  valor          text,
  atualizado_em  timestamptz not null default now(),
  atualizado_por text
);

insert into public.configuracao (chave, valor) values ('telefone_plantao', '(41) 0000-0000')
  on conflict (chave) do nothing;

alter table public.configuracao enable row level security;
drop policy if exists configuracao_select on public.configuracao;
drop policy if exists configuracao_write  on public.configuracao;

-- LEITURA: qualquer autenticado (a família precisa ver o telefone do plantão).
create policy configuracao_select on public.configuracao for select to authenticated
  using (true);

-- ESCRITA: Master e Administração.
create policy configuracao_write on public.configuracao for all to authenticated
  using (public.app_perfil() in ('master','administracao'))
  with check (public.app_perfil() in ('master','administracao'));

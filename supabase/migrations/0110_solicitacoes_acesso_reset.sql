-- ===========================================================================
-- 0110 — Solicitações públicas: "Esqueci minha senha" + "Solicitar acesso".
-- ---------------------------------------------------------------------------
-- Duas filas que um visitante NÃO autenticado cria (via RPC SECURITY DEFINER,
-- pois o anon não tem INSERT direto nas tabelas) e que o Master resolve:
--   A) solicitacao_reset_senha — o usuário pede reset; o Master zera a senha
--      (botão "Resetar p/ 'blue'" reusa a RPC admin_definir_senha da 0109).
--   B) solicitacao_acesso — visitante (familiar/colaborador) pede cadastro;
--      o Master aprova (cria o usuário) ou recusa.
-- Leitura/gestão: master apenas. Inserção: só pelas RPCs (anon-callable) — as
-- tabelas não têm policy de INSERT, então ninguém escreve fora do fluxo.
-- Idempotente. Rode após a 0109.
-- ===========================================================================

-- ── A · Fila de reset de senha ──────────────────────────────────────────────
create table if not exists public.solicitacao_reset_senha (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  status       text not null default 'pendente' check (status in ('pendente','atendido','descartado')),
  criado_em    timestamptz not null default now(),
  atendido_por text,
  atendido_em  timestamptz
);
create index if not exists idx_sol_reset_status on public.solicitacao_reset_senha (status, criado_em desc);

alter table public.solicitacao_reset_senha enable row level security;
drop policy if exists sol_reset_master_sel on public.solicitacao_reset_senha;
create policy sol_reset_master_sel on public.solicitacao_reset_senha for select to authenticated
  using (public.app_perfil() = 'master');
drop policy if exists sol_reset_master_upd on public.solicitacao_reset_senha;
create policy sol_reset_master_upd on public.solicitacao_reset_senha for update to authenticated
  using (public.app_perfil() = 'master')
  with check (public.app_perfil() = 'master');

-- ── B · Fila de solicitação de acesso ───────────────────────────────────────
create table if not exists public.solicitacao_acesso (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null check (tipo in ('familiar','colaborador')),
  nome           text not null,
  email          text not null,
  contato        text,
  cargo          text,                 -- colaborador: cargo pretendido
  residente_nome text,                 -- familiar: quem ele acompanha
  parentesco     text,                 -- familiar: parentesco
  observacao     text,
  status         text not null default 'pendente' check (status in ('pendente','aprovada','recusada')),
  motivo_recusa  text,
  criado_em      timestamptz not null default now(),
  revisado_por   text,
  revisado_em    timestamptz
);
create index if not exists idx_sol_acesso_status on public.solicitacao_acesso (status, criado_em desc);

alter table public.solicitacao_acesso enable row level security;
drop policy if exists sol_acesso_master_sel on public.solicitacao_acesso;
create policy sol_acesso_master_sel on public.solicitacao_acesso for select to authenticated
  using (public.app_perfil() = 'master');
drop policy if exists sol_acesso_master_upd on public.solicitacao_acesso;
create policy sol_acesso_master_upd on public.solicitacao_acesso for update to authenticated
  using (public.app_perfil() = 'master')
  with check (public.app_perfil() = 'master');

-- ── C · RPC pública: solicitar reset de senha ───────────────────────────────
-- Registra o pedido. Não revela se o e-mail existe (evita enumeração). Se já
-- houver um pendente para o mesmo e-mail, apenas renova o horário (sem duplicar).
create or replace function public.solicitar_reset_senha(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(p_email));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido.';
  end if;
  update public.solicitacao_reset_senha
    set criado_em = now()
    where lower(email) = v_email and status = 'pendente';
  if not found then
    insert into public.solicitacao_reset_senha (email) values (v_email);
  end if;
end $$;

-- ── D · RPC pública: solicitar acesso ───────────────────────────────────────
create or replace function public.solicitar_acesso(
  p_tipo text, p_nome text, p_email text, p_contato text,
  p_cargo text, p_residente_nome text, p_parentesco text, p_observacao text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(p_email));
begin
  if p_tipo not in ('familiar','colaborador') then
    raise exception 'Tipo inválido.';
  end if;
  if coalesce(btrim(p_nome), '') = '' then
    raise exception 'Informe o nome.';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido.';
  end if;
  if exists (select 1 from public.solicitacao_acesso
             where lower(email) = v_email and status = 'pendente') then
    raise exception 'Já existe uma solicitação pendente para este e-mail.';
  end if;
  insert into public.solicitacao_acesso
    (tipo, nome, email, contato, cargo, residente_nome, parentesco, observacao)
  values
    (p_tipo, btrim(p_nome), v_email, nullif(btrim(coalesce(p_contato,'')), ''),
     nullif(btrim(coalesce(p_cargo,'')), ''), nullif(btrim(coalesce(p_residente_nome,'')), ''),
     nullif(btrim(coalesce(p_parentesco,'')), ''), nullif(btrim(coalesce(p_observacao,'')), ''));
end $$;

-- Anon pode SOLICITAR (as RPCs validam e não expõem dados); ninguém lê as filas
-- sem ser Master (RLS acima).
revoke all on function public.solicitar_reset_senha(text) from public;
revoke all on function public.solicitar_acesso(text, text, text, text, text, text, text, text) from public;
grant execute on function public.solicitar_reset_senha(text) to anon, authenticated;
grant execute on function public.solicitar_acesso(text, text, text, text, text, text, text, text) to anon, authenticated;

-- Fim.

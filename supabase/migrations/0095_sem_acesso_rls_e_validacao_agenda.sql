-- ===========================================================================
-- 0095 — Auditoria: (a) reflete `sem_acesso` na RLS e (b) valida FORMATO do
-- agendamento anônimo (complementa os limites de tamanho da 0092).
-- ---------------------------------------------------------------------------
-- #4 — sem_acesso na RLS (defesa em profundidade): hoje o bloqueio de login de
--   usuários `sem_acesso=true` é só no cliente (AuthProvider). As funções de
--   identidade (app_perfil/app_usuario_id), usadas por TODAS as policies,
--   passam a IGNORAR usuários sem_acesso → eles não recebem perfil nem id e a
--   RLS os trata como anônimos (negado por padrão), mesmo com credencial válida.
--
-- #2 — validação de formato no insert anônimo (visita_agendamento): a chave
--   pública insere direto na API; além do tamanho (0092), garantimos e-mail com
--   cara de e-mail e WhatsApp com 8–15 dígitos. Formatos claramente inválidos
--   são rejeitados no banco (última linha de defesa; o front público valida antes).
--
-- Idempotente. Rode depois da 0073 (sem_acesso) e 0092.
-- ===========================================================================

-- (a) app_perfil / app_usuario_id ignoram usuários sem_acesso.
create or replace function public.app_perfil()
returns text language sql stable security definer set search_path = public as $$
  select u.perfil::text from public.usuarios u
  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and u.ativo and not coalesce(u.sem_acesso, false)
  order by u.id limit 1
$$;

create or replace function public.app_usuario_id()
returns uuid language sql stable security definer set search_path = public as $$
  select u.id from public.usuarios u
  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and u.ativo and not coalesce(u.sem_acesso, false)
  order by u.id limit 1
$$;

create or replace function public.app_residente_familia()
returns uuid language sql stable security definer set search_path = public as $$
  select u.residente_vinculado from public.usuarios u
  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and u.ativo and not coalesce(u.sem_acesso, false)
  order by u.id limit 1
$$;

-- (b) Formato do agendamento anônimo (além do tamanho da 0092).
do $$
begin
  if to_regclass('public.visita_agendamento') is not null then
    alter table public.visita_agendamento drop constraint if exists visita_agend_formato_chk;
    alter table public.visita_agendamento add constraint visita_agend_formato_chk check (
      -- e-mail: opcional, mas se vier precisa ter cara de e-mail
      (email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
      -- WhatsApp: 8 a 15 dígitos (após remover não-dígitos) — cobre DDD+numero+55
      and char_length(regexp_replace(whatsapp, '[^0-9]', '', 'g')) between 8 and 15
      -- nome: pelo menos 2 caracteres não-espaço
      and char_length(btrim(nome_completo)) >= 2
    );
  end if;
end $$;

-- Fim.

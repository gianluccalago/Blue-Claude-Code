-- ============================================================================
-- Blue Senior Living — Migration 0017
-- CORREÇÃO ROBUSTA do login + DIAGNÓSTICO.
--
-- Diferença para o 0016: a criação de cada usuário é tolerante a falhas e
-- IMPRIME mensagens (RAISE NOTICE). O insert em auth.identities (que varia
-- entre versões do Supabase e costuma derrubar o script inteiro) agora é
-- best-effort: se falhar, NÃO impede a criação do auth.users (que é o que o
-- login realmente exige).
--
-- COMO USAR:
--   Supabase > SQL Editor > New query > cole TUDO > Run.
--   Veja a aba de MENSAGENS/RESULTS: deve aparecer "Credenciais OK: N".
--   Se aparecer "FALHOU para <email>: <motivo>", me mande esse texto.
--
-- ⚠️ Senha "blue" é provisória de teste.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------- Master dono do sistema ----------
insert into public.usuarios (nome, email, perfil, ativo)
select 'Gianlucca Lago (Master)', 'gianluccalago@gmail.com', 'master', true
where not exists (
  select 1 from public.usuarios where lower(email) = 'gianluccalago@gmail.com'
);

-- ---------- Credenciais de login (robusto + diagnóstico) ----------
do $$
declare
  u record;
  uid uuid;
  ok int := 0;
begin
  for u in
    select * from public.usuarios
    where ativo and email is not null and btrim(email) <> ''
  loop
    begin
      -- limpa credencial anterior (idempotente; corrige estados parciais)
      delete from auth.identities i using auth.users au
        where au.id = i.user_id and lower(au.email) = lower(u.email);
      delete from auth.users where lower(email) = lower(u.email);

      uid := gen_random_uuid();

      -- auth.users com TODOS os campos de token = '' (evita erro de NULL no
      -- login do GoTrue). Este insert é o essencial para o login funcionar.
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at, last_sign_in_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change,
        email_change_token_new, email_change_token_current,
        phone_change, phone_change_token, reauthentication_token
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
        lower(u.email), crypt('blue', gen_salt('bf')),
        now(), now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
        '', '', '', '', '', '', '', ''
      );

      -- auth.identities é best-effort: tolera diferenças de versão do schema.
      begin
        insert into auth.identities (
          id, provider_id, user_id, identity_data, provider,
          created_at, updated_at, last_sign_in_at
        ) values (
          gen_random_uuid(), lower(u.email), uid,
          jsonb_build_object('sub', uid::text, 'email', lower(u.email), 'email_verified', true),
          'email', now(), now(), now()
        );
      exception when others then
        begin
          insert into auth.identities (
            provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at
          ) values (
            lower(u.email), uid,
            jsonb_build_object('sub', uid::text, 'email', lower(u.email), 'email_verified', true),
            'email', now(), now(), now()
          );
        exception when others then
          raise notice 'identity ignorada p/ % (%).', u.email, sqlerrm;
        end;
      end;

      ok := ok + 1;
    exception when others then
      raise notice 'FALHOU para %: %', u.email, sqlerrm;
    end;
  end loop;

  raise notice 'Credenciais OK: %', ok;
end $$;

-- ---------- Conferência: quem tem login? ----------
-- (Roda automaticamente e mostra a tabela no Results.)
select u.email,
       u.perfil,
       (au.id is not null) as tem_login
from public.usuarios u
left join auth.users au on lower(au.email) = lower(u.email)
where u.ativo
order by u.email;

-- Fim.
